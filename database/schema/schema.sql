PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS moon_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO moon_metadata(key, value, updated_at)
VALUES ('schema_version', '1', unixepoch('subsec') * 1000)
ON CONFLICT(key) DO NOTHING;
