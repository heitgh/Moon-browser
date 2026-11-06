// Nexus Inc. — explicit reload policy; a memory target is never a hard limit.
export interface ResourceSettings {
  readonly version: 1; readonly mode: "balanced" | "economy" | "custom";
  readonly automatic: boolean; readonly idleMinutes: number; readonly targetMiB: number | null;
  readonly reloadSafeOrigins: readonly string[]; readonly exceptions: readonly string[];
}
export const DEFAULT_RESOURCE_SETTINGS: ResourceSettings = {version: 1, mode: "balanced", automatic: false, idleMinutes: 30, targetMiB: null, reloadSafeOrigins: [], exceptions: []};
function origins(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Informe até 100 origens de sites.");
  return [...new Set(value.map(item => {
    if (typeof item !== "string" || item.length > 2048) throw new Error("Origem inválida.");
    let url: URL;
    try { url = new URL(item); } catch { throw new Error("Origem inválida. Use, por exemplo, https://example.com."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hostname.includes("*") || url.pathname !== "/" || url.search || url.hash) throw new Error("Use somente a origem, por exemplo https://example.com, sem caminho ou credenciais.");
    return url.origin;
  }))];
}
export function parseResourceSettings(value: unknown): ResourceSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Política de recursos inválida.");
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.mode !== "string" || !["balanced", "economy", "custom"].includes(v.mode) || typeof v.automatic !== "boolean"
    || !Number.isInteger(v.idleMinutes) || Number(v.idleMinutes) < 1 || Number(v.idleMinutes) > 240
    || (v.targetMiB !== null && (!Number.isInteger(v.targetMiB) || Number(v.targetMiB) < 256 || Number(v.targetMiB) > 65536))) throw new Error("Modo, inatividade ou alvo de memória inválido.");
  return {version: 1, mode: v.mode as ResourceSettings["mode"], automatic: v.automatic, idleMinutes: Number(v.idleMinutes), targetMiB: v.targetMiB as number | null, reloadSafeOrigins: origins(v.reloadSafeOrigins), exceptions: origins(v.exceptions)};
}
export interface PageActivity {
  readonly documentId: string; readonly url: string; readonly eligible: boolean; readonly reasons: readonly string[];
  readonly scrollX: number; readonly scrollY: number;
}
export interface SuspensionCandidate { readonly id: string; readonly title: string; readonly url: string; readonly eligible: boolean; readonly reasons: readonly string[]; readonly suspended: boolean; }
export interface ResourcePolicyState { readonly settings: ResourceSettings; readonly canConfigure: boolean; readonly candidates: readonly SuspensionCandidate[]; readonly warning?: string; }
export interface ResourceEconomyReport {
  readonly cancelled: boolean; readonly suspendedIds: readonly string[];
  readonly beforeKiB: number | null; readonly afterKiB: number | null;
  readonly skipped: readonly {readonly id: string; readonly reasons: readonly string[]}[];
}
