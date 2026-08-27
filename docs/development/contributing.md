# Contributing

Keep dependency direction intact: UI and Core must not import Electron; UI must not access SQL; adapters implement Platform contracts. Add typed events for observable state changes and stable error codes for failures.

Before submitting changes, run typecheck, tests, formatting, security checks, database migration tests, and a production build. Do not commit generated user data, secrets, binaries, build output, or empty placeholder files.

Commits should be focused and explain behavior rather than file movement alone.
