import { UPDATE_FEED_EPOCH } from "../../../../config/update-channel.js";
// Nexus Inc. — advisory updates only; no automatic installation or profile changes.
export interface AvailableUpdate { readonly version: string; readonly notes: string; readonly url: string; }
function version(value: string): { parts: number[]; channel: string; sequence: number } | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta)\.(\d+))?$/.exec(value);
  return match ? { parts: match.slice(1, 4).map(Number), channel: match[4] ?? "stable", sequence: Number(match[5] ?? 0) } : undefined;
}
export function selectUpdate(current: string, releases: unknown): AvailableUpdate | null {
  const installed = version(current); if (!installed || !Array.isArray(releases)) return null;
  const installedRelease = releases.find(item => item && typeof item === "object" && typeof item.tag_name === "string" && item.tag_name.replace(/^v/, "") === current.replace(/^v/, ""));
  const installedDate = Date.parse(installedRelease?.published_at ?? "");
  const minimumDate = Number.isFinite(installedDate) ? Math.max(UPDATE_FEED_EPOCH, installedDate) : UPDATE_FEED_EPOCH;
  const candidates: AvailableUpdate[] = [];
  for (const item of releases.slice(0, 100)) {
    if (!item || typeof item !== "object" || item.draft || typeof item.tag_name !== "string" || typeof item.html_url !== "string") continue;
    const next = version(item.tag_name); if (!next) continue;
    const published = typeof item.published_at === "string" ? Date.parse(item.published_at) : NaN;
    if (!Number.isFinite(published) || published < minimumDate) continue;
    if (installed.channel === "stable" && next.channel !== "stable") continue;
    if (installed.channel === "beta" && next.channel === "alpha") continue;
    let url: URL; try { url = new URL(item.html_url); } catch { continue; }
    if (url.href !== `https://github.com/heitgh/Moon-browser/releases/tag/${item.tag_name}` || url.origin !== "https://github.com" || url.username || url.password || !/^\/heitgh\/Moon-browser\/releases\/tag\/[a-zA-Z0-9._-]+$/.test(url.pathname) || url.search || url.hash) continue;
    if (compare(next, installed) <= 0) continue;
    candidates.push({ version: item.tag_name, notes: typeof item.body === "string" ? item.body.slice(0, 2000) : "Veja as novidades na página da versão.", url: url.href });
  }
  return candidates.sort((a, b) => compare(version(b.version)!, version(a.version)!))[0] ?? null;
}
function compare(a: NonNullable<ReturnType<typeof version>>, b: NonNullable<ReturnType<typeof version>>): number {
  for (let i = 0; i < 3; i++) { const diff = a.parts[i]! - b.parts[i]!; if (diff) return diff; }
  const rank: Record<string, number> = { alpha: 0, beta: 1, stable: 2 };
  return rank[a.channel]! - rank[b.channel]! || a.sequence - b.sequence;
}
export class UpdateChecker {
  #inflight: Promise<AvailableUpdate | null> | undefined;
  available: AvailableUpdate | null = null;
  constructor(readonly current: string) {}
  check(): Promise<AvailableUpdate | null> {
    if (this.#inflight) return this.#inflight;
    this.#inflight = this.#fetch().finally(() => { this.#inflight = undefined; });
    return this.#inflight;
  }
  async #fetch(): Promise<AvailableUpdate | null> {
    const response = await fetch("https://api.github.com/repos/heitgh/Moon-browser/releases?per_page=30", { signal: AbortSignal.timeout(5000), redirect: "error", headers: { accept: "application/vnd.github+json" } });
    if (!response.ok || !response.body) throw new Error("Não foi possível verificar atualizações agora.");
    let total = 0; const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > 1_000_000) throw new Error("Update response too large"); chunks.push(value); }
    } finally { await reader.cancel(); }
    this.available = selectUpdate(this.current, JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
    return this.available;
  }
}
