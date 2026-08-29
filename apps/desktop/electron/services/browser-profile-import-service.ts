import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { dialog } from "electron";
import { BetterSqliteConnection } from "../../../../packages/storage/adapters/better-sqlite-connection.js";
import type { ImportedLink, ImportedProfileData, ImportResult, ImportSelection, ImportSourceSummary, ImportBrowser } from "../../../../packages/ipc/browser-import-contract.js";

export interface ProfileImportPersistence {
  importExternalProfile(sourceId: string, data: ImportedProfileData): Promise<ImportResult>;
}

interface ImportSource {
  readonly summary: ImportSourceSummary;
  readonly directory: string;
  readonly kind: "chromium" | "firefox";
}

const MAX_IMPORT_ITEMS = 50_000;
const CHROMIUM_EPOCH_OFFSET_MS = 11_644_473_600_000;

export class BrowserProfileImportService {
  readonly #sources = new Map<string, ImportSource>();

  constructor(readonly homeDirectory: string, readonly persistence: ProfileImportPersistence) {}

  async discover(): Promise<readonly ImportSourceSummary[]> {
    this.#sources.clear();
    const chromiumRoots: readonly [ImportBrowser, string, string][] = [
      ["chrome", join(this.homeDirectory, ".config/google-chrome"), "Google Chrome"],
      ["chromium", join(this.homeDirectory, ".config/chromium"), "Chromium"],
      ["brave", join(this.homeDirectory, ".config/BraveSoftware/Brave-Browser"), "Brave"],
      ["vivaldi", join(this.homeDirectory, ".config/vivaldi"), "Vivaldi"],
      ["edge", join(this.homeDirectory, ".config/microsoft-edge"), "Microsoft Edge"]
    ];
    for (const [browser, root, label] of chromiumRoots) {
      for (const directory of await profileDirectories(root, /^(Default|Profile \d+)$/)) await this.#addSource(browser, label, directory, "chromium");
    }
    for (const directory of await profileDirectories(join(this.homeDirectory, ".mozilla/firefox"), /^[^.].*/)) {
      if (await exists(join(directory, "places.sqlite"))) await this.#addSource("firefox", "Firefox", directory, "firefox");
    }
    return [...this.#sources.values()].map(source => source.summary).sort((left, right) => right.modifiedAt - left.modifiedAt);
  }

  async import(selection: ImportSelection): Promise<ImportResult> {
    const source = this.#sources.get(selection.sourceId);
    if (!source) throw new Error("Import source expired; scan profiles again");
    const all = await this.#readSource(source);
    const selected: ImportedProfileData = {
      bookmarks: selection.categories.includes("bookmarks") ? all.bookmarks : [],
      history: selection.categories.includes("history") ? all.history : []
    };
    return this.persistence.importExternalProfile(source.summary.id, selected);
  }

  async importBookmarksHtml(): Promise<ImportResult | null> {
    const picked = await dialog.showOpenDialog({ title: "Importar favoritos HTML", properties: ["openFile"], filters: [{ name: "Bookmarks HTML", extensions: ["html", "htm"] }] });
    const path = picked.filePaths[0]; if (picked.canceled || !path) return null;
    const info = await stat(path); if (!info.isFile() || info.size > 20_000_000) throw new Error("Bookmarks HTML exceeds 20 MB");
    const html = await readFile(path, "utf8");
    const bookmarks: ImportedLink[] = [];
    const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (let match = pattern.exec(html); match && bookmarks.length < MAX_IMPORT_ITEMS; match = pattern.exec(html)) {
      const url = safeWebUrl(match[1]); if (!url) continue;
      const title = stripMarkup(match[2] ?? "").slice(0, 2_000) || url;
      bookmarks.push({ id: importedId("html", url), title, url, time: info.mtimeMs });
    }
    return this.persistence.importExternalProfile(`html-${createHash("sha256").update(path).digest("hex").slice(0, 16)}`, { bookmarks, history: [] });
  }

  async #addSource(browser: ImportBrowser, label: string, directory: string, kind: ImportSource["kind"]): Promise<void> {
    try {
      const data = await this.#readSource({ directory, kind });
      if (!data.bookmarks.length && !data.history.length) return;
      const modifiedAt = Math.max(...await Promise.all(["Bookmarks", "History", "places.sqlite"].map(async file => { try { return (await stat(join(directory, file))).mtimeMs; } catch { return 0; } })));
      const id = `source-${createHash("sha256").update(`${browser}\0${directory}`).digest("hex").slice(0, 20)}`;
      const profileName = basename(directory);
      const summary: ImportSourceSummary = { id, browser, name: `${label} — ${profileName}`, modifiedAt, categories: { bookmarks: data.bookmarks.length, history: data.history.length } };
      this.#sources.set(id, { summary, directory, kind });
    } catch { /* unreadable or locked profiles are omitted without touching the source */ }
  }

  async #readSource(source: Pick<ImportSource, "directory" | "kind">): Promise<ImportedProfileData> {
    return source.kind === "chromium" ? this.#readChromium(source.directory) : this.#readFirefox(source.directory);
  }

  async #readChromium(directory: string): Promise<ImportedProfileData> {
    const bookmarks = await readChromiumBookmarks(join(directory, "Bookmarks"));
    const history = await readStagedDatabase(join(directory, "History"), [] as readonly ImportedLink[], async database => {
      const rows = await database.all<{ readonly url: string; readonly title: string; readonly last_visit_time: number }>("SELECT url, title, last_visit_time FROM urls WHERE hidden = 0 ORDER BY last_visit_time DESC LIMIT ?", [MAX_IMPORT_ITEMS]);
      return rows.flatMap(row => { const url = safeWebUrl(row.url); if (!url) return []; const time = Math.max(0, Math.floor(Number(row.last_visit_time) / 1_000 - CHROMIUM_EPOCH_OFFSET_MS)); return [{ id: importedId("history", url), title: row.title.slice(0, 2_000) || url, url, time }]; });
    });
    return { bookmarks, history };
  }

  async #readFirefox(directory: string): Promise<ImportedProfileData> {
    return readStagedDatabase(join(directory, "places.sqlite"), { bookmarks: [], history: [] } as ImportedProfileData, async database => {
      const bookmarkRows = await database.all<{ readonly url: string; readonly title: string | null; readonly dateAdded: number }>("SELECT p.url, COALESCE(b.title, p.title) AS title, b.dateAdded FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1 AND b.fk IS NOT NULL ORDER BY b.dateAdded DESC LIMIT ?", [MAX_IMPORT_ITEMS]);
      const historyRows = await database.all<{ readonly url: string; readonly title: string | null; readonly last_visit_date: number | null }>("SELECT url, title, last_visit_date FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT ?", [MAX_IMPORT_ITEMS]);
      const bookmarks = bookmarkRows.flatMap(row => toImported("bookmark", row.url, row.title, Math.floor(row.dateAdded / 1_000)));
      const history = historyRows.flatMap(row => toImported("history", row.url, row.title, Math.floor((row.last_visit_date ?? 0) / 1_000)));
      return { bookmarks, history };
    });
  }
}

async function profileDirectories(root: string, pattern: RegExp): Promise<readonly string[]> {
  try { return (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && pattern.test(entry.name)).map(entry => join(root, entry.name)); }
  catch { return []; }
}

async function readChromiumBookmarks(path: string): Promise<readonly ImportedLink[]> {
  let parsed: unknown; try { parsed = JSON.parse(await readFile(path, "utf8")) as unknown; } catch { return []; }
  const results: ImportedLink[] = [];
  const visit = (value: unknown): void => {
    if (results.length >= MAX_IMPORT_ITEMS || !value || typeof value !== "object") return;
    const item = value as { readonly type?: unknown; readonly url?: unknown; readonly name?: unknown; readonly date_added?: unknown; readonly children?: unknown };
    if (item.type === "url" && typeof item.url === "string") {
      const url = safeWebUrl(item.url); if (url) results.push({ id: importedId("bookmark", url), title: typeof item.name === "string" ? item.name.slice(0, 2_000) || url : url, url, time: chromiumTime(item.date_added) });
    }
    if (Array.isArray(item.children)) item.children.forEach(visit);
    else Object.values(item).forEach(child => { if (child && typeof child === "object") visit(child); });
  };
  visit(parsed); return results;
}

async function readStagedDatabase<T>(source: string, empty: T, read: (database: BetterSqliteConnection) => Promise<T>): Promise<T> {
  if (!await exists(source)) return empty;
  const staging = await mkdtemp(join(tmpdir(), "moon-import-")); const copy = join(staging, "source.sqlite3");
  try {
    await copyFile(source, copy);
    for (const suffix of ["-wal", "-shm"] as const) if (await exists(`${source}${suffix}`)) await copyFile(`${source}${suffix}`, `${copy}${suffix}`);
    const database = new BetterSqliteConnection(copy, { readonly: true, fileMustExist: true }); await database.connect(); try { return await read(database); } finally { await database.close(); }
  }
  finally { await rm(staging, { recursive: true, force: true }); }
}

async function exists(path: string): Promise<boolean> { try { await stat(path); return true; } catch { return false; } }
function chromiumTime(value: unknown): number { const numeric = typeof value === "string" || typeof value === "number" ? Number(value) : 0; return Math.max(0, Math.floor(numeric / 1_000 - CHROMIUM_EPOCH_OFFSET_MS)); }
function safeWebUrl(value: string | undefined): string | undefined { try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; } }
function importedId(kind: string, url: string): string { return `import-${kind}-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`; }
function toImported(kind: string, rawUrl: string, rawTitle: string | null, time: number): ImportedLink[] { const url = safeWebUrl(rawUrl); return url ? [{ id: importedId(kind, url), title: rawTitle?.slice(0, 2_000) || url, url, time: Math.max(0, time) }] : []; }
function stripMarkup(value: string): string { return value.replace(/<[^>]*>/g, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim(); }
