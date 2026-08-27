# Platform API

`@moon/platform` defines native capabilities used by the Core: browser, storage, network, security, extensions, filesystem, clipboard, downloads, notifications, and permissions.

Desktop implementations live under `apps/desktop`; mobile implementations conform to the same contracts. Platform methods are asynchronous because native bridges may cross process or device boundaries. Callers must never assume Electron, Node.js paths, or Chromium-only behavior.

The central `Platform` object also exposes runtime name, version, operating system, architecture, and desktop/mobile type.
