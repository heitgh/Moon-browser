import Database from "better-sqlite3";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const databasePath = resolve(process.env.MOON_DATABASE_PATH ?? "database/moon.db");
await mkdir(dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

try {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec("CREATE TABLE IF NOT EXISTS moon_migrations(version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");

  const applied = db.prepare("SELECT 1 FROM moon_migrations WHERE version = ?");
  const record = db.prepare("INSERT INTO moon_migrations(version, applied_at) VALUES(?, ?)");
  const initialVersion = "000-initial-schema";

  if (!applied.get(initialVersion)) {
    const schemaRoot = resolve("database/schema");
    const tableRoot = join(schemaRoot, "tables");
    const tableFiles = (await readdir(tableRoot))
      .filter(file => file.endsWith(".sql"))
      .sort();
    const schemaSql = await readFile(join(schemaRoot, "schema.sql"), "utf8");
    const tableSql = await Promise.all(
      tableFiles.map(file => readFile(join(tableRoot, file), "utf8"))
    );
    const indexesSql = await readFile(join(schemaRoot, "indexes.sql"), "utf8");

    // PRAGMA statements in schema.sql must run outside a transaction.
    db.exec(schemaSql);
    db.transaction(() => {
      for (const sql of tableSql) db.exec(sql);
      db.exec(indexesSql);
      record.run(initialVersion, Date.now());
    })();
    console.log(`Applied ${initialVersion}`);
  }

  const migrationsDirectory = resolve("database/migrations");
  let files: string[] = [];
  try {
    files = (await readdir(migrationsDirectory)).filter(file => file.endsWith(".sql")).sort();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }

  for (const file of files) {
    if (applied.get(file)) continue;
    const sql = await readFile(join(migrationsDirectory, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(file, Date.now());
    })();
    console.log(`Applied ${file}`);
  }
} finally {
  db.close();
}
