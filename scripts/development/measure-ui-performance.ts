import { _electron as electron, expect, type ElectronApplication, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const detectedDisplay = process.env.DISPLAY ?? (existsSync("/tmp/.X11-unix/X0") ? ":0" : undefined);
const desktopEnv = { ...process.env, ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}), ...(detectedDisplay ? { DISPLAY: detectedDisplay } : {}) };
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];

async function shellWindow(application: ElectronApplication): Promise<Page> {
  await expect.poll(() => application.windows().some(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))).toBe(true);
  return application.windows().find(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))!;
}

async function duration(action: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await action();
  return Math.round((performance.now() - start) * 10) / 10;
}

const profile = await mkdtemp(join(tmpdir(), "moon-performance-"));
const bootStart = performance.now();
const application = await electron.launch({ args: [...platformArguments, `--user-data-dir=${profile}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile } });

try {
  const page = await shellWindow(application);
  await expect(page.getByLabel("Página inicial", { exact: true })).toBeVisible();
  await expect(page.locator(".moon-home-search-input")).toBeVisible();
  const homeInteractiveMs = Math.round((performance.now() - bootStart) * 10) / 10;

  await page.getByLabel("Nova aba (Ctrl+T)").click();
  await expect(page.locator(".moon-tab")).toHaveCount(2);
  const tabSwitchMs = await duration(async () => {
    await page.locator(".moon-tab").first().click();
    await expect(page.locator(".moon-tab").first()).toHaveClass(/is-active/);
  });
  const drawerOpenMs = await duration(async () => {
    await page.getByLabel("Workspaces", { exact: true }).click();
    await expect(page.locator(".moon-drawer")).toHaveClass(/is-open/);
  });
  await page.getByLabel("Fechar painel").click();
  const settingsOpenMs = await duration(async () => {
    await page.getByLabel("Configurações", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  process.stdout.write(`${JSON.stringify({ homeInteractiveMs, tabSwitchMs, drawerOpenMs, settingsOpenMs }, null, 2)}\n`);
} finally {
  await application.close();
  await rm(profile, { recursive: true, force: true });
}
