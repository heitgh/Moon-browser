# Threat model

Protected assets include browsing data, sessions, credentials, filesystem access, extension/plugin capabilities, network configuration, AI context, and update integrity.

Threat actors include malicious pages, compromised extensions, untrusted plugins, hostile downloads, injected IPC messages, supply-chain packages, local attackers, and prompt-injection content.

Active controls are sandboxing, context isolation, a frozen preload allowlist, tab/window ownership checks, HTTP(S)-only page navigation, partitioned sessions, explicit site-permission decisions, local default assets, backup schema validation and non-persistence of private tabs.

Open risks:

- IPC payload validation is handwritten and does not yet share schemas on every channel.
- Permission grants are not persisted, checked through `setPermissionCheckHandler` or revocable by origin.
- AdBlock owns a `webRequest` handler instead of a composed policy pipeline.
- Download reputation, executable confirmation and quarantine integration are incomplete.
- Release signing, SBOM and signed updater are not operational.
- Extension, plugin and AI modules remain disabled; their isolation contracts are not production controls.

Any change in those areas requires a focused threat analysis and negative tests before its feature flag can be enabled.
