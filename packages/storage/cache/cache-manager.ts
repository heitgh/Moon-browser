import type { CacheStore } from "./cache-store.js";
export class CacheManager {
  constructor(readonly store: CacheStore) {}
  async get<T>(key: string): Promise<T | undefined> { const entry = await this.store.get<T>(key); if (!entry) return undefined; if (entry.expiresAt && entry.expiresAt <= Date.now()) { await this.store.delete(key); return undefined; } return entry.value; }
  set<T>(key: string, value: T, ttlMs?: number): Promise<void> { const now = Date.now(); return this.store.set(key, { value, createdAt: now, expiresAt: ttlMs ? now + ttlMs : undefined }); }
  delete(key: string): Promise<boolean> { return this.store.delete(key); }
  clear(): Promise<void> { return this.store.clear(); }
}
