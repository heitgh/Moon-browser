import type { DatabaseConnection, SqlParameters, SqlRunResult } from "./connection.js";
export type TransactionFactory = (connection: DatabaseConnection) => Promise<DatabaseConnection>;
export class MoonDatabase {
  constructor(readonly connection: DatabaseConnection) {}
  connect(): Promise<void> { return this.connection.connect(); }
  close(): Promise<void> { return this.connection.close(); }
  run(sql: string, parameters?: SqlParameters): Promise<SqlRunResult> { return this.connection.run(sql, parameters); }
  get<T extends object>(sql: string, parameters?: SqlParameters): Promise<T | undefined> { return this.connection.get<T>(sql, parameters); }
  all<T extends object>(sql: string, parameters?: SqlParameters): Promise<readonly T[]> { return this.connection.all<T>(sql, parameters); }
  async transaction<T>(operation: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    await this.connection.execute("BEGIN IMMEDIATE");
    try { const result = await operation(this.connection); await this.connection.execute("COMMIT"); return result; }
    catch (error) { await this.connection.execute("ROLLBACK"); throw error; }
  }
}
