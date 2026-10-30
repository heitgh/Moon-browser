import type { DatabaseConnection, SqlParameters, SqlRunResult } from "./connection.js";
import { AsyncLocalStorage } from "node:async_hooks";
export type TransactionFactory = (connection: DatabaseConnection) => Promise<DatabaseConnection>;
export class MoonDatabase {
  readonly #context = new AsyncLocalStorage<{ active: boolean }>();
  #tail: Promise<unknown> = Promise.resolve();
  #closing = false;
  constructor(readonly connection: DatabaseConnection) {}
  async connect(): Promise<void> {
    await this.#tail;
    await this.connection.connect();
    this.#closing = false;
  }
  async close(): Promise<void> {
    this.#closing = true;
    await this.#tail;
    await this.connection.close();
  }
  // Keep repository calls inside one transaction in its async context, while
  // queuing unrelated reads/writes behind it. Rejections never poison the queue.
  exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#context.getStore()?.active) return operation();
    if (this.#closing) return Promise.reject(new Error("O banco do perfil está encerrando."));
    const task = this.#tail.then(async () => {
      const scope = { active: true };
      try { return await this.#context.run(scope, operation); }
      finally { scope.active = false; }
    });
    this.#tail = task.then(() => undefined, () => undefined);
    return task;
  }
  run(sql: string, parameters?: SqlParameters): Promise<SqlRunResult> { return this.exclusive(() => this.connection.run(sql, parameters)); }
  get<T extends object>(sql: string, parameters?: SqlParameters): Promise<T | undefined> { return this.exclusive(() => this.connection.get<T>(sql, parameters)); }
  all<T extends object>(sql: string, parameters?: SqlParameters): Promise<readonly T[]> { return this.exclusive(() => this.connection.all<T>(sql, parameters)); }
  async transaction<T>(operation: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
    await this.connection.execute("BEGIN IMMEDIATE");
    try { const result = await operation(this.connection); await this.connection.execute("COMMIT"); return result; }
    catch (error) { await this.connection.execute("ROLLBACK"); throw error; }
    });
  }
}
