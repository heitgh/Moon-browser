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
