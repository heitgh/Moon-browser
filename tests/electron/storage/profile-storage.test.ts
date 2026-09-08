import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileStorage } from "../../../apps/desktop/electron/services/profile-storage.js";
import { createMoonProfileBackup } from "../../../packages/storage/backup/profile-backup.js";
import { createDefaultCustomization } from "../../../ui/customization/customization-schema.js";

const temporaryDirectories: string[] = [];
const backup = createMoonProfileBackup({
  bookmarks: [{ id: "bookmark-1", title: "Moon", url: "https://moon.test/", time: 10 }],
  history: [{ id: "history-1", title: "Moon", url: "https://moon.test/", time: 11 }],
  notes: "Uma nota que não pode ser perdida",
  shortcuts: [],
  themes: [],
  workspaces: [{ id: "research", name: "Pesquisa" }],
  preferences: { accent: "#8a5cf5", wallpaper: "./assets/wallpapers/aurora.svg", searchEngine: "duckduckgo", showClock: true, showShortcuts: true, glassHome: false }
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function profile(): Promise<{ directory: string; storage: ProfileStorage }> {
  const directory = await mkdtemp(join(tmpdir(), "moon-profile-test-"));
  temporaryDirectories.push(directory);
  const storage = new ProfileStorage(directory);
  await storage.open();
  return { directory, storage };
}

describe("ProfileStorage", () => {
  it("migrates V3 customization to canonical V4 exactly once", async () => {
    const { storage } = await profile();
    const legacy = { ...createDefaultCustomization(100), version: 3, experience: { mode: "customize", lastSection: "layout" } };
    const migrated = await storage.loadCustomization(legacy);
    expect(migrated).toMatchObject({ version: 4, updatedAt: 100, experience: { mode: "advanced", view: "all", lastSection: "layout" } });
    const competingLegacy = createDefaultCustomization(200);
    (competingLegacy.global.appearance.colors as { accent: string }).accent = "#38bdf8";
    expect((await storage.loadCustomization(competingLegacy)).updatedAt).toBe(100);
    expect((await storage.loadCustomization()).global.appearance.colors.accent).toBe(migrated.global.appearance.colors.accent);
    await storage.close();
  });

  it("commits customization atomically and rejects stale revisions", async () => {
    const { storage } = await profile();
    const initial = await storage.loadCustomization(createDefaultCustomization(100));
    const next = structuredClone(initial);
    (next as { revision: number; updatedAt: number }).revision = initial.revision + 2;
    (next as { revision: number; updatedAt: number }).updatedAt = 200;
    (next.global.appearance.colors as { accent: string }).accent = "#38bdf8";
    expect((await storage.commitCustomization(next)).global.appearance.colors.accent).toBe("#38bdf8");
    await expect(storage.commitCustomization(initial)).rejects.toThrow(/outra janela/i);
    expect((await storage.loadCustomization()).global.appearance.colors.accent).toBe("#38bdf8");
    await storage.close();
  });

  it("backs up and migrates the legacy profile exactly once", async () => {
    const { directory, storage } = await profile();
    expect(await storage.migrateLegacyProfile(JSON.stringify(backup))).toEqual({ migrated: true, version: 1 });
    expect(await storage.migrateLegacyProfile(JSON.stringify(backup))).toEqual({ migrated: false, version: 1 });
    const sourceBackup = await readFile(join(directory, "legacy-profile-backup-v1.json"), "utf8");
    expect(JSON.parse(sourceBackup)).toEqual(backup);
    await storage.close();
  });

  it("restores only validated, non-private tabs", async () => {
    const { storage } = await profile();
    await storage.saveBrowserSession([
      { id: "tab-home", url: "moon://newtab", title: "Nova guia", active: false, loading: false, private: false },
      { id: "tab-web", url: "https://moon.test/", title: "Moon", active: true, loading: false, workspaceId: "research", private: false },
      { id: "tab-private", url: "https://private.test/", title: "Private", active: false, loading: false, private: true }
    ]);
    expect(await storage.loadBrowserSession()).toEqual([
      { id: "tab-home", url: "moon://newtab", active: false, workspaceId: undefined, sessionId: undefined },
      { id: "tab-web", url: "https://moon.test/", active: true, workspaceId: "research", sessionId: undefined }
    ]);
    await storage.close();
  });

  it("normalizes legacy about:blank home tabs without dropping the session", async () => {
    const { storage } = await profile();
    await storage.saveBrowserSession([
      { id: "legacy-home", url: "about:blank", title: "", active: true, loading: false, private: false }
    ]);
    expect(await storage.loadBrowserSession()).toEqual([
      { id: "legacy-home", url: "moon://newtab", active: true, workspaceId: undefined, sessionId: undefined }
    ]);
    await storage.close();
  });

  it("uses repositories as the canonical profile data source", async () => {
    const { storage } = await profile();
    await storage.migrateLegacyProfile(JSON.stringify(backup));
    await storage.applyProfileMutation({ type: "bookmark:save", value: { id: "bookmark-2", title: "Nexus", url: "https://nexus.test/", time: 20 } });
    await storage.applyProfileMutation({ type: "notes:save", content: "Estado canônico no SQLite" });
    await storage.applyProfileMutation({ type: "workspace:save", value: { id: "workspace-product", name: "Produto", position: 1 } });
    const snapshot = await storage.loadProfileData();
    expect(snapshot.bookmarks.map(item => item.id)).toContain("bookmark-2");
    expect(snapshot.notes).toBe("Estado canônico no SQLite");
    expect(snapshot.workspaces).toContainEqual({ id: "workspace-product", name: "Produto", position: 1 });
    await storage.applyProfileMutation({ type: "bookmark:delete", id: "bookmark-2" });
    expect((await storage.loadProfileData()).bookmarks.map(item => item.id)).not.toContain("bookmark-2");
    await storage.close();
  });

  it("persists versioned timeline visits and deletes items or ranges exactly", async () => {
    const { storage } = await profile();
    const visit = (id: string, startedAt: number, url: string) => ({ schemaVersion: 2 as const, id, title: id, url, time: startedAt, startedAt, endedAt: startedAt + 50, durationMs: 50, profileId: "default", workspaceId: "research", sessionId: "session-1", tabId: "tab-1", source: "navigation" as const, navigationType: "typed" as const });
    await storage.recordHistoryEntry(visit("visit-older", 100, "https://older.test/"));
    await storage.recordHistoryEntry(visit("visit-newer", 200, "https://newer.test/"));
    expect((await storage.loadProfileData()).history.map(item => item.id)).toEqual(["visit-newer", "visit-older"]);
    await storage.applyProfileMutation({ type: "history:delete", id: "visit-newer" });
    expect((await storage.loadProfileData()).history.map(item => item.id)).toEqual(["visit-older"]);
    await storage.applyProfileMutation({ type: "history:delete-range", from: 90, to: 150 });
    expect((await storage.loadProfileData()).history).toEqual([]);
    await storage.close();
  });

  it("persists validated site permission decisions in profile settings", async () => {
    const { storage } = await profile();
    const records = [{ origin: "https://meet.example", permission: "media", decision: "allow" as const, updatedAt: 10 }];
    await storage.saveSitePermissions(records);
    expect(await storage.loadSitePermissions()).toEqual(records);
    await storage.close();
  });

  it("persists managed wallpaper assets independently from themes", async () => {
    const { storage } = await profile();
    const record = { id: "wallpaper-1234567890abcdef", name: "Aurora local", source: "data:image/png;base64,iVBORw0KGgo=", type: "image" as const, thumbnailData: "data:image/png;base64,iVBORw0KGgo=", mimeType: "image/png" as const, bytes: 8, hash: "1234567890abcdef", favorite: true, tags: ["noite"], fit: "cover" as const, position: "center", repeat: false, createdAt: 10, updatedAt: 20 };
    await storage.saveWallpaper(record);
    expect(await storage.getWallpaper(record.id)).toEqual(record);
    expect(await storage.listWallpapers()).toEqual([record]);
    expect(await storage.removeWallpaper(record.id)).toBe(true);
    expect(await storage.getWallpaper(record.id)).toBeUndefined();
    await storage.close();
  });

  it("stores Moon Notes with folders, safe backlink renames, revisions and recoverable trash", async () => {
    const { storage } = await profile();
    const input = (id: string, title: string, content: string, parentId?: string) => ({ id, kind: "note" as const, ...(parentId ? { parentId } : {}), title, content, format: "markdown" as const, pinned: false, favorite: false, tags: ["produto"] });
    await storage.applyProfileMutation({ type: "note:save", expectedRevision: 0, value: { ...input("folder-one", "Produto", ""), kind: "folder", content: "" } });
    await storage.applyProfileMutation({ type: "note:save", expectedRevision: 0, value: input("note-source", "Origem", "Veja [[Destino]]", "folder-one") });
    await storage.applyProfileMutation({ type: "note:save", expectedRevision: 0, value: input("note-target", "Destino", "Conteúdo") });
    await storage.applyProfileMutation({ type: "note:save", expectedRevision: 1, value: input("note-target", "Destino novo", "Conteúdo atualizado") });
    let snapshot = await storage.loadProfileData();
    expect(snapshot.noteDocuments.find(note => note.id === "note-source")?.content).toBe("Veja [[Destino novo]]");
    expect(snapshot.noteDocuments.find(note => note.id === "note-target")?.versions).toHaveLength(1);
    await expect(storage.applyProfileMutation({ type: "note:save", expectedRevision: 1, value: input("note-target", "Conflito", "x") })).rejects.toThrow(/outra janela/i);
    await storage.applyProfileMutation({ type: "note:delete", id: "folder-one" }); snapshot = await storage.loadProfileData();
    expect(snapshot.noteDocuments.find(note => note.id === "note-source")?.deletedAt).toBeTypeOf("number");
    await storage.applyProfileMutation({ type: "note:restore", id: "note-source" }); expect((await storage.loadProfileData()).noteDocuments.find(note => note.id === "note-source")?.deletedAt).toBeUndefined();
    await storage.applyProfileMutation({ type: "note:purge", id: "note-source" }); expect((await storage.loadProfileData()).noteDocuments.some(note => note.id === "note-source")).toBe(false);
    await storage.close();
  });

  it("imports profile data atomically and deduplicates existing and repeated URLs", async () => {
    const { storage } = await profile();
    await storage.applyProfileMutation({ type: "bookmark:save", value: { id: "existing", title: "Existing", url: "https://existing.test/", time: 1 } });
    const result = await storage.importExternalProfile("source-12345678", {
      bookmarks: [
        { id: "duplicate-existing", title: "Existing twice", url: "https://existing.test/", time: 2 },
        { id: "new-one", title: "New", url: "https://new.test/", time: 3 },
        { id: "new-two", title: "New twice", url: "https://new.test/", time: 4 }
      ],
      history: [
        { id: "history-one", title: "History", url: "https://history.test/", time: 5 },
        { id: "history-two", title: "History twice", url: "https://history.test/", time: 6 }
      ]
    });
    expect(result).toEqual({ sourceId: "source-12345678", imported: { bookmarks: 1, history: 1 }, skipped: { bookmarks: 2, history: 1 } });
    const snapshot = await storage.loadProfileData(); expect(snapshot.bookmarks.filter(item => item.url === "https://new.test/")).toHaveLength(1); expect(snapshot.history.filter(item => item.url === "https://history.test/")).toHaveLength(1);
    await storage.close();
  });
});
