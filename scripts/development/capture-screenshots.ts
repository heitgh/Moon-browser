import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

async function shellWindow(application: ElectronApplication): Promise<Page> {
  await expect
    .poll(() =>
      application
        .windows()
        .some(
          (page) =>
            page.url().startsWith("file:") &&
            page.url().endsWith("/index.html"),
        ),
    )
    .toBe(true);
  return application
    .windows()
    .find(
      (page) =>
        page.url().startsWith("file:") && page.url().endsWith("/index.html"),
    )!;
}

async function finishFirstRun(page: Page): Promise<void> {
  const onboarding = page.getByTestId("moon-onboarding");
  if (
    await onboarding
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await page.getByLabel("Pular configuração inicial").click();
    await expect(onboarding).toBeHidden();
  }
}

async function resize(
  application: ElectronApplication,
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  await application.evaluate(
    ({ BrowserWindow }, size) => {
      const windows = BrowserWindow.getAllWindows();
      const window =
        BrowserWindow.getFocusedWindow() ??
        windows.find((candidate) => candidate.isVisible()) ??
        windows[0];
      if (!window) throw new Error("Moon window is unavailable");
      window.unmaximize();
      window.setContentSize(size.width, size.height, false);
      return true;
    },
    { width, height },
  );
  await page.setViewportSize({ width, height });
}

const profile = await mkdtemp(join(tmpdir(), "moon-screenshot-profile-"));
const runtimeDirectory =
  process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland =
  process.env.WAYLAND_DISPLAY ??
  (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const detectedDisplay =
  process.env.DISPLAY ?? (existsSync("/tmp/.X11-unix/X0") ? ":0" : undefined);
const desktopEnv = {
  ...process.env,
  ...(detectedWayland
    ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory }
    : {}),
  ...(detectedDisplay ? { DISPLAY: detectedDisplay } : {}),
};
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];
const application = await electron.launch({
  args: [...platformArguments, `--user-data-dir=${profile}`, "."],
  cwd: process.cwd(),
  env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile },
});

try {
  const window = await shellWindow(application);
  await resize(application, window, 1280, 800);
  await expect(window.getByTestId("moon-onboarding")).toHaveCount(1);
  await expect(window.getByTestId("moon-onboarding")).toBeVisible();
  await window.screenshot({
    path: "assets/screenshots/final-update-onboarding.png",
  });
  await finishFirstRun(window);
  await expect(
    window.getByLabel("Página inicial", { exact: true }),
  ).toBeVisible();

  for (const [width, height] of [
    [909, 1026],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    await resize(application, window, width, height);
    await window.waitForTimeout(180);
    await window.screenshot({
      path: `assets/screenshots/phase-a-home-${width}x${height}.png`,
    });
  }

  await resize(application, window, 1440, 900);
  await window.screenshot({ path: "assets/screenshots/page.png" });
  await window.getByLabel("Central de comandos", { exact: true }).click();
  await expect(
    window.getByLabel("Buscar na Central de comandos"),
  ).toBeVisible();
  await window.screenshot({
    path: "assets/screenshots/final-update-command-center.png",
  });
  await window.keyboard.press("Escape");
  await window.getByLabel("Foco e Zen", { exact: true }).click();
  await expect(window.locator(".moon-focus-form")).toBeVisible();
  await window.waitForTimeout(300);
  await window.screenshot({
    path: "assets/screenshots/final-update-focus.png",
  });
  await window.getByLabel("Fechar painel").click();
  const omnibox = window.getByPlaceholder("Pesquise ou digite um endereço");
  await omnibox.fill("https://example.com/");
  await window.getByLabel("Abrir endereço").click();
  await expect
    .poll(() =>
      window.evaluate(() =>
        (
          window as unknown as {
            moonBrowser: { getTabs(): Promise<Array<{ url: string }>> };
          }
        ).moonBrowser
          .getTabs()
          .then((tabs) =>
            tabs.some((tab) => tab.url === "https://example.com/"),
          ),
      ),
    )
    .toBe(true);
  await window.waitForTimeout(300);
  await window.screenshot({
    path: "assets/screenshots/phase-a-browser-page.png",
  });
  await window.getByLabel("Página inicial", { exact: true }).click();
  await window.waitForTimeout(180);
  await window.getByLabel("Proteção e AdBlock").click();
  await expect(window.locator(".moon-drawer-title")).toHaveText("Proteção");
  await window.waitForTimeout(300);
  await window.screenshot({ path: "assets/screenshots/page1.png" });
  await window.getByLabel("Configurações", { exact: true }).click();
  await expect(window.getByRole("dialog")).toBeVisible();
  await window.screenshot({ path: "assets/screenshots/page2.png" });
  await window.getByLabel("Simples", { exact: true }).click();
  await expect(
    window.getByRole("heading", { name: "Personalize o essencial" }),
  ).toBeVisible();
  await window.locator(".moon-customization-content").evaluate((node) => {
    node.scrollTop = 0;
  });
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-simple.png",
  });
  await expect(window.getByLabel("Recolher prévia")).toBeVisible();
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-preview-expanded.png",
  });
  await window.getByLabel("Avançado", { exact: true }).click();
  await window.getByLabel("Aparência", { exact: true }).click();
  await window.locator(".moon-customization-content").evaluate((node) => {
    node.scrollTop = 0;
  });
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-advanced.png",
  });
  const iconEditor = window
    .locator(".moon-setting-group", { hasText: "Ícones semânticos" })
    .first();
  await iconEditor.scrollIntoViewIfNeeded();
  await window.waitForTimeout(180);
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-theme-editor-icons.png",
  });
  const themeLibrary = window
    .locator(".moon-setting-group", { hasText: "Biblioteca de temas" })
    .first();
  await themeLibrary.scrollIntoViewIfNeeded();
  await window.waitForTimeout(180);
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-theme-library.png",
  });
  await window.getByLabel("Cancelar mudanças").click();
  await expect(window.getByLabel("Editar Home")).toBeVisible();
  await window.waitForTimeout(2_500);
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-home-final.png",
  });
  await window.getByLabel("Editar Home").click();
  await expect(
    window.getByText("Adicionar conteúdo", { exact: true }),
  ).toBeVisible();
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-home-editing.png",
  });
  await window.getByLabel("Cancelar edição da Home").click();
  await window.getByLabel("Gerenciar perfis", { exact: true }).first().click();
  await expect(window.locator(".moon-profile-list")).toBeVisible();
  await window.waitForTimeout(450);
  await window.screenshot({
    path: "assets/screenshots/personalization-v4-profiles.png",
  });
  await window.getByLabel("Configurações", { exact: true }).click();
  await expect(window.getByRole("dialog")).toBeVisible();
  for (const [label, slug] of [
    ["Aparência", "appearance"],
    ["Layout e densidade", "layout"],
    ["Home e widgets", "home"],
    ["Tipografia", "typography"],
    ["Pesquisa", "search"],
    ["Workspaces e dados", "data"],
  ] as const) {
    await window.getByLabel(label, { exact: true }).click();
    await window.waitForTimeout(120);
    await window.screenshot({
      path: `assets/screenshots/phase-a-settings-${slug}.png`,
    });
  }
} finally {
  await application.close();
  await rm(profile, { recursive: true, force: true });
}
