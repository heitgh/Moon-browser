# Moon Browser

Moon é um navegador desktop contextual e orientado à privacidade, construído sobre Electron/Chromium. A fundação prioriza isolamento de páginas, controle humano, personalização e evolução verificável — sem apresentar contratos ou telas demonstrativas como recursos prontos.

## Estado do produto

### Funcional no aplicativo atual

- navegação HTTP/HTTPS e busca configurável;
- múltiplas abas com voltar, avançar, recarregar, parar e Home;
- `WebContentsView`, sandbox, context isolation e Node desativado para páginas;
- workspaces com partições Electron;
- favoritos, histórico, notas, atalhos, temas e preferências locais;
- downloads nativos com progresso e controles;
- AdBlock real baseado em listas;
- permissões de sites com decisão explícita;
- SQLite no processo principal com migrations, WAL e restauração de abas não privadas;
- migração única do perfil local com backup de origem e rollback transacional;
- backup/importação JSON versionado e validado nos processos renderer e main;
- wallpapers padrão locais, sem requisição automática a terceiros;
- build Linux em AppImage e Debian.

### Próximos cortes arquiteturais

- migração de workspaces, favoritos, histórico e notas para Application/repositories;
- extração de settings e renderizadores de painéis do controlador do shell;
- controles de privacidade por site e permissões persistentes;
- personalização avançada, ergonomia e Command Center.

### Desativado até existir implementação real

- Moon Intelligence/providers de IA;
- compatibilidade instalável com extensões Chromium;
- plugins e marketplace;
- Smart Spaces e Timeline;
- VPN, sync e auto-update.

O painel Moon AI continua identificado como preview e encaminha consultas ao buscador. O painel de extensões informa explicitamente que a compatibilidade está em desenvolvimento.

## Arquitetura executável

```text
main.js
  -> apps/desktop/electron/main/main.ts (compilado)
  -> BrowserApplicationService
     -> Core (TabManager + StateStore + EventBus)
     -> ElectronBrowserManager + WebContentsView
     -> ProfileStorage + better-sqlite3

preload.cjs
  -> window.moonBrowser (bridge allowlisted)

index.html
  -> ui/browser-shell.ts (compilado)
```

`electron-builder.yml` é a única fonte de configuração do empacotamento. Core não importa Electron; páginas remotas não recebem preload ou APIs Moon.

O inventário de baseline está em [`docs/audits/foundation-recovery-2026-08-24.md`](docs/audits/foundation-recovery-2026-08-24.md), e o estado atual em [`docs/roadmap/status.md`](docs/roadmap/status.md). Decisões arquiteturais estão em [`docs/adr`](docs/adr).

## Interface atual

![Home do Moon Browser](assets/screenshots/page.png)

![Painel de proteção](assets/screenshots/page1.png)

![Configurações de aparência](assets/screenshots/page2.png)

## Desenvolvimento

Requisitos: Node.js 22+, npm 10+, Git, Python e toolchain nativa necessária ao `better-sqlite3`.

```bash
npm ci
npm run dev:desktop
```

Não substitua `nodejs-lts-jod` por `nodejs` em uma instalação Arch quando outro aplicativo depender do pacote LTS.

## Quality gates

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run native:electron
npm run test:electron-storage
npm run test:e2e
npm audit --audit-level=high
npm run build:desktop
```

O teste SQLite nativo usa o ABI do Electron; depois de um `npm ci`, execute `npm run native:electron` antes dele e do E2E. Em Linux sem sessão gráfica direta, o E2E deve ser executado com `xvfb-run -a npm run test:e2e`. Os mesmos gates são obrigatórios em `.github/workflows/quality.yml`; CodeQL e Dependabot também estão configurados.

## Build

```bash
npm run build:desktop
```

Artefatos são gravados em `release/`. Bancos, perfil, secrets, traces, relatórios e builds não devem ser versionados.

## Segurança e honestidade

- Não habilitar Node em conteúdo remoto.
- Não adicionar scripts remotos ao renderer Moon.
- Não enviar páginas, histórico, notas ou sessão a providers sem consentimento granular.
- Não ativar UI de VPN, IA, extensão, updater ou proteção sem backend verificável.
- Não copiar implementação do protótipo histórico sem auditoria de proveniência e licença.

Consulte [`docs/architecture/security.md`](docs/architecture/security.md) para os invariantes de segurança.
