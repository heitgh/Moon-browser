import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserTab } from "@moon/platform";
import { BetterSqliteConnection } from "../../../../packages/storage/adapters/better-sqlite-connection.js";
import { parseMoonProfileBackup } from "../../../../packages/storage/backup/profile-backup.js";
import { MoonDatabase } from "../../../../packages/storage/database/database.js";
import { foundationMigrations } from "../../../../packages/storage/migrations/foundation-migrations.js";
import { MigrationManager } from "../../../../packages/storage/migrations/migration-manager.js";
import { BookmarkRepository } from "../../../../packages/storage/repositories/bookmark-repository.js";
import { HistoryRepository } from "../../../../packages/storage/repositories/history-repository.js";
import { NoteRepository } from "../../../../packages/storage/repositories/note-repository.js";
import { SettingsRepository } from "../../../../packages/storage/repositories/settings-repository.js";
import { ThemeRepository, type ThemeRecord } from "../../../../packages/storage/repositories/theme-repository.js";
import { WallpaperRepository } from "../../../../packages/storage/repositories/wallpaper-repository.js";
import { WorkspaceRepository } from "../../../../packages/storage/repositories/workspace-repository.js";
import { normalizeMoonInternalUrl } from "../../../../packages/navigation/internal-routes.js";
import type { ProfileDataMutation, ProfileDataSnapshot } from "../../../../packages/ipc/profile-data-contract.js";
import { parseSitePermissionRecords, type SitePermissionRecord } from "../../../../packages/ipc/site-permission-contract.js";
import type { ImportedProfileData, ImportResult } from "../../../../packages/ipc/browser-import-contract.js";

export interface RestorableBrowserTab {
  readonly id: string;
  readonly url: string;
  readonly active: boolean;
  readonly workspaceId?: string;
  readonly sessionId?: string;
}

interface BrowserSessionRecord {
  readonly version: 1;
  readonly savedAt: number;
  readonly tabs: readonly RestorableBrowserTab[];
}

export class ProfileStorage {
  readonly #connection: BetterSqliteConnection;
  readonly #database: MoonDatabase;
  readonly #settings: SettingsRepository;
  readonly #bookmarks: BookmarkRepository;
  readonly #history: HistoryRepository;
  readonly #notes: NoteRepository;
  readonly #themes: ThemeRepository;
  readonly #wallpapers: WallpaperRepository;
  readonly #workspaces: WorkspaceRepository;

  constructor(readonly profileDirectory: string) {
    this.#connection = new BetterSqliteConnection(join(profileDirectory, "moon.sqlite3"));
    this.#database = new MoonDatabase(this.#connection);
    this.#settings = new SettingsRepository(this.#database);
    this.#bookmarks = new BookmarkRepository(this.#database);
    this.#history = new HistoryRepository(this.#database);
    this.#notes = new NoteRepository(this.#database);
    this.#themes = new ThemeRepository(this.#database);
    this.#wallpapers = new WallpaperRepository(this.#database);
    this.#workspaces = new WorkspaceRepository(this.#database);
  }

  async open(): Promise<void> {
    await mkdir(this.profileDirectory, { recursive: true, mode: 0o700 });
    await this.#database.connect();
    await new MigrationManager(this.#database, foundationMigrations).migrate();
  }

  async close(): Promise<void> {
    await this.#database.close();
  }

  async migrateLegacyProfile(content: string): Promise<{ readonly migrated: boolean; readonly version: number }> {
    const backup = parseMoonProfileBackup(content);
    const current = await this.#metadataNumber("legacy_profile_version");
    if (current >= 1) return { migrated: false, version: current };

    const canonical = JSON.stringify(backup, null, 2);
    const backupPath = join(this.profileDirectory, "legacy-profile-backup-v1.json");
    const temporaryPath = `${backupPath}.tmp`;
    await writeFile(temporaryPath, canonical, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, backupPath);

    const now = Date.now();
    await this.#database.transaction(async connection => {
      for (const item of backup.bookmarks) {
        await this.#bookmarks.save({ id: item.id, url: item.url, title: item.title, tags: [], createdAt: item.time, updatedAt: item.time });
      }
      for (const item of backup.history) {
        await this.#history.save({ id: item.id, url: item.url, title: item.title, transition: "link", visitCount: 1, typedCount: 0, firstVisitedAt: item.time, lastVisitedAt: item.time });
      }
      if (backup.notes.trim()) {
        await this.#notes.save({ id: "legacy-notes", title: "Notas migradas", content: backup.notes, format: "plain-text", pinned: false, archived: false, tags: [], createdAt: now, updatedAt: now });
      }
      for (const [position, item] of backup.workspaces.entries()) {
        await this.#workspaces.save({ id: item.id, name: item.name, position, layout: "standard", appearance: {}, default: position === 0, archived: false, createdAt: now, updatedAt: now, lastAccessedAt: now });
      }
      for (const item of backup.themes) {
        await this.#themes.save({ id: item.id, name: item.name, tokens: JSON.stringify({ accent: item.accent, wallpaper: item.wallpaper, glassHome: item.glassHome }), builtin: false, createdAt: now, updatedAt: now });
      }
      for (const wallpaper of new Set([backup.preferences.wallpaper, ...backup.themes.map(theme => theme.wallpaper)])) {
        await this.#wallpapers.save({ id: `wallpaper:${wallpaper}`, name: wallpaper.split("/").at(-1) ?? "Wallpaper", source: wallpaper, type: "image", createdAt: now });
      }
      await this.#settings.setValue("preferences", backup.preferences);
      await this.#settings.setValue("shortcuts", backup.shortcuts);
      await connection.run(
        "INSERT INTO moon_metadata(key, value, updated_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        ["legacy_profile_version", "1", now]
      );
    });
    return { migrated: true, version: 1 };
  }

  async saveBrowserSession(tabs: readonly BrowserTab[]): Promise<void> {
    const record: BrowserSessionRecord = {
      version: 1,
      savedAt: Date.now(),
      tabs: tabs
        .filter(tab => !tab.private)
        .map(tab => ({ id: tab.id, url: tab.url, active: tab.active, workspaceId: tab.workspaceId, sessionId: tab.sessionId }))
    };
    await this.#settings.setValue("browser-session", record);
  }

  async loadBrowserSession(): Promise<readonly RestorableBrowserTab[]> {
    const value = await this.#settings.getValue<BrowserSessionRecord>("browser-session");
    if (!value || value.version !== 1 || !Array.isArray(value.tabs) || value.tabs.length > 500) return [];
    const tabs: RestorableBrowserTab[] = [];
    for (const candidate of value.tabs) {
      if (!candidate || typeof candidate.id !== "string" || candidate.id.length > 100 || typeof candidate.url !== "string" || candidate.url.length > 16_384 || typeof candidate.active !== "boolean") return [];
      const normalizedUrl = normalizeMoonInternalUrl(candidate.url) ?? candidate.url;
      if (!normalizeMoonInternalUrl(normalizedUrl)) {
        try { if (!["http:", "https:"].includes(new URL(normalizedUrl).protocol)) return []; }
        catch { return []; }
      }
      tabs.push({ ...candidate, url: normalizedUrl });
    }
    return tabs;
  }

  async loadProfileData(): Promise<ProfileDataSnapshot> {
    const [bookmarks, history, notes, workspaces] = await Promise.all([
      this.#bookmarks.list(),
      this.#history.recent(500),
      this.#notes.list(undefined, true),
      this.#workspaces.list()
    ]);
    const scratchpad = notes.find(note => note.id === "moon-scratchpad") ?? notes.find(note => note.id === "legacy-notes") ?? notes[0];
    return {
      bookmarks: bookmarks.map(item => ({ id: item.id, title: item.title, url: item.url, time: item.createdAt })),
      history: history.map(item => ({ id: item.id, title: item.title, url: item.url, time: item.lastVisitedAt })),
      notes: scratchpad?.content ?? "",
      workspaces: workspaces.map(item => ({ id: item.id, name: item.name, position: item.position }))
    };
  }

  async applyProfileMutation(mutation: ProfileDataMutation): Promise<void> {
    const now = Date.now();
    switch (mutation.type) {
      case "bookmark:save": {
        const existing = await this.#bookmarks.get(mutation.value.id);
        await this.#bookmarks.save({ id: mutation.value.id, title: mutation.value.title, url: mutation.value.url, tags: existing?.tags ?? [], createdAt: existing?.createdAt ?? mutation.value.time, updatedAt: now });
        return;
      }
      case "bookmark:delete": await this.#bookmarks.delete(mutation.id); return;
      case "history:record":
        await this.#history.save({ id: mutation.value.id, title: mutation.value.title, url: mutation.value.url, transition: "link", visitCount: 1, typedCount: 0, firstVisitedAt: mutation.value.time, lastVisitedAt: mutation.value.time });
        return;
      case "history:clear": await this.#history.clear(); return;
      case "notes:save": {
        const existing = await this.#notes.get("moon-scratchpad");
        await this.#notes.save({ id: "moon-scratchpad", title: "Bloco de notas", content: mutation.content, format: "plain-text", pinned: false, archived: false, tags: [], createdAt: existing?.createdAt ?? now, updatedAt: now });
        return;
      }
      case "workspace:save": {
        const existing = await this.#workspaces.get(mutation.value.id);
        const current = existing ?? (await this.#workspaces.list())[0];
        await this.#workspaces.save({ id: mutation.value.id, name: mutation.value.name, position: mutation.value.position, layout: existing?.layout ?? "standard", appearance: existing?.appearance ?? {}, default: existing?.default ?? !current, archived: false, createdAt: existing?.createdAt ?? now, updatedAt: now, lastAccessedAt: now });
        return;
      }
      case "workspace:delete": await this.#workspaces.delete(mutation.id); return;
    }
  }

  async importExternalProfile(sourceId: string, data: ImportedProfileData): Promise<ImportResult> {
    const existingBookmarks = new Set((await this.#bookmarks.list()).map(item => item.url));
    const existingHistory = new Set((await this.#history.all()).map(item => item.url));
    const bookmarks = data.bookmarks.filter(item => { if (existingBookmarks.has(item.url)) return false; existingBookmarks.add(item.url); return true; });
    const history = data.history.filter(item => { if (existingHistory.has(item.url)) return false; existingHistory.add(item.url); return true; });
    await this.#database.transaction(async () => {
      for (const item of bookmarks) await this.#bookmarks.save({ id: item.id, title: item.title, url: item.url, tags: ["imported"], createdAt: item.time, updatedAt: Date.now() });
      for (const item of history) await this.#history.save({ id: item.id, title: item.title, url: item.url, transition: "link", visitCount: 1, typedCount: 0, firstVisitedAt: item.time, lastVisitedAt: item.time });
      await this.#settings.setValue(`import-report:${sourceId}`, { importedAt: Date.now(), imported: { bookmarks: bookmarks.length, history: history.length }, skipped: { bookmarks: data.bookmarks.length - bookmarks.length, history: data.history.length - history.length } });
    });
    return { sourceId, imported: { bookmarks: bookmarks.length, history: history.length }, skipped: { bookmarks: data.bookmarks.length - bookmarks.length, history: data.history.length - history.length } };
  }

  async loadSitePermissions(): Promise<readonly SitePermissionRecord[]> {
    return parseSitePermissionRecords(await this.#settings.getValue<unknown>("site-permissions"));
  }

  async saveSitePermissions(records: readonly SitePermissionRecord[]): Promise<void> {
    await this.#settings.setValue("site-permissions", parseSitePermissionRecords(records));
  }

  listThemes(): Promise<readonly ThemeRecord[]> { return this.#themes.list(); }
  getTheme(id: string): Promise<ThemeRecord | undefined> { return this.#themes.get(id); }
  saveTheme(theme: ThemeRecord): Promise<void> { return this.#themes.save(theme); }
  removeTheme(id: string): Promise<boolean> { return this.#themes.removeCustom(id); }

  async #metadataNumber(key: string): Promise<number> {
    const row = await this.#database.get<{ value: string }>("SELECT value FROM moon_metadata WHERE key = ?", [key]);
    const value = Number(row?.value ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
}
