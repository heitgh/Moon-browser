import { _electron as electron, expect, test } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("private windows do not retain site storage after close", async () => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", request.url === "/sw.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/sw.js" ? "self.addEventListener('fetch', () => {});" : "<!doctype html><title>Private fixture</title>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile = await mkdtemp(join(tmpdir(), "moon-private-footprints-"));
  const application = await electron.launch({ args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${profile}`, "."], cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: profile } });
  try {
    const shell = application.windows().find(page => page.url().endsWith("/index.html")) ?? await application.firstWindow();
    await shell.getByLabel("Pular configuração inicial").click();
    const openPrivate = async () => {
      await shell.evaluate(() => (globalThis as typeof globalThis & { moonBrowser: { createPrivateWindow(): Promise<unknown> } }).moonBrowser.createPrivateWindow());
      await expect.poll(() => application.windows().filter(page => page.url().endsWith("/index.html")).length).toBe(2);
      const page = application.windows().find(candidate => candidate !== shell && candidate.url().endsWith("/index.html"))!;
      const skip = page.getByLabel("Pular configuração inicial");
      if (await skip.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false)) await skip.click();
      await expect(page.getByPlaceholder("Pesquise ou digite um endereço")).toBeVisible();
      await page.getByPlaceholder("Pesquise ou digite um endereço").fill(origin);
      await page.getByLabel("Abrir endereço").click();
      await expect.poll(() => application.evaluate(({ webContents }, target) => webContents.getAllWebContents().some(contents => contents.getURL() === `${target}/`), origin)).toBe(true);
      return page;
    };
    const first = await openPrivate();
    const stored = await application.evaluate(async ({ webContents }, target) => {
      const contents = webContents.getAllWebContents().find(item => item.getURL() === `${target}/`)!;
      (globalThis as typeof globalThis & { moonPrivateTestSession?: Electron.Session }).moonPrivateTestSession = contents.session;
      contents.setZoomFactor(1.5);
      return contents.executeJavaScript(`(async () => {
        document.cookie = 'moon-private=secret; SameSite=Lax';
        localStorage.setItem('moon-private', 'secret');
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('moon-private', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('items');
          request.onsuccess = () => { request.result.close(); resolve(); };
          request.onerror = () => reject(request.error);
        });
        await caches.open('moon-private');
        await navigator.serviceWorker.register('/sw.js');
        return document.cookie.includes('moon-private=secret');
      })()`, true);
    }, origin);
    expect(stored).toBe(true);
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.session.getStoragePath() === null)?.close());
    await expect.poll(() => first.isClosed()).toBe(true);
    await expect.poll(() => application.evaluate(async () => {
      const session = (globalThis as typeof globalThis & { moonPrivateTestSession?: Electron.Session }).moonPrivateTestSession;
      return session ? (await session.cookies.get({})).length : -1;
    })).toBe(0);
    const second = await openPrivate();
    const empty = await application.evaluate(async ({ webContents }, target) => {
      const contents = webContents.getAllWebContents().find(item => item.getURL() === `${target}/`)!;
      return contents.executeJavaScript(`(async () => ({
        cookie: document.cookie,
        local: localStorage.getItem('moon-private'),
        indexedDB: await indexedDB.databases(),
        caches: await caches.keys(),
        workers: await navigator.serviceWorker.getRegistrations()
      }))()`, true).then(value => ({ ...value, zoom: contents.getZoomFactor(), inMemory: contents.session.getStoragePath() === null }));
    }, origin);
    expect(empty).toEqual({ cookie: "", local: null, indexedDB: [], caches: [], workers: [], zoom: 1, inMemory: true });
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.session.getStoragePath() === null)?.close());
    await expect.poll(() => second.isClosed()).toBe(true);
  } finally {
    await application.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
