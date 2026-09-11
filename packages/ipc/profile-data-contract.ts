export interface ProfileSavedLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly time: number;
}

export type ProfileHistoryNavigationType = "link" | "typed" | "reload" | "redirect" | "form-submit" | "history" | "generated" | "other";

export interface ProfileHistoryEntry extends ProfileSavedLink {
  readonly schemaVersion: 2;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly durationMs?: number;
  readonly faviconUrl?: string;
  readonly profileId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly tabId?: string;
  readonly source: "navigation" | "import" | "legacy";
  readonly navigationType: ProfileHistoryNavigationType;
}

export interface ProfileWorkspace {
  readonly id: string;
  readonly name: string;
  readonly position: number;
}

export interface ProfileNoteVersion { readonly revision: number; readonly title: string; readonly content: string; readonly updatedAt: number; }
export interface ProfileNoteDocument {
  readonly id: string;
  readonly kind: "note" | "folder";
  readonly parentId?: string;
  readonly title: string;
  readonly content: string;
  readonly format: "plain-text" | "markdown";
  readonly pinned: boolean;
  readonly favorite: boolean;
  readonly archived: boolean;
  readonly deletedAt?: number;
  readonly tags: readonly string[];
  readonly sourceUrl?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revision: number;
  readonly versions: readonly ProfileNoteVersion[];
}

export type ProfileNoteInput = Pick<ProfileNoteDocument, "id" | "kind" | "title" | "content" | "format" | "pinned" | "favorite" | "tags"> & Partial<Pick<ProfileNoteDocument, "parentId" | "sourceUrl" | "tabId" | "workspaceId" | "sessionId">>;

export interface ProfileDataSnapshot {
  readonly bookmarks: readonly ProfileSavedLink[];
  readonly history: readonly ProfileHistoryEntry[];
  readonly notes: string;
  readonly noteDocuments: readonly ProfileNoteDocument[];
  readonly workspaces: readonly ProfileWorkspace[];
}

export type ProfileDataMutation =
  | { readonly type: "bookmark:save"; readonly value: ProfileSavedLink }
  | { readonly type: "bookmark:delete"; readonly id: string }
  | { readonly type: "history:record"; readonly value: ProfileHistoryEntry }
  | { readonly type: "history:delete"; readonly id: string }
  | { readonly type: "history:delete-range"; readonly from: number; readonly to: number }
  | { readonly type: "history:clear" }
  | { readonly type: "notes:save"; readonly content: string }
  | { readonly type: "note:save"; readonly value: ProfileNoteInput; readonly expectedRevision: number }
  | { readonly type: "note:delete"; readonly id: string }
  | { readonly type: "note:restore"; readonly id: string }
  | { readonly type: "note:purge"; readonly id: string }
  | { readonly type: "workspace:save"; readonly value: ProfileWorkspace }
  | { readonly type: "workspace:delete"; readonly id: string };

const MAX_NOTES_LENGTH = 1_000_000;

export function parseProfileDataMutation(value: unknown): ProfileDataMutation {
  const input = record(value, "profile mutation");
  switch (input.type) {
    case "bookmark:save": return { type: input.type, value: savedLink(input.value, "bookmark") };
    case "bookmark:delete": return { type: input.type, id: identifier(input.id) };
    case "history:record": return { type: input.type, value: historyEntry(input.value) };
    case "history:delete": return { type: input.type, id: identifier(input.id) };
    case "history:delete-range": { const from = timestamp(input.from, "history range start"); const to = timestamp(input.to, "history range end"); if (from > to) throw new TypeError("Invalid history range"); return { type: input.type, from, to }; }
    case "history:clear": return { type: input.type };
    case "notes:save": return { type: input.type, content: text(input.content, "notes", MAX_NOTES_LENGTH) };
    case "note:save": return { type: input.type, value: noteInput(input.value), expectedRevision: revision(input.expectedRevision) };
    case "note:delete": return { type: input.type, id: identifier(input.id) };
    case "note:restore": return { type: input.type, id: identifier(input.id) };
    case "note:purge": return { type: input.type, id: identifier(input.id) };
    case "workspace:save": return { type: input.type, value: workspace(input.value) };
    case "workspace:delete": return { type: input.type, id: identifier(input.id) };
    default: throw new TypeError("Unsupported profile mutation");
  }
}

function noteInput(value: unknown): ProfileNoteInput {
  const input = record(value, "note");
  const kind = input.kind === "folder" ? "folder" : "note";
  const format = input.format === "plain-text" ? "plain-text" : "markdown";
  const tagsValue = input.tags;
  if (!Array.isArray(tagsValue) || tagsValue.length > 30) throw new TypeError("Invalid note tags");
  const tags = [...new Set(tagsValue.map(tag => text(tag, "note tag", 50).trim()).filter(Boolean))];
  const optionalId = (field: string): string | undefined => input[field] === undefined ? undefined : identifier(input[field]);
  let sourceUrl: string | undefined;
  if (input.sourceUrl !== undefined) {
    const raw = text(input.sourceUrl, "note source URL", 16_384);
    try { const parsed = new URL(raw); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); sourceUrl = parsed.href; }
    catch { throw new TypeError("Invalid note source URL"); }
  }
  return { id: identifier(input.id), kind, ...(optionalId("parentId") ? { parentId: optionalId("parentId") } : {}), title: text(input.title, "note title", 200).trim() || (kind === "folder" ? "Nova pasta" : "Sem título"), content: kind === "folder" ? "" : text(input.content, "note content", MAX_NOTES_LENGTH), format, pinned: Boolean(input.pinned), favorite: Boolean(input.favorite), tags, ...(sourceUrl ? { sourceUrl } : {}), ...(optionalId("tabId") ? { tabId: optionalId("tabId") } : {}), ...(optionalId("workspaceId") ? { workspaceId: optionalId("workspaceId") } : {}), ...(optionalId("sessionId") ? { sessionId: optionalId("sessionId") } : {}) };
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError("Invalid note revision");
  return value;
}

function historyEntry(value: unknown): ProfileHistoryEntry {
  const input = record(value, "history entry"); const link = savedLink(input, "history entry");
  const startedAt = timestamp(input.startedAt ?? link.time, "history start");
  const endedAt = input.endedAt === undefined ? undefined : timestamp(input.endedAt, "history end");
  if (endedAt !== undefined && endedAt < startedAt) throw new TypeError("Invalid history duration");
  const durationMs = input.durationMs === undefined ? endedAt === undefined ? undefined : endedAt - startedAt : timestamp(input.durationMs, "history duration");
  const navigationTypes = ["link", "typed", "reload", "redirect", "form-submit", "history", "generated", "other"] as const;
  const navigationType = navigationTypes.find(type => type === input.navigationType) ?? "other";
  const source = input.source === "import" || input.source === "legacy" ? input.source : "navigation";
  const optionalId = (field: string): string | undefined => input[field] === undefined ? undefined : identifier(input[field]);
  const faviconUrl = input.faviconUrl === undefined ? undefined : text(input.faviconUrl, "history favicon", 16_384);
  return { ...link, schemaVersion: 2, startedAt, ...(endedAt === undefined ? {} : { endedAt }), ...(durationMs === undefined ? {} : { durationMs }), ...(faviconUrl === undefined ? {} : { faviconUrl }), ...(optionalId("profileId") ? { profileId: optionalId("profileId") } : {}), ...(optionalId("workspaceId") ? { workspaceId: optionalId("workspaceId") } : {}), ...(optionalId("sessionId") ? { sessionId: optionalId("sessionId") } : {}), ...(optionalId("tabId") ? { tabId: optionalId("tabId") } : {}), source, navigationType };
}

function timestamp(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid ${label}`);
  return value;
}

function savedLink(value: unknown, label: string): ProfileSavedLink {
  const input = record(value, label);
  const url = text(input.url, `${label} URL`, 16_384);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new TypeError(`Invalid ${label} URL`); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new TypeError(`Invalid ${label} URL protocol`);
  const time = input.time;
  if (typeof time !== "number" || !Number.isSafeInteger(time) || time < 0) throw new TypeError(`Invalid ${label} timestamp`);
  return { id: identifier(input.id), title: text(input.title, `${label} title`, 2_000), url: parsed.href, time };
}

function workspace(value: unknown): ProfileWorkspace {
  const input = record(value, "workspace");
  const position = input.position;
  if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0 || position > 10_000) throw new TypeError("Invalid workspace position");
  return { id: identifier(input.id), name: text(input.name, "workspace name", 200), position };
}

function identifier(value: unknown): string {
  const result = text(value, "profile record ID", 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(result)) throw new TypeError("Invalid profile record ID");
  return result;
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum || value.includes("\0")) throw new TypeError(`Invalid ${label}`);
  return value;
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Invalid ${label}`);
  return value as Readonly<Record<string, unknown>>;
}
