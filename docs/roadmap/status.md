# Moon Browser 0.5 Demo — status de reconstrução

Atualizado em 30 de agosto de 2026. Este documento descreve somente capacidades conectadas ao runtime ativo.

A atualização atual parte do checkpoint local `d78522d` na branch `codex/personalization-studio-v4-2026-08-29`. Nenhuma alteração foi enviada ao remoto, e o repositório oficial não foi modificado por push, merge ou release.

## Moon Foundation Recovery

| Entrega                                       | Estado                         | Evidência                                                                                                                                               |
| --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventário e entrypoints reais                | Concluído                      | `docs/audits/foundation-recovery-2026-08-24.md`                                                                                                         |
| Main, preload e shell únicos                  | Concluído                      | `main.js` → main TS; `preload.cjs`; `ui/browser-shell.ts`                                                                                               |
| Build e workspaces coerentes                  | Concluído                      | `package.json`, `electron-builder.yml`, lockfile                                                                                                        |
| CI install/type/lint/test/E2E/build/audit     | Concluído                      | `.github/workflows/quality.yml`                                                                                                                         |
| ADRs obrigatórios                             | Concluído                      | `docs/adr/0001` a `0006`                                                                                                                                |
| Shell decomposto                              | Parcial avançado               | Home, toolbar, tab strip, workspace bar, permissões, onboarding, Foco e Command Center estão separados; drawers legados restantes ainda serão extraídos |
| CSS decomposto                                | Concluído para o runtime atual | globals é agregador; shell, Home, painéis, settings, responsive e accessibility separados                                                               |
| Application Service inicial                   | Concluído                      | `BrowserApplicationService` é a API usada pelo IPC de browser                                                                                           |
| Core conectado a tabs                         | Concluído                      | `TabManager`, `MoonStateStore` e `MoonEventBus` reconciliam eventos do browser real                                                                     |
| Dados de workspaces/favoritos/histórico/notas | Concluído no runtime atual     | renderer consome projeção e commands IPC; repositories SQLite são a fonte canônica                                                                      |
| SQLite concreto no main                       | Concluído                      | better-sqlite3, WAL, foreign keys, busy timeout, migrations e contract tests no ABI Electron                                                            |
| Migração segura de localStorage               | Concluído para o perfil v1     | schema compartilhado, backup de origem, transação, marker idempotente e fonte antiga preservada                                                         |
| Sessão restaurável                            | Concluído                      | abas não privadas e URLs voltam após restart; E2E executa dois ciclos Electron                                                                          |
| Janela anônima real                           | Concluído                      | nova BrowserWindow, partição efêmera, badge, limpeza e teste de não restauração                                                                         |
| Permissões por origem                         | Concluído no runtime atual     | check/request handlers, cache main, persistência, privado efêmero e revogação na Proteção                                                               |
| Pipeline `webRequest`                         | Concluído                      | um compositor instala os hooks; AdBlock é uma política e não remove outros handlers                                                                     |
| Flags e documentação verdadeiras              | Concluído                      | IA, extensões e updater permanecem desativados                                                                                                          |
| Wallpapers locais e screenshots atuais        | Concluído                      | assets locais, CSP sem imagens remotas automáticas e capturas do runtime                                                                                |

## Moon Settings V4 — recuperação e evolução

| Entrega                                                              | Estado                       | Evidência                                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Fonte de verdade V4 e migrações V2/V3 idempotentes                   | Concluído                    | `ui/customization/customization-schema.ts`, recovery e store                                                                        |
| Draft, preview, aplicar, cancelar, undo/redo e falha de persistência | Concluído                    | Commit ocorre somente em Aplicar; cancelamento não regrava o draft                                                                  |
| Recuperação parcial, lastKnownGood, modo seguro e diagnóstico        | Concluído                    | `docs/settings-recovery-audit.md` e testes de corrupção por seção                                                                   |
| Modal e página interna `moon://settings/*`                           | Concluído                    | Shell compartilhado, deep links e histórico voltar/avançar                                                                          |
| Essencial, Personalizar, Avançado e busca por intenção               | Concluído                    | Mesmo store/componentes; catálogo testado por sinônimos e navegação ao controle                                                     |
| Aparência, layout, Home, tipografia, pesquisa e escopo               | Concluído                    | `customization-applier.ts`, Home e toolbar ativos                                                                                   |
| Biblioteca visual de temas e import/export V4                        | Concluído                    | cards, thumbnails, busca/filtros, favoritos, seleção de áreas, uso, duplicação e dez revisões locais                                |
| Editor de icon pack                                                  | Concluído                    | nomes semânticos, allowlist SVG, busca/categorias, importação unitária/pack, preview, fallback e reset granular                     |
| Wallpaper remoto opcional e seguro                                   | Concluído                    | HTTPS restrito, destino público, tipo/tamanho validados e dados servidos pelo main; CSP continua restritiva                         |
| Sidebar e workspaces discretas e recuperáveis                        | Concluído                    | runtime, preview, limites, auto-hide, Ctrl+, e Ctrl+Shift+W                                                                         |
| Favicons seguros em abas                                             | Concluído                    | fonte `webContents`, fetch HTTPS público no main, MIME/250 KB, cache/TTL e fallback                                                 |
| Favicons em Home, histórico e favoritos                              | Concluído                    | cache por origem alimenta atalhos e listas; navegação privada não propaga nem persiste dados                                        |
| Favicons em sugestões da omnibox                                     | Não aplicável ao shell atual | a omnibox ainda não possui uma lista própria de sugestões; nenhuma capacidade inexistente é simulada                                |
| Wallpapers locais e animados                                         | Concluído no escopo seguro   | presets e PNG/JPEG/WebP/GIF até 1,5 MB; assinatura/decode/dimensões, poster, toggle e pausa por visibilidade/reduced-motion/energia |
| Vídeo como wallpaper                                                 | Não ativado                  | WebM/MP4 exigem loader/streaming seguro; data URL grande não é aceito nem simulado                                                  |
| Capturas do runtime atual                                            | Concluído                    | `assets/screenshots/personalization-v4-*`, `phase-a-*` e `final-update-*`                                                           |

## Reconstrução ergonômica

| Entrega                                             | Estado                     | Evidência                                                                                                  |
| --------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Fase A — tokens, grade e sistema visual             | Concluído                  | `docs/audits/ergonomics-phase-a-2026-08-26.md`                                                             |
| Tipografia padrão de 13–14 px e alvos de 40 px      | Concluído                  | tokens semânticos, unit e E2E em quatro viewports                                                          |
| Capturas responsivas e seis categorias              | Concluído                  | `assets/screenshots/phase-a-*`                                                                             |
| Medição reproduzível de interação                   | Concluído                  | `npm run measure:ui`                                                                                       |
| Separação cold boot/Home quente/feedback/superfície | Concluído                  | a sonda não atribui mais espera do Playwright ao produto                                                   |
| Fase B — Home ergonômica e presets distintos        | Concluído no runtime atual | Minimalista, Foco, Estudo, Trabalho e Desenvolvimento alteram composição, prioridade, spans e visibilidade |

## Corte de produto — onboarding, importação, Foco e navegação

| Entrega                               | Estado                              | Evidência                                                                                                    |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Onboarding curto, pulável e retomável | Concluído                           | seis etapas, preview cancelável/confirmável e teste unitário/E2E de primeiro uso                             |
| Detecção de perfis compatíveis        | Concluído para Linux                | Chrome/Chromium, Brave, Vivaldi, Edge e Firefox em raízes conhecidas                                         |
| Importação segura                     | Concluído para favoritos/histórico  | staging read-only, WAL/SHM, seleção explícita, transação, dedupe, relatório e fallback HTML                  |
| Categorias ampliadas e senhas         | Não implementado                    | abas, buscadores, configurações e senhas continuam fora do fluxo e são declarados como indisponíveis         |
| Abas verticais/horizontais            | Concluído                           | topo, esquerda ou direita, largura configurável, preview e fallback estreito                                 |
| Central de comandos                   | Concluído                           | `Ctrl/Cmd+Shift+P`, teclado, busca accent-insensitive em seis fontes canônicas                               |
| Foco/Zen                              | Concluído para o escopo deste corte | temporizado, Pomodoro, contínuo, até horário, presets, allowlists, pausa/extensão/recuperação e resumo local |
| Sons e modo circadiano                | Não implementado                    | permanecem fora da UI; nenhuma adaptação silenciosa é executada                                              |
| Moon Intelligence                     | Bloqueada                           | nenhuma rota/provider; onboarding explica indisponibilidade e `RELEASE_GATED_FEATURE_FLAGS` impede override  |

## Quality gates atuais

- TypeScript estrito e ESLint.
- 108 testes unitários.
- 28 testes de integração do shell.
- 15 testes SQLite/serviços no runtime Electron.
- 8 E2E Electron: smoke, restore de sessão, persistência V4, import/export, ergonomia, wallpaper animado, janela privada e isolamento de perfis.
- Build Linux AppImage e deb aprovado neste checkpoint.
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades de produção neste checkpoint.

Medição local reproduzível deste corte: cold boot até Home utilizável em 714,1 ms; Home quente 24,4 ms; feedback/superfície da aba 0,7/0,5 ms; feedback/fim da transição do drawer 18,6/247,2 ms; Settings 115,6 ms. São amostras desta máquina, não p95.

## Moon Themes e menu contextual

| Entrega                                                           | Estado                           | Evidência                                                            |
| ----------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Contrato `.moontheme` V2 retrocompatível com V1 e fixtures hostis | Concluído                        | `packages/theme-contract` e `tests/unit/moon-theme-contract.test.ts` |
| Importar, quarentena, preview, confirmar e exportar               | Concluído                        | `moon-theme-service.ts`, IPC allowlisted e Moon Studio               |
| Aplicar, atualizar, manter versão, remover e rollback             | Concluído                        | ThemeRepository, Personalização V2 e teste Electron de reinício      |
| Menu página/link/seleção/editável/imagem/mídia                    | Concluído                        | `context-menu.ts` e modelo tipado testável                           |
| Clipboard, impressão e downloads com progresso                    | Concluído                        | APIs nativas do Electron e DownloadManager existente                 |
| Deep link/API oficial                                             | Bloqueado por integração externa | faltam domínio, endpoint, trust roots e contrato de intent oficiais  |
| Conta, favoritos e Device Authorization                           | Bloqueado por integração externa | faltam issuer OAuth, client ID e API do Moon Themes                  |

## Perfis locais

| Entrega                                                                    | Estado                     | Evidência                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Perfil atual convertido em Padrão sem mover o diretório                    | Concluído                  | `LocalProfileManager` abre/valida o SQLite antes de gravar metadados atômicos e mantém o caminho legado                       |
| Criar, renomear, avatar e cor                                              | Concluído                  | contrato IPC compartilhado, gerenciador no main e tela acessível pela rail/indicador do chrome                                |
| SQLite, shell e sessões Chromium por perfil                                | Concluído                  | storage resolver por janela e partições `persist:moon-shell:*`/`persist:profile:*`; E2E verifica bancos e partições distintos |
| Dados, temas, Home, workspaces, favoritos, histórico, notas e preferências | Concluído no runtime atual | todos os handlers persistentes resolvem o `profileId` da janela chamadora; localStorage da shell também usa partição própria  |
| Downloads e permissões                                                     | Concluído                  | downloads possuem ownership por perfil; permissões usam um serviço hidratado por SQLite/perfil                                |
| Convidado temporário sem persistência                                      | Concluído                  | diretório e partições não persistentes removidos ao fechar a última janela convidada                                          |
| Troca com proteção de rascunho                                             | Concluído                  | UI exige descarte explícito do preview antes de alternar e a janela anterior só fecha após a nova abrir                       |
| Exclusão segura                                                            | Concluído                  | perfil Padrão protegido, janelas precisam estar fechadas, resumo + nome exato + backup opcional antes da remoção              |
| Sincronização em nuvem                                                     | Desativada                 | engine/fixture existem, mas nenhum provider oficial, endpoint ou autenticação foi configurado                                 |

## Sync E2EE e credenciais

| Entrega                                        | Estado                         | Evidência                                                                                                            |
| ---------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Contratos desacoplados de servidor             | Concluído                      | `packages/sync/types.ts` define engine, provider, record, envelope, device, categorias e estados                     |
| Engine offline-first e provider fixture        | Concluído para testes          | merge inicial não destrutivo, tombstone, conflito determinístico, retry exponencial, cancelamento, reset e revogação |
| Categorias opt-in                              | Concluído                      | histórico desligado por padrão; credenciais desligadas e exigindo consentimento separado                             |
| E2EE                                           | Concluído no engine            | AES-256-GCM, nonce aleatório de 96 bits, AAD, PBKDF2-SHA-256 versionado, chave mestra e recovery key separadas       |
| Ausência de plaintext                          | Concluído                      | unit tests procuram texto conhecido no envelope/provider e validam adulteração de metadata                           |
| Provider oficial/Moon ID                       | Bloqueado externamente         | sem endpoint, autenticação, política ou trust roots; `mobile-sync` permanece release-gated                           |
| Cofre local                                    | Concluído como motor gated     | origem HTTPS exata, segredo selado, interação consciente e auto-lock; backend seguro em memória é somente fixture    |
| Captura/autofill e persistência de credenciais | Bloqueado                      | backend seguro do SO e auditoria de origem/vazamentos ainda inexistentes; UI declara indisponibilidade               |
| Threat model e recuperação                     | Concluído para o desenho atual | `docs/architecture/sync-e2ee-threat-model.md` documenta chaves, riscos, recuperação e gates                          |

## Preparação do Moon Hub

| Entrega                            | Estado                 | Evidência                                                                                                         |
| ---------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Limite browser/serviço             | Documentado            | `docs/product/moon-hub-contract.md` separa consentimento/E2EE/preview local de conta, storage e moderação remotos |
| Conta e Device Authorization       | Contrato apenas        | `MoonHubAccountProvider`; issuer, client ID, scopes e endpoints continuam deliberadamente indefinidos             |
| Intent de tema                     | Contrato validado      | metadata opaca, curta, com hash/chave/expiração; URL e campos executáveis são rejeitados em unit test             |
| Trust roots/rotação                | Documentado            | roots somente por release assinado, sobreposição, revogação assinada e rollback local                             |
| Moderação, copyright e denúncias   | Documentado            | responsabilidades, recurso, retirada emergencial e direitos do criador/usuário                                    |
| Privacidade, exportação e exclusão | Documentado            | minimização, retenção, exportação, recibo e logs sem segredos                                                     |
| Portal/API real                    | Bloqueado externamente | nenhuma URL foi inventada e nenhuma tela simula conta, catálogo ou upload disponível                              |

## Dívida explícita antes das fases de produto

1. Extrair renderizadores de bookmarks, history, notes, downloads e security do controlador do shell.
2. Extrair as projeções de workspaces, favoritos, histórico e notas do controlador do shell; a autoridade já está nos repositories.
3. Adicionar schemas compartilhados aos canais legados restantes e ampliar testes de sender/origin/limites.
4. Ampliar o importador somente com parsers e rollback comprovados para cada nova categoria.
5. Não ativar IA, extensões, updater ou VPN antes das definições de pronto registradas nos ADRs.

Settings V4, onboarding, importação segura no escopo declarado, Foco/Zen, abas verticais, Central de comandos e presets distintos da Home estão conectados e cobertos. Grupos/árvore/hibernação de abas, split view, Glance, comandos encadeados, gestos, configurações por site, circadiano e Moon Intelligence permanecem planejados e não são anunciados como capacidades prontas.
