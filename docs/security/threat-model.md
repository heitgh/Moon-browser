# Threat model

Protected assets include browsing data, sessions, credentials, filesystem access, extension/plugin capabilities, network configuration, AI context, and update integrity.

Threat actors include malicious pages, compromised extensions, untrusted plugins, hostile downloads, injected IPC messages, supply-chain packages, local attackers, and prompt-injection content.

Active controls are sandboxing, context isolation, a frozen preload allowlist, tab/window ownership checks, HTTP(S)-only page navigation, partitioned sessions, explicit site-permission decisions, local default assets, backup schema validation and non-persistence of private tabs.

Open risks:

- IPC payload validation is handwritten and does not yet share schemas on every channel.
- Permission grants are persisted and checked in normal profiles; real device and iframe behavior still needs platform testing.
- AdBlock rules are pinned to a Git commit but fetched on first launch without a separate opt-in, then cached. A bundled verified snapshot is still needed.
- Download reputation, executable confirmation and quarantine integration are incomplete.
- Windows/Linux release signing, SBOM and signed AppImage verification have code and CI gates; production signing keys and cross-version installation tests are still absent. The published alpha.5 is unsigned.
- Local SQLite data, Chromium profile stores and recovery backups are not encrypted by the Moon application.
- Extension, plugin and AI modules remain disabled; their isolation contracts are not production controls.

Any change in those areas requires a focused threat analysis and negative tests before its feature flag can be enabled.
