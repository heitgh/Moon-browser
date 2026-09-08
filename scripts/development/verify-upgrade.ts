import { existsSync } from "node:fs";
import { _electron as electron, expect, type ElectronApplication } from "@playwright/test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.MOON_HEADLESS === "1" ? undefined : process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const desktopEnv = { ...process.env, ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}) };
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];
const previous = process.env.MOON_PREVIOUS_SOURCE;
const executable = process.env.MOON_VERIFY_EXECUTABLE;
if (!previous || !executable) throw new Error("Defina MOON_PREVIOUS_SOURCE e MOON_VERIFY_EXECUTABLE. Os perfis de verificação são sempre temporários.");
const root = await mkdtemp(join(tmpdir(), "moon-verify-upgrade-"));
const profile = join(root, "profile"); const backup = join(root, "backup"); const rollback = join(root, "rollback");
async function launch(data: string, old = false): Promise<ElectronApplication> {
  return electron.launch({ ...(old ? {} : { executablePath: resolve(executable!) }), cwd: old ? previous : process.cwd(), args: [...platformArguments, `--user-data-dir=${data}`, ...(old ? ["."] : [])], env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: data } });
}
async function shell(application: ElectronApplication) {
  await expect.poll(() => application.windows().some(p => /index.html$/.test(p.url()))).toBe(true);
  const page = application.windows().find(p => /index.html$/.test(p.url()))!;
  const skip = page.getByLabel("Pular configuração inicial");
  if (await skip.waitFor({ state: "visible", timeout: 1000 }).then(() => true).catch(() => false)) await skip.click();
  return page;
}
let application: ElectronApplication | undefined;
try {
  application = await launch(profile, true); let page = await shell(application);
  await page.evaluate(async () => {
    const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
    await bridge.mutateProfileData({ type: "bookmark:save", value: { id: "upgrade-bookmark", title: "Fonte de estudo", url: "https://example.org/study", time: 100 } });
    await bridge.mutateProfileData({ type: "notes:save", content: "Nota antiga que deve sobreviver à atualização." });
    const document = await bridge.loadCustomization(); await bridge.commitCustomization({ ...document, revision: document.revision + 1, updatedAt: Date.now(), global: { ...document.global, layout: { ...document.global.layout, drawer: { ...document.global.layout.drawer, width: 440 } } } });
  });
  const previousVersion = await application.evaluate(({ app }) => app.getVersion());
  await application.close(); application = undefined; await cp(profile, backup, { recursive: true });
  application = await launch(profile); page = await shell(application);
  const verify = async () => page.evaluate(async () => {
    const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
    const data = await bridge.getProfileData(); const customization = await bridge.loadCustomization();
    return { note: data.notes, bookmark: data.bookmarks.find(b => b.id === "upgrade-bookmark")?.title, width: customization.global.layout.drawer.width };
  });
  const expected = { note: "Nota antiga que deve sobreviver à atualização.", bookmark: "Fonte de estudo", width: 440 };
  expect(await verify()).toEqual(expected);
  const currentVersion = await application.evaluate(({ app }) => app.getVersion()); expect(currentVersion).toBe("0.6.0-alpha.1");
  await expect(page.getByLabel("Moon Research", { exact: true })).toBeVisible();
  await application.close(); application = undefined;
  application = await launch(profile); page = await shell(application); expect(await verify()).toEqual(expected);
  await application.close(); application = undefined;
  await cp(backup, rollback, { recursive: true }); application = await launch(rollback, true); page = await shell(application); expect(await verify()).toEqual(expected);
  console.log(JSON.stringify({ previousVersion, currentVersion, upgrade: "PASS", restart: "PASS", rollbackFromFullBackup: "PASS", profile: "temporary", checked: ["bookmark", "scratchpad", "settings", "research entry"] }, null, 2));
} finally { await application?.close(); await rm(root, { recursive: true, force: true }); }
