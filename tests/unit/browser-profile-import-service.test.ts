import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BrowserProfileImportService,
  sanitizeImportedBookmarkTitle,
} from "../../apps/desktop/electron/services/browser-profile-import-service.js";
import {
  parseImportSelection,
  type ImportedProfileData,
  type ImportResult,
} from "../../packages/ipc/browser-import-contract.js";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("BrowserProfileImportService", () => {
  it("detects a Chromium profile read-only, previews counts and imports only selected safe URLs", async () => {
    const home = await mkdtemp(join(tmpdir(), "moon-import-test-"));
    temporary.push(home);
    const profile = join(home, ".config/chromium/Default");
    await mkdir(profile, { recursive: true });
    const source = JSON.stringify({
      roots: {
        bookmark_bar: {
          children: [
            {
              type: "url",
              name: "Moon",
              url: "https://moon.example/",
              date_added: "13300000000000000",
            },
            {
              type: "url",
              name: "Hostil",
              url: "javascript:alert(1)",
              date_added: "13300000000000000",
            },
          ],
        },
      },
    });
    const path = join(profile, "Bookmarks");
    await writeFile(path, source);
    let staged: ImportedProfileData | undefined;
    const persistence = {
      importExternalProfile: async (
        sourceId: string,
        data: ImportedProfileData,
      ): Promise<ImportResult> => {
        staged = data;
        return {
          sourceId,
          imported: {
            bookmarks: data.bookmarks.length,
            history: data.history.length,
          },
          skipped: { bookmarks: 0, history: 0 },
        };
      },
    };
    const service = new BrowserProfileImportService(home, persistence);
    const sources = await service.discover();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      browser: "chromium",
      detectedPath: profile,
      categories: { bookmarks: 1, history: 0 },
    });
    const result = await service.import({
      sourceId: sources[0]!.id,
      categories: ["bookmarks"],
    });
    expect(result.imported.bookmarks).toBe(1);
    expect(staged?.bookmarks[0]?.url).toBe("https://moon.example/");
    expect(await readFile(path, "utf8")).toBe(source);
  });

  it("detects alternate Linux installs and multiple profiles", async () => {
    const home = await mkdtemp(join(tmpdir(), "moon-import-alternate-"));
    temporary.push(home);
    for (const name of ["Default", "Profile 2"]) {
      const profile = join(home, "snap/chromium/common/chromium", name);
      await mkdir(profile, { recursive: true });
      await writeFile(join(profile, "Bookmarks"), chromiumBookmarks(`https://${name === "Default" ? "default" : "second"}.example/`));
    }
    const service = new BrowserProfileImportService(home, persistenceStub());
    const sources = await service.discover();
    expect(sources).toHaveLength(2);
    expect(sources.map(source => source.name).sort()).toEqual(["Chromium (Snap) — Default", "Chromium (Snap) — Profile 2"]);
    expect(sources.every(source => source.detectedPath.includes("snap/chromium"))).toBe(true);
  });

  it("returns an empty discovery result when no compatible browser exists", async () => {
    const home = await mkdtemp(join(tmpdir(), "moon-import-empty-"));
    temporary.push(home);
    const service = new BrowserProfileImportService(home, persistenceStub());
    await expect(service.discover()).resolves.toEqual([]);
  });

  it("adds a manually selected profile without accepting a renderer path", async () => {
    const home = await mkdtemp(join(tmpdir(), "moon-import-manual-"));
    temporary.push(home);
    const profile = join(home, "portable-browser/Profile 7");
    await mkdir(profile, { recursive: true });
    await writeFile(join(profile, "Bookmarks"), chromiumBookmarks("https://portable.example/"));
    const service = new BrowserProfileImportService(home, persistenceStub(), { pickDirectory: async () => profile });
    const selected = await service.selectManualSource();
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ browser: "chromium", detectedPath: profile, categories: { bookmarks: 1, history: 0 } });
  });

  it("rejects renderer-controlled paths and unsupported categories at the IPC boundary", () => {
    expect(() =>
      parseImportSelection({
        sourceId: "/home/user/.config",
        categories: ["bookmarks"],
      }),
    ).toThrow();
    expect(() =>
      parseImportSelection({
        sourceId: "source-12345678",
        categories: ["cookies"],
      }),
    ).toThrow();
  });

  it("decodes bookmark entities once without turning nested escapes into markup", () => {
    expect(
      sanitizeImportedBookmarkTitle("Moon &amp; &lt;b&gt;Browser&lt;/b&gt;"),
    ).toBe("Moon & Browser");
    expect(
      sanitizeImportedBookmarkTitle(
        "&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;",
      ),
    ).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

function chromiumBookmarks(url: string): string {
  return JSON.stringify({ roots: { bookmark_bar: { children: [{ type: "url", name: "Imported", url, date_added: "13300000000000000" }] } } });
}

function persistenceStub() {
  return {
    importExternalProfile: async (sourceId: string, data: ImportedProfileData): Promise<ImportResult> => ({
      sourceId,
      imported: { bookmarks: data.bookmarks.length, history: data.history.length },
      skipped: { bookmarks: 0, history: 0 },
    }),
  };
}
