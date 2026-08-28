import { _electron as electron, expect, type ElectronApplication, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

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

async function drawerFeedback(page: Page): Promise<{ feedbackMs: number; settledMs: number }> {
  const timing = page.evaluate(() => new Promise<{ feedbackMs: number; settledMs: number }>(resolve => {
    const drawer = document.querySelector(".moon-drawer");
    if (!(drawer instanceof HTMLElement)) throw new Error("Moon drawer was not found");
    const startedAt = performance.now();
    let feedbackMs: number | undefined;
    const observer = new MutationObserver(() => {
      if (!drawer.classList.contains("is-open")) return;
      feedbackMs = performance.now() - startedAt;
      observer.disconnect();
      const durationMs = Number.parseFloat(getComputedStyle(drawer).transitionDuration) * 1000;
      if (durationMs <= 1) resolve({ feedbackMs, settledMs: performance.now() - startedAt });
      else drawer.addEventListener("transitionend", () => resolve({ feedbackMs: feedbackMs!, settledMs: performance.now() - startedAt }), { once: true });
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ["class"] });
  }));
  await page.getByLabel("Workspaces", { exact: true }).click();
  return timing;
}

async function tabSwitchTiming(page: Page): Promise<{ feedbackMs: number; settledMs: number }> {
  const feedbackMs = await page.evaluate(() => {
    const target = document.querySelector<HTMLButtonElement>(".moon-tab");
    if (!target) throw new Error("Moon tab was not found");
    return new Promise<number>((resolve, reject) => {
      const startedAt = performance.now();
      const timeout = window.setTimeout(() => { observer.disconnect(); reject(new Error("Tab feedback measurement timed out")); }, 1_000);
      const observer = new MutationObserver(() => {
        const first = document.querySelector(".moon-tab");
        if (!first?.classList.contains("is-active")) return;
        window.clearTimeout(timeout); observer.disconnect(); resolve(performance.now() - startedAt);
      });
      observer.observe(document.querySelector(".moon-tabs-list")!, { attributes: true, childList: true, subtree: true });
      target.click();
    });
  });
  const settledMs = await page.evaluate(async () => {
    const bridge = (window as unknown as { readonly moonBrowser: MoonBrowserBridge }).moonBrowser;
    const tabs = await bridge.getTabs();
    const target = tabs.find(tab => !tab.active);
    if (!target) throw new Error("Inactive tab was not found for the surface measurement");
    const startedAt = performance.now();
    await bridge.activateTab(target.id);
    return performance.now() - startedAt;
  });
  return { feedbackMs, settledMs };
}

const profile = await mkdtemp(join(tmpdir(), "moon-performance-"));
const bootStart = performance.now();
const application = await electron.launch({ args: [...platformArguments, `--user-data-dir=${profile}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile } });

try {
  const page = await shellWindow(application);
  await expect(page.getByLabel("Página inicial", { exact: true })).toBeVisible();
  await expect(page.locator(".moon-home-search-input")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const bridge = (window as unknown as { readonly moonBrowser: MoonBrowserBridge }).moonBrowser;
    return (await bridge.getTabs()).some(tab => tab.active);
  })).toBe(true);
  const coldBootHomeInteractiveMs = Math.round((performance.now() - bootStart) * 10) / 10;

  await page.getByLabel("Nova aba (Ctrl+T)").click();
  await expect(page.locator(".moon-tab")).toHaveCount(2);
  await page.evaluate(async () => {
    const bridge = (window as unknown as { readonly moonBrowser: MoonBrowserBridge }).moonBrowser;
    const tabs = await bridge.getTabs();
    if (tabs.length !== 2) throw new Error("Two tabs are required for the surface measurement");
    await bridge.navigate(tabs[0]!.id, "https://example.com/");
    await bridge.navigate(tabs[1]!.id, "https://example.org/");
    await bridge.activateTab(tabs[1]!.id);
  });
  await expect(page.locator(".moon-home")).toBeHidden();
  const tabTiming = await tabSwitchTiming(page);
  const warmHomeRevealMs = await duration(async () => {
    await page.getByLabel("Página inicial", { exact: true }).click();
    await expect(page.locator(".moon-home-search-input")).toBeVisible();
  });
  const drawerTiming = await drawerFeedback(page);
  await expect(page.locator(".moon-drawer")).toHaveClass(/is-open/);
  await page.getByLabel("Fechar painel").click();
  const settingsOpenMs = await duration(async () => {
    await page.getByLabel("Configurações", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  process.stdout.write(`${JSON.stringify({ coldBootHomeInteractiveMs, warmHomeRevealMs, tabFeedbackMs: Math.round(tabTiming.feedbackMs * 10) / 10, tabSurfaceSettledMs: Math.round(tabTiming.settledMs * 10) / 10, drawerFeedbackMs: Math.round(drawerTiming.feedbackMs * 10) / 10, drawerSettledMs: Math.round(drawerTiming.settledMs * 10) / 10, settingsOpenMs }, null, 2)}\n`);
} finally {
  await application.close();
  await rm(profile, { recursive: true, force: true });
}
