# Threat model — Final Update

Atualizado em 2026-08-28. Este documento descreve controles conectados e riscos ainda abertos.

## Fronteiras de confiança

- Conteúdo web remoto é não confiável e executa em `WebContentsView` sandboxed, sem Node e sem acesso direto ao banco, filesystem ou providers.
- O renderer local é menos privilegiado que o main e usa somente o preload allowlisted.
- IPC, arquivos importados, URLs, conteúdo de páginas e respostas de providers futuros são entradas não confiáveis.
- SQLite no main é a fonte de verdade do perfil; `localStorage` legado serve apenas à migração preservada.

## Janela privada

Ativos protegidos: histórico, notas, favicons compartilhados, sessão restaurável, permissões persistentes e futuro contexto de IA.

Ameaças consideradas: partição persistente por engano, sobrescrita da sessão normal, vazamento para Home/listas, decisão de permissão persistida e resíduos após fechamento.

Controles atuais:

- o main força `private` para toda aba criada em uma janela privada;
- partição `private:<windowId>` sem prefixo `persist:`;
- nenhuma atualização/fechamento privado agenda persistência e `flushWindow` ignora janelas privadas;
- histórico e notas são omitidos pelo IPC, notas ficam desativadas e favicons privados não alimentam cache por origem;
- decisões de permissão privadas vivem em mapa efêmero por `Session`;
- fechamento destrói superfícies e limpa cache/storage da sessão;
- E2E prova criação de outra janela, isolamento e ausência de restauração.

Risco residual: downloads privados ainda precisam de um fluxo dedicado que sempre solicite destino e explique que o arquivo permanece no sistema.

## Perfil e IPC

Ameaças: payload excessivo, `javascript:`/`file:`, IDs malformados, corrupção, renderer mantendo uma segunda fonte e gravação parcial.

Controles atuais:

- contratos compartilhados validam tipo, tamanho, protocolo, origem, timestamp e identificador;
- main valida novamente antes do repository;
- mutations passam por canais explícitos; páginas remotas não recebem preload;
- falha de mutation faz o renderer recarregar a projeção canônica;
- migração antiga é idempotente, transacional e preserva backup da fonte.

## Permissões e webRequest

Ameaças: permissão concedida a origem errada, callback reaproveitado por outra janela, handler substituído por outro módulo e permissão privada persistida.

Controles atuais:

- pedido guarda janela, origem, permissão, sessão e timeout; resposta exige ownership da janela;
- origem é normalizada para HTTP/HTTPS e a decisão é revogável na interface;
- `setPermissionCheckHandler` consulta cache hidratado pelo main;
- `SessionRequestPipeline` é o único dono ativo de `onBeforeRequest` e `onHeadersReceived`;
- políticas falham abertas para disponibilidade, mas registram erro; decisões de permissão falham fechadas.

Risco residual: falta política por site para exceções do bloqueador e diagnóstico de quebra.

## Importador

O importador está ativo somente em janelas normais e somente para favoritos e histórico escolhidos pelo usuário.

Controles atuais:

- descoberta limitada a raízes conhecidas de Chrome/Chromium, Brave, Vivaldi, Edge e Firefox; o renderer recebe um ID opaco, nunca um caminho;
- leitura não destrutiva: JSON é somente lido e bancos são copiados para staging temporário, incluindo `-wal`/`-shm`, e abertos em modo read-only;
- staging é removido em `finally`; URLs aceitas são HTTP(S), sem credenciais, e quantidade/tamanho possuem limites;
- persistência de todas as categorias selecionadas ocorre em uma única transação SQLite; falha reverte o lote;
- deduplicação considera o perfil existente e repetições dentro do próprio payload; um relatório local registra importados e ignorados;
- bookmarks HTML é fallback explícito, com seletor nativo, limite de 20 MB e parser sem execução de markup;
- cookies, tokens, sessões autenticadas, senhas, carteiras, chaves, extensões e arquivos internos nunca entram nesse fluxo;
- IPC impede importação no privado e não aceita caminhos controlados pelo renderer.

Risco residual: abas abertas, buscadores, configurações compatíveis e senhas por exportação suportada ainda não são oferecidos; a UI declara o escopo reduzido em vez de simular suporte.

## Moon Intelligence

Moon Intelligence permanece desativada, ausente da navegação e bloqueada pelo gate de release mesmo diante de override. Antes de remover o gate:

- IA exige BYOK seguro no main/keychain, consentimento por site, policy firewall, proveniência, budgets, exclusão/exportação e zero memória privada;
- conteúdo de página deve permanecer rotulado como dado não confiável e nunca virar instrução de sistema;
- providers, memória, citações, esquecimento e confirmação de ações externas precisam funcionar e possuir testes negativos de ponta a ponta.
