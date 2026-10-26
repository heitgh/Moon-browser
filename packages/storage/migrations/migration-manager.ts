// Nexus Inc. — validate compatibility and snapshot before any schema mutation.
import type { DatabaseMigration } from "../database/migrations.js";
import { sortMigrations } from "../database/migrations.js";
import type { MoonDatabase } from "../database/database.js";
export class MigrationManager {
  constructor(readonly database: MoonDatabase, readonly migrations: readonly DatabaseMigration[], readonly beforeMigration?: () => Promise<void>) {}
  async migrate(): Promise<number> {
    const exists = await this.database.get<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='moon_migrations'");
    const applied = exists ? await this.database.all<{ version: number }>("SELECT version FROM moon_migrations") : [];
    const ordered = sortMigrations(this.migrations);
    const known = new Set(ordered.map(item => item.version));
    if (applied.some(item => !known.has(item.version))) throw new Error("Este perfil foi criado por uma versão incompatível do Moon. Abra-o com a versão mais recente; seus dados não foram migrados.");
    const versions = new Set(applied.map(item => item.version));
    const pending = ordered.filter(item => !versions.has(item.version));
    if (!pending.length) return 0;
    await this.beforeMigration?.();
    await this.database.run("CREATE TABLE IF NOT EXISTS moon_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)");
    for (const migration of pending) await this.database.transaction(async connection => {
      await migration.up(connection);
      await connection.run("INSERT INTO moon_migrations(version,name,applied_at) VALUES(?,?,?)", [migration.version, migration.name, Date.now()]);
    });
    return pending.length;
  }
}
