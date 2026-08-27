import { _electron as electron, expect, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

async function shellWindow(application: ElectronApplication): Promise<Page> {
  await expect.poll(() => application.windows().some(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))).toBe(true);
  return application.windows().find(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))!;
}

async function resize(application: ElectronApplication, page: Page, width: number, height: number): Promise<void> {
  await application.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.unmaximize();
    window?.setContentSize(size.width, size.height, false);
  }, { width, height });
  await page.setViewportSize({ width, height });
}

const profile = await mkdtemp(join(tmpdir(), "moon-screenshot-profile-"));
const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const detectedDisplay = process.env.DISPLAY ?? (existsSync("/tmp/.X11-unix/X0") ? ":0" : undefined);
const desktopEnv = {
  ...process.env,
  ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}),
  ...(detectedDisplay ? { DISPLAY: detectedDisplay } : {})
};
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];
const application = await electron.launch({
  args: [...platformArguments, `--user-data-dir=${profile}`, "."],
  cwd: process.cwd(),
  env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile }
});

try {
  const window = await shellWindow(application);
  await expect(window.getByLabel("Página inicial", { exact: true })).toBeVisible();

  for (const [width, height] of [[909, 1026], [1280, 800], [1440, 900], [1920, 1080]] as const) {
    await resize(application, window, width, height);
    await window.waitForTimeout(180);
    await window.screenshot({ path: `assets/screenshots/phase-a-home-${width}x${height}.png` });
  }

  await resize(application, window, 1440, 900);
  await window.screenshot({ path: "assets/screenshots/page.png" });
  const omnibox = window.getByPlaceholder("Pesquise ou digite um endereço");
  await omnibox.fill("https://example.com/");
  await window.getByLabel("Abrir endereço").click();
  await expect.poll(() => window.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ url: string }>> } }).moonBrowser.getTabs().then(tabs => tabs.some(tab => tab.url === "https://example.com/")))).toBe(true);
  await window.waitForTimeout(300);
  await window.screenshot({ path: "assets/screenshots/phase-a-browser-page.png" });
  await window.getByLabel("Página inicial", { exact: true }).click();
  await window.waitForTimeout(180);
  await window.getByLabel("Proteção e AdBlock").click();
  await expect(window.locator(".moon-drawer-title")).toHaveText("Proteção");
  await window.waitForTimeout(300);
  await window.screenshot({ path: "assets/screenshots/page1.png" });
  await window.getByLabel("Configurações", { exact: true }).click();
  await expect(window.getByRole("dialog")).toBeVisible();
  await window.screenshot({ path: "assets/screenshots/page2.png" });
  for (const [label, slug] of [
    ["Aparência", "appearance"], ["Layout e densidade", "layout"], ["Home e widgets", "home"],
    ["Tipografia", "typography"], ["Pesquisa", "search"], ["Workspaces e dados", "data"]
  ] as const) {
    await window.getByLabel(label, { exact: true }).click();
    await window.waitForTimeout(120);
    await window.screenshot({ path: `assets/screenshots/phase-a-settings-${slug}.png` });
  }
} finally {
  await application.close();
  await rm(profile, { recursive: true, force: true });
}
