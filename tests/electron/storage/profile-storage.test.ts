import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileStorage } from "../../../apps/desktop/electron/services/profile-storage.js";
import { createMoonProfileBackup } from "../../../packages/storage/backup/profile-backup.js";

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

  it("persists validated site permission decisions in profile settings", async () => {
    const { storage } = await profile();
    const records = [{ origin: "https://meet.example", permission: "media", decision: "allow" as const, updatedAt: 10 }];
    await storage.saveSitePermissions(records);
    expect(await storage.loadSitePermissions()).toEqual(records);
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
