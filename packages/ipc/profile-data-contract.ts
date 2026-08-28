export interface ProfileSavedLink {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly time: number;
}

export interface ProfileWorkspace {
  readonly id: string;
  readonly name: string;
  readonly position: number;
}

export interface ProfileDataSnapshot {
  readonly bookmarks: readonly ProfileSavedLink[];
  readonly history: readonly ProfileSavedLink[];
  readonly notes: string;
  readonly workspaces: readonly ProfileWorkspace[];
}

export type ProfileDataMutation =
  | { readonly type: "bookmark:save"; readonly value: ProfileSavedLink }
  | { readonly type: "bookmark:delete"; readonly id: string }
  | { readonly type: "history:record"; readonly value: ProfileSavedLink }
  | { readonly type: "history:clear" }
  | { readonly type: "notes:save"; readonly content: string }
  | { readonly type: "workspace:save"; readonly value: ProfileWorkspace }
  | { readonly type: "workspace:delete"; readonly id: string };

const MAX_NOTES_LENGTH = 1_000_000;

export function parseProfileDataMutation(value: unknown): ProfileDataMutation {
  const input = record(value, "profile mutation");
  switch (input.type) {
    case "bookmark:save": return { type: input.type, value: savedLink(input.value, "bookmark") };
    case "bookmark:delete": return { type: input.type, id: identifier(input.id) };
    case "history:record": return { type: input.type, value: savedLink(input.value, "history entry") };
    case "history:clear": return { type: input.type };
    case "notes:save": return { type: input.type, content: text(input.content, "notes", MAX_NOTES_LENGTH) };
    case "workspace:save": return { type: input.type, value: workspace(input.value) };
    case "workspace:delete": return { type: input.type, id: identifier(input.id) };
    default: throw new TypeError("Unsupported profile mutation");
  }
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
