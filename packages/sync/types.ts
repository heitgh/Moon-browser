export type SyncCategory = "settings" | "themes" | "home" | "workspaces" | "bookmarks" | "shortcuts" | "notes" | "sessions" | "history" | "credentials";
export type SyncState = "idle" | "syncing" | "offline" | "error" | "conflict" | "disabled";

export interface DeviceIdentity { readonly id: string; readonly name: string; readonly keyId: string; readonly createdAt: number; readonly revokedAt?: number; }
export interface SyncRecord<T = unknown> { readonly id: string; readonly category: SyncCategory; readonly logicalVersion: number; readonly deviceId: string; readonly updatedAt: number; readonly tombstone: boolean; readonly payload: T; }
export interface SyncEnvelope { readonly format: "moon-sync-envelope"; readonly version: 1; readonly id: string; readonly category: SyncCategory; readonly logicalVersion: number; readonly deviceId: string; readonly updatedAt: number; readonly tombstone: boolean; readonly algorithm: "AES-256-GCM"; readonly nonce: string; readonly ciphertext: string; }
export interface SyncBatch { readonly cursor?: string; readonly envelopes: readonly SyncEnvelope[]; }
export interface SyncResult { readonly uploaded: number; readonly downloaded: number; readonly conflicts: number; readonly state: SyncState; }

export interface SyncProvider {
  readonly id: string;
  pull(cursor?: string, signal?: AbortSignal): Promise<SyncBatch>;
  push(envelopes: readonly SyncEnvelope[], signal?: AbortSignal): Promise<void>;
  resetRemote(signal?: AbortSignal): Promise<void>;
  revokeDevice(deviceId: string, signal?: AbortSignal): Promise<void>;
}

export interface SyncStore { list(): Promise<readonly SyncEnvelope[]>; put(envelope: SyncEnvelope): Promise<void>; clear(): Promise<void>; }
export interface SyncCategoryPolicy { readonly enabled: boolean; readonly requiresSeparateConsent?: boolean; }
export interface SyncEngine {
  readonly state: SyncState;
  synchronize(signal?: AbortSignal): Promise<SyncResult>;
  write<T>(record: SyncRecord<T>): Promise<SyncEnvelope>;
  read<T>(id: string): Promise<SyncRecord<T> | undefined>;
  remove(record: Omit<SyncRecord<null>, "payload" | "tombstone">): Promise<SyncEnvelope>;
  resetRemote(signal?: AbortSignal): Promise<void>;
  revokeDevice(deviceId: string, signal?: AbortSignal): Promise<void>;
}
