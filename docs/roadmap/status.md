# Moon Browser 0.5 Demo — status de reconstrução

Atualizado em 28 de agosto de 2026. Este documento descreve somente capacidades conectadas ao runtime ativo.

A atualização atual parte diretamente de `heitgh/Moon-browser@8d5a35b24e7b68276831660736eba14766266edf` na branch local `codex/final-upd-2026-08-28`. O snapshot local anterior de `Moon-tests-1` foi preservado, não sobrescrito.

## Moon Foundation Recovery

| Entrega | Estado | Evidência |
|---|---|---|
| Inventário e entrypoints reais | Concluído | `docs/audits/foundation-recovery-2026-08-24.md` |
| Main, preload e shell únicos | Concluído | `main.js` → main TS; `preload.cjs`; `ui/browser-shell.ts` |
| Build e workspaces coerentes | Concluído | `package.json`, `electron-builder.yml`, lockfile |
| CI install/type/lint/test/E2E/build/audit | Concluído | `.github/workflows/quality.yml` |
| ADRs obrigatórios | Concluído | `docs/adr/0001` a `0006` |
| Shell decomposto | Parcial avançado | Home, toolbar, tab strip, workspace bar, permissões e contratos separados; painéis de produto ainda serão extraídos |
| CSS decomposto | Concluído para o runtime atual | globals é agregador; shell, Home, painéis, settings, responsive e accessibility separados |
| Application Service inicial | Concluído | `BrowserApplicationService` é a API usada pelo IPC de browser |
| Core conectado a tabs | Concluído | `TabManager`, `MoonStateStore` e `MoonEventBus` reconciliam eventos do browser real |
| Dados de workspaces/favoritos/histórico/notas | Concluído no runtime atual | renderer consome projeção e commands IPC; repositories SQLite são a fonte canônica |
| SQLite concreto no main | Concluído | better-sqlite3, WAL, foreign keys, busy timeout, migrations e contract tests no ABI Electron |
| Migração segura de localStorage | Concluído para o perfil v1 | schema compartilhado, backup de origem, transação, marker idempotente e fonte antiga preservada |
| Sessão restaurável | Concluído | abas não privadas e URLs voltam após restart; E2E executa dois ciclos Electron |
| Janela anônima real | Concluído | nova BrowserWindow, partição efêmera, badge, limpeza e teste de não restauração |
| Permissões por origem | Concluído no runtime atual | check/request handlers, cache main, persistência, privado efêmero e revogação na Proteção |
| Pipeline `webRequest` | Concluído | um compositor instala os hooks; AdBlock é uma política e não remove outros handlers |
| Flags e documentação verdadeiras | Concluído | IA, extensões e updater permanecem desativados |
| Wallpapers locais e screenshots atuais | Concluído | assets locais, CSP sem imagens remotas automáticas e capturas do runtime |

## Moon Settings V3 — recuperação e evolução

| Entrega | Estado | Evidência |
|---|---|---|
| Fonte de verdade V3 e migração V2 idempotente | Concluído | `ui/customization/customization-schema.ts`, migration e store |
| Draft, preview, aplicar, cancelar, undo/redo e falha de persistência | Concluído | Commit ocorre somente em Aplicar; cancelamento não regrava o draft |
| Recuperação parcial, lastKnownGood, modo seguro e diagnóstico | Concluído | `docs/settings-recovery-audit.md` e testes de corrupção por seção |
| Modal e página interna `moon://settings/*` | Concluído | Shell compartilhado, deep links e histórico voltar/avançar |
| Essencial, Todas, Avançado e busca por intenção | Concluído | Mesmo store/componentes; catálogo testado por sinônimos |
| Aparência, layout, Home, tipografia, pesquisa e escopo | Concluído | `customization-applier.ts`, Home e toolbar ativos |
| Temas salvos, Moon Themes e import/export V3 | Concluído | schema validado, bridge desktop, quarentena e rollback |
| Wallpaper remoto opcional e seguro | Concluído | HTTPS restrito, destino público, tipo/tamanho validados e dados servidos pelo main; CSP continua restritiva |
| Sidebar e workspaces discretas e recuperáveis | Concluído | runtime, preview, limites, auto-hide, Ctrl+, e Ctrl+Shift+W |
| Favicons seguros em abas | Concluído | fonte `webContents`, fetch HTTPS público no main, MIME/250 KB, cache/TTL e fallback |
| Favicons em Home, histórico e favoritos | Concluído | cache por origem alimenta atalhos e listas; navegação privada não propaga nem persiste dados |
| Favicons em sugestões da omnibox | Não aplicável ao shell atual | a omnibox ainda não possui uma lista própria de sugestões; nenhuma capacidade inexistente é simulada |
| Biblioteca persistente de wallpapers com metadados | Parcial | importação e presets funcionam; favoritos/ordenação/deduplicação ainda não existem |
| Capturas do runtime V2 | Concluído | `assets/screenshots/page.png` a `page2.png` |

## Reconstrução ergonômica

| Entrega | Estado | Evidência |
|---|---|---|
| Fase A — tokens, grade e sistema visual | Concluído | `docs/audits/ergonomics-phase-a-2026-08-26.md` |
| Tipografia padrão de 13–14 px e alvos de 40 px | Concluído | tokens semânticos, unit e E2E em quatro viewports |
| Capturas responsivas e seis categorias | Concluído | `assets/screenshots/phase-a-*` |
| Medição reproduzível de interação | Concluído | `npm run measure:ui` |
| Separação cold boot/Home quente/feedback/superfície | Concluído | a sonda não atribui mais espera do Playwright ao produto |
| Fase B — Home ergonômica e presets distintos | Próximo corte | ainda não implementada |

## Quality gates atuais

- TypeScript estrito e ESLint.
- 63 testes unitários.
- 18 testes de integração do shell.
- 8 testes SQLite/serviços no runtime Electron.
- 6 E2E Electron: smoke/modal/página/busca/teclado, restore de sessão, persistência V3, import/export, ergonomia e janela privada.
- Build Linux AppImage e deb aprovado neste checkpoint.
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades de produção neste checkpoint.

## Moon Themes e menu contextual

| Entrega | Estado | Evidência |
|---|---|---|
| Contrato `.moontheme` v1 e fixtures hostis | Concluído | `packages/theme-contract` e `tests/unit/moon-theme-contract.test.ts` |
| Importar, quarentena, preview, confirmar e exportar | Concluído | `moon-theme-service.ts`, IPC allowlisted e Moon Studio |
| Aplicar, atualizar, manter versão, remover e rollback | Concluído | ThemeRepository, Personalização V2 e teste Electron de reinício |
| Menu página/link/seleção/editável/imagem/mídia | Concluído | `context-menu.ts` e modelo tipado testável |
| Clipboard, impressão e downloads com progresso | Concluído | APIs nativas do Electron e DownloadManager existente |
| Deep link/API oficial | Bloqueado por integração externa | faltam domínio, endpoint, trust roots e contrato de intent oficiais |
| Conta, favoritos e Device Authorization | Bloqueado por integração externa | faltam issuer OAuth, client ID e API do Moon Themes |

## Dívida explícita antes das fases de produto

1. Extrair renderizadores de bookmarks, history, notes, downloads e security do controlador do shell.
2. Extrair as projeções de workspaces, favoritos, histórico e notas do controlador do shell; a autoridade já está nos repositories.
3. Adicionar schemas compartilhados aos canais legados restantes e ampliar testes de sender/origin/limites.
4. Não ativar IA, extensões, updater ou VPN antes das definições de pronto registradas nos ADRs.

A Fase 1 de personalização está conectada e coberta. Personalização profunda de abas/painéis, comandos em cadeia, gestos, configurações por site, Zen/Circadian avançado, ergonomia, segurança avançada, Universal Search e Moon Intelligence permanecem planejados, não implementados.
