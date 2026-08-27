import type { MoonDatabase } from "../database/database.js";

interface StoredJsonRow {
  readonly id: string;
  readonly data: string;
  readonly updated_at: number;
}

export abstract class JsonRepository<T extends { readonly id: string }> {
  readonly #table: string;

  protected constructor(
    protected readonly database: MoonDatabase,
    table: string
  ) {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) {
      throw new Error(`Invalid repository table name: ${table}`);
    }
    this.#table = table;
  }

  async get(id: string): Promise<T | undefined> {
    const row = await this.database.get<StoredJsonRow>(
      `SELECT id, data, updated_at FROM ${this.#table} WHERE id = ?`,
      [id]
    );
    return row ? this.decode(row) : undefined;
  }

  async all(): Promise<readonly T[]> {
    const rows = await this.database.all<StoredJsonRow>(
      `SELECT id, data, updated_at FROM ${this.#table} ORDER BY updated_at DESC`
    );
    return rows.map(row => this.decode(row));
  }

  async save(value: T): Promise<void> {
    await this.database.run(
      `INSERT INTO ${this.#table} (id, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at`,
      [value.id, JSON.stringify(value), Date.now()]
    );
  }

  async saveMany(values: readonly T[]): Promise<void> {
    await this.database.transaction(async () => {
      for (const value of values) await this.save(value);
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.run(
      `DELETE FROM ${this.#table} WHERE id = ?`,
      [id]
    );
    return result.changes > 0;
  }

  async clear(): Promise<number> {
    const result = await this.database.run(`DELETE FROM ${this.#table}`);
    return result.changes;
  }

  protected async filter(
    predicate: (value: T) => boolean
  ): Promise<readonly T[]> {
    return (await this.all()).filter(predicate);
  }

  private decode(row: StoredJsonRow): T {
    try {
      const value = JSON.parse(row.data) as T;
      if (!value || typeof value !== "object" || value.id !== row.id) {
        throw new Error("Stored record identity does not match its row");
      }
      return value;
    } catch (error) {
      throw new Error(
        `Failed to decode ${this.#table} record ${row.id}`,
        { cause: error }
      );
    }
  }
}
