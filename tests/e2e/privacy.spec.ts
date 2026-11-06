import { _electron as electron, expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

test("privacy settings alter Chromium cookie traffic and clear only reviewed site data", async () => {
  test.setTimeout(100_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-privacy-"));
  const seen = new Map<string, string>();
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    seen.set(path, request.headers.cookie ?? "");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    if (path === "/allow") response.setHeader("Set-Cookie", "first=allowed; Path=/; Max-Age=3600");
    if (path === "/blocked") response.setHeader("Set-Cookie", "blocked=should-not-store; Path=/; Max-Age=3600");
    response.end("<title>Privacy fixture</title><main>Privacy fixture</main>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  const application = await electron.launch({
    args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
    env: {...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: join(directory, "profile")}
  });
  const child = application.process();
  try {
    await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
    const page = application.windows().find(page => page.url().endsWith("/index.html"))!;
    await page.getByLabel("Pular configuração inicial").click();
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 1, checkboxChecked: false});});
    const open = (path: string) => page.evaluate(url => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.createTab(url), origin + path);
    const cookieNames = () => application.evaluate(async ({session}, url) => {
      const cookies = await session.fromPartition("persist:profile:default:default").cookies.get({url});
      return cookies.map(cookie => cookie.name).sort();
    }, origin);
    await open("/allow");
    await expect.poll(cookieNames).toContain("first");
    await open("/baseline");
    expect(seen.get("/baseline")).toContain("first=allowed");
    await page.getByLabel("Configurações", {exact: true}).click();
    await page.getByLabel("Privacidade e dados", {exact: true}).click();
    await expect(page.getByRole("heading", {name: "Privacidade", exact: true})).toBeVisible();
    const selector = page.getByLabel("Cookies HTTP", {exact: true});
    await expect(selector).toBeEnabled();
    await selector.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Exceções de rastreadores (uma origem por linha)", {exact: true})).toBeFocused();
    await selector.selectOption("block-all");
    const save = page.getByRole("button", {name: "Salvar privacidade", exact: true});
    await save.click();
    await expect(page.getByText("Opções aplicadas às próximas requisições.", {exact: true})).toBeVisible();
    await open("/blocked");
    expect(seen.get("/blocked")).toBe("");
    expect(await cookieNames()).not.toContain("blocked");
    const state = await page.evaluate(() => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.getPrivacyState!());
    await page.evaluate(({settings, origin}) => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.configurePrivacy!({...settings, cookieExceptions: [origin]}), {settings: state.settings, origin});
    await open("/exception");
    expect(seen.get("/exception")).toContain("first=allowed");

    await application.evaluate(async ({session}) => {
      await session.fromPartition("persist:profile:default:default").cookies.set({
        url: "https://unrelated.example", name: "keep", value: "value"
      });
    });
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 0, checkboxChecked: false});});
    const clear = () => page.evaluate(value => (window as unknown as {moonBrowser: MoonBrowserBridge}).moonBrowser.clearSiteData!(value), origin);
    await expect(clear()).resolves.toBe(false);
    expect(await cookieNames()).toContain("first");
    await application.evaluate(({dialog}) => {dialog.showMessageBox = async () => ({response: 1, checkboxChecked: false});});
    await expect(clear()).resolves.toBe(true);
    await expect.poll(cookieNames).not.toContain("first");
    expect(await application.evaluate(async ({session}) => (await session.fromPartition("persist:profile:default:default").cookies.get({url: "https://unrelated.example"})).length)).toBe(1);
  } finally {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
    void application.evaluate(({app}) => {setImmediate(() => app.quit());}).catch(() => undefined);
    try {
      expect(await Promise.race([exited, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Privacy test shutdown timed out")), 12_000);
      })])).toBe(0);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(directory, {recursive: true, force: true, maxRetries: 12, retryDelay: 250});
    }
  }
});
