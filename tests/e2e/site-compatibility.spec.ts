import { _electron as electron, expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function shellWindow(application: ElectronApplication): Promise<Page> {
  await expect.poll(() => application.windows().some(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))).toBe(true);
  return application.windows().find(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))!;
}

test("keeps cookies through redirects and recovers a crashed site renderer", async () => {
  test.setTimeout(60_000);
  let heavyRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/login") {
      response.statusCode = 302;
      response.setHeader("set-cookie", "moon_session=authenticated; HttpOnly; SameSite=Lax; Path=/");
      response.setHeader("location", "/account");
      response.end();
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (request.url === "/account") {
      response.end(`<!doctype html><title>Conta Moon</title><main id="session">${request.headers.cookie ?? "missing"}</main>`);
      return;
    }
    if (request.url?.startsWith("/authorize")) {
      response.end('<!doctype html><title>OAuth Fixture</title><button id="done" onclick="window.opener.postMessage(\'oauth-ok\', \'*\');window.close()">Continuar</button>');
      return;
    }
    if (request.url === "/heavy") {
      heavyRequests += 1;
      response.end(`<!doctype html><title>Media Fixture ${heavyRequests}</title><main>renderer recovery</main>`);
      return;
    }
    response.end('<!doctype html><title>Compat Fixture</title><button id="login" onclick="window.open(\'/authorize?client_id=moon&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback\', \'oauth-window\')">Entrar</button><script>addEventListener("message", event => window.oauthResult=event.data)</script>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const userData = await mkdtemp(join(tmpdir(), "moon-compat-"));
  const application = await electron.launch({
    args: [`--user-data-dir=${userData}`, "."],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData }
  });
  try {
    const shell = await shellWindow(application);
    const skip = shell.getByLabel("Pular configuração inicial");
    if (await skip.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await skip.click();
    const bridge = () => (window as unknown as { moonBrowser: import("../../ui/browser-shell/contracts.js").MoonBrowserBridge }).moonBrowser;

    await shell.getByPlaceholder("Pesquise ou digite um endereço").fill(`${origin}/login`);
    await shell.getByLabel("Abrir endereço").click();
    await expect.poll(() => application.evaluate(({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === url);
      return page?.getTitle();
    }, `${origin}/account`)).toBe("Conta Moon");

    const sessionText = await application.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === url);
      return page?.executeJavaScript("document.querySelector('#session').textContent");
    }, `${origin}/account`);
    expect(sessionText).toContain("moon_session=authenticated");

    const popupPromise = application.waitForEvent("window");
    await shell.evaluate(async target => {
      const api = bridge();
      const tab = await api.createTab(target, "research");
      await api.activateTab(tab.id);
    }, origin);
    await expect.poll(() => application.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(item => item.getURL() === url), `${origin}/`)).toBe(true);
    await application.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === url);
      await page?.executeJavaScript("document.querySelector('#login').click()", true);
    }, `${origin}/`);
    const popup = await popupPromise;
    await popup.waitForURL(/\/authorize/);
    await popup.locator("#done").click();
    await expect.poll(() => application.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === url);
      return page?.executeJavaScript("window.oauthResult");
    }, `${origin}/`)).toBe("oauth-ok");

    await shell.evaluate(async target => {
      const api = bridge();
      const tab = await api.createTab(target, "research");
      await api.activateTab(tab.id);
    }, `${origin}/heavy`);
    await expect.poll(() => heavyRequests).toBe(1);
    await application.evaluate(({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === url);
      if (!page) throw new Error("fixture renderer not found");
      page.forcefullyCrashRenderer();
    }, `${origin}/heavy`);
    await expect.poll(() => heavyRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => application.evaluate(({ webContents }, base) => {
      const page = webContents.getAllWebContents().find(item => item.getURL() === `${base}/heavy`);
      return page?.getTitle();
    }, origin)).toContain("Media Fixture");
  } finally {
    await application.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(userData, { recursive: true, force: true });
  }
});
