# Moon Foundation Recovery — auditoria de baseline

Data: 24 de agosto de 2026
Escopo: fundação local em `/home/heitgh/Moon-browser`
Remote: `https://github.com/heitgh/Moon-tests-1.git`

## Veredito

O repositório já executa um navegador Electron real e significativamente mais seguro que o protótipo histórico. Entretanto, o produto ativo ainda contorna grande parte de Core, Storage, Security, Network, Context, Intelligence e Extensions. O primeiro objetivo é criar uma única aplicação executável e conectar caminhos verticais reais; a quantidade de arquivos não será tratada como funcionalidade.

## Inventário honesto

### Conectado e funcional

- `main.js` carrega o main TypeScript compilado.
- `apps/desktop/electron/main/main.ts` cria a janela, registra IPC e inicia browser, downloads e AdBlock.
- `WebContentsView` hospeda páginas HTTP/HTTPS sem Node, com sandbox e isolamento de contexto.
- Abas: criar, ativar, fechar, voltar, avançar, recarregar, parar e Home.
- Partições Electron por workspace e partições efêmeras para abas privadas no backend.
- `preload.cjs` expõe a bridge de produção com operações explícitas.
- IPC de browser valida tipos básicos, tamanho de URL e posse da aba pela janela.
- Downloads Electron reais com progresso e comandos de usuário.
- AdBlock Ghostery real, com contador derivado de eventos de bloqueio.
- Prompt de permissões com decisão explícita e timeout.
- Shell ativo com workspaces, favoritos, histórico, notas, tradução, temas, wallpapers, atalhos e backup local.
- TypeScript estrito, ESLint, Vitest, AppImage e pacote Debian.

### Funcional, mas não conectado ao produto ativo

- `TabManager`, `WorkspaceManager`, `SessionManager`, `MoonStateStore` e EventBus do Core.
- `MoonDatabase`, `MigrationManager` e repositories JSON sobre o contrato abstrato de banco.
- Componentes alternativos em `ui/shell`, `ui/sidebar` e `ui/settings`.
- Adapters desktop genéricos e registrador agregado de IPC.
- Contratos e parsers pontuais de Navigation, Platform e Extensions.

Esses módulos compilam, mas não governam a janela que o usuário utiliza.

### Skeleton ou contrato

- Context Engine, Smart Spaces, Timeline e sources contextuais.
- Moon Intelligence, memória, prompts e providers.
- Extensions, marketplace e compatibilidade Chromium.
- Plugins, widgets e automações.
- Network, proxy, DNS e VPN.
- Security declarativa além das proteções diretamente ligadas ao Electron.
- UI modular histórica, Home widgets, Zen e customization editors.
- Mobile adapters.

### Ausente

- Camada Application como única API da UI.
- Driver concreto `better-sqlite3` ligado ao main.
- Migração transacional de `localStorage` e restauração de sessão.
- Persistência de decisões de permissão e painel de revogação.
- Pipeline de rede composto; o AdBlock ainda é dono direto de `webRequest`.
- Validação estrutural/versionada do backup.
- E2E executável, CI, security tests e performance baseline.
- Updater assinado, SBOM, signing e crash recovery validado.
- Provider de IA real e subset de extensões testado.

## Entry points reais

```text
package.json#main
  -> main.js
     -> dist/types/apps/desktop/electron/main/main.js
        -> WindowManager
        -> ElectronBrowserManager -> WebContentsView
        -> ElectronDownloadManager
        -> ElectronAdblockService
        -> browser/product IPC

BrowserWindow preload
  -> preload.cjs
     -> window.moonBrowser

BrowserWindow renderer
  -> index.html
     -> dist/types/ui/browser-shell.js
        -> MoonApp -> BrowserShell

Remote pages
  -> WebContentsView sem preload e sem Node
```

## Duplicações, drift e arquivos fora do caminho ativo

- `preload.cjs` é o preload real; `preload.js` e `apps/desktop/electron/preload/*` formam uma segunda bridge incompatível e não usada.
- `ui/browser-shell.ts` é o shell real; `ui/bootstrap.ts` é um shell antigo completo, e `ui/shell/*` é outra composição ainda não ligada.
- `package.json#build` e `electron-builder.yml` discordam sobre output e arquivos empacotados.
- `apps/desktop/electron/ipc/ipc-handlers.ts` registra um conjunto arquitetural diferente do main ativo.
- `packages/*` é declarado como npm workspace, embora os packages arquiteturais não possuam metadata própria.
- `test:integration` e `test:e2e` apontam para suítes ausentes.
- `config/ai-config.ts`, `extension-config.ts` e `feature-flags.ts` habilitam recursos que não chegam ao produto.
- README, homepage e screenshots não representam integralmente o runtime atual.

Nada dessa lista deve ser apagado antes de migrar usos, adicionar cobertura e provar que o pacote continua inicializando.

## Baseline reproduzido

| Gate | Resultado |
|---|---|
| `npm ci` | passou; 492 pacotes auditados, 0 vulnerabilidades reportadas |
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm test` | passou: 4 arquivos, 21 testes |
| `npm run build:desktop` | passou: AppImage e Debian |
| `npm run test:integration` | falhou: diretório/suíte não existe |
| `npm run test:e2e` | falhou: nenhum teste encontrado |

Os dois últimos resultados são defeitos de consistência do repositório, não testes vermelhos do produto.

## Riscos prioritários

1. UI e Core podem divergir porque possuem estados independentes.
2. Favoritos, histórico, notas e personalização permanecem no renderer e não participam de transações ou recuperação.
3. Desativar AdBlock remove callbacks de `webRequest`, o que conflitará com futuras camadas de segurança.
4. Permissões não possuem `permission check`, persistência por origem ou revogação.
5. Backup aceita estruturas parciais sem schema formal e faz mutações antes de uma validação completa.
6. Wallpapers remotos padrão produzem tráfego de terceiros sem escolha explícita.
7. O pacote declara auto-update e features futuras sem implementação operacional correspondente.

## Invariantes para a recuperação

- Preservar navegação, abas, omnibox, Home, workspaces, favoritos, histórico, downloads, notas, tradução, temas, wallpapers, atalhos, backup, AdBlock e permissões.
- Preservar `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` e `webviewTag: false`.
- Nenhuma página remota recebe bridge privilegiada.
- Nenhum recurso futuro aparece ativo antes de existir end-to-end.
- Migrações devem manter o perfil antigo recuperável e possuir rollback.

## Próximos cortes verticais

1. Unificar entrypoints/build/scripts e criar CI, sem mudar comportamento.
2. Decompor o shell e CSS sob testes de caracterização.
3. Introduzir Application Services e contratos IPC compartilhados.
4. Ligar Core a tabs/workspaces reais.
5. Implementar SQLite concreto, migração segura e restauração.
