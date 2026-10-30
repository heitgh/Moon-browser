import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

const nativeProcess = new WeakMap<ElectronApplication, ReturnType<ElectronApplication["process"]>>();
async function launch(directory: string) {
  const application = await electron.launch({args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
    env: {...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: join(directory, "profile")}});
  nativeProcess.set(application, application.process()); return application;
}
async function document(application: ElectronApplication, name: string): Promise<Page> {
  await expect.poll(() => application.windows().some(page => page.url().endsWith(`/${name}.html`)), {timeout: 15_000}).toBe(true);
  const page = application.windows().find(page => page.url().endsWith(`/${name}.html`))!; await page.waitForLoadState("load"); return page;
}
async function quit(application: ElectronApplication) {
  const child = nativeProcess.get(application)!;
  if (child.exitCode !== null || child.signalCode !== null) return;
  let stderr = ""; child.stderr?.on("data", chunk => { stderr += String(chunk); });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exit = new Promise<number | null>(resolve => child.once("exit", resolve));
  void application.evaluate(({app}) => { setImmediate(() => app.quit()); }).catch(() => undefined);
  try { expect(await Promise.race([exit, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Access test quit: " + stderr)), 12_000); })]), stderr).toBe(0); }
  finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
}
async function setup(directory: string) {
  const application = await launch(directory); const page = await document(application, "index");
  await application.evaluate(({dialog}) => { dialog.showMessageBox = async () => ({response: 1, checkboxChecked: false}); });
  const skip = page.getByLabel("Pular configuração inicial"); if (await skip.isVisible()) await skip.click();
  return {application, page};
}

test("security UI activates protection and startup exposes no profile data until the password is correct", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-protected-start-"));
  let application: ElectronApplication | undefined;
  try {
    const first = await setup(directory); application = first.application;
    await first.page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.mutateProfileData({type: "notes:save", content: "Protected note"}));
    await first.page.getByLabel("Gerenciar perfis", {exact: true}).click();
    await first.page.getByText("Segurança do perfil", {exact: true}).click();
    await first.page.getByLabel("Nova senha", {exact: true}).fill("secure-profile-password");
    await first.page.getByLabel("Confirmar nova senha", {exact: true}).fill("secure-profile-password");
    await first.page.getByRole("button", {name: "Ativar proteção", exact: true}).click();
    await expect(first.page.getByRole("button", {name: "Bloquear agora", exact: true})).toBeVisible();
    const securityFile = join(directory, "profile-access", "default.json");
    expect(await readFile(securityFile, "utf8")).not.toContain("secure-profile-password");
    await quit(application); application = undefined;
    application = await launch(directory);
    const gate = await document(application, "access");
    expect(application.windows().some(page => page.url().endsWith("/index.html"))).toBe(false);
    expect(await gate.evaluate(() => typeof (window as unknown as {moonBrowser?: unknown}).moonBrowser)).toBe("undefined");
    await expect(stat(join(directory, "profile", "moon.sqlite3-wal"))).rejects.toMatchObject({code: "ENOENT"});
    await gate.getByLabel("Senha do perfil").fill("incorrect-password");
    await gate.getByRole("button", {name: "Desbloquear", exact: true}).click();
    await expect(gate.getByRole("status")).toContainText("Senha incorreta");
    await expect.poll(async () => JSON.parse(await readFile(securityFile, "utf8")).retryAt <= Date.now()).toBe(true);
    await gate.getByLabel("Senha do perfil").fill("secure-profile-password");
    await gate.getByRole("button", {name: "Desbloquear", exact: true}).click().catch(error => { if (!gate.isClosed()) throw error; });
    const restored = await document(application, "index");
    expect(await restored.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getProfileData().then(data => data.notes))).toBe("Protected note");
  } finally { if (application) await quit(application); await rm(directory, {recursive: true, force: true, maxRetries: 12, retryDelay: 250}); }
});

test("manual and automatic locking protect the whole profile and a second launch cannot bypass the gate", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-profile-lock-"));
  let application: ElectronApplication | undefined;
  try {
    const first = await setup(directory); application = first.application;
    await first.page.evaluate(async () => {
      const bridge = (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser;
      await bridge.enableProfileAccess("secure-profile-password");
      await bridge.lockProfile();
    }).catch(error => { if (!first.page.isClosed()) throw error; });
    const gate = await document(application, "access");
    expect(application.windows().some(page => page.url().endsWith("/index.html"))).toBe(false);
    const binary = createRequire(import.meta.url)("electron") as string;
    await new Promise<void>((resolve, reject) => execFile(binary, [...(process.platform === "linux" ? ["--no-sandbox"] : []), ...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, ".", "https://example.test/should-not-open"], {
      cwd: process.cwd(), env: {...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: join(directory, "profile")}, timeout: 15_000
    }, error => error ? reject(error) : resolve()));
    expect(application.windows().some(page => page.url().endsWith("/index.html"))).toBe(false);
    await gate.getByLabel("Senha do perfil").fill("secure-profile-password");
    await gate.getByRole("button", {name: "Desbloquear", exact: true}).click().catch(error => { if (!gate.isClosed()) throw error; });
    const page = await document(application, "index");
    await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.configureProfileAccess("secure-profile-password", 1, false));
    await application.evaluate(({powerMonitor}) => { powerMonitor.getSystemIdleTime = () => 120; });
    const automatic = await document(application, "access");
    await expect(automatic.getByRole("heading", {name: "Perfil bloqueado"})).toBeVisible();
    expect(application.windows().some(page => page.url().endsWith("/index.html"))).toBe(false);
  } finally { if (application) await quit(application); await rm(directory, {recursive: true, force: true, maxRetries: 12, retryDelay: 250}); }
});
