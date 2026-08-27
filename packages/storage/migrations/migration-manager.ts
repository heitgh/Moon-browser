import type { DatabaseMigration } from "../database/migrations.js";
import { sortMigrations } from "../database/migrations.js";
import type { MoonDatabase } from "../database/database.js";
export class MigrationManager {
  constructor(readonly database: MoonDatabase, readonly migrations: readonly DatabaseMigration[]) {}
  async migrate(): Promise<number> {
    await this.database.run("CREATE TABLE IF NOT EXISTS moon_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)");
    const applied = await this.database.all<{ version: number }>("SELECT version FROM moon_migrations"); const versions = new Set(applied.map(item => item.version)); let count = 0;
    for (const migration of sortMigrations(this.migrations)) if (!versions.has(migration.version)) { await this.database.transaction(async connection => { await migration.up(connection); await connection.run("INSERT INTO moon_migrations(version,name,applied_at) VALUES(?,?,?)", [migration.version, migration.name, Date.now()]); }); count++; }
    return count;
  }
}
