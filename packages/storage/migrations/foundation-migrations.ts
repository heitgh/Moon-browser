import type { DatabaseMigration } from "../database/migrations.js";

const JSON_TABLES = [
  "settings",
  "tabs",
  "workspaces",
  "sessions",
  "bookmarks",
  "history",
  "notes",
  "tasks",
  "themes",
  "wallpapers",
  "timeline",
  "extensions"
] as const;

export const foundationMigrations: readonly DatabaseMigration[] = [
  {
    version: 1,
    name: "foundation-json-repositories",
    async up(connection) {
      for (const table of JSON_TABLES) {
        await connection.execute(`
          CREATE TABLE ${table} (
            id TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL CHECK(json_valid(data)),
            updated_at INTEGER NOT NULL
          );
          CREATE INDEX ${table}_updated_at_idx ON ${table}(updated_at DESC);
        `);
      }
      await connection.execute(`
        CREATE TABLE moon_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    }
  }
];
