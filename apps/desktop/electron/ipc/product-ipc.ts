import type { ElectronAdblockService } from "../services/adblock-service.js";
import type { ElectronDownloadManager } from "../services/download-manager.js";
import type { IpcRouter } from "./ipc-router.js";
import { dialog } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseMoonProfileBackup } from "../../../../packages/storage/backup/profile-backup.js";
import { createDefaultCustomization, parseCustomizationImport } from "../../../../ui/customization/customization-schema.js";
import { parseMoonHome, serializeMoonHome } from "../../../../ui/customization/moon-home-contract.js";
import type { ProfileStorage } from "../services/profile-storage.js";
import type { MoonThemeService } from "../services/moon-theme-service.js";
import { parseProfileDataMutation } from "../../../../packages/ipc/profile-data-contract.js";
import type { WindowManager } from "../main/window-manager.js";
import type { BrowserProfileImportService } from "../services/browser-profile-import-service.js";
import { parseImportSelection } from "../../../../packages/ipc/browser-import-contract.js";

interface IdPayload { readonly id: string; }

export function registerProductIpc(
  router: IpcRouter,
  downloads: ElectronDownloadManager,
  adblock: ElectronAdblockService,
  profile: ProfileStorage,
  themes: MoonThemeService,
  windows: WindowManager,
  profileImporter: BrowserProfileImportService
): void {
  const idFrom = (payload: IdPayload): string => {
    if (!payload || typeof payload.id !== "string" || payload.id.length > 100) {
      throw new TypeError("A valid ID is required");
    }
    return payload.id;
  };
  const assertNormalWindow = (event: Electron.IpcMainInvokeEvent): void => {
    const windowId = windows.idForWebContents(event.sender);
    if (!windowId || windows.isPrivate(windowId)) throw new Error("Esta operação não está disponível em janelas privadas");
  };
  const boundedCustomization = (value: unknown): unknown => {
    let serialized: string;
    try { serialized = JSON.stringify(value); }
    catch { throw new TypeError("Invalid customization payload"); }
    if (serialized.length > 2_000_000) throw new TypeError("Customization payload exceeds 2 MB");
    return value;
  };

  router.register("download:list", () => downloads.list());
  router.register("download:pause", (_event, payload: IdPayload) => downloads.pause(idFrom(payload)));
  router.register("download:resume", (_event, payload: IdPayload) => downloads.resume(idFrom(payload)));
  router.register("download:cancel", (_event, payload: IdPayload) => downloads.cancel(idFrom(payload)));
  router.register("download:open", (_event, payload: IdPayload) => downloads.open(idFrom(payload)));
  router.register("download:show-in-folder", (_event, payload: IdPayload) => downloads.showInFolder(idFrom(payload)));
  router.register("download:clear-finished", () => downloads.clearFinished());

  router.register("adblock:get-status", () => adblock.status());
  router.register("adblock:set-enabled", (_event, payload?: { readonly enabled?: boolean }) => {
    if (!payload || typeof payload.enabled !== "boolean") {
      throw new TypeError("An enabled value is required");
    }
    adblock.setEnabled(payload.enabled);
    return adblock.status();
  });

  router.register("product:export-data", async (_event, payload?: { readonly content?: string }) => {
    if (!payload || typeof payload.content !== "string" || payload.content.length > 5_000_000) {
      throw new TypeError("Invalid export content");
    }
    const canonicalContent = JSON.stringify(parseMoonProfileBackup(payload.content), null, 2);
    const result = await dialog.showSaveDialog({
      title: "Exportar dados do Moon",
      defaultPath: `moon-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Moon backup", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, canonicalContent, { encoding: "utf8", mode: 0o600 });
    return true;
  });
  router.register("product:import-data", async () => {
    const result = await dialog.showOpenDialog({
      title: "Importar dados do Moon",
      properties: ["openFile"],
      filters: [{ name: "Moon backup", extensions: ["json"] }]
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    const content = await readFile(path, "utf8");
    return JSON.stringify(parseMoonProfileBackup(content));
  });
  router.register("product:export-customization", async (_event, payload?: { readonly content?: string }) => {
    if (!payload || typeof payload.content !== "string" || payload.content.length > 2_000_000) throw new TypeError("Invalid customization export");
    parseCustomizationImport(payload.content, createDefaultCustomization());
    const canonicalContent = JSON.stringify(JSON.parse(payload.content) as unknown, null, 2);
    const result = await dialog.showSaveDialog({ title: "Exportar personalização do Moon", defaultPath: `moon-personalizacao-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "Moon Customization", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, canonicalContent, { encoding: "utf8", mode: 0o600 }); return true;
  });
  router.register("product:import-customization", async () => {
    const result = await dialog.showOpenDialog({ title: "Importar personalização do Moon", properties: ["openFile"], filters: [{ name: "Moon Customization", extensions: ["json"] }] });
    const path = result.filePaths[0]; if (result.canceled || !path) return null;
    const content = await readFile(path, "utf8"); parseCustomizationImport(content, createDefaultCustomization()); return content;
  });
  router.register("product:export-moon-home", async (_event, payload?: { readonly content?: string }) => {
    if (!payload || typeof payload.content !== "string" || payload.content.length > 512_000) throw new TypeError("Invalid .moonhome export");
    const canonicalContent = serializeMoonHome(parseMoonHome(payload.content));
    const result = await dialog.showSaveDialog({ title: "Exportar Home do Moon", defaultPath: `moon-home-${new Date().toISOString().slice(0, 10)}.moonhome`, filters: [{ name: "Moon Home", extensions: ["moonhome"] }] });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, canonicalContent, { encoding: "utf8", mode: 0o600 }); return true;
  });
  router.register("product:import-moon-home", async () => {
    const result = await dialog.showOpenDialog({ title: "Importar Home do Moon", properties: ["openFile"], filters: [{ name: "Moon Home", extensions: ["moonhome"] }] });
    const path = result.filePaths[0]; if (result.canceled || !path) return null;
    const content = await readFile(path, "utf8"); return serializeMoonHome(parseMoonHome(content));
  });
  router.register("product:export-settings-diagnostic", async (_event, payload?: { readonly content?: string }) => {
    if (!payload || typeof payload.content !== "string" || payload.content.length > 100_000) throw new TypeError("Invalid settings diagnostic");
    const parsed = JSON.parse(payload.content) as { readonly format?: unknown }; if (parsed.format !== "moon-settings-diagnostic") throw new TypeError("Invalid settings diagnostic format");
    const result = await dialog.showSaveDialog({ title: "Exportar diagnóstico das configurações", defaultPath: `moon-settings-diagnostic-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "Moon Settings Diagnostic", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return false; await writeFile(result.filePath, JSON.stringify(parsed, null, 2), { encoding: "utf8", mode: 0o600 }); return true;
  });
  router.register("product:fetch-wallpaper", async (_event, payload?: { readonly url?: string }) => {
    if (!payload || typeof payload.url !== "string" || payload.url.length > 2_048) throw new TypeError("Invalid wallpaper URL");
    return fetchSafeWallpaper(payload.url);
  });
  router.register("product:fetch-favicon", async (_event, payload?: { readonly url?: string }) => {
    if (!payload || typeof payload.url !== "string" || payload.url.length > 2_048) throw new TypeError("Invalid favicon URL");
    return fetchSafeFavicon(payload.url);
  });
  router.register("product:migrate-legacy-profile", (_event, payload?: { readonly content?: string }) => {
    if (!payload || typeof payload.content !== "string" || payload.content.length > 5_000_000) {
      throw new TypeError("Invalid legacy profile content");
    }
    return profile.migrateLegacyProfile(payload.content);
  });
  router.register("customization:load", (_event, payload?: { readonly legacy?: unknown }) => {
    return profile.loadCustomization(payload?.legacy === undefined ? undefined : boundedCustomization(payload.legacy));
  });
  router.register("customization:commit", (event, payload?: { readonly document?: unknown }) => {
    assertNormalWindow(event);
    if (!payload || payload.document === undefined) throw new TypeError("A customization document is required");
    return profile.commitCustomization(boundedCustomization(payload.document));
  });
  router.register("profile:get-data", async event => {
    const snapshot = await profile.loadProfileData();
    const windowId = windows.idForWebContents(event.sender);
    if (!windowId) throw new Error("Browser window is not registered");
    return windows.isPrivate(windowId) ? { ...snapshot, history: [], notes: "" } : snapshot;
  });
  router.register("profile:mutate", (event, payload: unknown) => {
    const windowId = windows.idForWebContents(event.sender);
    if (!windowId) throw new Error("Browser window is not registered");
    const mutation = parseProfileDataMutation(payload);
    if (windows.isPrivate(windowId) && (mutation.type === "history:record" || mutation.type === "notes:save")) throw new Error("Private windows cannot persist history or notes");
    return profile.applyProfileMutation(mutation);
  });
  router.register("import:discover", event => { assertNormalWindow(event); return profileImporter.discover(); });
  router.register("import:run", (event, payload: unknown) => { assertNormalWindow(event); return profileImporter.import(parseImportSelection(payload)); });
  router.register("import:bookmarks-html", event => { assertNormalWindow(event); return profileImporter.importBookmarksHtml(); });
  router.register("theme:import", () => themes.importFromDialog());
  router.register("theme:confirm", (_event, payload: { readonly intentId: string }) => themes.confirm(idFrom({ id: payload?.intentId })));
  router.register("theme:cancel", (_event, payload: { readonly intentId: string }) => themes.cancel(idFrom({ id: payload?.intentId })));
  router.register("theme:list", () => themes.list());
  router.register("theme:apply", (_event, payload: IdPayload) => themes.apply(idFrom(payload)));
  router.register("theme:activate", (_event, payload: IdPayload) => themes.activate(idFrom(payload)));
  router.register("theme:rollback", (_event, payload?: { readonly packageId?: string }) => {
    if (!payload || typeof payload.packageId !== "string" || payload.packageId.length > 64) throw new TypeError("A valid package ID is required");
    return themes.rollback(payload.packageId);
  });
  router.register("theme:remove", (_event, payload: IdPayload) => themes.remove(idFrom(payload)));
  router.register("theme:export", (_event, payload: IdPayload) => themes.export(idFrom(payload)));
}

const MAX_WALLPAPER_BYTES = 1_500_000;
const WALLPAPER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FAVICON_BYTES = 250_000;
const FAVICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"]);

async function fetchSafeWallpaper(input: string): Promise<string> {
  let url = new URL(input);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicHttpsUrl(url, "Wallpaper");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { accept: "image/png,image/jpeg,image/webp" } });
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location || redirect === 3) throw new Error("Wallpaper has too many redirects"); url = new URL(location, url); continue; }
    if (!response.ok) throw new Error(`Wallpaper request failed (${response.status})`);
    const mime = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase(); if (!mime || !WALLPAPER_TYPES.has(mime)) throw new Error("Wallpaper must be PNG, JPEG or WebP");
    const declared = Number(response.headers.get("content-length") ?? "0"); if (declared > MAX_WALLPAPER_BYTES) throw new Error("Wallpaper exceeds 1.5 MB");
    if (!response.body) throw new Error("Wallpaper response has no body");
    const chunks: Uint8Array[] = []; let total = 0; const reader = response.body.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; if (!value) continue; total += value.byteLength; if (total > MAX_WALLPAPER_BYTES) { await reader.cancel(); throw new Error("Wallpaper exceeds 1.5 MB"); } chunks.push(value); }
    const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))); return `data:${mime};base64,${bytes.toString("base64")}`;
  }
  throw new Error("Wallpaper could not be loaded");
}

async function fetchSafeFavicon(input: string): Promise<string> {
  let url = new URL(input);
  for (let redirect = 0; redirect <= 2; redirect += 1) {
    await assertPublicHttpsUrl(url, "Favicon");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { accept: "image/png,image/jpeg,image/webp,image/gif,image/x-icon" } });
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location || redirect === 2) throw new Error("Favicon has too many redirects"); url = new URL(location, url); continue; }
    if (!response.ok) throw new Error(`Favicon request failed (${response.status})`);
    const mime = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase(); if (!mime || !FAVICON_TYPES.has(mime)) throw new Error("Favicon has an unsupported image type");
    const declared = Number(response.headers.get("content-length") ?? "0"); if (declared > MAX_FAVICON_BYTES) throw new Error("Favicon exceeds 250 KB");
    if (!response.body) throw new Error("Favicon response has no body");
    const chunks: Uint8Array[] = []; let total = 0; const reader = response.body.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; if (!value) continue; total += value.byteLength; if (total > MAX_FAVICON_BYTES) { await reader.cancel(); throw new Error("Favicon exceeds 250 KB"); } chunks.push(value); }
    return `data:${mime};base64,${Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("base64")}`;
  }
  throw new Error("Favicon could not be loaded");
}

async function assertPublicHttpsUrl(url: URL, resource: "Wallpaper" | "Favicon"): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error(`${resource} URL must use public HTTPS on port 443`);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }); if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error(`Private or local ${resource.toLowerCase()} hosts are not allowed`);
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address); if (version === 4) { const [a, b] = address.split(".").map(Number); return !(a === 0 || a === 10 || a === 127 || a! >= 224 || (a === 100 && b! >= 64 && b! <= 127) || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))); }
  if (version === 6) { const value = address.toLowerCase(); return !(value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value) || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.")); }
  return false;
}
