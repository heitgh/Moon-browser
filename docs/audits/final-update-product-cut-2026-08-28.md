# Final Update — corte de produto

Data: 2026-08-28

## Resultado

O corte conecta Settings V4, onboarding/importação segura, Foco/Zen, abas verticais, Central de comandos e presets distintos da Home ao runtime desktop real. Moon Intelligence continua bloqueada até cumprir sua definição de pronto.

## Causas encontradas e correções

1. O shell concentrava novos fluxos e o timer da Home era cenográfico. Onboarding, Foco e Central de comandos ganharam controladores/componentes próprios; a Home passou a abrir o sistema de Foco real.
2. Settings não distinguia a posição das abas da posição da sidebar e alguns botões de formulário nunca submetiam. Labels ficaram inequívocos e os submits usam tipo explícito.
3. Perfis Chromium em WAL podiam produzir leitura incompleta. O staging agora inclui sidecars e abre a cópia read-only.
4. A deduplicação comparava somente com o banco anterior. URLs aceitas passam a entrar no conjunto durante o lote.
5. A sonda e as capturas não conheciam o onboarding e bloqueavam. As automações agora tratam o primeiro uso explicitamente.
6. O resumo de Foco usava tempo de parede. A contagem agora acumula somente fases de foco ativas, excluindo pausas e intervalos.

## Funcionalidades demonstráveis

- onboarding de seis etapas, retomável e cancelável;
- importação opt-in de favoritos/histórico de navegadores detectados e bookmarks HTML;
- Settings em Essencial, Personalizar e Avançado, com draft, preview, busca e deep links preservados;
- abas no topo/esquerda/direita;
- busca unificada por comandos, abas, histórico, favoritos, workspaces e configurações;
- sessões de Foco temporizadas, Pomodoro, contínuas e até horário, com allowlists e recuperação;
- cinco presets de Home com composições diferentes.

## Gates finais

| Gate | Resultado |
|---|---:|
| TypeScript / ESLint | aprovado / aprovado |
| Unitários | 76/76 |
| Integração do shell | 23/23 |
| Electron/SQLite/services | 9/9 |
| E2E Electron | 6/6 |
| Dependências de produção | 0 vulnerabilidades |
| Build Linux | AppImage e deb gerados |

Métricas de uma execução local: cold boot até Home utilizável após dispensar o onboarding 738,7 ms; Home quente 26,9 ms; feedback/superfície da aba 0,6/0,5 ms; feedback/fim da animação do drawer 12,5/239,2 ms; Settings 53,9 ms. Não são p95.

## Limites honestos

- importação cobre favoritos e histórico; abas abertas, buscadores, configurações e senhas não são prometidos;
- sons de foco e modo circadiano ainda não existem;
- grupos/árvore/hibernação, split view, Glance, comandos encadeados e gestos continuam fora deste corte;
- Moon Intelligence está bloqueada e invisível; scaffolding não equivale a provider seguro;
- término visual da animação do drawer permanece acima de 100 ms, embora o feedback seja imediato;
- revisão visual foi feita nas quatro resoluções-alvo e zoom 200% por E2E; uma auditoria WCAG manual completa continua recomendada antes de declarar conformidade formal.
