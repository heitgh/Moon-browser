export type StorageScope =
  | "global"
  | "profile"
  | "workspace"
  | "session"
  | "tab"
  | "extension";

export interface StorageQuery {
  readonly scope: StorageScope;
  readonly namespace: string;
  readonly key: string;
}

export interface StorageEntry<T = unknown> {
  readonly scope: StorageScope;
  readonly namespace: string;
  readonly key: string;
  readonly value: T;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface StorageTransaction {
  get<T = unknown>(
    query: StorageQuery
  ): Promise<StorageEntry<T> | null>;

  set<T = unknown>(
    query: StorageQuery,
    value: T
  ): Promise<void>;

  delete(
    query: StorageQuery
  ): Promise<void>;

  clear(
    scope: StorageScope,
    namespace: string
  ): Promise<void>;
}

export interface StoragePlatform {
  get<T = unknown>(
    query: StorageQuery
  ): Promise<StorageEntry<T> | null>;

  set<T = unknown>(
    query: StorageQuery,
    value: T
  ): Promise<void>;

  delete(
    query: StorageQuery
  ): Promise<void>;

  has(
    query: StorageQuery
  ): Promise<boolean>;

  clear(
    scope: StorageScope,
    namespace: string
  ): Promise<void>;

  keys(
    scope: StorageScope,
    namespace: string
  ): Promise<readonly string[]>;

  transaction<T>(
    callback: (
      transaction: StorageTransaction
    ) => Promise<T>
  ): Promise<T>;

  close(): Promise<void>;
}