const MAX_ITEMS = 5_000;
const MAX_TEXT = 1_000_000;

export interface ProfileSavedLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly time: number;
}

export interface ProfileShortcut { readonly id: string; readonly name: string; readonly url: string; }
export interface ProfileTheme { readonly id: string; readonly name: string; readonly accent: string; readonly wallpaper: string; readonly glassHome: boolean; }
export interface ProfileWorkspace { readonly id: string; readonly name: string; }
export interface ProfilePreferences { readonly accent: string; readonly wallpaper: string; readonly searchEngine: "duckduckgo" | "google" | "brave"; readonly showClock: boolean; readonly showShortcuts: boolean; readonly glassHome: boolean; }

export interface MoonProfileBackupV1 {
  readonly format: "moon-profile";
  readonly version: 1;
  readonly exportedAt: string;
  readonly bookmarks: readonly ProfileSavedLink[];
  readonly history: readonly ProfileSavedLink[];
  readonly notes: string;
  readonly shortcuts: readonly ProfileShortcut[];
  readonly themes: readonly ProfileTheme[];
  readonly workspaces: readonly ProfileWorkspace[];
  readonly preferences: ProfilePreferences;
}

export type MoonProfileData = Omit<MoonProfileBackupV1, "format" | "version" | "exportedAt">;

export function createMoonProfileBackup(data: MoonProfileData): MoonProfileBackupV1 {
  return parseMoonProfileBackup(JSON.stringify({
    format: "moon-profile",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data
  }));
}

export function parseMoonProfileBackup(content: string): MoonProfileBackupV1 {
  if (content.length > 5_000_000) throw new Error("Backup file is too large");
  let value: unknown;
  try { value = JSON.parse(content); }
  catch { throw new Error("Backup is not valid JSON"); }
  const root = record(value, "backup");
  if (root.format !== "moon-profile" || root.version !== 1) throw new Error("Unsupported Moon backup format or version");
  const exportedAt = text(root.exportedAt, "exportedAt", 64);
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error("Invalid backup export date");
  const workspaces = list(root.workspaces, "workspaces", workspace);
  if (workspaces.length === 0) throw new Error("Backup must contain at least one workspace");
  uniqueIds(workspaces, "workspaces");
  const bookmarks = list(root.bookmarks, "bookmarks", savedLink);
  const history = list(root.history, "history", savedLink);
  const shortcuts = list(root.shortcuts, "shortcuts", shortcut);
  const themes = list(root.themes, "themes", theme);
  uniqueIds(bookmarks, "bookmarks"); uniqueIds(history, "history"); uniqueIds(shortcuts, "shortcuts"); uniqueIds(themes, "themes");
  return {
    format: "moon-profile",
    version: 1,
    exportedAt,
    bookmarks,
    history,
    notes: text(root.notes, "notes", MAX_TEXT),
    shortcuts,
    themes,
    workspaces,
    preferences: preferences(root.preferences)
  };
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, maximum = 512): string {
  if (typeof value !== "string" || value.length > maximum || value.includes("\0")) throw new Error(`Invalid ${name}`);
  return value;
}

function timestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}

function bool(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name}`);
  return value;
}

function webUrl(value: unknown, name: string, httpsOnly = false): string {
  const url = text(value, name, 16_384);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(`Invalid ${name}`); }
  if (httpsOnly ? parsed.protocol !== "https:" : !["http:", "https:"].includes(parsed.protocol)) throw new Error(`Invalid ${name} protocol`);
  return parsed.href;
}

function list<T>(value: unknown, name: string, decode: (value: unknown, index: number) => T): readonly T[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`Invalid ${name}`);
  return value.map((item, index) => decode(item, index));
}

function uniqueIds(values: readonly { readonly id: string }[], name: string): void {
  if (new Set(values.map(value => value.id)).size !== values.length) throw new Error(`Duplicate IDs in ${name}`);
}

function savedLink(value: unknown, index: number): ProfileSavedLink {
  const item = record(value, `saved link ${index}`);
  return { id: text(item.id, "saved link id", 100), title: text(item.title, "saved link title", 2_000), url: webUrl(item.url, "saved link URL"), time: timestamp(item.time, "saved link time") };
}

function shortcut(value: unknown, index: number): ProfileShortcut {
  const item = record(value, `shortcut ${index}`);
  return { id: text(item.id, "shortcut id", 100), name: text(item.name, "shortcut name", 200), url: webUrl(item.url, "shortcut URL", true) };
}

function theme(value: unknown, index: number): ProfileTheme {
  const item = record(value, `theme ${index}`);
  return { id: text(item.id, "theme id", 100), name: text(item.name, "theme name", 200), accent: color(item.accent), wallpaper: wallpaper(item.wallpaper), glassHome: bool(item.glassHome, "theme glassHome") };
}

function workspace(value: unknown, index: number): ProfileWorkspace {
  const item = record(value, `workspace ${index}`);
  return { id: text(item.id, "workspace id", 100), name: text(item.name, "workspace name", 200) };
}

function color(value: unknown): string {
  const result = text(value, "accent color", 32);
  if (!/^#[0-9a-f]{6}$/i.test(result)) throw new Error("Invalid accent color");
  return result.toLowerCase();
}

function preferences(value: unknown): ProfilePreferences {
  const item = record(value, "preferences");
  if (item.searchEngine !== "duckduckgo" && item.searchEngine !== "google" && item.searchEngine !== "brave") throw new Error("Invalid search engine");
  return {
    accent: color(item.accent),
    wallpaper: wallpaper(item.wallpaper),
    searchEngine: item.searchEngine,
    showClock: bool(item.showClock, "showClock"),
    showShortcuts: bool(item.showShortcuts, "showShortcuts"),
    glassHome: bool(item.glassHome, "glassHome")
  };
}

function wallpaper(value: unknown): string {
  const result = text(value, "wallpaper", 512);
  if (!/^\.\/assets\/wallpapers\/[a-z0-9-]+\.svg$/.test(result)) throw new Error("Invalid local wallpaper path");
  return result;
}
