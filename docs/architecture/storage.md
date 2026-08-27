# Storage architecture

Moon uses SQLite in WAL mode. Repositories store validated JSON envelopes containing stable IDs and timestamps. This provides forward-compatible domain serialization while migrations evolve indexed projections.

Transactions use `BEGIN IMMEDIATE`, commit on success, and roll back on failure. Migrations are ordered, recorded exactly once, and executed transactionally. Cache and backup services remain independent of the database driver.

Private browsing data must use isolated ephemeral storage and must never be copied into persistent repositories.
