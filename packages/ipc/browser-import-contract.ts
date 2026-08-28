export type ImportBrowser = "chrome" | "chromium" | "brave" | "vivaldi" | "edge" | "firefox" | "html";
export type ImportCategory = "bookmarks" | "history";

export interface ImportSourceSummary {
  readonly id: string;
  readonly browser: ImportBrowser;
  readonly name: string;
  readonly modifiedAt: number;
  readonly categories: Readonly<Record<ImportCategory, number>>;
}

export interface ImportSelection {
  readonly sourceId: string;
  readonly categories: readonly ImportCategory[];
}

export interface ImportResult {
  readonly sourceId: string;
  readonly imported: Readonly<Record<ImportCategory, number>>;
  readonly skipped: Readonly<Record<ImportCategory, number>>;
}

export interface ImportedLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly time: number;
}

export interface ImportedProfileData {
  readonly bookmarks: readonly ImportedLink[];
  readonly history: readonly ImportedLink[];
}

export function parseImportSelection(value: unknown): ImportSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid import selection");
  const input = value as Readonly<Record<string, unknown>>;
  if (typeof input.sourceId !== "string" || !/^[a-z0-9-]{8,100}$/i.test(input.sourceId)) throw new TypeError("Invalid import source");
  if (!Array.isArray(input.categories) || input.categories.length < 1 || input.categories.length > 2) throw new TypeError("Select at least one import category");
  const categories = [...new Set(input.categories.map(category => {
    if (category !== "bookmarks" && category !== "history") throw new TypeError("Unsupported import category");
    return category;
  }))];
  return { sourceId: input.sourceId, categories };
}
