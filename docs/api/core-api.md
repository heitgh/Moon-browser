# Core API

`@moon/core` contains browser-domain state and orchestration without native-runtime imports. Public modules include `BrowserManager`, `TabManager`, `NavigationManager`, `SessionManager`, `WorkspaceManager`, `CommandManager`, `MoonStateStore`, and `MoonEventBus`.

Managers receive platform capabilities through constructors. Mutations publish typed events and update immutable state. Consumers must use public exports from `packages/core/index.ts`; importing Electron or database drivers into Core is prohibited.

Errors derive from `MoonError` and include stable codes, timestamps, context, recoverability, and safe serialization.
