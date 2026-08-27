export type SqlValue = string | number | bigint | Uint8Array | null;
export type SqlParameters = readonly SqlValue[] | Readonly<Record<string, SqlValue>>;
export interface SqlRunResult { readonly changes: number; readonly lastInsertRowId?: number | bigint; }
export interface DatabaseConnection {
  readonly open: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  run(sql: string, parameters?: SqlParameters): Promise<SqlRunResult>;
  get<T extends object>(sql: string, parameters?: SqlParameters): Promise<T | undefined>;
  all<T extends object>(sql: string, parameters?: SqlParameters): Promise<readonly T[]>;
  execute(sql: string): Promise<void>;
}
