# Compatibility roadmap

Desktop initially targets current Electron/Chromium on Linux, Windows, and macOS. Mobile targets Android browser APIs and iOS WKWebView through the same Platform contracts.

Chromium extensions are evaluated namespace by namespace. Manifest V3 is the baseline; unsupported APIs fail explicitly. Data formats and migrations remain forward compatible, while platform-specific capabilities can report `unavailable` instead of being simulated.
