# Moon Browser — checkpoint de ergonomia, Fase A

Data: 26 de agosto de 2026  
Escopo: grade e sistema visual do runtime Electron ativo.

## Baseline

| Problema observado | Causa provável | Arquivos envolvidos | Risco | Prioridade | Critério de aceite |
|---|---|---|---|---|---|
| Textos essenciais de 8–12 px | Escalas locais e valores fixos ignoram os tokens existentes | `shell.css`, `panels.css`, `settings.css`, `customization-runtime.css` | fadiga e baixa legibilidade | P0 | texto normal de 13–14 px; microtexto não essencial com mínimo de 11 px |
| Alvos de 20–36 px | controles dimensionados isoladamente | `shell.css`, `home.css`, `panels.css`, `settings.css` | baixa precisão e acessibilidade | P0 | alvos principais com 40 px; 44 px em ponteiro coarse |
| Chrome visualmente fragmentado | tabs, toolbar e workspaces usam alturas, paddings e superfícies sem escala comum | `shell.css`, `customization-runtime.css` | hierarquia ruidosa e desalinhamento | P0 | alinhamento óptico e ritmo comum em quatro viewports |
| Tokens incompletos e regras concorrentes | variáveis cobrem apenas parte do sistema; arquivos históricos ainda definem valores concretos | `variables.css`, agregação em `globals.css` | regressão e manutenção cara | P0 | tokens semânticos governam tipo, espaço, altura, foco, sombra e movimento |
| E2E depende do perfil local | primeiro smoke não cria `user-data-dir` temporário | `desktop-smoke.spec.ts` | gate não determinístico | P0 | os quatro E2E passam em perfil isolado |
| Capturas insuficientes | script registra um único viewport e só uma categoria de configurações | `capture-screenshots.ts` | regressões responsivas invisíveis | P1 | Home em 909×1026, 1280×800, 1440×900 e 1920×1080; drawer e seis categorias capturados |

## Gates antes da alteração

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run test:unit`: 22 passaram.
- `npm run test:integration`: 14 passaram.
- `npm run test:e2e`: 3 passaram e 1 falhou porque o smoke reutilizou preferências externas que ocultavam a omnibox.

## Invariantes

- Personalização V2, migração e persistência permanecem no mesmo formato.
- Nenhum isolamento Electron ou contrato IPC será relaxado.
- Fase A não declara Home V3, tabs avançadas, Command Center ou funcionalidades futuras.

## Resultado da Fase A

| Métrica | Antes | Depois |
|---|---:|---:|
| menor texto literal no CSS ativo | 7 px; vários textos essenciais em 8–10 px | 11 px, reservado a metadados |
| texto padrão do chrome | 10–12 px | 13–14 px |
| menor alvo interativo observado no chrome | 20 px | 40 px |
| folhas carregadas pelo agregador | 14, incluindo temas/estrutura responsiva legados | 11; três folhas concorrentes retiradas do runtime |
| viewports com regressão automatizada | 1 captura sem asserção geométrica | 4: 909×1026, 1280×800, 1440×900 e 1920×1080 |

O teste E2E mede o DOM realmente renderizado em cada viewport: texto visível essencial ≥ 11 px, controles principais ≥ 40 px, Home dentro da largura e nenhum overflow horizontal do documento.

## Performance reproduzível

Comando: `npm run measure:ui`. Perfil temporário vazio, sessão gráfica local desta máquina:

| Caminho | Medição atual |
|---|---:|
| primeira Home interativa | 549,9 ms |
| troca de aba | 800,4 ms |
| abertura do drawer | 27,8 ms |
| abertura das configurações | 107,4 ms |

Não existe telemetria equivalente anterior ao corte; portanto, estes tempos são o baseline reproduzível para a Fase B, não uma alegação de redução. A melhoria antes/depois deste corte é demonstrada pelas métricas geométricas e tipográficas acima.

## Evidência visual

- Home: `assets/screenshots/phase-a-home-{909x1026,1280x800,1440x900,1920x1080}.png`.
- Página aberta: `assets/screenshots/phase-a-browser-page.png`.
- Drawer: `assets/screenshots/page1.png`.
- Configurações: `assets/screenshots/phase-a-settings-{appearance,layout,home,typography,search,data}.png`.

## Checklist de acessibilidade

- [x] foco visível centralizado no token de foco;
- [x] navegação de settings mantém trap de foco, Escape e undo/redo por teclado;
- [x] toolbar e widgets possuem alternativa de ordenação por teclado;
- [x] `prefers-reduced-motion` e controle interno de movimento continuam cobrindo o shell;
- [x] alvos principais e piso tipográfico verificados automaticamente nos quatro viewports;
- [x] inspeção visual de Home, drawer e seis categorias sem clipping aparente;
- [ ] leitura completa com NVDA/Orca e contraste de todos os temas criados pelo usuário permanece validação manual de release.

## Itens adiados

A Fase B deve reconstruir as composições dos presets da Home. A Fase C deve aprofundar transições de drawer/abas e medir sessões prolongadas. O schema V3, tabs avançadas e Command Center não pertencem a este corte.
