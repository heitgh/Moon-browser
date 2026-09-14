# Security architecture

Renderer defaults are `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webviewTag: false`. Preload exposes a frozen bridge with an explicit channel allowlist.

Controles ativos hoje: validação de protocolos HTTP/HTTPS, posse de aba por janela no IPC, limites básicos de payload, partições por workspace, sessões privadas efêmeras, prompt explícito de permissões, CSP local e schema de backup. Page content is always untrusted and never receives the Moon preload.

Capability permissions, permission persistence/revocation, extension/plugin sandboxes, composed network policy, signed updates and AI isolation remain design contracts. They must not be described as operational until their adapters, UI, threat tests and revocation paths are connected.

Destructive, external, or high-risk actions require explicit user confirmation.


## Compatibilidade sem reduzir o sandbox

A política de compatibilidade remove apenas identificadores do produto no user-agent e mantém a versão real do Chromium. Popups HTTP/HTTPS de autenticação reutilizam a `Session` da aba de origem, continuam com `sandbox: true`, `contextIsolation: true`, Node desativado e navegação restrita a protocolos web seguros.

O AdBlock falha aberto somente para navegação principal, endpoints reconhecidos de identidade ou políticas que excedam o deadline. Conteúdo remoto continua sem preload do Moon. Recuperação de renderer é limitada a duas recargas para evitar loops e não restaura páginas privadas fora de sua sessão.

Evidência do corte `c0ca1ba`: fixture determinístico validou cookie após redirect, popup OAuth com `window.opener` e recuperação limitada após crash; probes reais abriram Pinterest e TikTok sem renderer caído ou vazamento de erro interno. Isso não substitui login humano nem validação anti-bot por região.
