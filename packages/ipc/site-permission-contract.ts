export type SitePermissionDecision = "allow" | "deny";

export interface SitePermissionRecord {
  readonly origin: string;
  readonly permission: string;
  readonly decision: SitePermissionDecision;
  readonly updatedAt: number;
}

export interface SitePermissionKey {
  readonly origin: string;
  readonly permission: string;
}

export function parseSitePermissionKey(value: unknown): SitePermissionKey {
  const input = record(value);
  return { origin: origin(input.origin), permission: permission(input.permission) };
}

export function parseSitePermissionRecord(value: unknown): SitePermissionRecord {
  const input = record(value);
  if (input.decision !== "allow" && input.decision !== "deny") throw new TypeError("Invalid site permission decision");
  if (typeof input.updatedAt !== "number" || !Number.isSafeInteger(input.updatedAt) || input.updatedAt < 0) throw new TypeError("Invalid site permission timestamp");
  return { ...parseSitePermissionKey(input), decision: input.decision, updatedAt: input.updatedAt };
}

export function parseSitePermissionRecords(value: unknown): readonly SitePermissionRecord[] {
  if (!Array.isArray(value) || value.length > 5_000) return [];
  try {
    const records = value.map(parseSitePermissionRecord);
    return [...new Map(records.map(item => [`${item.origin}\0${item.permission}`, item])).values()];
  } catch { return []; }
}

function origin(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_048) throw new TypeError("Invalid site permission origin");
  let url: URL;
  try { url = new URL(value); } catch { throw new TypeError("Invalid site permission origin"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.origin === "null") throw new TypeError("Invalid site permission origin");
  return url.origin;
}

function permission(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,79}$/i.test(value)) throw new TypeError("Invalid site permission name");
  return value;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid site permission payload");
  return value as Readonly<Record<string, unknown>>;
}
