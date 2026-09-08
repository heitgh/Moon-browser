import { existsSync } from "node:fs";
import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.MOON_HEADLESS === "1" ? undefined : process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const desktopEnv = { ...process.env, ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}) };
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];
const profile = await mkdtemp(join(tmpdir(), "moon-update-gallery-"));
const application = await electron.launch({ args: [...platformArguments, `--user-data-dir=${profile}`, "."], env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile } });
try {
  const page = await application.firstWindow(); await page.waitForURL(/index.html$/);
  await page.getByLabel("Pular configuração inicial").click();
  await application.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]!; window.unmaximize(); window.setContentSize(1440, 900); });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const mode of ["dark", "light", "wallpaper"] as const) {
    await page.evaluate(async mode => {
      const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
      const document = await bridge.loadCustomization();
      const next = structuredClone(document) as unknown as { revision: number; updatedAt: number; global: { layout: { drawer: { width: number } }; appearance: { mode: string; colors: Record<string, string>; regions: Record<string, string>; wallpaper: { type: string; source: string; dim: number } } } };
      next.revision += 1; next.updatedAt = Date.now(); next.global.layout.drawer.width = 440;
      next.global.appearance.mode = mode === "light" ? "light" : "dark";
      if (mode === "wallpaper") {
        const canvas = window.document.createElement("canvas"); canvas.width = 960; canvas.height = 600; const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 960, 600); gradient.addColorStop(0, "#122938"); gradient.addColorStop(.6, "#31605f"); gradient.addColorStop(1, "#c6a17a"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 600);
        const { extractPalette } = await import(new URL("./dist/types/ui/customization/palette-extractor.js", window.location.href).href) as typeof import("../../ui/customization/palette-extractor.js");
        const palette = extractPalette(ctx.getImageData(0, 0, 960, 600)); Object.assign(next.global.appearance.colors, palette.colors); Object.assign(next.global.appearance.regions, palette.regions);
        next.global.appearance.wallpaper = { ...next.global.appearance.wallpaper, type: "local", source: canvas.toDataURL("image/png") };
      }
      await bridge.commitCustomization(next as unknown as Parameters<MoonBrowserBridge["commitCustomization"]>[0]);
    }, mode);
    await page.reload(); await expect(page.getByLabel("Página inicial", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.moonTheme)).toBe(mode === "light" ? "light" : "dark");
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
    await page.screenshot({ path: `assets/screenshots/update-home-${mode}.png` });
    if (mode === "wallpaper") {
      const data = await page.evaluate(async () => (await (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser.loadCustomization()).global.appearance.wallpaper.source);
      await writeFile("assets/wallpapers/update-gradient.png", Buffer.from(data.split(",")[1]!, "base64"));
    }
  }
} finally { await application.close(); await rm(profile, { recursive: true, force: true }); }
