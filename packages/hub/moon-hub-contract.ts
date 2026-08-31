export interface MoonHubDeviceAuthorization {
  readonly requestId: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresAt: number;
  readonly pollIntervalSeconds: number;
}

export interface MoonHubSession { readonly accountId: string; readonly accessTokenReference: string; readonly expiresAt: number; }
export interface MoonHubDevice { readonly id: string; readonly name: string; readonly createdAt: number; readonly lastSeenAt: number; readonly revokedAt?: number; }
export interface MoonHubExportJob { readonly id: string; readonly state: "queued" | "running" | "ready" | "expired" | "failed"; readonly expiresAt?: number; }

export interface MoonHubAccountProvider {
  readonly id: string;
  beginDeviceAuthorization(signal?: AbortSignal): Promise<MoonHubDeviceAuthorization>;
  pollDeviceAuthorization(requestId: string, signal?: AbortSignal): Promise<MoonHubSession | null>;
  logout(session: MoonHubSession): Promise<void>;
  listDevices(session: MoonHubSession): Promise<readonly MoonHubDevice[]>;
  revokeDevice(session: MoonHubSession, deviceId: string): Promise<void>;
  requestDataExport(session: MoonHubSession): Promise<MoonHubExportJob>;
  requestAccountDeletion(session: MoonHubSession, confirmationToken: string): Promise<void>;
}

export interface MoonHubThemeIntentV1 {
  readonly format: "moon-hub-theme-intent";
  readonly version: 1;
  readonly action: "preview";
  readonly intentId: string;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly sha256: string;
  readonly signatureKeyId: string;
  readonly expiresAt: number;
}

export interface MoonHubCatalogProvider {
  readonly id: string;
  resolveThemeIntent(intent: MoonHubThemeIntentV1, signal?: AbortSignal): Promise<Uint8Array>;
  reportTheme(packageId: string, reason: "malware" | "copyright" | "impersonation" | "abuse" | "other", detail?: string): Promise<void>;
}

const OPAQUE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function parseMoonHubThemeIntent(value: unknown, now = Date.now()): MoonHubThemeIntentV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Intent do Moon Hub inválido.");
  const record = value as Record<string, unknown>; const allowed = new Set(["format", "version", "action", "intentId", "packageId", "packageVersion", "sha256", "signatureKeyId", "expiresAt"]);
  if (Object.keys(record).some(key => !allowed.has(key))) throw new TypeError("Intent do Moon Hub contém campos desconhecidos.");
  if (record.format !== "moon-hub-theme-intent" || record.version !== 1 || record.action !== "preview") throw new TypeError("Formato de intent do Moon Hub não suportado.");
  const intentId = opaque(record.intentId, "intent"); const packageId = opaque(record.packageId, "pacote"); const signatureKeyId = opaque(record.signatureKeyId, "chave");
  if (typeof record.packageVersion !== "string" || !SEMVER.test(record.packageVersion)) throw new TypeError("Versão de pacote inválida.");
  if (typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) throw new TypeError("Hash de pacote inválido.");
  if (!Number.isSafeInteger(record.expiresAt) || Number(record.expiresAt) <= now || Number(record.expiresAt) > now + 24 * 60 * 60_000) throw new TypeError("Intent expirado ou com validade excessiva.");
  return { format: "moon-hub-theme-intent", version: 1, action: "preview", intentId, packageId, packageVersion: record.packageVersion, sha256: record.sha256, signatureKeyId, expiresAt: Number(record.expiresAt) };
}

export function moonHubInternalPreviewRoute(intentId: string): string { return `moon://themes/preview/${encodeURIComponent(opaque(intentId, "intent"))}`; }
function opaque(value: unknown, label: string): string { if (typeof value !== "string" || !OPAQUE_ID.test(value)) throw new TypeError(`ID de ${label} inválido.`); return value; }
