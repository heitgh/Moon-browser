# Extension API

Moon extensions use permission-scoped APIs for tabs, windows, storage, runtime messaging, commands, context menus, bookmarks, history, and notifications.

Manifest V3 packages are parsed and validated before loading. Chromium namespaces may be supported, partially supported, or unavailable; consult the compatibility registry rather than assuming complete Chrome parity.

Every privileged method checks its declared permission. Extension storage is namespaced by extension ID, background work runs through an isolated process adapter, and IPC or native objects are never exposed directly.
