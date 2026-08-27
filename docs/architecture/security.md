# Security architecture

Renderer defaults are `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webviewTag: false`. Preload exposes a frozen bridge with an explicit channel allowlist.

Controles ativos hoje: validação de protocolos HTTP/HTTPS, posse de aba por janela no IPC, limites básicos de payload, partições por workspace, sessões privadas efêmeras, prompt explícito de permissões, CSP local e schema de backup. Page content is always untrusted and never receives the Moon preload.

Capability permissions, permission persistence/revocation, extension/plugin sandboxes, composed network policy, signed updates and AI isolation remain design contracts. They must not be described as operational until their adapters, UI, threat tests and revocation paths are connected.

Destructive, external, or high-risk actions require explicit user confirmation.
