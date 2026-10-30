# Storage architecture

Moon uses SQLite in WAL mode. Repositories store validated JSON envelopes containing stable IDs and timestamps. This provides forward-compatible domain serialization while migrations evolve indexed projections.

Transactions use `BEGIN IMMEDIATE`, commit on success, and roll back on failure. Migrations are ordered, recorded exactly once, and executed transactionally. Cache and backup services remain independent of the database driver.

Private browsing data must use isolated ephemeral storage and must never be copied into persistent repositories.

## Encerramento e recuperação — etapa 1 em revisão

`MoonDatabase.exclusive` enfileira operações por conexão. O contexto assíncrono da
transação permite que repositórios usem a mesma fila sem deadlock, enquanto chamadas
externas aguardam o commit/rollback. Fechamento rejeita novas operações e aguarda a fila.
`BetterSqliteConnection.close` executa checkpoint WAL antes do fechamento; um checkpoint
ocupado é erro, não sucesso silencioso. A fila não é um bloqueio entre processos.

`LocalProfileManager` compartilha a abertura pendente do mesmo perfil. O coordenador
de saída aguarda IPC, eventos de persistência e sessões antes de destruir páginas e
fechar bancos. `ElectronBrowserSurface.destroy` resolve somente no evento `destroyed`;
o gerenciador de páginas não fecha janelas durante essa fase. A saída nativa final
fica com o coordenador. O prazo de cinco segundos é fallback, não garantia de gravação
de operações ainda não confirmadas nem proteção contra bloqueio síncrono do event loop.

`ProfileRecoveryService` não sobrescreve o banco danificado em lugar: preserva a pasta,
copia o conteúdo, substitui o banco por backup validado e remove WAL/SHM da cópia
restaurada. Falha tenta recolocar o original. A interface tem preload e IPC próprios,
documento principal exato, confirmação no main e exclusão mútua para ações de recuperação.
Perfis que falham ao abrir informam seu diretório real ao main, sem expô-lo ao renderer.

Criar um perfil limpo usa ID/partição novos. Um registro ilegível é copiado antes de
reconstrução; diretórios de perfis com IDs válidos são preservados, mas nomes antigos
podem ser perdidos no registro reconstruído. Exportação de emergência é cópia bruta,
não criptografada; falha do registro exporta o diretório do aplicativo. Backups
pré-migração/pré-atualização são snapshots SQLite e não capturam partições Chromium.

## Proteção de acesso ao perfil (etapa 2 em revisão)

`ProfileAccessService` mantém somente sal e chave derivada por scrypt em `userData/profile-access/<id>.json`, separado do SQLite e de seus backups. O registro possui limite de tamanho, parâmetros fixos e atualização temporária sincronizada seguida de rename. Arquivos ausentes representam perfis sem proteção; registros inválidos falham fechados e não são redirecionados para recuperação de banco. Isto é controle de acesso do aplicativo, não criptografia nem resistência contra quem modifica os arquivos locais.

`LocalProfileManager` chama o autorizador antes de retornar armazenamento, inclusive em cache, e antes de excluir um perfil persistente. `ProfileAccessController` expõe apenas desbloqueio à janela isolada e associa o IPC normal ao estado desbloqueado do perfil da janela. Ao bloquear, o fechamento pode finalizar gravações já aceitas por `openedStorage`, que só retorna conexões existentes e não abre bancos nem concede acesso ao renderer. O renderer deixa de receber resultados. A recuperação de registro corrompido exige desbloquear todos os registros protegidos antes de exportar o diretório completo. Operações de credenciais e bloqueio não concorrem; um bloqueio do sistema ocupado é tentado novamente no ciclo seguinte.
