import type { FaviconSettings } from "../customization/customization-schema.js";

const STORAGE_KEY = "moon:favicons:v1";
const MAX_ENTRIES = 500;
const MAX_DATA_LENGTH = 400_000;
const SAFE_DATA = /^data:image\/(?:png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/=]+$/i;

interface FaviconEntry { readonly source: string; readonly data: string; readonly expiresAt: number; readonly touchedAt: number; }

export class FaviconCache {
  readonly #entries = new Map<string, FaviconEntry>();
  #settings: FaviconSettings = { enabled: true, persist: true, ttlDays: 30 };

  constructor(readonly storage: Storage = localStorage, readonly now: () => number = Date.now) { this.#load(); }

  configure(settings: FaviconSettings): void {
    this.#settings = settings;
    this.#prune();
    if (!settings.persist) { try { this.storage.removeItem(STORAGE_KEY); } catch { /* memory cache remains available */ } }
    else this.#persist();
  }

  get(source: string): string | undefined {
    if (!this.#settings.enabled) return undefined;
    if (SAFE_DATA.test(source) && source.length <= MAX_DATA_LENGTH) return source;
    const entry = this.#entries.get(source); if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) { this.#entries.delete(source); this.#persist(); return undefined; }
    return entry.data;
  }

  set(source: string, data: string): boolean {
    if (!this.#settings.enabled || !/^https:\/\//i.test(source) || source.length > 2_048 || !SAFE_DATA.test(data) || data.length > MAX_DATA_LENGTH) return false;
    const timestamp = this.now(); this.#entries.set(source, { source, data, expiresAt: timestamp + this.#settings.ttlDays * 86_400_000, touchedAt: timestamp });
    this.#prune(); this.#persist(); return true;
  }

  clear(): void { this.#entries.clear(); try { this.storage.removeItem(STORAGE_KEY); } catch { /* best effort */ } }

  #load(): void {
    try {
      const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? "[]") as unknown;
      if (!Array.isArray(parsed)) return;
      for (const candidate of parsed.slice(0, MAX_ENTRIES)) {
        if (!candidate || typeof candidate !== "object") continue;
        const entry = candidate as Partial<FaviconEntry>;
        if (typeof entry.source === "string" && /^https:\/\//i.test(entry.source) && typeof entry.data === "string" && SAFE_DATA.test(entry.data) && entry.data.length <= MAX_DATA_LENGTH && typeof entry.expiresAt === "number" && typeof entry.touchedAt === "number") this.#entries.set(entry.source, entry as FaviconEntry);
      }
      this.#prune();
    } catch { this.#entries.clear(); }
  }

  #prune(): void {
    const timestamp = this.now(); for (const [source, entry] of this.#entries) if (entry.expiresAt <= timestamp) this.#entries.delete(source);
    const overflow = [...this.#entries.values()].sort((a, b) => a.touchedAt - b.touchedAt).slice(0, Math.max(0, this.#entries.size - MAX_ENTRIES)); overflow.forEach(entry => this.#entries.delete(entry.source));
  }

  #persist(): void {
    if (!this.#settings.persist) return;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify([...this.#entries.values()])); } catch { /* favicons never block browsing */ }
  }
}
