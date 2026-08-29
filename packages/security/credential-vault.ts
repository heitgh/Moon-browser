export type SecretBackendAvailability = "secure" | "insecure" | "unavailable";
export interface SecretBackendStatus { readonly availability: SecretBackendAvailability; readonly name: string; readonly reason?: string; }
export interface SecretProtectionBackend { readonly status: SecretBackendStatus; seal(plaintext: Uint8Array, context: string): Promise<string>; unseal(ciphertext: string, context: string): Promise<Uint8Array>; }

export interface VaultCredential { readonly id: string; readonly origin: string; readonly username: string; readonly password: string; readonly createdAt: number; readonly updatedAt: number; }
export interface VaultCredentialSummary { readonly id: string; readonly origin: string; readonly username: string; readonly createdAt: number; readonly updatedAt: number; }
export interface SealedVaultRecord extends VaultCredentialSummary { readonly sealed: string; }
export interface VaultRepository { list(): Promise<readonly SealedVaultRecord[]>; put(record: SealedVaultRecord): Promise<void>; remove(id: string): Promise<void>; clear(): Promise<void>; }
export interface VaultStatus { readonly available: boolean; readonly locked: boolean; readonly backend: SecretBackendStatus; readonly captureEnabled: false; readonly autofillEnabled: false; }

export class LocalCredentialVault {
  #unlockedAt: number | undefined;
  constructor(readonly backend: SecretProtectionBackend, readonly repository: VaultRepository, readonly lockAfterMs = 5 * 60_000, readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(lockAfterMs) || lockAfterMs < 10_000 || lockAfterMs > 24 * 60 * 60_000) throw new TypeError("Tempo de bloqueio do cofre inválido.");
  }

  get status(): VaultStatus { return { available: this.backend.status.availability === "secure", locked: !this.#isUnlocked(), backend: this.backend.status, captureEnabled: false, autofillEnabled: false }; }

  unlock(userInitiated: boolean): void {
    if (!userInitiated) throw new Error("Desbloquear o cofre exige interação consciente do usuário.");
    if (this.backend.status.availability !== "secure") throw new Error(this.backend.status.reason ?? "Backend seguro do sistema indisponível.");
    this.#unlockedAt = this.now();
  }

  lock(): void { this.#unlockedAt = undefined; }

  async save(input: Omit<VaultCredential, "createdAt" | "updatedAt"> & { readonly createdAt?: number; readonly updatedAt?: number }, userInitiated: boolean): Promise<VaultCredentialSummary> {
    this.#assertUnlocked(userInitiated); const id = bounded(input.id, 100, "ID"); const origin = normalizeCredentialOrigin(input.origin); const username = bounded(input.username, 512, "usuário", true); const password = bounded(input.password, 10_000, "senha", true);
    const existing = (await this.repository.list()).find(record => record.id === id); const updatedAt = input.updatedAt ?? this.now(); const createdAt = existing?.createdAt ?? input.createdAt ?? updatedAt;
    if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(updatedAt) || createdAt < 0 || updatedAt < createdAt) throw new TypeError("Datas da credencial inválidas.");
    const sealed = await this.backend.seal(new TextEncoder().encode(JSON.stringify({ username, password })), context(id, origin));
    const record: SealedVaultRecord = { id, origin, username, createdAt, updatedAt, sealed }; await this.repository.put(record); this.#touch(); return summary(record);
  }

  async list(): Promise<readonly VaultCredentialSummary[]> { this.#assertUnlocked(true); this.#touch(); return (await this.repository.list()).map(summary); }

  async reveal(id: string, origin: string, userInitiated: boolean): Promise<VaultCredential> {
    this.#assertUnlocked(userInitiated); const normalizedOrigin = normalizeCredentialOrigin(origin); const record = (await this.repository.list()).find(candidate => candidate.id === bounded(id, 100, "ID"));
    if (!record) throw new Error("Credencial não encontrada."); if (record.origin !== normalizedOrigin) throw new Error("A credencial não pode ser revelada para uma origem diferente.");
    const plaintext = await this.backend.unseal(record.sealed, context(record.id, record.origin)); const value = JSON.parse(new TextDecoder().decode(plaintext)) as { readonly username?: unknown; readonly password?: unknown };
    const username = bounded(value.username, 512, "usuário", true); const password = bounded(value.password, 10_000, "senha", true); this.#touch(); return { ...summary(record), username, password };
  }

  async remove(id: string, userInitiated: boolean): Promise<void> { this.#assertUnlocked(userInitiated); await this.repository.remove(bounded(id, 100, "ID")); this.#touch(); }

  #assertUnlocked(userInitiated: boolean): void { if (!userInitiated) throw new Error("A operação do cofre exige interação consciente do usuário."); if (!this.#isUnlocked()) { this.lock(); throw new Error("O cofre está bloqueado."); } }
  #isUnlocked(): boolean { return this.#unlockedAt !== undefined && this.now() - this.#unlockedAt < this.lockAfterMs; }
  #touch(): void { this.#unlockedAt = this.now(); }
}

export class MemoryVaultRepository implements VaultRepository {
  readonly #records = new Map<string, SealedVaultRecord>();
  async list(): Promise<readonly SealedVaultRecord[]> { return [...this.#records.values()]; }
  async put(record: SealedVaultRecord): Promise<void> { this.#records.set(record.id, record); }
  async remove(id: string): Promise<void> { this.#records.delete(id); }
  async clear(): Promise<void> { this.#records.clear(); }
  snapshot(): readonly SealedVaultRecord[] { return [...this.#records.values()]; }
}

export class UnavailableSecretBackend implements SecretProtectionBackend {
  readonly status: SecretBackendStatus;
  constructor(reason = "Nenhum backend seguro do sistema operacional foi detectado.", name = "unavailable") { this.status = { availability: "unavailable", name, reason }; }
  async seal(): Promise<string> { throw new Error(this.status.reason); }
  async unseal(): Promise<Uint8Array> { throw new Error(this.status.reason); }
}

export class MemorySecureSecretBackend implements SecretProtectionBackend {
  readonly status: SecretBackendStatus = { availability: "secure", name: "memory-test-fixture" };
  readonly #key: CryptoKey;
  private constructor(key: CryptoKey) { this.#key = key; }
  static async create(): Promise<MemorySecureSecretBackend> { return new MemorySecureSecretBackend(await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])); }
  async seal(plaintext: Uint8Array, contextValue: string): Promise<string> { const nonce = new Uint8Array(12); crypto.getRandomValues(nonce); const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buffer(nonce), additionalData: buffer(new TextEncoder().encode(contextValue)), tagLength: 128 }, this.#key, buffer(plaintext)); return `${encode(nonce)}.${encode(new Uint8Array(ciphertext))}`; }
  async unseal(value: string, contextValue: string): Promise<Uint8Array> { const [nonce, ciphertext, extra] = value.split("."); if (!nonce || !ciphertext || extra) throw new TypeError("Registro selado inválido."); return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buffer(decode(nonce)), additionalData: buffer(new TextEncoder().encode(contextValue)), tagLength: 128 }, this.#key, buffer(decode(ciphertext)))); }
}

export function normalizeCredentialOrigin(value: string): string { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new TypeError("Credenciais exigem uma origem HTTPS exata, sem caminho, consulta ou fragmento."); return url.origin; }
function context(id: string, origin: string): string { return `moon-credential-v1\0${id}\0${origin}`; }
function summary(record: SealedVaultRecord): VaultCredentialSummary { return { id: record.id, origin: record.origin, username: record.username, createdAt: record.createdAt, updatedAt: record.updatedAt }; }
function bounded(value: unknown, max: number, label: string, allowEmpty = false): string { if (typeof value !== "string" || value.length > max || (!allowEmpty && !value) || [...value].some(character => character.charCodeAt(0) === 0)) throw new TypeError(`${label} inválido.`); return value; }
function buffer(value: Uint8Array): Uint8Array<ArrayBuffer> { const copy = new Uint8Array(new ArrayBuffer(value.byteLength)); copy.set(value); return copy; }
function encode(value: Uint8Array): string { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""); }
function decode(value: string): Uint8Array { if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError("Base64url inválido."); const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4)); const bytes = Uint8Array.from(binary, character => character.charCodeAt(0)); if (!bytes.length || bytes.length > 20_000) throw new TypeError("Registro selado inválido."); return bytes; }
