# Database schema

Schema version 1 enables foreign keys, WAL journaling, normal synchronization, and a five-second busy timeout. `moon_metadata` records schema information.

Domain tables contain:

- `id` — stable primary key;
- `data` — JSON validated by SQLite;
- `updated_at` — millisecond timestamp used by indexes.

Tables cover bookmarks, extensions, history, notes, sessions, settings, tabs, tasks, themes, timeline, wallpapers, and workspaces. Repository codecs validate identity after JSON decoding.
