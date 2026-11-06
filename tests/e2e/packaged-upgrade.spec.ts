import { _electron as electron, expect, test } from "@playwright/test";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previous = process.env.MOON_PREVIOUS_EXECUTABLE;
const candidate = process.env.MOON_CANDIDATE_EXECUTABLE;

test("opens a profile created by the public installer in the candidate package", async () => {
  test.skip(!previous || !candidate, "Requires the previous and candidate desktop packages");
  const userData = await mkdtemp(join(tmpdir(), "moon-packaged-upgrade-"));
  const open = (executablePath: string) => electron.launch({
    executablePath,
    args: [`--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1" }
  });
  const title = "Nota criada no Moon alpha.5";
  const url = "https://example.com/moon-upgrade";
  try {
    const old = await open(previous!);
    try {
      const page = await old.firstWindow();
      await page.getByLabel("Pular configuração inicial").click();
      const address = page.getByPlaceholder("Pesquise ou digite um endereço");
      await address.fill(url);
      await page.getByLabel("Abrir endereço").click();
      await expect.poll(() => page.evaluate(() => {
        const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
        return bridge.getTabs().then(tabs => tabs.map(tab => tab.url));
      })).toContain(url);
      await page.evaluate(title => {
        const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
        return bridge.mutateProfileData({
          type: "note:save", expectedRevision: 0,
          value: { id: "note-release-upgrade", kind: "note", title, content: "Dados preservados", format: "markdown", pinned: false, favorite: false, tags: [] }
        });
      }, title);
    } finally {
      await old.close();
    }

    const next = await open(candidate!);
    try {
      const page = await next.firstWindow();
      await expect.poll(() => page.evaluate(async () => {
        const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
        return { urls: (await bridge.getTabs()).map(tab => tab.url), profile: await bridge.getProfileData() };
      })).toEqual(expect.objectContaining({
        urls: expect.arrayContaining([url]),
        profile: expect.objectContaining({
          notes: expect.arrayContaining([expect.objectContaining({ title, content: "Dados preservados" })])
        })
      }));
      await expect(page.getByLabel("Pular configuração inicial")).toBeHidden();
    } finally {
      await next.close();
    }
  } finally {
    await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
