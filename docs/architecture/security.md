# Security architecture

Every shell window, web tab, authentication popup, access window and recovery window now uses a shared policy with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, `allowRunningInsecureContent: false` and `webviewTag: false`. Webview attachment is denied. Preload exposes a frozen bridge with an explicit channel allowlist. The release build sets five Electron fuses; CI reads the resulting executable and fails if any required fuse differs.

Controles ativos hoje: validação de protocolos HTTP/HTTPS, posse de aba por janela no IPC, limites básicos de payload, partições por workspace, sessões privadas efêmeras, prompt explícito de permissões, CSP local e schema de backup. Page content is always untrusted and never receives the Moon preload.

Capability permissions and permission revocation have a UI and main-process adapter, but require device testing. Extension/plugin sandboxes, signed production releases and AI isolation remain design contracts. Windows Authenticode and Linux signatures now have release gates, yet no production key or cross-version update test is available. They must not be described as released controls.

Destructive, external, or high-risk actions require explicit user confirmation.


## Compatibilidade sem reduzir o sandbox

A política de compatibilidade remove apenas identificadores do produto no user-agent e mantém a versão real do Chromium. Popups HTTP/HTTPS de autenticação reutilizam a `Session` da aba de origem, continuam com `sandbox: true`, `contextIsolation: true`, Node desativado e navegação restrita a protocolos web seguros.

O AdBlock falha aberto somente para navegação principal, endpoints reconhecidos de identidade ou políticas que excedam o deadline. Conteúdo remoto continua sem preload do Moon. Recuperação de renderer é limitada a duas recargas para evitar loops e não restaura páginas privadas fora de sua sessão.

Evidência do corte `c0ca1ba`: fixture determinístico validou cookie após redirect, popup OAuth com `window.opener` e recuperação limitada após crash; probes reais abriram Pinterest e TikTok sem renderer caído ou vazamento de erro interno. Isso não substitui login humano nem validação anti-bot por região.
