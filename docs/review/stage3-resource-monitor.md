# Etapa 3 — Medidor de recursos — Nexus Inc.

## Diagnóstico e plano

O backend possuía `ElectronBrowserManager` com mapas de abas e superfícies `WebContentsView`, além de diagnóstico local opt-in. Não havia painel de consumo nem API de métricas por processo. `app.getAppMetrics()` e `webContents.getOSProcessId()` fornecem os dados necessários sem abrir acesso do renderer ao sistema.

A implementação separa `ResourceMonitor` (medição), contrato IPC, adaptador do gerenciador e `ResourcesPanel` (apresentação). Política e suspensão são a etapa 4. Não se altera esquema de banco nesta etapa.

## Comportamento e limites

- Menu nativo Moon → Recursos, central de comandos e Ctrl/Cmd+Shift+E abrem o painel. A opção Mostrar Recursos na sidebar persiste no armazenamento da interface do perfil.
- Agora mostra RAM e CPU dos processos do Moon, contagem única de processos e abas desta janela. Páginas pesadas ordena as abas desta janela pelo consumo do processo correspondente.
- A mesma PID entra uma vez no total. PID e instante de criação identificam a amostra de CPU; reciclagem de PID exige nova amostra inicial. Abas que compartilham processo exibem aviso, sem dividir artificialmente o consumo.
- RAM é o conjunto de trabalho em KiB convertido em MiB. A soma dos conjuntos de trabalho pode incluir páginas físicas compartilhadas por processos distintos; não é medição da RAM física exclusiva do aplicativo.
- A primeira amostra de CPU não significa ociosidade. Métricas inexistentes são indisponíveis; totais incompletos são indicados como parciais. CPU pode ultrapassar 100% em vários núcleos.
- Nenhum runtime local de modelo está ativo nesta etapa. Existe atribuição por PID registrado para uma futura integração; não se inventa consumo zero de IA.
- Só o shell autorizado consulta o IPC; a janela vem do remetente. Títulos de outras janelas/perfis não são retornados. Os totais globais incluem todos os processos, inclusive outras janelas.
- Consultas próximas compartilham amostra por 500 ms. O painel consulta a cada dois segundos enquanto aberto; fechar interrompe a consulta. Eventos de downloads não recriam o painel nem retiram foco de seus controles.
- Não há envio de métricas, telemetria, persistência de amostras, alvo de RAM, limitação de CPU ou suspensão nesta etapa.

## Testes

- `resource-monitor.test.ts`: processos duplicados, compartilhamento, primeira amostra, cache, PID reutilizada, métricas ausentes, atribuição de IA e ordenação.
- `resource-ipc.test.ts`: origem da janela e rejeição de parâmetros de escopo.
- `resources-panel.test.ts`: valores reais, escape de títulos por `textContent`, polling, erros e botão opcional.
- `resources.spec.ts`: oito páginas reais, menu nativo, processos únicos, total conferido com suas parcelas e preferência da sidebar após recarregar a interface.

Rode `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run compile` e `npx playwright test tests/e2e/resources.spec.ts --workers=1` num desktop Windows/Linux. A interface local neste executor não pode abrir o socket Unix de instância única do Electron; a validação real de UI precisa da CI. Não se desativa essa proteção para passar o teste.

## Reprodução manual

1. Abra sites em várias abas e entre em Menu Moon → Recursos ou Ctrl+Shift+E.
2. Confira a amostra inicial de CPU e aguarde dois segundos para a seguinte. Compare as PIDs com um gerenciador de processos do sistema; definições de memória podem diferir entre ferramentas.
3. Confira o aviso em abas com PID repetida. Não some as linhas das abas como se fossem processos distintos.
4. Marque Mostrar Recursos na sidebar, feche o painel e recarregue a interface. O botão deve permanecer disponível.
5. Navegue com Tab/Shift+Tab e feche o painel. Leitor de tela real e consumo em hardware físico ainda não foram homologados.

## Estado

Implementação e testes locais em revisão. Nenhuma versão publicada nesta etapa. A comparação de memória antes/depois de suspensão e o teste de carga prolongado pertencem à etapa seguinte.
