# Moon roadmap

The immediate milestone is a secure desktop build reproducing legacy browsing, tabs, workspaces, settings, themes, AdBlock, sessions, notes, and downloads.

Next milestones add SQLite migration, Chromium extension compatibility, contextual Timeline, optional AI actions, plugin automation, sync-ready storage, Android and iOS adapters, accessibility validation, performance budgets, signed updates, and reproducible releases.

Features remain behind flags until their security and persistence behavior is verified.


## Foco imediato — 0.6.0-alpha.2

1. Manter verdes typecheck, lint, unitários, integração, Electron storage, E2E determinístico e builds; o gate passou em Linux e Windows no commit `c0ca1ba`.
2. Executar sondas externas de Pinterest e TikTok em mais de uma rede/plataforma.
3. Fazer teste humano de login Google/Pinterest sem registrar credenciais, cookies ou tokens.
4. Capturar comparação visual do chrome compacto nas mesmas dimensões do baseline.
5. Somente após os quatro gates, decidir tag, binários e publicação.