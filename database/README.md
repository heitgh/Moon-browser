# Moon Browser database

The desktop application uses SQLite in WAL mode. Application records are stored as validated JSON envelopes with stable identifiers and update timestamps. This keeps repository serialization consistent while the domain model evolves.

Initialization order:

1. `schema/schema.sql`
2. every file in `schema/tables/`
3. `schema/indexes.sql`
4. versioned migrations
5. optional development seeds

Database files, WAL files, backups, and user data must not be committed. Schema changes require a forward migration and must preserve private-session isolation.
