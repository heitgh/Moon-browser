# Moon Browser — Etapa 1: Encerramento e recuperação (branch de trabalho)

Nexus Inc. · 30/10/2026 · **não publicada**

## Mudanças nesta branch

- Fechamento de janelas normais aguarda o flush da sessão antes de destruir as superfícies.
- Gravações da mesma instância de armazenamento SQLite são serializadas. O snapshot contém abas de todas as janelas normais conhecidas do perfil, sem incluir abas privadas. Janelas fechadas preservam seu último snapshot até a saída do processo.
- Shutdown espera gravações de sessão em andamento antes da destruição das abas e do fechamento dos bancos. Uma falha explícita no flush interrompe a sequência, em vez de seguir fechando o banco. O timeout global preexistente ainda força saída em cinco segundos.
- Atualizador nativo faz flush e backup consistente de cada banco SQLite persistente antes de iniciar a instalação. Falha em qualquer cópia impede a chamada ao instalador.
- Quando a abertura do perfil padrão falha, a aplicação abre uma janela de recuperação isolada com preload dedicado e canais IPC limitados.
- A recuperação permite restaurar somente backups SQLite que passaram por `integrity_check`, exportar cópia bruta de emergência da pasta do perfil, ou criar armazenamento limpo. Toda substituição desloca a pasta original para um caminho `*.preserved-...` e tenta rollback em erro.
- Os instaladores incluem os quatro arquivos estáticos da tela de recuperação.

## O que **não** se pode afirmar nesta etapa

- O bug MB-016 foi mitigado por ordenação de gravações, mas ainda não há reprodução e causa raiz comprovadas dos timeouts do runner Windows.
- Backup de SQLite **não** inclui cookies, sessões de autenticação e partições Chromium fora da pasta do banco. Esta entrega não promete restauração integral dessas partições. A exportação bruta cobre somente a pasta de perfil selecionada.
- A UI de recuperação inicia quando a abertura do **perfil padrão** falha. Recuperação do registro `profiles/index.json` corrompido e abertura de perfis secundários ainda requerem tratamento próprio.
- O renderer de recuperação não recebe caminhos locais nem acesso direto ao sistema de arquivos.
- A nova branch não substitui a release pública `v0.6.0-alpha.5`.

## Testes adicionados

- `tests/unit/shutdown.test.ts`: falha de flush interrompe etapas posteriores.
- `tests/unit/browser-application-service.test.ts`: multijanela, janela anônima e flush em andamento.
- `tests/electron/profile-recovery.test.ts`: cópia pré-update, corrupção simulada, restauração, rejeição de backup inválido, exportação e perfil novo.
- `tests/e2e/recovery.spec.ts`: falha de abertura mostra UI independente.
- `tests/e2e/shutdown.spec.ts` (já existente): 30 ciclos reais de fechamento e reabertura.

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
