# Changelog

## Unreleased — Final Update, produto e ergonomia (2026-08-28)

### Adicionado

- perfil canônico em SQLite para workspaces, favoritos, histórico e notas, com contrato IPC compartilhado e validado;
- janela anônima real por `Ctrl/Cmd+Shift+N`, identidade visual, partição efêmera, limpeza no fechamento e E2E de não restauração;
- decisões de permissão persistentes e revogáveis por origem, com armazenamento efêmero separado no privado;
- pipeline único de `webRequest` para composição do AdBlock e futuras políticas;
- preflight, mapa de impacto e threat model do update massivo.
- onboarding de seis etapas, pulável, retomável e com preview transacional das preferências;
- detecção local de Chrome/Chromium, Brave, Vivaldi, Edge e Firefox, preview de contagens e importação transacional somente de favoritos/histórico selecionados;
- Settings V4 nos modos Simples e Avançado, com “Ver tudo” explícito, busca por intenção, deep links, preview recolhível e indicação de draft;
- documento de personalização V4 canônico em SQLite, migração idempotente de V2/V3, último estado válido transacional e `localStorage` restrito a espelho/recuperação;
- canais IPC limitados e validados para hidratação e commit único da personalização, com gravação bloqueada em janelas privadas;
- biblioteca única para temas nativos, criações do usuário e pacotes `.moontheme`, exibindo origem, confiança, versão, capacidades e estado ativo;
- biblioteca visual de temas com busca, filtros, ordenação, thumbnails determinísticas, favoritos, contador de uso, seleção parcial de áreas, duplicação e até dez revisões locais para rollback;
- editor de ícones semânticos com busca, categorias, importação unitária ou por pack, preview, reset granular e persistência por perfil/workspace;
- contrato `.moontheme` V2 retrocompatível com V1, incluindo thumbnail declarada, tokens de Home/movimento e wallpaper GIF animado validado por MIME/hash;
- editor direto sobre a Home real com Pointer Events, alternativa de teclado, tray de conteúdo, preview transacional e portabilidade `.moonhome` estritamente validada;
- seis posições para o botão de nova aba, incluindo oculto com `Ctrl/Cmd+T` preservado;
- Icon Registry com allowlist SVG, atualização dos ícones montados e fallback nativo atômico em conteúdo rejeitado;
- cores semânticas por região e extração opcional de paleta inteiramente local a partir de PNG/JPEG/WebP;
- wallpapers GIF e WebP animados locais com poster estático, controle manual, pausa quando a Home está oculta, em baixa bateria ou com redução de movimento, além de validação de assinatura, decode e dimensões;
- abas horizontais ou verticais dos dois lados, com largura configurável e fallback responsivo;
- Central de comandos por `Ctrl/Cmd+Shift+P`, reunindo comandos, abas, histórico, favoritos, workspaces e configurações;
- Foco/Zen temporizado, Pomodoro, contínuo ou até horário, com presets, allowlists, pausa, extensão, recuperação e resumo local;
- composições realmente distintas da Home para Minimalista, Foco, Estudo, Trabalho e Desenvolvimento.
- perfis locais com nome, avatar e cor, indicador no chrome, SQLite e partições Chromium isolados, troca protegida por rascunho e migração preservando o diretório atual como perfil Padrão;
- perfil convidado inteiramente temporário, downloads filtrados por perfil e exclusão com resumo, confirmação forte e backup local opcional.
- contratos de sync offline-first, provider fixture em memória, merge não destrutivo, tombstones, conflitos determinísticos, retry/cancelamento e revogação de dispositivos;
- E2EE com AES-256-GCM, metadata autenticada, nonce único, chave mestra separada da frase, wrapping por KDF versionada e recovery key exportável;
- cofre local isolado por contrato, origem HTTPS exata, revelação consciente, auto-lock e backend seguro em memória exclusivo para testes.
- contrato de fronteira do futuro Moon Hub e intent de preview curto, opaco e sem URLs/payload executável.

### Corrigido

- disputa grid/flex no container raiz;
- marker do renderer deixando de ser autoridade da migração SQLite;
- janela privada podendo sobrescrever a sessão normal com uma lista vazia;
- falha ao persistir uma permissão deixando cache e callback do Chromium em estado inconsistente;
- rodapé da Personalização sobrepondo os últimos controles roláveis;
- métricas de Home, abas e drawer misturando inicialização/feedback do produto com espera da automação.
- botões de formulários visuais que não submetiam por herdarem `type="button"`;
- importação de SQLite em WAL que ignorava os sidecars `-wal`/`-shm`;
- deduplicação que não reconhecia URLs repetidas dentro do mesmo payload;
- resumo de Foco contando pausas como tempo focado;
- automações de performance/captura bloqueadas pelo onboarding e overflow horizontal no seletor de níveis de Settings.
- sessões e modelos do Core permanecendo órfãos ao fechar uma janela durante a troca de perfil.
- tema salvo deixando de aparecer como ativo depois de reabrir o Studio e wallpaper animado permanecendo pausado ao reaplicar um tema.

### Desempenho

- atualizações de abas web deixam de reconstruir a árvore da Home enquanto ela está oculta;
- a sonda separa cold boot, Home quente, feedback da aba, confirmação da superfície e transição do drawer.

### Segurança

- histórico/notas não são expostos ou gravados pela janela privada;
- payloads de perfil e permissões são limitados por tipo, tamanho, protocolo e origem no main;
- AdBlock não remove mais handlers de outras políticas ao ser desativado.
- o importador usa IDs opacos, raízes conhecidas, cópia temporária read-only, limites, protocolos HTTP(S), limpeza de staging e transação SQLite;
- cookies, tokens, sessões autenticadas, senhas, carteiras, extensões e arquivos internos não são importados;
- Moon Intelligence permanece invisível no shell e bloqueada pelo gate de release mesmo diante de override local.
- IDs, nomes, avatares e cores de perfil passam por contrato compartilhado; o registro é atômico e só marca a migração após o SQLite existente abrir com sucesso.
- `mobile-sync` passa a ser release-gated; sem provider oficial, nem override local pode fazer a UI simular sincronização;
- testes procuram texto conhecido nos envelopes/provider e nos registros selados do cofre para impedir vazamento em claro.

## 0.5.0-demo.1 — Demo pública (2026-08-27)

### Consolidado

- transferência da arquitetura validada em `heitgh/Moon-tests-1` para o repositório oficial `heitgh/Moon-browser`, preservando os dois históricos;
- versão do produto, workspaces npm, metadados, links e documentação alinhados à série `0.5 Demo`;
- README reconstruído com estado real, arquitetura, segurança, guia de screenshots, comunidade, roadmap e ideias estratégicas;
- navegação, abas, workspaces, Home, Settings V4, SQLite, sessões, downloads, AdBlock, permissões, menu contextual e Moon Themes apresentados como capacidades da demo;
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
