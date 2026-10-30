// Nexus Inc. — compare real Electron metrics with the resource panel.
import { _electron as electron, expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";
test("native Resources menu displays real unique processes and its optional sidebar button persists", async () => {
  test.setTimeout(90_000);
  const root = await mkdtemp(join(tmpdir(), "moon-resources-"));
  const server = createServer((_request, response) => { response.writeHead(200, {"Content-Type": "text/html"}); response.end(`<title>Resource fixture</title><main><h1>Local resource fixture</h1><p>${"measurement ".repeat(4000)}</p></main>`); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as {port: number}).port;
  const application = await electron.launch({args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${root}`, "."], env: {...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: join(root, "profile")}});
  const child = application.process();
  try {
    const probe = await fetch(`http://127.0.0.1:${port}/fixture-reflection-probe`);
    expect(await probe.text()).not.toContain("fixture-reflection-probe");
    await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
    const page = application.windows().find(page => page.url().endsWith("/index.html"))!;
    await page.getByLabel("Pular configuração inicial").click();
    for (let i = 0; i < 8; i++) await page.evaluate(async url => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.createTab(url), `http://127.0.0.1:${port}/${i}`);
    await application.evaluate(({Menu, BrowserWindow}) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById("moon-resources")!;
      const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith("/index.html"))!;
      item.click(item, window);
    });
    await expect(page.getByRole("heading", {name: "Agora", exact: true})).toBeVisible();
    await expect(page.getByText("RAM dos processos:", {exact: false})).toBeVisible();
    const snapshot = await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getResourceSnapshot!());
    expect(snapshot.processCount).toBe(new Set(snapshot.processes.map(process => process.pid)).size);
    expect(snapshot.processCount).toBeGreaterThan(1);
    expect(snapshot.memoryKiB).toBeGreaterThan(0);
    expect(snapshot.memoryKiB).toBe(snapshot.processes.reduce((sum, process) => sum + (process.memoryKiB ?? 0), 0));
    expect(snapshot.tabs.length).toBe(9);
    expect(snapshot.tabs.filter(tab => tab.title.startsWith("Resource")).length).toBe(8);
    expect(snapshot.tabs.some(tab => tab.pid !== null && tab.memoryKiB !== null)).toBe(true);
    await page.getByLabel("Mostrar Recursos na sidebar").check();
    await page.getByRole("button", {name: "Fechar painel", exact: true}).click();
    await page.reload();
    await expect(page.getByRole("button", {name: "Recursos", exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Recursos", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Páginas pesadas desta janela"})).toBeVisible();
  } finally {
    const exit = new Promise<number | null>(resolve => child.once("exit", resolve));
    void application.evaluate(({app}) => { setImmediate(() => app.quit()); }).catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { expect(await Promise.race([exit, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Resource test shutdown timed out")), 12_000); })])).toBe(0); }
    finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, {recursive: true, force: true, maxRetries: 12, retryDelay: 250}); }
  }
});
