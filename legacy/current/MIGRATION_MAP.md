# Moon Browser — Migration Map

This branch is the safe foundation for the modular migration.

## Current implementation

- `index.html` remains the canonical legacy UI during migration.
- `main.js` remains the canonical Electron bootstrap during migration.
- `package.json` remains the current dependency manifest until the new workspace/module boundaries are validated.

## Migration targets

| Current | Target | Strategy |
|---|---|---|
| `index.html` | `ui/` + `packages/ui-core/` | Split structure, styles and UI behavior incrementally |
| inline JS in `index.html` | `packages/core/`, `packages/navigation/`, `packages/intelligence/`, `packages/context/`, `packages/storage/` | Extract by responsibility, preserving behavior |
| `main.js` | `apps/desktop/electron/main/` + `apps/desktop/electron/preload/` + platform adapters | Extract Electron-only capabilities |
| `@ghostery/adblocker-electron` | `packages/security/adblock/` + desktop adapter | Keep network/native boundary explicit |
| `localStorage` | `packages/storage/` + SQLite | Introduce migrations; do not delete existing data |
| VPN UI state | `packages/network/` + desktop native adapter | UI must never claim a VPN is connected without a real backend |
| browser extension UI | `packages/extensions/` | Build Chromium compatibility behind an adapter |

## Non-negotiable migration rules

1. Do not remove an existing user-facing feature merely to modularize it.
2. Do not replace working behavior with mock buttons or placeholder services.
3. Keep the current Electron build runnable after every migration step.
4. Core packages must not import Electron APIs.
5. UI must call platform capabilities through interfaces/adapters.
6. Mobile must consume the same core contracts rather than copying desktop logic.
7. Native capabilities such as VPN, network filtering, permissions and extension execution must expose truthful runtime state.
8. Existing `localStorage` data must be migrated before it is retired.
9. Chrome/Chromium extension compatibility is a compatibility layer, not a promise that every Chrome API works on day one.
10. Every extraction should be tested before the old implementation is removed.
