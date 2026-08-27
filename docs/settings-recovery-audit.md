# Moon Browser — auditoria de recuperação das configurações V3

Data: 2026-08-27
Branch auditada: `main`
Baseline V3 auditada: `76d74c338932d6b0f91a66e42634f05cb3e04307`

## Escopo e regra de estabilização

A expansão da V3 fica congelada enquanto qualquer gate essencial estiver vermelho. O objetivo deste ciclo é recuperar primeiro o fluxo de configurações, a separação entre preview e estado confirmado, a persistência e as rotas internas. Novos recursos só podem avançar depois da linha de base voltar a ficar verde.

## Linha de base reproduzida

Comandos executados no snapshot acima:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
```

Resultado inicial:

| Gate | Resultado | Evidência |
| --- | --- | --- |
| TypeScript | passou | `tsc --noEmit`, código 0 |
| ESLint | passou | `eslint .`, código 0 |
| Unitários | falhou | 42/43 passaram; preview continha texto literal de 6 px |
| Integração da shell | falhou | 10/14 passaram; 4 falharam |

Isso demonstra que compilação e lint isoladamente não detectavam as regressões funcionais.

## Matriz de regressões e causas

| ID | Sintoma reproduzido | Causa raiz | Impacto | Prioridade | Estado |
| --- | --- | --- | --- | --- | --- |
| REC-001 | Clicar em uma categoria no modo Essencial não mostrava seus controles; exportação e ajustes avançados pareciam inexistentes | A navegação alterava apenas a categoria ativa, mas o renderer do modo Essencial ignorava a categoria | Controles reais inacessíveis e 3 testes posteriores contaminados pelo painel aberto | P0 | corrigido; categoria explícita entra em Avançado |
| REC-002 | Alterações de preview apareciam imediatamente em `moon:customization:v3` | `CustomizationStore.#mutate` persistia o rascunho em toda alteração | Cancelamento dependia de uma segunda gravação; crash ou quota podia confirmar mudanças não aplicadas | P0 | corrigido; rascunho fica apenas em memória e Aplicar confirma |
| REC-003 | Falha de gravação podia fechar o painel sem confirmação confiável | `applyPreview` apenas encerrava a sessão de preview e não reportava falha | Perda de confiança e possível divergência entre UI e armazenamento | P0 | corrigido; Aplicar retorna falha, mantém preview aberto e mostra erro |
| REC-004 | Busca por “tipografia” deixou de encontrar a área correspondente | O novo catálogo de intenções não incluía metadados de tipografia | Busca global incompleta | P1 | corrigido; metadado estável adicionado |
| REC-005 | Preview continha texto literal de 6 px e 7 px | Mock visual novo não respeitou o piso tipográfico semântico de 11 px | Ilegibilidade e gate visual vermelho | P1 | corrigido para 11 px |
| REC-006 | Suíte de integração lia o armazenamento para validar alterações ainda não aplicadas | Testes antigos codificavam a persistência incorreta como comportamento esperado | Impedia a correção da arquitetura de rascunho | P1 | corrigido; testes agora verificam UI ao vivo e armazenamento imutável |
| REC-007 | Cadeia IPC de `moon://settings/*` existia, mas a shell abria somente o modal | Implementação da página interna ficou incompleta entre backend e renderer | Deep links e página completa não cumpriam o contrato V3 | P0 | corrigido; shell, IPC, histórico e deep links conectados |
| REC-008 | Documento inválido recuperava o backup inteiro, não apenas campos corrompidos | Validação era all-or-nothing | Uma preferência inválida descartava outras preferências válidas mais recentes | P1 | corrigido; recuperação isolada por seção, workspace e metadado |

## Reprodução detalhada

### REC-001 — categoria inacessível

1. Abrir Configurações com a experiência no modo Essencial.
2. Clicar em “Workspaces e dados”.
3. Antes da correção, o conteúdo permanecia na visão Essencial e “Exportar tudo” não existia no DOM.
4. O teste falhava com `Cannot read properties of null (reading 'click')`.

Critério de aceite: clicar em uma categoria explícita abre a visão Avançada naquela categoria e mantém a navegação acessível.

### REC-002 — preview persistido prematuramente

1. Carregar o store e guardar o conteúdo de `moon:customization:v3`.
2. Iniciar preview e mudar `appearance.colors.accent`.
3. Antes da correção, a chave persistida mudava antes de “Aplicar”.
4. Cancelar exigia outra escrita para recuperar o valor.

Critério de aceite: durante preview a UI muda, mas a chave confirmada permanece byte a byte igual; Aplicar grava; Cancelar apenas restaura o rascunho em memória.

### REC-003 — erro ao aplicar

1. Iniciar preview e alterar uma preferência válida.
2. Simular `Storage.setItem` lançando `QuotaExceededError`.
3. Acionar Aplicar.

Critério de aceite: Aplicar retorna falha, `previewing` continua verdadeiro, o estado confirmado não muda e a mensagem de erro fica disponível.

## Contrato de estado adotado

- Estado confirmado: documento persistido e último estado válido.
- Rascunho: documento em memória enquanto o centro de configurações está aberto.
- Preview: aplicação visual do rascunho por assinatura do store.
- Aplicar: única operação que promove o rascunho visual para estado confirmado.
- Cancelar/Escape: descarta o rascunho e reaplica o snapshot confirmado.
- Preferência de experiência (`mode` e `lastSection`): pode persistir durante o painel, mas é promovida simultaneamente no snapshot confirmado para não confirmar outras mudanças.
- Erro de persistência: nunca encerra o preview nem altera o documento confirmado.

## Validação obrigatória restante

- Rodar novamente unitários e integração após cada correção P0.
- Testes unitários de normalização e histórico de `moon://settings/*`: concluídos.
- Conexão da rota interna à shell e teste de modal/página completa/deep link: concluídos; restauração de sessão permanece no gate E2E.
- Validar manualmente teclado, foco, Escape, zoom 80/100/125/150%, janela estreita e ausência de conteúdo inacessível.
- Executar `npm run quality`, `npm run test:e2e` e `npm run build:desktop` antes de liberar a expansão da V3.

## Não conformidades deliberadamente não mascaradas

Página interna, recuperação parcial, estados visuais principais e o pipeline de favicons das abas, Home, histórico e favoritos foram conectados e testados. A navegação privada não alimenta o cache compartilhado por origem. Permanecem parciais, sem declaração indevida de conclusão: biblioteca persistente de wallpapers com favoritos/deduplicação; favicons em sugestões da omnibox (a shell ainda não possui essa superfície); perfis/histórico de commits e a central completa “O que foi alterado”.

## Gate recuperado

- TypeScript e ESLint: verdes.
- Unitários: 52 testes.
- Integração da shell: 17 testes.
- Electron/SQLite/serviços: 6 testes.
- E2E: modal, página interna, busca por intenção, teclado, restart, import/export, viewports, zoom e movimento reduzido cobertos.
- Inspeção visual: screenshots do Electron real regeneradas após correções de legibilidade e altura do preview.
