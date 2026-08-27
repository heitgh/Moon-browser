import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteConnection } from "../../../packages/storage/adapters/better-sqlite-connection.js";
import { MoonDatabase } from "../../../packages/storage/database/database.js";
import { MigrationManager } from "../../../packages/storage/migrations/migration-manager.js";
import { foundationMigrations } from "../../../packages/storage/migrations/foundation-migrations.js";
import { SettingsRepository } from "../../../packages/storage/repositories/settings-repository.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function createDatabase(): Promise<{ connection: BetterSqliteConnection; database: MoonDatabase }> {
  const directory = await mkdtemp(join(tmpdir(), "moon-storage-test-"));
  temporaryDirectories.push(directory);
  const connection = new BetterSqliteConnection(join(directory, "profile.sqlite3"));
  const database = new MoonDatabase(connection);
  await database.connect();
  return { connection, database };
}

describe("BetterSqliteConnection", () => {
  it("enables the production pragmas and applies migrations once", async () => {
    const { connection, database } = await createDatabase();
    const migrations = new MigrationManager(database, foundationMigrations);
    expect(await migrations.migrate()).toBe(1);
    expect(await migrations.migrate()).toBe(0);
    expect((await database.get<{ journal_mode: string }>("PRAGMA journal_mode"))?.journal_mode).toBe("wal");
    expect((await database.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))?.foreign_keys).toBe(1);
    expect((await database.get<{ timeout: number }>("PRAGMA busy_timeout"))?.timeout).toBe(5_000);
    await connection.close();
  });

  it("persists repository values and rolls failed transactions back", async () => {
    const { connection, database } = await createDatabase();
    await new MigrationManager(database, foundationMigrations).migrate();
    const settings = new SettingsRepository(database);
    await settings.setValue("appearance", { density: "compact" });
    expect(await settings.getValue("appearance")).toEqual({ density: "compact" });

    await expect(database.transaction(async transaction => {
      await transaction.run(
        "INSERT INTO settings(id, data, updated_at) VALUES(?, ?, ?)",
        ["global:temporary", JSON.stringify({ id: "global:temporary" }), Date.now()]
      );
      throw new Error("abort");
    })).rejects.toThrow("abort");
    expect(await settings.get("global:temporary")).toBeUndefined();
    await connection.close();
  });
});
