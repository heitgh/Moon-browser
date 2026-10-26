import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
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

it("refuses a future schema without running migrations or the backup hook", async () => {
  const { connection, database } = await createDatabase();
  try {
    await new MigrationManager(database, foundationMigrations).migrate();
    await database.run("INSERT INTO moon_migrations(version,name,applied_at) VALUES(999,'future',0)");
    const backup = vi.fn();
    await expect(new MigrationManager(database, foundationMigrations, backup).migrate()).rejects.toThrow(/incompatível/);
    expect(backup).not.toHaveBeenCalled();
    expect(await database.get("SELECT version FROM moon_migrations WHERE version=999")).toEqual({ version: 999 });
  } finally { await connection.close(); }
});

it("takes a consistent pre-migration snapshot and leaves it readable after migration failure", async () => {
  const { connection, database } = await createDatabase();
  const destination = join(temporaryDirectories.at(-1)!, "snapshot.sqlite3");
  try {
    await new MigrationManager(database, foundationMigrations).migrate();
    const settings = new SettingsRepository(database); await settings.setValue("precious", { saved: true });
    const next = { version: 2, name: "failure", up: async () => { await database.run("CREATE TABLE transient_test(id INTEGER)"); throw new Error("disk failure"); } };
    await expect(new MigrationManager(database, [...foundationMigrations, next], () => connection.backup(destination)).migrate()).rejects.toThrow("disk failure");
    expect(await settings.getValue("precious")).toEqual({ saved: true });
    expect(await database.get("SELECT name FROM sqlite_master WHERE name='transient_test'")).toBeUndefined();
    const snapshot = new BetterSqliteConnection(destination, { readonly: true });
    await snapshot.connect();
    try { expect(await new SettingsRepository(new MoonDatabase(snapshot)).getValue("precious")).toEqual({ saved: true }); }
    finally { await snapshot.close(); }
  } finally { await connection.close(); }
});

it("does not mutate schema when the snapshot cannot be written", async () => {
  const { connection, database } = await createDatabase();
  try {
    await expect(new MigrationManager(database, foundationMigrations, async () => { throw new Error("no space"); }).migrate()).rejects.toThrow("no space");
    expect(await database.get("SELECT name FROM sqlite_master WHERE name='moon_migrations'")).toBeUndefined();
  } finally { await connection.close(); }
});
