# ADR 0003 — Storage e migração de perfil

Status: Aceito
Data: 24 de agosto de 2026

## Decisão

Usar SQLite via `better-sqlite3` exclusivamente no processo principal, atrás de `DatabaseConnection` e repositories. Ativar foreign keys, WAL, synchronous NORMAL e busy timeout. Migrations são ordenadas, versionadas e transacionais.

A UI acessará dados somente por Application Services e IPC tipado. `localStorage` será fonte de migração, nunca banco definitivo.

## Migração

1. Ler e validar um snapshot completo do perfil legado.
2. Persistir backup e checksum antes de alterar qualquer chave.
3. Importar em uma transação.
4. Validar contagens e relações.
5. Registrar versão de migração.
6. Manter o snapshot antigo até confirmação de sucesso em inicialização posterior.
7. Em falha, rollback do SQLite e nenhum apagamento no renderer.

Modo privado usa storage efêmero e nunca participa de repositories persistentes.
