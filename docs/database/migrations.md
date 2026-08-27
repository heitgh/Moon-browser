# Database migrations

Migrations live in `database/migrations/` and use sortable, immutable filenames such as `0001_initial.sql`. Applied filenames are recorded in `moon_migrations` with timestamps.

Rules:

1. Never edit a migration already released.
2. Prefer additive changes and backfills.
3. Wrap schema and data changes in one transaction.
4. Test upgrades from the oldest supported schema.
5. Back up user data before destructive migrations.
6. Document rollback limitations explicitly.
