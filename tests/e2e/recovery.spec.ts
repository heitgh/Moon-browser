// Nexus Inc. — corrupted profile must open an isolated recovery UI.
import { _electron as electron, expect, test, type ElectronApplication } from "@playwright/test";
import { mkdtemp, rm, writeFile, mkdir, copyFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

async function launch(directory: string, profileDirectory = directory): Promise<ElectronApplication> {
  return electron.launch({
    args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
    env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: profileDirectory }
  });
}

async function shellWindow(application: ElectronApplication) {
  await expect.poll(() => application.windows().some(page => /index\.html$/.test(page.url()))).toBe(true);
  const shell = application.windows().find(page => /index\.html$/.test(page.url()))!;
  await shell.waitForLoadState("load");
  return shell;
}

async function exitAfter(application: ElectronApplication, action: () => Promise<unknown>): Promise<void> {
  const child = application.process();
  let stderr = "";
  child.stderr?.on("data", chunk => { stderr += String(chunk); });
  if (child.exitCode !== null || child.signalCode !== null) {
    expect(child.exitCode, `Process already exited with signal ${child.signalCode}`).toBe(0);
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
  try {
    void action().catch(() => undefined);
    const code = await Promise.race([exited, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Recovery restart did not exit")), 12_000); })]);
    expect(code, `Signal ${child.signalCode}; stderr: ${stderr}`).toBe(0);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

test("shows profile recovery rather than exiting when SQLite cannot open", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-recovery-e2e-"));
  try {
    await writeFile(join(directory, "moon.sqlite3"), "corrupted database");
    const application = await electron.launch({
      args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
      env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
    });
    try {
      const recovery = application.windows()[0] ?? await application.firstWindow();
      await expect(recovery.locator("h1")).toHaveText("Recuperação de perfil");
      await expect(recovery.locator("#restore")).toBeDisabled();
      await expect(recovery.locator("#export")).toBeEnabled();
      await expect(recovery.locator("#fresh")).toBeEnabled();
      await expect(recovery.locator("#status")).toContainText("Nenhum backup íntegro");
    } finally { await application.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("restores selected backup through recovery UI and reopens the saved data", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-recovery-restore-"));
  // Model production: database directory is not Electron's live userData root.
  // Windows cannot rename the latter while Chromium holds its lock files.
  const profileDirectory = join(directory, "profile");
  const launchProfile = () => launch(directory, profileDirectory);
  let application: ElectronApplication | undefined;
  try {
    application = await launchProfile();
    const shell = await shellWindow(application);
    await expect(shell).toHaveURL(/index\.html$/);
    await shell.waitForLoadState("load");
    await shell.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.mutateProfileData({ type: "notes:save", content: "Recover this note" }));
    const healthy = application;
    await exitAfter(healthy, () => healthy.evaluate(({ app }) => { setImmediate(() => app.quit()); }));
    application = undefined;
    const backups = join(profileDirectory, "recovery-backups");
    await mkdir(backups);
    await copyFile(join(profileDirectory, "moon.sqlite3"), join(backups, "before-update-123-abcdef.sqlite3"));
    await writeFile(join(profileDirectory, "moon.sqlite3"), "damaged original");
    application = await launchProfile();
    const recovery = await application.firstWindow();
    await expect(recovery.locator("#restore")).toBeEnabled();
    // Test the same main-process confirmation path without an OS modal.
    await application.evaluate(({ app, dialog }) => {
      app.relaunch = () => undefined;
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await exitAfter(application, () => recovery.locator("#restore").click());
    application = undefined;
    const preserved = (await readdir(directory)).find(name => name.startsWith("profile.preserved-"));
    expect(await readFile(join(directory, preserved!, "moon.sqlite3"), "utf8")).toBe("damaged original");
    // The preserved original is intentionally outside the replacement directory.
    await rm(join(directory, preserved!), { recursive: true, force: true });
    application = await launchProfile();
    const reopened = await shellWindow(application);
    await expect(reopened).toHaveURL(/index\.html$/);
    await reopened.waitForLoadState("load");
    const notes = await reopened.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getProfileData().then(data => data.notes));
    expect(notes).toBe("Recover this note");
  } finally {
    if (application) {
      const child = application.process();
      if (child.exitCode === null && child.signalCode === null) { const app = application; await exitAfter(app, () => app.evaluate(({ app }) => { setImmediate(() => app.quit()); })); }
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("corrupt registry offers recovery and cannot invoke normal profile IPC", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-registry-ui-"));
  let application: ElectronApplication | undefined;
  try {
    await mkdir(join(directory, "profiles"));
    await writeFile(join(directory, "profiles", "index.json"), "invalid-json");
    application = await launch(directory);
    const recovery = await application.firstWindow();
    await expect(recovery.locator("h1")).toHaveText("Recuperação de perfil");
    expect(await recovery.evaluate(() => typeof (window as unknown as {moonBrowser?: unknown}).moonBrowser)).toBe("undefined");
    expect(await recovery.evaluate(() => Object.keys((window as unknown as {moonRecovery: object}).moonRecovery).sort())).toEqual(["export", "fresh", "list", "restore"]);
    expect(await readFile(join(directory, "profiles", "index.json"), "utf8")).toBe("invalid-json");
    await application.evaluate(({ app, dialog }) => {
      app.relaunch = () => undefined;
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await exitAfter(application, () => recovery.locator("#fresh").click());
    application = undefined;
    const registry = JSON.parse(await readFile(join(directory, "profiles", "index.json"), "utf8")) as {profiles: {id: string; default: boolean}[]};
    expect(registry.profiles.find(profile => profile.default)?.id).toMatch(/^profile-/);
    const oldIndex = (await readdir(join(directory, "profiles"))).find(name => name.startsWith("index.json.preserved-"));
    expect(await readFile(join(directory, "profiles", oldIndex!), "utf8")).toBe("invalid-json");
    application = await launch(directory);
    const shell = await shellWindow(application);
    await expect(shell).toHaveURL(/index\.html$/);
    await shell.waitForLoadState("load");
    expect(shell.url()).toMatch(/index\.html$/);
  } finally {
    if (application) { const app = application; await exitAfter(app, () => app.evaluate(({ app }) => { setImmediate(() => app.quit()); })); }
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
