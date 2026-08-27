import BetterSqlite3, { type Database } from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  DatabaseConnection,
  SqlParameters,
  SqlRunResult
} from "../database/connection.js";

export interface BetterSqliteConnectionOptions {
  readonly readonly?: boolean;
  readonly fileMustExist?: boolean;
  readonly timeoutMs?: number;
}

export class BetterSqliteConnection implements DatabaseConnection {
  #database: Database | undefined;

  constructor(
    readonly filename: string,
    readonly options: BetterSqliteConnectionOptions = {}
  ) {}

  get open(): boolean {
    return this.#database?.open === true;
  }

  async connect(): Promise<void> {
    if (this.open) return;
    if (this.filename !== ":memory:") {
      await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 });
    }
    const database = new BetterSqlite3(this.filename, {
      timeout: this.options.timeoutMs ?? 5_000,
      ...(this.options.readonly === undefined ? {} : { readonly: this.options.readonly }),
      ...(this.options.fileMustExist === undefined ? {} : { fileMustExist: this.options.fileMustExist })
    });
    database.pragma("foreign_keys = ON");
    database.pragma(`busy_timeout = ${this.options.timeoutMs ?? 5_000}`);
    if (!this.options.readonly) {
      database.pragma("journal_mode = WAL");
      database.pragma("synchronous = NORMAL");
    }
    this.#database = database;
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = undefined;
  }

  async run(sql: string, parameters?: SqlParameters): Promise<SqlRunResult> {
    const statement = this.#requireDatabase().prepare(sql);
    const result = parameters === undefined
      ? statement.run()
      : Array.isArray(parameters)
        ? statement.run(...parameters)
        : statement.run(parameters);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
  }

  async get<T extends object>(sql: string, parameters?: SqlParameters): Promise<T | undefined> {
    const statement = this.#requireDatabase().prepare(sql);
    return (parameters === undefined
      ? statement.get()
      : Array.isArray(parameters)
        ? statement.get(...parameters)
        : statement.get(parameters)) as T | undefined;
  }

  async all<T extends object>(sql: string, parameters?: SqlParameters): Promise<readonly T[]> {
    const statement = this.#requireDatabase().prepare(sql);
    return (parameters === undefined
      ? statement.all()
      : Array.isArray(parameters)
        ? statement.all(...parameters)
        : statement.all(parameters)) as readonly T[];
  }

  async execute(sql: string): Promise<void> {
    this.#requireDatabase().exec(sql);
  }

  #requireDatabase(): Database {
    if (!this.#database?.open) throw new Error("Moon database is not connected");
    return this.#database;
  }
}
