import { _electron as electron, expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const detectedDisplay = process.env.DISPLAY ?? (existsSync("/tmp/.X11-unix/X0") ? ":0" : undefined);
const desktopEnv = { ...process.env, ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}), ...(detectedDisplay ? { DISPLAY: detectedDisplay } : {}) };
const platformArguments = detectedWayland
  ? ["--ozone-platform=wayland"]
  : [];

async function shellWindow(application: ElectronApplication): Promise<Page> {
  await expect.poll(() => application.windows().some(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))).toBe(true);
  return application.windows().find(page => page.url().startsWith("file:") && page.url().endsWith("/index.html"))!;
}

async function selectValue(page: Page, label: string, value: string): Promise<void> {
  await page.locator("label.moon-field", { hasText: label }).locator("select").first().evaluate((node, next) => {
    const select = node as HTMLSelectElement; select.value = next; select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function setViewport(application: ElectronApplication, page: Page, width: number, height: number): Promise<void> {
  await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height, false), { width, height });
  await page.setViewportSize({ width, height });
}

test("starts the packaged desktop shell and opens every primary panel", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-smoke-"));
  const application = await electron.launch({
    args: [...platformArguments, `--user-data-dir=${userData}`, "."],
    cwd: process.cwd(),
    env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData }
  });

  try {
    const window = await shellWindow(application);
    await expect(window.getByLabel("Página inicial", { exact: true })).toBeVisible();
    await expect(window.getByPlaceholder("Pesquise ou digite um endereço")).toBeVisible();

    const modules = [
      ["Workspaces", "Workspaces"],
      ["Favoritos", "Favoritos"],
      ["Downloads", "Downloads"],
      ["Histórico", "Histórico"],
      ["Traduzir página", "Tradutor"],
      ["Bloco de notas", "Bloco de notas"]
    ] as const;

    for (const [label, heading] of modules) {
      await window.getByLabel(label, { exact: true }).click();
      await expect(window.locator(".moon-drawer-title")).toHaveText(heading);
    }

    await window.getByLabel("Configurações", { exact: true }).click();
    await expect(window.getByRole("dialog")).toBeVisible();
    await expect(window.getByRole("heading", { name: "Personalize o essencial" })).toBeVisible();
    await expect(window.locator(".moon-settings-mode")).toHaveText(["Essencial", "Personalizar", "Avançado"]);
    const search = window.getByLabel("Buscar nas configurações"); await search.fill("grossura da sidebar");
    await window.locator(".moon-settings-result").click(); await expect(window.getByRole("heading", { name: "Layout e densidade" })).toBeVisible();
    await window.getByLabel("Abrir configurações em página completa").evaluate(button => (button as HTMLButtonElement).click());
    await expect(window.getByTestId("customization-center")).toHaveAttribute("data-presentation", "page");
    await expect.poll(() => window.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ url: string }>> } }).moonBrowser.getTabs().then(tabs => tabs.some(tab => tab.url.startsWith("moon://settings/"))))).toBe(true);
    await window.getByLabel("Voltar à página inicial").click();
    await window.keyboard.press("Control+,"); await expect(window.getByRole("dialog")).toBeVisible(); await window.keyboard.press("Escape");
    await window.keyboard.press("Control+Shift+W"); await expect(window.locator(".moon-drawer-title")).toHaveText("Workspaces");
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("restores the real tab session after an application restart", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-profile-"));
  const launch = () => electron.launch({
    args: [...platformArguments, `--user-data-dir=${userData}`, "."],
    cwd: process.cwd(),
    env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData }
  });

  try {
    let application = await launch();
    try {
      const window = await shellWindow(application);
      await expect(window.locator(".moon-tab")).toHaveCount(1);
      await window.getByLabel("Nova aba (Ctrl+T)").click();
      await expect(window.locator(".moon-tab")).toHaveCount(2);
      await window.locator(".moon-tab").nth(1).click();
      const omnibox = window.getByPlaceholder("Pesquise ou digite um endereço");
      await omnibox.fill("https://example.com/");
      await window.getByLabel("Abrir endereço").click();
      await expect.poll(() => window.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ url: string }>> } }).moonBrowser.getTabs().then(tabs => tabs.map(tab => tab.url)))).toContain("https://example.com/");
    } finally {
      await application.close();
    }

    application = await launch();
    try {
      const restored = await shellWindow(application);
      await expect(restored.locator(".moon-tab")).toHaveCount(2);
      const restoredUrls = await restored.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ url: string }>> } }).moonBrowser.getTabs().then(tabs => tabs.map(tab => tab.url)));
      expect(restoredUrls).toContain("https://example.com/");
    } finally {
      await application.close();
    }
  } finally {
    await rm(userData, { recursive: true, force: true });
  }
});

test("persists theme, sidebar and Home customization after restart", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-customization-"));
  const launch = () => electron.launch({ args: [...platformArguments, `--user-data-dir=${userData}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData } });
  try {
    let application = await launch();
    try {
      const window = await shellWindow(application);
      await window.getByLabel("Configurações", { exact: true }).click();
      await window.getByLabel("Aparência", { exact: true }).click();
      await selectValue(window, "Modo", "light");
      await window.getByLabel("Layout e densidade", { exact: true }).click();
      await selectValue(window, "Posição", "right");
      await window.getByLabel("Home e widgets", { exact: true }).click();
      await window.locator('.moon-widget-setting[aria-label^="Relógio"] input[type="checkbox"]').evaluate(node => { const input = node as HTMLInputElement; input.checked = false; input.dispatchEvent(new Event("change", { bubbles: true })); });
      await window.getByLabel("Aplicar personalização").click();
      await expect.poll(() => window.evaluate(() => document.documentElement.dataset.moonTheme)).toBe("light");
      await expect.poll(() => window.evaluate(() => document.documentElement.dataset.moonSidebar)).toBe("right");
    } finally { await application.close(); }

    application = await launch();
    try {
      const restored = await shellWindow(application);
      await expect.poll(() => restored.evaluate(() => document.documentElement.dataset.moonTheme)).toBe("light");
      await expect.poll(() => restored.evaluate(() => document.documentElement.dataset.moonSidebar)).toBe("right");
      await expect(restored.locator('.moon-home-clock[data-widget="clock"]')).toHaveCount(0);
      const storedVersion = await restored.evaluate(() => JSON.parse(localStorage.getItem("moon:customization:v3") ?? "{}").version as number);
      expect(storedVersion).toBe(3);
    } finally { await application.close(); }
  } finally { await rm(userData, { recursive: true, force: true }); }
});

test("exports and imports customization through the real desktop bridge", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-portability-"));
  const exportPath = join(userData, "moon-customization.json");
  const application = await electron.launch({ args: [...platformArguments, `--user-data-dir=${userData}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData } });
  try {
    const window = await shellWindow(application);
    await application.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, exportPath);
    await window.getByLabel("Configurações", { exact: true }).click();
    await window.getByLabel("Aparência", { exact: true }).click();
    await selectValue(window, "Modo", "light");
    await window.getByLabel("Workspaces e dados", { exact: true }).click();
    await window.getByLabel("Exportar tudo").click();
    await expect.poll(async () => (await readFile(exportPath, "utf8")).includes('"moon-customization"')).toBe(true);

    await window.getByLabel("Aparência", { exact: true }).click();
    await selectValue(window, "Modo", "dark");
    await expect.poll(() => window.evaluate(() => document.documentElement.dataset.moonTheme)).toBe("dark");
    await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, exportPath);
    await window.getByLabel("Workspaces e dados", { exact: true }).click();
    window.once("dialog", dialog => void dialog.accept());
    await window.getByLabel("Importar personalização").click();
    await expect.poll(() => window.evaluate(() => document.documentElement.dataset.moonTheme)).toBe("light");
    await window.getByLabel("Aplicar personalização").click();
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("keeps the Phase A chrome readable, reachable and unclipped across target viewports", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-ergonomics-"));
  const application = await electron.launch({ args: [...platformArguments, `--user-data-dir=${userData}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData } });
  try {
    const window = await shellWindow(application);
    for (const [width, height] of [[909, 1026], [1280, 720], [1366, 768], [1920, 1080]] as const) {
      await setViewport(application, window, width, height);
      await expect.poll(() => window.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ width, scroll: width });
      const metrics = await window.evaluate(() => {
        const visible = (node: Element): node is HTMLElement => node instanceof HTMLElement && !node.hidden && getComputedStyle(node).display !== "none";
        const fontSizes = [...document.querySelectorAll(".moon-tab-title, .moon-omnibox, .moon-workspace-chip, .moon-shortcut-label")].filter(visible).map(node => Number.parseFloat(getComputedStyle(node).fontSize));
        const targets = [...document.querySelectorAll(".moon-rail-button, .moon-nav-button, .moon-add-tab, .moon-workspace-chip, .moon-home-search-button")].filter(visible).map(node => { const rect = node.getBoundingClientRect(); return Math.min(rect.width, rect.height); });
        const grid = document.querySelector(".moon-home-grid")?.getBoundingClientRect();
        return { minFont: Math.min(...fontSizes), minTarget: Math.min(...targets), gridLeft: grid?.left ?? -1, gridRight: grid?.right ?? Number.MAX_VALUE };
      });
      expect(metrics.minFont).toBeGreaterThanOrEqual(11);
      expect(metrics.minTarget).toBeGreaterThanOrEqual(39.9);
      expect(metrics.gridLeft).toBeGreaterThanOrEqual(0);
      expect(metrics.gridRight).toBeLessThanOrEqual(width);
    }
    await setViewport(application, window, 1280, 720); await window.getByLabel("Configurações", { exact: true }).click();
    await window.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await expect(window.getByRole("dialog")).toBeVisible(); await expect(window.getByLabel("Aplicar personalização")).toBeVisible();
    await window.emulateMedia({ reducedMotion: "reduce" });
    expect(await window.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector(".moon-settings-modal")!).animationDuration || "0"))).toBeLessThanOrEqual(.001);
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("opens a real isolated private window and never restores it", async () => {
  const userData = await mkdtemp(join(tmpdir(), "moon-e2e-private-"));
  const launch = () => electron.launch({ args: [...platformArguments, `--user-data-dir=${userData}`, "."], cwd: process.cwd(), env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: userData } });
  try {
    let application = await launch();
    try {
      const normalWindow = await shellWindow(application);
      await normalWindow.evaluate(async () => {
        const bridge = (window as unknown as { moonBrowser: { mutateProfileData(value: unknown): Promise<void> } }).moonBrowser;
        await bridge.mutateProfileData({ type: "history:record", value: { id: "private-test-history", title: "Normal", url: "https://normal.test/", time: Date.now() } });
        await bridge.mutateProfileData({ type: "notes:save", content: "Nota do perfil normal" });
      });
      await normalWindow.keyboard.press("Control+Shift+N");
      await expect.poll(() => application.windows().filter(page => page.url().endsWith("/index.html")).length).toBe(2);
      const privateWindow = application.windows().filter(page => page.url().endsWith("/index.html")).find(page => page !== normalWindow)!;
      await expect(privateWindow.locator(".moon-private-badge")).toBeVisible();
      await expect.poll(() => privateWindow.evaluate(() => document.documentElement.dataset.moonPrivate)).toBe("on");
      const privateTabs = await privateWindow.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ private: boolean }>> } }).moonBrowser.getTabs());
      expect(privateTabs.length).toBeGreaterThan(0); expect(privateTabs.every(tab => tab.private)).toBe(true);
      const privateProfile = await privateWindow.evaluate(() => (window as unknown as { moonBrowser: { getProfileData(): Promise<{ history: unknown[]; notes: string }> } }).moonBrowser.getProfileData());
      expect(privateProfile.history).toEqual([]); expect(privateProfile.notes).toBe("");
      await privateWindow.getByLabel("Bloco de notas", { exact: true }).click();
      await expect(privateWindow.locator(".moon-notes-input")).toBeDisabled();
    } finally { await application.close(); }

    application = await launch();
    try {
      const restored = await shellWindow(application);
      const restoredTabs = await restored.evaluate(() => (window as unknown as { moonBrowser: { getTabs(): Promise<Array<{ private: boolean }>> } }).moonBrowser.getTabs());
      expect(restoredTabs.every(tab => !tab.private)).toBe(true);
    } finally { await application.close(); }
  } finally { await rm(userData, { recursive: true, force: true }); }
});
