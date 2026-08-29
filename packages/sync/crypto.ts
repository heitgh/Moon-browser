import type { SyncEnvelope, SyncRecord } from "./types.js";

export const SYNC_KDF_PARAMETERS = Object.freeze({ name: "PBKDF2", hash: "SHA-256", iterations: 600_000, saltBytes: 16, keyBytes: 32 } as const);
export interface DerivedUserKey { readonly key: CryptoKey; readonly salt: string; readonly iterations: number; }
export interface WrappedMasterKey { readonly format: "moon-wrapped-master-key"; readonly version: 1; readonly kdf: "PBKDF2-SHA-256"; readonly iterations: number; readonly salt: string; readonly nonce: string; readonly ciphertext: string; }

export async function deriveUserKey(passphrase: string, salt: string | Uint8Array = randomBytes(SYNC_KDF_PARAMETERS.saltBytes), iterations: number = SYNC_KDF_PARAMETERS.iterations): Promise<DerivedUserKey> {
  if (typeof passphrase !== "string" || passphrase.length < 12 || passphrase.length > 1_024) throw new TypeError("A frase de criptografia deve ter entre 12 e 1024 caracteres.");
  if (!Number.isSafeInteger(iterations) || iterations < 310_000 || iterations > 2_000_000) throw new TypeError("Parâmetros KDF inválidos.");
  const saltBytes = typeof salt === "string" ? decode(salt, 16, 64) : salt;
  const material = await crypto.subtle.importKey("raw", buffer(utf8(passphrase)), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buffer(saltBytes), iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { key, salt: encode(saltBytes), iterations };
}

export function generateMasterKey(): Uint8Array { return randomBytes(SYNC_KDF_PARAMETERS.keyBytes); }

export async function wrapMasterKey(masterKey: Uint8Array, userKey: DerivedUserKey, profileId: string): Promise<WrappedMasterKey> {
  assertMasterKey(masterKey); const nonce = randomBytes(12); const aad = utf8(`moon-master-key\0v1\0${boundedId(profileId)}`);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buffer(nonce), additionalData: buffer(aad), tagLength: 128 }, userKey.key, buffer(masterKey));
  return { format: "moon-wrapped-master-key", version: 1, kdf: "PBKDF2-SHA-256", iterations: userKey.iterations, salt: userKey.salt, nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) };
}

export async function unwrapMasterKey(bundle: WrappedMasterKey, passphrase: string, profileId: string): Promise<Uint8Array> {
  if (bundle.format !== "moon-wrapped-master-key" || bundle.version !== 1 || bundle.kdf !== "PBKDF2-SHA-256") throw new TypeError("Pacote de chave mestra inválido.");
  const userKey = await deriveUserKey(passphrase, bundle.salt, bundle.iterations);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buffer(decode(bundle.nonce, 12, 12)), additionalData: buffer(utf8(`moon-master-key\0v1\0${boundedId(profileId)}`)), tagLength: 128 }, userKey.key, buffer(decode(bundle.ciphertext, 17, 128)));
  const masterKey = new Uint8Array(plaintext); assertMasterKey(masterKey); return masterKey;
}

export async function encryptSyncRecord(record: SyncRecord, masterKey: Uint8Array): Promise<SyncEnvelope> {
  assertMasterKey(masterKey); validateRecord(record); const nonce = randomBytes(12); const key = await importMasterKey(masterKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buffer(nonce), additionalData: buffer(utf8(metadataFor(record))), tagLength: 128 }, key, buffer(utf8(JSON.stringify(record.payload))));
  return { format: "moon-sync-envelope", version: 1, id: record.id, category: record.category, logicalVersion: record.logicalVersion, deviceId: record.deviceId, updatedAt: record.updatedAt, tombstone: record.tombstone, algorithm: "AES-256-GCM", nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) };
}

export async function decryptSyncEnvelope<T>(envelope: SyncEnvelope, masterKey: Uint8Array): Promise<SyncRecord<T>> {
  assertMasterKey(masterKey); validateEnvelope(envelope); const key = await importMasterKey(masterKey);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buffer(decode(envelope.nonce, 12, 12)), additionalData: buffer(utf8(metadataFor(envelope))), tagLength: 128 }, key, buffer(decode(envelope.ciphertext, 17, 5_000_000)));
  return { id: envelope.id, category: envelope.category, logicalVersion: envelope.logicalVersion, deviceId: envelope.deviceId, updatedAt: envelope.updatedAt, tombstone: envelope.tombstone, payload: JSON.parse(new TextDecoder().decode(plaintext)) as T };
}

export function exportRecoveryKey(masterKey: Uint8Array): string { assertMasterKey(masterKey); return `moon-recovery-v1:${encode(masterKey)}`; }
export function importRecoveryKey(value: string): Uint8Array { if (!value.startsWith("moon-recovery-v1:")) throw new TypeError("Chave de recuperação inválida."); const key = decode(value.slice(17), 32, 32); assertMasterKey(key); return key; }

async function importMasterKey(value: Uint8Array): Promise<CryptoKey> { return crypto.subtle.importKey("raw", buffer(value), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); }
function metadataFor(value: Pick<SyncRecord, "id" | "category" | "logicalVersion" | "deviceId" | "updatedAt" | "tombstone">): string { return JSON.stringify(["moon-sync-envelope", 1, value.id, value.category, value.logicalVersion, value.deviceId, value.updatedAt, value.tombstone]); }
function validateRecord(record: SyncRecord): void { boundedId(record.id); boundedId(record.deviceId); if (!Number.isSafeInteger(record.logicalVersion) || record.logicalVersion < 1 || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0) throw new TypeError("Metadados do registro de sync inválidos."); JSON.stringify(record.payload); }
function validateEnvelope(envelope: SyncEnvelope): void { if (envelope.format !== "moon-sync-envelope" || envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM") throw new TypeError("Envelope de sync inválido."); validateRecord({ ...envelope, payload: null }); }
function boundedId(value: string): string { if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(value)) throw new TypeError("ID de sync inválido."); return value; }
function assertMasterKey(value: Uint8Array): void { if (!(value instanceof Uint8Array) || value.byteLength !== 32) throw new TypeError("A chave mestra deve ter 256 bits."); }
function randomBytes(length: number): Uint8Array { const value = new Uint8Array(length); crypto.getRandomValues(value); return value; }
function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function buffer(value: Uint8Array): Uint8Array<ArrayBuffer> { const copy = new Uint8Array(new ArrayBuffer(value.byteLength)); copy.set(value); return copy; }
function encode(value: Uint8Array): string { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""); }
function decode(value: string, minimum: number, maximum: number): Uint8Array { if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError("Base64url inválido."); const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded); const bytes = Uint8Array.from(binary, character => character.charCodeAt(0)); if (bytes.byteLength < minimum || bytes.byteLength > maximum) throw new TypeError("Tamanho criptográfico inválido."); return bytes; }
