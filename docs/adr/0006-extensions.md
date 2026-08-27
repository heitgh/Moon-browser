# ADR 0006 — Extensões e plugins

Status: Aceito
Data: 24 de agosto de 2026

## Contexto

Electron suporta apenas um subconjunto das APIs de extensões Chromium, não instala CRX e não tem como objetivo compatibilidade total com a Chrome Web Store.

## Decisão

Manter Extensions desativada no produto até existir uma matriz testada. O primeiro corte será um subset explícito de Manifest V3 carregado de diretório desempacotado em modo de desenvolvimento, somente em sessões persistentes.

O fluxo deverá validar manifest, paths, CSP, host permissions, capabilities, checksum e limites. Extensões são recarregadas a cada boot, isoladas por perfil e nunca recebem acesso implícito a dados Moon. Plugins Moon terão SDK versionado e sandbox separado.

Marketplace remoto, updates e alegação de compatibilidade ampla ficam bloqueados até existir modelo de supply chain, assinatura, revisão e revogação.

## Referências

- https://www.electronjs.org/docs/latest/api/extensions-api
- https://www.electronjs.org/docs/latest/api/extensions/
