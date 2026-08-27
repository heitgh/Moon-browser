# Architecture overview

Moon follows dependency inversion:

```text
UI → Core → Platform contracts ← Desktop / Mobile adapters
          ↘ Storage, Network, Security, Context, Intelligence
```

Core owns browser concepts and state. Platform contracts describe native capabilities. Electron, Android, and iOS details remain in application adapters. Storage uses repositories; UI never issues SQL. Context and AI receive filtered domain data rather than direct filesystem or database access.

All cross-boundary operations are asynchronous, permission checked, event observable, and replaceable in tests.
