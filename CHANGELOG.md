# Changelog

## 0.5.0-demo.1 — Demo pública (2026-08-27)

### Consolidado

- transferência da arquitetura validada em `heitgh/Moon-tests-1` para o repositório oficial `heitgh/Moon-browser`, preservando os dois históricos;
- versão do produto, workspaces npm, metadados, links e documentação alinhados à série `0.5 Demo`;
- README reconstruído com estado real, arquitetura, segurança, guia de screenshots, comunidade, roadmap e ideias estratégicas;
- navegação, abas, workspaces, Home, Settings V3, SQLite, sessões, downloads, AdBlock, permissões, menu contextual e Moon Themes apresentados como capacidades da demo;
- IA, extensões, plugins, Smart Spaces, Timeline, VPN, sync e auto-update mantidos desativados até implementação verificável;
- build Linux validado em AppImage e Debian, além dos gates de TypeScript, ESLint, testes e auditoria de dependências.

### Observação de versionamento

- a tag histórica `v1.0.0` descreve o protótipo inicial; `0.5.0-demo.1` passa a representar a maturidade da arquitetura reconstruída e não remove o histórico anterior.

## Unreleased — Moon Themes e menu contextual (2026-08-26)

### Adicionado

- contrato canônico `.moontheme` v1 com assinatura Ed25519, hashes, compatibilidade, MIME e schemas estritos;
- importação manual com quarentena, diff, confiança visível, confirmação, exportação, versões, aplicação, remoção e rollback;
- menu contextual nativo para página, links, seleção, edição, imagens, vídeo e áudio, integrado a clipboard, impressão e downloads;
- buscador configurado sincronizado com o processo principal para pesquisas da seleção.

### Segurança

- bloqueio de traversal, caminhos absolutos, symlinks, ZIP bombs, arquivos não declarados, tipos executáveis, MIME falso e SVG ativo;
- nenhum preload, IPC, Node ou script DOM foi exposto às páginas remotas;
- ativação do tema só é persistida depois que a Personalização V2 aceita o preview e o usuário confirma as mudanças.

## Unreleased — Reconstrução ergonômica, Fase A (2026-08-26)

### Alterado

- sistema visual centralizado em tokens semânticos de tipografia, espaço, alturas, raios, sombras, foco e movimento;
- chrome ativo alinhado a um piso legível de 13–14 px e alvos principais de 40 px;
- defaults de novos perfis atualizados sem alterar o formato nem a migração da Personalização V2;
- folhas estruturais legadas removidas da composição ativa para evitar regras concorrentes;
- capturas de regressão ampliadas para quatro resoluções, página aberta, drawer e seis categorias.

### Qualidade

- smoke Electron isolado do perfil local;
- contratos unitários dos tokens e E2E geométrico de legibilidade, alvos e overflow;
- medição local reproduzível com `npm run measure:ui`.

## Unreleased — Personalização V2, Fase 1 (2026-08-25)

### Adicionado

- Central de personalização conectada à janela ativa, com preview, aplicar, cancelar, undo/redo e reset granular.
- Perfis globais ou por workspace para aparência, layout, Home, tipografia e pesquisa.
- Home configurável com grid, widgets, atalhos, cards e favoritos; toolbar reordenável por botões ou teclado.
- Temas salvos, migração de preferências V1, exportação e importação versionada.
- Persistência V2 coberta por testes de unidade, integração e reinício real do Electron.

### Segurança

- Importação rejeita versões, estruturas, URLs, cores e fontes inválidas antes de persistir.
- Wallpaper remoto é opt-in: somente HTTPS público, com redirects, MIME e tamanho limitados; a CSP do renderer continua sem acesso remoto direto.

## 0.1.0 — Foundation Recovery (2026-08-24)

### Adicionado

- CI determinístico com typecheck, lint, unit, integração, SQLite no Electron, E2E, audit e build.
- Application Service inicial conectado a TabManager, StateStore e EventBus.
- adapter `better-sqlite3`, migrations versionadas e repositories no processo principal.
- migração idempotente do perfil v1 com backup local e transação.
- restauração de abas não privadas após restart, coberta por E2E real.
- schema compartilhado e versionado de backup/importação.
- wallpapers locais, capturas atuais e ADRs de fundação.

### Alterado

- entrypoints, preload, workspaces npm e configuração de build foram unificados.
- shell foi separado em componentes de Home, toolbar, abas, workspaces e permissões.
- CSS foi separado em shell, Home, painéis, settings, responsividade e acessibilidade.
- flags de IA, extensões, Smart Spaces, Timeline e updater refletem o estado real: desativadas.

### Segurança

- CSP do renderer deixou de autorizar imagens e conexões HTTPS remotas por padrão.
- import/export passa por validação estrutural e limites antes de I/O.
- sessões privadas não são persistidas.

### Removido

- preloads e shell duplicados comprovadamente fora do runtime.
- CSS `preview-*` sem consumidor.
- wallpapers remotos carregados automaticamente.
