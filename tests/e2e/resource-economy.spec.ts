import { _electron as electron, expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";
import { DEFAULT_RESOURCE_SETTINGS } from "../../packages/ipc/resource-policy-contract.js";
test("economy destroys only verified background surfaces, preserves stateful pages and restores real history and scroll", async () => {
  const info = test.info();
  test.setTimeout(180_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-economy-"));
  const server = createServer((request, response) => {
    response.writeHead(200, {"Content-Type": "text/html"});
    if (request.url === "/form") response.end('<title>Protected form</title><input value="unsaved-value">');
    else if (request.url === "/script") response.end('<title>Protected script</title><script>window.importantState=42</script>');
    else response.end('<title>Static fixture</title><main style="height:12000px">Static reload-safe fixture</main>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  const application = await electron.launch({args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."], env: {...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: join(directory, "profile")}});
  const child = application.process();
  try {
    await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
    const page = application.windows().find(page => page.url().endsWith("/index.html"))!;
    await page.getByLabel("Pular configuração inicial").click();
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 1, checkboxChecked: false});});
    const settings = {...DEFAULT_RESOURCE_SETTINGS, reloadSafeOrigins: [origin]};
    await page.evaluate(async settings => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.configureResourcePolicy!(settings), settings);
    const tabs = await page.evaluate(async origin => {
      const bridge = (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser; const tabs = [];
      for (let i = 0; i < 30; i++) tabs.push(await bridge.createTab(`${origin}/static-${i}`));
      tabs.push(await bridge.createTab(`${origin}/form`)); tabs.push(await bridge.createTab(`${origin}/script`));
      return tabs;
    }, origin);
    const first = tabs[0]!;
    await page.evaluate(async ({id, url}) => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.navigate(id, url), {id: first.id, url: `${origin}/history-final`});
    await expect.poll(() => application.evaluate(({webContents}, url) => { const contents = webContents.getAllWebContents().find(contents => contents.getURL() === url); return contents ? !contents.isLoading() : false; }, `${origin}/history-final`)).toBe(true);
    const oldContentsId = await application.evaluate(async ({webContents}, url) => {
      const contents = webContents.getAllWebContents().find(contents => contents.getURL() === url)!;
      await contents.executeJavaScriptInIsolatedWorld(1004, [{code: "window.scrollTo(0,900)"}]); return contents.id;
    }, `${origin}/history-final`);
    await expect.poll(async () => (await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.inspectResourcePolicy!())).candidates.filter(candidate => candidate.eligible).length, {timeout: 30_000}).toBe(30);
    const before = await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getResourceSnapshot!());
    // An exception remains stronger than an origin authorization.
    await page.evaluate(async settings => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.configureResourcePolicy!({...settings, exceptions: settings.reloadSafeOrigins}), settings);
    expect((await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.inspectResourcePolicy!())).candidates.some(candidate => candidate.eligible)).toBe(false);
    await page.evaluate(async settings => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.configureResourcePolicy!(settings), settings);
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 0, checkboxChecked: false});});
    expect((await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.economizeResources!())).cancelled).toBe(true);
    expect(await application.evaluate(({webContents}, id) => Boolean(webContents.fromId(id)), oldContentsId)).toBe(true);
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 1, checkboxChecked: false});});
    const report = await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.economizeResources!());
    expect(report.suspendedIds).toHaveLength(30); expect(report.suspendedIds).toContain(first.id);
    expect(await application.evaluate(({webContents}, id) => Boolean(webContents.fromId(id)), oldContentsId)).toBe(false);
    const after = await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getResourceSnapshot!());
    await mkdir(info.outputDir, {recursive: true});
    await writeFile(info.outputPath("measured-economy.json"), JSON.stringify({before, report, after}));
    expect(after.tabs.filter(tab => tab.pid === null).length).toBeGreaterThanOrEqual(30);
    expect(await application.evaluate(async ({webContents}, url) => webContents.getAllWebContents().find(contents => contents.getURL() === url)?.executeJavaScript("document.querySelector('input').value"), `${origin}/form`)).toBe("unsaved-value");
    expect(await application.evaluate(async ({webContents}, url) => webContents.getAllWebContents().find(contents => contents.getURL() === url)?.executeJavaScript("window.importantState"), `${origin}/script`)).toBe(42);
    await application.evaluate(({Menu, BrowserWindow}) => {const item = Menu.getApplicationMenu()!.getMenuItemById("moon-resources")!; item.click(item, BrowserWindow.getAllWindows()[0]!);});
    await page.getByRole("button", {name: "Avaliar abas", exact: true}).click();
    await expect(page.getByText("Static fixture · suspensa", {exact: true}).first()).toBeVisible();
    await page.screenshot({path: info.outputPath("economy-ui.png")});
    await page.evaluate(async id => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.activateTab(id), first.id);
    const restored = await application.evaluate(async ({webContents}, url) => {
      const contents = webContents.getAllWebContents().find(contents => contents.getURL() === url)!;
      return {id: contents.id, back: contents.navigationHistory.canGoBack(), scroll: await contents.executeJavaScript("window.scrollY")};
    }, `${origin}/history-final`);
    expect(restored.id).not.toBe(oldContentsId); expect(restored.back).toBe(true); expect(restored.scroll).toBeGreaterThan(800);
    await page.evaluate(async id => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.closeTab(id), tabs[1]!.id);
    expect((await page.evaluate(async () => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getTabs())).some(tab => tab.id === tabs[1]!.id)).toBe(false);
  } finally {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exit = new Promise<number | null>(resolve => child.once("exit", resolve));
    void application.evaluate(({app}) => {setImmediate(() => app.quit());}).catch(() => undefined);
    try {expect(await Promise.race([exit, new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error("Economy shutdown timed out")), 12_000);})])).toBe(0);}
    finally {clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, {recursive: true, force: true, maxRetries: 12, retryDelay: 250});}
  }
});
