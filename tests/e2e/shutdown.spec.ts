// Nexus Inc. — repeated real-process shutdown against the same SQLite profile.
import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

test("preserves committed notes across 30 native window-close and app.quit cycles", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-shutdown-cycles-"));
  try {
    for (let cycle = 0; cycle < 30; cycle++) {
      const application = await electron.launch({
        args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
        env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
      });
      const child = application.process();
      let stderr = ""; child.stderr?.on("data", chunk => { stderr += String(chunk); });
      try {
        await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
        const page = application.windows().find(page => page.url().endsWith("/index.html"))!;
        await page.waitForLoadState("load");
        const notes = await page.evaluate(async () => (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser.getProfileData().then(data => data.notes));
        expect(notes).toBe(cycle === 0 ? "" : `Committed cycle ${cycle - 1}`);
        await page.evaluate(async cycle => (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser.mutateProfileData({ type: "notes:save", content: `Committed cycle ${cycle}` }), cycle);
        const exited = new Promise<number | null>(resolve => child.once("exit", code => resolve(code)));
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // Keep the inspector attached until actual process exit. Playwright's
          // context-close detaches it during Electron's asynchronous quit path.
          void application.evaluate(({ app, BrowserWindow }, cycle) => {
            setImmediate(() => { if (cycle % 2) app.quit(); else BrowserWindow.getAllWindows()[0]!.close(); });
          }, cycle).catch(() => undefined);
          expect(await Promise.race([
            exited,
            new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`Shutdown exceeded 12 seconds at cycle ${cycle}: ${stderr}`)), 12_000); })
          ]), `Cycle ${cycle}: ${stderr}`).toBe(0);
        } finally { clearTimeout(timer); }
      } finally { if (child.exitCode === null && child.signalCode === null) child.kill(); }
    }
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 }); }
});

test("native app.quit closes the persisted profile and Electron process cleanly", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-native-quit-"));
  const application = await electron.launch({
    args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
    env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
  });
  const child = application.process();
  let stderr = "";
  child.stderr?.on("data", chunk => { stderr += String(chunk); });
  try {
    await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
    const exit = new Promise<number | null>(resolve => child.once("exit", resolve));
    await application.evaluate(({ app }) => { app.quit(); });
    const code = await Promise.race([exit, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Native quit deadline exceeded: " + stderr)), 12_000))]);
    expect(code, stderr).toBe(0);
  } finally {
    if (child.exitCode === null) child.kill();
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
});

test("reopens committed data after an abrupt process interruption", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-interrupted-"));
  const launch = () => electron.launch({
    args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
    env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
  });
  let application = await launch();
  try {
    await expect.poll(() => application.windows().some(page => /index\.html$/.test(page.url()))).toBe(true);
    let page = application.windows().find(page => /index\.html$/.test(page.url()))!;
    await expect(page).toHaveURL(/index\.html$/);
    await page.waitForLoadState("load");
    await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.mutateProfileData({type: "notes:save", content: "Committed before interruption"}));
    const child = application.process();
    const interrupted = new Promise<void>(resolve => child.once("exit", () => resolve()));
    if (process.platform === "win32") {
      // Killing only the main PID leaves Chromium children holding the fixture's
      // profile files on Windows. Simulate a crash of the entire application.
      await new Promise<void>((resolve, reject) => execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], error => error ? reject(error) : resolve()));
    } else child.kill("SIGKILL");
    await interrupted;
    application = await launch();
    await expect.poll(() => application.windows().some(page => /index\.html$/.test(page.url()))).toBe(true);
    page = application.windows().find(page => /index\.html$/.test(page.url()))!;
    await expect(page).toHaveURL(/index\.html$/);
    await page.waitForLoadState("load");
    expect(await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getProfileData().then(data => data.notes))).toBe("Committed before interruption");
  } finally {
    const child = application.process();
    if (child.exitCode === null && child.signalCode === null) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const exit = new Promise<number | null>(resolve => child.once("exit", resolve));
      void application.evaluate(({ app }) => { setImmediate(() => app.quit()); }).catch(() => undefined);
      try {
        expect(await Promise.race([exit, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Post-interruption native quit exceeded deadline")), 12_000); })])).toBe(0);
      } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
});
