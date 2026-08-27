export interface CacheEntry<T> { readonly value: T; readonly createdAt: number; readonly expiresAt?: number; }
export interface CacheStore { get<T>(key: string): Promise<CacheEntry<T> | undefined>; set<T>(key: string, entry: CacheEntry<T>): Promise<void>; delete(key: string): Promise<boolean>; clear(): Promise<void>; keys(): Promise<readonly string[]>; }
