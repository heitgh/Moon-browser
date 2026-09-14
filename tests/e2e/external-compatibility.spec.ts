import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.skip(process.env.MOON_EXTERNAL_COMPAT !== "1", "external compatibility probes are opt-in");

for (const site of [
  { name: "Pinterest", url: "https://www.pinterest.com/login/", hosts: ["pinterest.com"] },
  { name: "TikTok", url: "https://www.tiktok.com/", hosts: ["tiktok.com"] },
]) {
  test(`${site.name} opens without a renderer crash or internal error leak`, async () => {
    const userData = await mkdtemp(join(tmpdir(), `moon-external-${site.name.toLowerCase()}-`));
    const application = await electron.launch({
      args: [`--user-data-dir=${userData}`, "."],
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData }
    });
    try {
      await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
      const shell = application.windows().find(page => page.url().endsWith("/index.html"))!;
      const skip = shell.getByLabel("Pular configuração inicial");
      if (await skip.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) await skip.click();
      await shell.getByPlaceholder("Pesquise ou digite um endereço").fill(site.url);
      await shell.getByLabel("Abrir endereço").click();
      const observation = await expect.poll(() => application.evaluate(({ webContents }, hosts) => {
        const page = webContents.getAllWebContents().find(item => hosts.some(host => {
          try { return new URL(item.getURL()).hostname.endsWith(host); } catch { return false; }
        }));
        return page ? { url: page.getURL(), crashed: page.isCrashed(), title: page.getTitle(), userAgent: page.getUserAgent() } : undefined;
      }, site.hosts), { timeout: 30_000 }).toBeTruthy();
      void observation;
      const state = await application.evaluate(({ webContents }, hosts) => {
        const page = webContents.getAllWebContents().find(item => hosts.some(host => {
          try { return new URL(item.getURL()).hostname.endsWith(host); } catch { return false; }
        }))!;
        return { crashed: page.isCrashed(), title: page.getTitle(), userAgent: page.getUserAgent() };
      }, site.hosts);
      expect(state.crashed).toBe(false);
      expect(state.userAgent).not.toMatch(/Electron|MoonBrowser/i);
      expect(state.title).not.toMatch(/TypeScript|ERR_/i);
    } finally {
      await application.close();
      await rm(userData, { recursive: true, force: true });
    }
  });
}
