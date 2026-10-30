# Moon Browser — Etapa 1: Encerramento e recuperação

Nexus Inc. · 30/10/2026 · **não publicada**

## Estado atual

Integrada na main pelo [PR #37](https://github.com/heitgh/Moon-browser/pull/37), merge `a2c26b7588b6415350360fbc2c81a68f75bf18db`. O commit final `c7cbe70813cb1ebfd158323b2f814d07d98cb442` passou na matriz Windows/Linux de qualidade e builds do [workflow 41076974239](https://github.com/heitgh/Moon-browser/actions/runs/41076974239), além de CodeQL e compatibilidade. Nenhuma release nova foi publicada.

Os registros abaixo descrevem rodadas intermediárias, inclusive bloqueios e falhas que foram tratados antes da integração. A afirmação histórica de código somente local não descreve o estado atual. A matriz aprovada valida os cenários automatizados; não prova tolerância universal a falhas nem substitui teste de upgrade real e homologação em hardware físico.


## Mudanças nesta branch

- Fechamento de janelas normais aguarda o flush da sessão antes de destruir as superfícies.
- Gravações da mesma instância de armazenamento SQLite são serializadas. O snapshot contém abas de todas as janelas normais conhecidas do perfil, sem incluir abas privadas. Janelas fechadas preservam seu último snapshot até a saída do processo.
- Shutdown espera gravações de sessão em andamento antes da destruição das abas e do fechamento dos bancos. Uma falha explícita no flush interrompe a sequência, em vez de seguir fechando o banco. O timeout global preexistente ainda força saída em cinco segundos.
- Atualizador nativo faz flush e backup consistente de cada banco SQLite persistente antes de iniciar a instalação. Falha em qualquer cópia impede a chamada ao instalador.
- Quando a abertura do perfil selecionado falha (inclusive secundário), a aplicação abre uma janela de recuperação isolada com preload dedicado e canais IPC limitados. O diretório efetivamente afetado vem de erro tipado do gerenciador, sem ser escolhido pelo renderer.
- A recuperação permite restaurar somente backups SQLite que passaram por `integrity_check`, exportar cópia bruta de emergência da pasta do perfil, ou criar um perfil novo com ID e partição Chromium próprios, sem reusar cookies. A restauração desloca a pasta original para um caminho `*.preserved-...` e tenta rollback em erro.
- Os instaladores incluem os quatro arquivos estáticos da tela de recuperação.

## O que **não** se pode afirmar nesta etapa

- O bug MB-016 foi mitigado por ordenação de gravações, mas ainda não há reprodução e causa raiz comprovadas dos timeouts do runner Windows.
- Backup de SQLite **não** inclui cookies, sessões de autenticação e partições Chromium fora da pasta do banco. Esta entrega não promete restauração integral dessas partições. A exportação bruta cobre somente a pasta de perfil selecionada.
- Registro corrompido: criar perfil novo preserva uma cópia do índice e reconstrói identidades a partir das pastas válidas. Não recupera metadados ilegíveis como nomes antigos. A exportação nesse cenário inclui o diretório do aplicativo. Não há tentativa de adivinhar qual banco restaurar quando o índice não informa o perfil.
- O renderer de recuperação não recebe caminhos locais nem acesso direto ao sistema de arquivos.
- A nova branch não substitui a release pública `v0.6.0-alpha.5`.

## Testes adicionados

- `tests/unit/shutdown.test.ts`: falha de flush interrompe etapas posteriores.
- `tests/unit/browser-application-service.test.ts`: multijanela, janela anônima e flush em andamento.
- `tests/electron/profile-recovery.test.ts`: cópia pré-update, corrupção simulada, restauração, rejeição de backup inválido, exportação e perfil novo.
- `tests/e2e/recovery.spec.ts`: falha de abertura mostra UI independente.
- `tests/e2e/shutdown.spec.ts` (já existente): 30 ciclos reais de fechamento e reabertura.

## Revisão incremental desta execução

- O ensaio de 30 ciclos agora usa fechamento nativo de janela e `app.quit`, mantém
  o inspector até a saída e verifica dados confirmados em cada reabertura. Continua
  exigindo saída normal; sinais não são aceitos como sucesso. O caminho de fechamento
  de contexto Playwright mostrou término por sinal, portanto não é prova de saída limpa.
- `ElectronBrowserSurface.destroy` aguarda o evento real `destroyed`. Janelas são
  fechadas pelo coordenador somente após limpeza das páginas e bancos.
- Toda operação de repositório passa pela fila da conexão; rollback de uma transação
  não pode absorver uma gravação de outra janela. O fechamento aguarda a fila e checkpoint.
- Aberturas concorrentes do mesmo perfil compartilham uma instância de armazenamento.
- IPC de recuperação valida identidade, documento e frame; ações simultâneas são
  recusadas no main e no serviço. Exportação resolve caminhos reais antes de recusar
  destinos dentro do original. Backups que são links simbólicos não são listados.
- E2E acrescenta restauração pela interface, registro corrompido, perfil independente
  e interrupção abrupta do processo após commit. Testes de interrupção de processo não
  simulam queda de energia nem garantem preservação de gravações não confirmadas.

Resultados finais da execução e do CI devem ser registrados abaixo antes de merge.

## Evidências locais — 30/10/2026

### CI do commit e3b7349 e ajuste das fixtures Windows

O workflow de release passou no job de qualidade Linux. O job Windows passou em
21 E2E e falhou em dois novos ensaios: restauração e fechamento após interrupção.
Os 30 ciclos nativos passaram. O trace do ensaio de interrupção confirma que o
dado foi lido após reiniciar e o timeout ocorreu em `application.close()` no final.
O teste agora usa saída nativa com prazo e continua exigindo código zero.

A fixture de restauração usava o mesmo caminho para SQLite e `--user-data-dir`.
Isso tentava renomear o diretório ativo do Chromium no Windows. A fixture agora
separa `userData/profile`, como a instalação real. A recuperação continua tendo
de preservar o original e demonstrar a reabertura do dado. Esta mudança não é
considerada prova de correção até a próxima execução Windows/Linux.

### Recuperação interrompida durante a substituição

Antes de renomear o original, a recuperação grava e sincroniza um journal externo
à pasta afetada. Abertura normal recusa um perfil com recuperação pendente em vez
de criar um banco vazio silenciosamente. A UI lista backups e exporta os arquivos
do original preservado. Ao retomar uma restauração ou criar perfil independente,
uma cópia incompleta fica em pasta `*.incomplete-*` e o original é recolocado antes
de prosseguir. O journal aceita somente destinos irmãos com prefixo e formato
esperados; não aceita caminhos arbitrários ou links simbólicos.

Testes SQLite cobrem interrupção antes/depois do primeiro rename, retenção da cópia
parcial, bloqueio da inicialização, reabertura dos dados e journal forjado.
O sync do arquivo de intenção não é uma promessa de tolerância a toda queda de
energia, falha de hardware ou alteração externa de arquivos.

### Reabertura no mesmo processo e interrupção Windows

Snapshots de janelas já fechadas deixam de possuir abas restauradas em outra janela.
Isso evita ressuscitar abas que o usuário fechou após reabrir o perfil sem sair do
Moon. O snapshot agregado também elimina IDs duplicados. Regressão unitária cobre
fechar janela, reabrir no mesmo processo, remover abas e salvar sessão vazia.

No CI do commit bb15076, a qualidade Linux passou integralmente; no Windows,
22 E2E passaram e um ensaio excedeu o prazo. O trace mostra que o dado foi recuperado
e a saída nativa retornou zero; o timeout ocorreu depois, na limpeza da fixture.
A interrupção agora encerra a árvore de processos exclusiva da instância de teste
no Windows, evitando renderers órfãos segurando arquivos. Nenhuma asserção de dados
ou de saída normal foi removida, e não se aumentou o timeout para esconder a falha.

- Typecheck e lint passaram.
- 223 testes unitários (50 arquivos), 35 de integração e 33 Electron/SQLite passaram.
- A rodada completa headless teve 21 E2E aprovados, 2 falhas e 3 probes externos
  pulados. Falharam importação de personalização (processo encerrou) e a resposta
  de IPC na janela de origem durante troca de perfil. O segundo teste foi ajustado
  para aceitar somente a destruição esperada da origem, ainda exigindo a janela,
  dados e partição corretos no destino; passou em execução direcionada.
- Rodadas direcionadas passaram em 30 ciclos nativos com dados, fechamento por
  `app.quit`, recuperação após SIGKILL, restauração via UI e registro corrompido.
  Uma falha de teste identificou seleção indevida de `about:blank` de uma página
  incorporada; o harness agora identifica a janela do shell pela URL exata.
- O ambiente local é Linux headless, sem Xvfb. A falha de importação não foi pulada
  no código nem declarada corrigida. Não há homologação física Windows/GPU nesta execução.
- CI do novo commit precisa ser consultado; resultados antigos do PR não validam
  estas alterações. MB-016 e a etapa como um todo não são marcados concluídos.
- Rodada final específica, após os ajustes do harness: **6 E2E passaram em 55,2 s**,
  cobrindo UI de banco inválido, restauração e reabertura de nota, registro corrompido
  com novo perfil, 30 ciclos nativos com dados, saída nativa e reabertura após SIGKILL.
- O push do commit desta execução foi bloqueado pela revisão automática de aprovação;
  o código permanece local. Nenhum resultado do CI remoto é atribuído a esse commit.

### Roteiro de validação manual (usar cópia de perfil)

1. Em Windows/Linux com desktop, salvar favoritos e notas, abrir duas janelas
   normais e uma privada. Fechar pela janela e pelo menu; reabrir e conferir dados
   normais, exclusão dos privados da sessão e ausência de abas ressuscitadas.
2. Interromper uma instância de teste após uma gravação confirmada, reabrir e
   conferir os dados. Não prometer recuperação de uma gravação ainda não confirmada.
3. Com o Moon fechado, danificar apenas o SQLite de uma cópia. Na janela de
   recuperação, cancelar uma restauração e confirmar que nada mudou; depois
   restaurar um backup íntegro e conferir que o original está na pasta preservada.
4. Exportar arquivos para outra pasta e conferir o conteúdo. A cópia é sensível
   e não criptografada; não compartilhar esse material com cookies ou tokens.
5. Danificar `profiles/index.json` em uma cópia, criar perfil limpo pela UI e
   conferir cópia do índice, diretórios anteriores e novo ID/partição sem login herdado.
6. Tornar a pasta de backup não gravável. Tentar atualizar: o instalador não deve
   iniciar quando qualquer backup obrigatório falhar. Upgrade empacotado real
   ainda exige validação Windows/AppImage antes de publicação.

## Validação exigida antes do merge

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run native:electron
npm run test:electron-storage
npm run compile
npm run test:e2e -- --workers=1
```

Depois: repetir no Windows e Linux com sessão gráfica; conferir que instalações e atualizações reais preservam os perfis. Falhas, pulos e limites devem ser registrados antes de marcar a etapa como concluída.
