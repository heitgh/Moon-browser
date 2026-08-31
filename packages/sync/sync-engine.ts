import { decryptSyncEnvelope, encryptSyncRecord } from "./crypto.js";
import type { SyncCategory, SyncCategoryPolicy, SyncEngine, SyncEnvelope, SyncProvider, SyncRecord, SyncResult, SyncState, SyncStore } from "./types.js";

const CATEGORIES: readonly SyncCategory[] = ["settings", "themes", "home", "workspaces", "bookmarks", "shortcuts", "notes", "sessions", "history", "credentials"];
export const DEFAULT_SYNC_POLICY: Readonly<Record<SyncCategory, SyncCategoryPolicy>> = Object.freeze({
  settings: { enabled: true }, themes: { enabled: true }, home: { enabled: true }, workspaces: { enabled: true }, bookmarks: { enabled: true }, shortcuts: { enabled: true }, notes: { enabled: true }, sessions: { enabled: true },
  history: { enabled: false }, credentials: { enabled: false, requiresSeparateConsent: true }
});

export class SyncOfflineError extends Error { constructor(message = "Provider offline") { super(message); this.name = "SyncOfflineError"; } }

export interface OfflineFirstSyncOptions {
  readonly store: SyncStore;
  readonly provider?: SyncProvider;
  readonly masterKey: Uint8Array;
  readonly policy?: Readonly<Partial<Record<SyncCategory, SyncCategoryPolicy>>>;
  readonly credentialConsent?: boolean;
  readonly retry?: { readonly attempts: number; readonly baseDelayMs: number };
  readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export class OfflineFirstSyncEngine implements SyncEngine {
  #state: SyncState;
  #cursor: string | undefined;
  readonly #policy: Readonly<Record<SyncCategory, SyncCategoryPolicy>>;
  readonly #retry: { readonly attempts: number; readonly baseDelayMs: number };

  constructor(readonly options: OfflineFirstSyncOptions) {
    this.#state = options.provider ? "idle" : "disabled";
    this.#policy = Object.fromEntries(CATEGORIES.map(category => [category, options.policy?.[category] ?? DEFAULT_SYNC_POLICY[category]])) as Readonly<Record<SyncCategory, SyncCategoryPolicy>>;
    this.#retry = options.retry ?? { attempts: 3, baseDelayMs: 250 };
  }

  get state(): SyncState { return this.#state; }

  async write<T>(record: SyncRecord<T>): Promise<SyncEnvelope> {
    this.#assertCategory(record.category);
    const envelope = await encryptSyncRecord(record, this.options.masterKey);
    await this.options.store.put(envelope); return envelope;
  }

  async read<T>(id: string): Promise<SyncRecord<T> | undefined> {
    const envelope = (await this.options.store.list()).find(candidate => candidate.id === id);
    return envelope ? decryptSyncEnvelope<T>(envelope, this.options.masterKey) : undefined;
  }

  remove(record: Omit<SyncRecord<null>, "payload" | "tombstone">): Promise<SyncEnvelope> { return this.write({ ...record, tombstone: true, payload: null }); }

  async synchronize(signal?: AbortSignal): Promise<SyncResult> {
    const provider = this.options.provider;
    if (!provider) { this.#state = "disabled"; return { uploaded: 0, downloaded: 0, conflicts: 0, state: this.#state }; }
    this.#state = "syncing";
    try {
      const remote = await this.#withRetry(() => provider.pull(this.#cursor, signal), signal);
      const local = await this.options.store.list(); const merged = new Map(local.map(envelope => [envelope.id, envelope])); let downloaded = 0; let conflicts = 0;
      for (const candidate of remote.envelopes) {
        this.#assertCategory(candidate.category); const current = merged.get(candidate.id);
        if (!current) { merged.set(candidate.id, candidate); await this.options.store.put(candidate); downloaded += 1; continue; }
        const comparison = compareEnvelopes(candidate, current);
        if (comparison !== 0 && candidate.logicalVersion === current.logicalVersion) conflicts += 1;
        if (comparison > 0) { merged.set(candidate.id, candidate); await this.options.store.put(candidate); downloaded += 1; }
      }
      const upload = [...merged.values()]; await this.#withRetry(() => provider.push(upload, signal), signal); this.#cursor = remote.cursor;
      this.#state = conflicts > 0 ? "conflict" : "idle";
      return { uploaded: upload.length, downloaded, conflicts, state: this.#state };
    } catch (error) {
      this.#state = error instanceof SyncOfflineError ? "offline" : "error";
      throw error;
    }
  }

  async resetRemote(signal?: AbortSignal): Promise<void> { const provider = this.#requireProvider(); await this.#withRetry(() => provider.resetRemote(signal), signal); this.#cursor = undefined; }
  async revokeDevice(deviceId: string, signal?: AbortSignal): Promise<void> { if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(deviceId)) throw new TypeError("Device ID inválido."); await this.#withRetry(() => this.#requireProvider().revokeDevice(deviceId, signal), signal); }

  #assertCategory(category: SyncCategory): void {
    if (!CATEGORIES.includes(category)) throw new TypeError("Categoria de sync inválida.");
    const policy = this.#policy[category]; if (!policy.enabled) throw new Error(`A categoria ${category} não recebeu consentimento.`);
    if (category === "credentials" && (!policy.requiresSeparateConsent || this.options.credentialConsent !== true)) throw new Error("Credenciais exigem consentimento separado e E2EE ativa.");
  }

  #requireProvider(): SyncProvider { if (!this.options.provider) throw new Error("Sincronização em nuvem ainda não configurada"); return this.options.provider; }

  async #withRetry<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.#retry.attempts; attempt += 1) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Operação cancelada", "AbortError");
      try { return await operation(); }
      catch (error) {
        lastError = error; if (attempt + 1 >= this.#retry.attempts) break;
        await (this.options.sleep ?? sleep)(this.#retry.baseDelayMs * 2 ** attempt, signal);
      }
    }
    throw lastError;
  }
}

export class MemorySyncStore implements SyncStore {
  readonly #records = new Map<string, SyncEnvelope>();
  async list(): Promise<readonly SyncEnvelope[]> { return [...this.#records.values()]; }
  async put(envelope: SyncEnvelope): Promise<void> { const current = this.#records.get(envelope.id); if (!current || compareEnvelopes(envelope, current) >= 0) this.#records.set(envelope.id, envelope); }
  async clear(): Promise<void> { this.#records.clear(); }
}

export class InMemorySyncProvider implements SyncProvider {
  readonly id = "memory-fixture";
  readonly #records = new Map<string, SyncEnvelope>();
  readonly #revokedDevices = new Set<string>();
  online = true;
  failuresRemaining = 0;
  #revision = 0;

  async pull(_cursor?: string, signal?: AbortSignal): Promise<{ readonly cursor: string; readonly envelopes: readonly SyncEnvelope[] }> { this.#gate(signal); return { cursor: String(this.#revision), envelopes: [...this.#records.values()].filter(envelope => !this.#revokedDevices.has(envelope.deviceId)) }; }
  async push(envelopes: readonly SyncEnvelope[], signal?: AbortSignal): Promise<void> { this.#gate(signal); for (const envelope of envelopes) { if (this.#revokedDevices.has(envelope.deviceId)) continue; const current = this.#records.get(envelope.id); if (!current || compareEnvelopes(envelope, current) >= 0) this.#records.set(envelope.id, envelope); } this.#revision += 1; }
  async resetRemote(signal?: AbortSignal): Promise<void> { this.#gate(signal); this.#records.clear(); this.#revision += 1; }
  async revokeDevice(deviceId: string, signal?: AbortSignal): Promise<void> { this.#gate(signal); this.#revokedDevices.add(deviceId); for (const [id, envelope] of this.#records) if (envelope.deviceId === deviceId) this.#records.delete(id); this.#revision += 1; }
  snapshot(): readonly SyncEnvelope[] { return [...this.#records.values()]; }
  #gate(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new DOMException("Operação cancelada", "AbortError"); if (!this.online) throw new SyncOfflineError(); if (this.failuresRemaining > 0) { this.failuresRemaining -= 1; throw new Error("Falha transitória do fixture"); } }
}

export function compareEnvelopes(left: SyncEnvelope, right: SyncEnvelope): number {
  if (left.logicalVersion !== right.logicalVersion) return Math.sign(left.logicalVersion - right.logicalVersion);
  if (left.updatedAt !== right.updatedAt) return Math.sign(left.updatedAt - right.updatedAt);
  if (left.tombstone !== right.tombstone) return left.tombstone ? 1 : -1;
  return left.deviceId.localeCompare(right.deviceId);
}

async function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => { const timeout = setTimeout(resolve, milliseconds); signal?.addEventListener("abort", () => { clearTimeout(timeout); reject(signal.reason ?? new DOMException("Operação cancelada", "AbortError")); }, { once: true }); });
}
