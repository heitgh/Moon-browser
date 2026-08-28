# Final Update — preflight e primeiro checkpoint P0

Data: 2026-08-28

## Base confirmada

- Repositório público correto: `heitgh/Moon-browser@8d5a35b24e7b68276831660736eba14766266edf`.
- Branch local de trabalho: `codex/final-upd-2026-08-28`, criada da referência pública sem push ou alteração do remote.
- A pasta local estava inicialmente em `heitgh/Moon-tests-1@7a45dbd`; esse snapshot foi preservado na branch local `main` e não foi usado como nova base.
- Versão: `0.5.0-demo.1`.
- Não havia alterações locais do usuário no preflight.

## Baseline repetido neste ambiente

| Gate/medida | Resultado antes do corte |
|---|---:|
| TypeScript / ESLint | aprovado / aprovado |
| Unitários | 52/52 |
| Integração do shell | 18/18 |
| Electron/SQLite | 6/6 |
| E2E Electron | 5/5 |
| Home interativa | 559,4 ms |
| Troca de aba | 78,1 ms |
| Drawer pela métrica Playwright antiga | 760,6 ms |
| Settings | 56,2 ms |

A instrumentação do drawer misturava latência do produto com espera da automação. A métrica foi separada em feedback visual dentro do renderer e conclusão da transição. No primeiro rerun, o feedback ocorreu em 14,8 ms e o `transitionend` foi observado em 792,3 ms neste compositor. O segundo número permanece como risco; não foi ocultado.

## Resultado do checkpoint

| Gate/medida | Resultado após o corte |
|---|---:|
| TypeScript / ESLint | aprovado / aprovado |
| Unitários | 63/63 |
| Integração do shell | 17/17 |
| Electron/SQLite | 8/8 |
| E2E Electron | 6/6 |
| Dependências de produção | 0 vulnerabilidades no `npm audit` |
| Build Linux | AppImage e deb gerados |
| Cold boot até Home + aba ativa | 701,1 ms |
| Revelação da Home quente | 31,6 ms |
| Feedback visual da troca de aba | 0,6 ms |
| Confirmação IPC da superfície da aba | 1,0 ms |
| Feedback visual do drawer | 16,8 ms |
| Drawer após a transição | 247,6 ms |
| Settings | 56,8 ms |

As métricas são uma amostra reproduzível desta máquina, não p95 nem promessa universal. A instrumentação final descobriu que a medida antiga de Home terminava quando o DOM aparecia, antes de existir uma aba ativa, e que a medida antiga de troca de aba incluía a espera de estabilidade do botão pelo Playwright. Elas não são comparáveis como antes/depois. A sonda agora separa cold boot, Home quente, feedback visual e confirmação da superfície. Uma amostra A/B com a instrumentação nova mediu 1,3/1,3 ms para feedback/superfície quando cada atualização ainda reconstruía a Home oculta, e 0,6/1,0 ms após eliminar esse trabalho; a diferença é pequena demais para uma afirmação de p95, mas o teste de integração prova que a árvore oculta deixa de ser recriada. O drawer variou entre aproximadamente 243 e 810 ms no mesmo compositor e ainda não pode ser declarado otimizado.

## Mapa de impacto P0

| Área | Autoridade/entrada | Consumidores | Testes afetados |
|---|---|---|---|
| Layout raiz | `shell.css` + tokens | shell, toolbar, tabs, workspaces, viewport | design tokens, E2E de viewports |
| Perfil | `ProfileStorage` + repositories SQLite | Home, workspaces, favoritos, histórico, notas | contrato IPC, integração, Electron, E2E |
| Janelas privadas | `WindowManager`, `BrowserApplicationService`, `ElectronBrowserManager` | main, IPC, shell, session partitions | application service e E2E privado |
| Permissões | `SitePermissionService` + settings repository | session check/request handlers, Proteção | contrato, integração e Electron |
| Rede | `SessionRequestPipeline` | AdBlock e futuras políticas | unitário do pipeline e E2E |

## Causas confirmadas e correções

1. `moon-browser-main` era grid em `shell.css` e flex em `customization-runtime.css`. O flex virou a única autoridade estrutural e um teste impede nova disputa.
2. Workspaces, favoritos, histórico e notas eram gravados no renderer apesar dos repositories existentes. O SQLite agora é a autoridade; `localStorage` antigo é somente fonte preservada de migração.
3. O marker de migração no renderer podia impedir reimportação quando o banco fosse recriado. A idempotência agora é decidida pelo metadata SQLite no main.
4. O backend aceitava abas privadas, mas não havia janela privada real nem atalho completo. `Ctrl/Cmd+Shift+N` agora cria outra `BrowserWindow`, força partição efêmera e não agenda/realiza persistência de sessão.
5. Uma janela privada podia sobrescrever a sessão normal com uma lista vazia. Flush e timers agora ignoram janelas compostas apenas por abas privadas.
6. AdBlock registrava e removia handlers `webRequest` diretamente. Um pipeline único passou a compor políticas sem apagar handlers de outras capacidades.
7. Decisões de permissão existiam somente durante o callback. Agora há cache no main, persistência por origem, `setPermissionCheckHandler`, revogação na UI e decisões efêmeras separadas no privado.
8. A fila/modal de permissões foi extraída do `BrowserShell` para um controller coeso.

## Riscos e próximo corte

- `BrowserShell` e `CustomizationCenter` continuam grandes; drawers de produto e seções de Settings ainda devem ser extraídos.
- Cold boot ainda não possui orçamento próprio e o p95 da Home/troca de aba não foi coletado; a transição do drawer deve ser investigada pela variância observada neste corte.
- Onboarding/importador, Settings V4, Foco/Zen e Moon Intelligence não fazem parte deste primeiro checkpoint e continuam desativados ou honestamente parciais.
- O próximo corte recomendado é decompor os drawers e criar selectors granulares antes da Home Fase B.
