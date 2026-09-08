# Moon Browser 0.6.0-alpha.1 — relatório da atualização

Data: 8 de setembro de 2026. **Resultado geral: PARCIAL. Release público: BLOQUEADO. Migração oficial: NÃO INICIADA.**

## 1. Resumo executivo

A base encontrada era 0.5.0-demo.2, com alterações locais anteriores ainda não commitadas. Elas foram preservadas antes do desenvolvimento. A cópia isolada prepara 0.6.0-alpha.1: leitura local de fontes, notas referenciadas, memória manual por workspace e retomada de URLs, com correções de notas, contraste e distribuição.

O fluxo real é abrir uma página → autorizar extração → conferir trechos e fontes → salvar nota → guardar uma sessão → retomar páginas. Não existe IA generativa conectada. O resultado é uma alpha para avaliação; não satisfaz todos os critérios do super update nem autoriza migração ou publicação.

## 2. Inventário do projeto

| Item | Evidência e estado |
| --- | --- |
| Original local | `/home/heitgh/Moon-browser`, branch `codex/update-1.1-2026-09-01`, HEAD `d96c272` na descoberta |
| Remotos configurados no original | `origin`: `heitgh/Moon-tests-1`; `official`: `heitgh/Moon-browser`. Não houve push, fetch, merge ou alteração desses remotos |
| Diretório de testes alternativo | `/home/heitgh/GitHub/moon-tests`: checkout sem commits; não usado como fonte do código |
| Cópia desta tarefa | `moon-update`, branch `codex/moon-super-update`; baseline isolada `5d3117b` contém as alterações anteriores |
| Alterações preexistentes | 31 arquivos rastreados modificados + 6 entradas não rastreadas, incluindo o diretório de notas. Inventário e patch preservados fora do repositório |
| Stack | TypeScript, Electron 43.4.1/Chromium, SQLite/better-sqlite3, npm workspaces, Vitest, Playwright e electron-builder |
| Entradas | `main.js`, `preload.cjs`, `index.html`, main TypeScript e `ui/browser-shell.ts` |
| Build/documentação | `package.json`, lockfile, `electron-builder.yml`, workflows, README, CHANGELOG, `docs/adr`, `docs/architecture`, `docs/releases` |
| Proteções remotas | NÃO VERIFICADAS no servidor. YAML não comprova revisores obrigatórios de ambientes ou proteção de branch |

Inventário funcional: navegação, abas, favoritos, histórico, workspaces, notas, personalização, perfis e privado estão conectados. A homologação é **PARCIAL**, conforme matriz abaixo. Research/Memory locais são experimentais conectados. PDFs, busca semântica, grupos/split view e IA generativa são ausentes/planejados. Sync, cofre e Hub têm contratos/motores de teste e dependências externas; não são serviços operacionais. O harness DOM estava **quebrado no Node 26**, corrigido nesta tarefa.

Arquivos a examinar, sem exclusão automática:

| Candidato | Evidência, risco e ação |
| --- | --- |
| `dist`, `node_modules`, `release`, relatórios Playwright | Gerados; excluir do transporte Git. Artefatos ficam locais, com checksum |
| `.env.example` | Modelo de configuração; não equivale a segredo real. Não transportar `.env` pessoal |
| `tests/fixtures/moon-themes/fixture-factory.ts` | Fixture referenciada por testes, não órfã; manter |
| Scripts/serviços com `backup` no nome | Código de recuperação e testes; não são backups pessoais descartáveis |
| Documentos históricos 0.5 | Referências úteis preservadas; status atual aponta explicitamente para este relatório |
| Alterações anteriores sem commit | Preservadas na baseline, não descartadas como duplicatas |
| Mirror `sources/` e AI-Brain | Referências somente leitura, não modificadas |

Não foi demonstrado que todos os arquivos sem referência textual são órfãos; nenhuma limpeza destrutiva foi aplicada.

## 3. Pesquisa e decisões

[Pesquisa com fontes primárias](PESQUISA.md): Chrome oferece uma referência de confiabilidade; Edge/Vivaldi de organização; Opera de integração de IA; Arc de organização visual. Nenhuma comparação controlada demonstrou superioridade do Moon.

Escolha: testar o valor de transformar leitura em material recuperável com processamento local. Adiados provedor generativo sem configuração, ações externas autônomas, terminal/SSH, VPN, sync remoto, marketplace, Nexus School e reescrita integral.

## 4. Plano executado

| Fase | Estado e critério |
| --- | --- |
| Descoberta e baseline | CONCLUÍDO no checkout disponível: instruções, inventário, alterações preservadas e suítes de referência |
| Diagnóstico | CONCLUÍDO para falhas reproduzidas abaixo; auditoria universal permanece PARCIAL |
| Recorte e arquitetura | CONCLUÍDO: módulo aditivo, flags, limites, consentimento, dados separados e sem migration SQL destrutiva |
| Implementação | CONCLUÍDO no recorte local; P1 generativo/PDF e P2 completos permanecem PARCIAIS |
| Testes/visual | PARCIAL: suítes automatizadas e capturas reais; faltam plataformas e cenários descritos na matriz |
| Markdown | CONCLUÍDO para documentação atual; histórico preservado |
| Migração/publicação | NÃO INICIADO: aguardam homologações e aprovação final específica |
| Instaladores | PARCIAL: artefatos Linux; demais alvos e instalação pelo SO pendentes |

Detalhes dos canais, limites e dados: [arquitetura](ARQUITETURA.md).

## 5. Relatório de bugs

Ambiente comum: Linux x64/Wayland, Node 26.8.1, npm 12.0.2, Electron 43.4.1; perfis descartáveis.

| ID / gravidade | Reprodução, causa, correção ou pendência | Evidência / estado |
| --- | --- | --- |
| B01 / P1 | Rodar suítes DOM no Node 26: Web Storage nativo sombreava o DOM. Criar armazenamento happy-dom isolado em `tests/setup-dom.ts` | Baseline 3 unitários falharam/integração não executou; versões com flag de compatibilidade passaram; suíte final sem flag passa. CONCLUÍDO |
| B02 / P1 | Editar a mesma nota duas vezes: closure usava revisão antiga. `moon-notes-panel.ts` resolve a revisão atual ao salvar | Teste de segunda edição com expectedRevision 2. CONCLUÍDO |
| B03 / P1 | Autosave atualizava o perfil e recriava o editor durante digitação. `browser-shell.ts` preserva editor focado | Integração verifica foco após autosave. CONCLUÍDO |
| B04 / P2 | Escolher “Sem pasta” mantinha parentId antigo. Diferenciar campo omitido de remoção explícita | Correção localizada em `#save`; cenário de UI não automatizado separadamente. CONCLUÍDO por inspeção, cobertura PARCIAL |
| B05 / P1 | Editar duas notas dentro do debounce cancelava a primeira: timer compartilhado. Timers por nota e scratchpad | Teste de troca rápida confirma ambos os conteúdos enviados. CONCLUÍDO |
| B06 / P2 | Tema claro mantinha regiões escuras/textos claros fixos. Aplicar regiões e textos semânticos, remover sombras escuras de texto | Unitário de tokens + capturas reais. Todos os estados hover/erro/dialog não auditados. PARCIAL |
| B07 / P1 | Pipeline anterior permitia publicação automática/nomes sem versão. Opt-in manual, qualidade, ambiente, prerelease, proibição de sobrescrever release | Revisão do YAML; revisores reais ainda devem ser configurados. PARCIAL |
| B08 / P1 | `npm audit` apontou js-yaml vulnerável em ferramenta de desenvolvimento. Atualização compatível para 4.3.2 | Alta eliminada; dois alertas moderados em Vitest/mocker continuam. PARCIAL |
| B09 / P2 | Uma execução E2E excedeu tempo ao fechar teste de wallpaper, depois de todas as asserções | Log preservado; teste isolado e suíte completa posterior passaram. Causa intermitente não confirmada; monitorar |
| B10 / P1 para estabilidade | Memória elevada com 50 abas, sem hibernação homologada | Amostra de processos abaixo; investigar/reproduzir em carga real. ABERTO |
| B11 / P1 para distribuição | RPM depende de rpmbuild ausente; Windows, assinatura, integração de instalação/desinstalação e updater não homologados | Build inicial falhou apenas ao empacotar RPM. BLOQUEADO |

Falhas ambientais preservadas: E2E restrito recusou bind/socket com EPERM; execução autorizada com sessão gráfica passou. Script de galeria inicial não detectava Wayland, corrigido usando a detecção já presente nos testes. Não foram escondidas como testes aprovados.

## 6. Matriz de testes

Resultados finais e logs: [evidências locais](../../../moon-update-evidence/). Um teste unitário de motor não prova a integração real correspondente.

| Área / esperado | Execução e evidência | Estado |
| --- | --- | --- |
| TypeScript/lint | `final-typecheck.log`, `final-lint.log`, sem erros | CONCLUÍDO |
| Unitários | 134 testes, `final-unit.log` | CONCLUÍDO |
| Integração shell | 34 testes, `final-integration.log`; novas notas com foco, revisão e troca rápida | CONCLUÍDO |
| SQLite/Electron | 20 testes, `final-electron.log`; persistência, backup, migração, temas, perfis e memória | CONCLUÍDO |
| E2E desktop | 10 testes, `final-e2e.log`; sessão gráfica real, fixture HTTP local | CONCLUÍDO na suíte disponível |
| Instalação limpa/update/remoção/reinstalação | Execução de pacote extraído e perfil temporário; não houve instalação pelo gerenciador do SO ou desinstalação real | PARCIAL |
| Navegação HTTP/HTTPS/erros/redirect/certificado/voltar/reload | Navegação local, HTTPS de referência, políticas de URL e popup OAuth; sem matriz controlada de TLS inválido/redirecionamentos/rede interrompida | PARCIAL |
| Abas/janelas | Criar/fechar/alternar, sessão após restart, privado, perfis, popup, 1/10/50 abas; pin/reorder/duplicação sob carga não homologados | PARCIAL |
| Sessões | Restore após restart; snapshot real, restauração repetida não duplica; pesquisa/memória/notas após `app.exit(1)` | PARCIAL: não equivale a queda de energia, SIGKILL ou grupos/scroll |
| Workspaces | Filtro de fontes/nota, memória separada e tentativa de ler outra aba recusada; motores existentes de persistência | PARCIAL: matriz completa de mover/renomear em múltiplas janelas pendente |
| Home | Presets, widgets/contratos, personalização persistente e viewports; galeria real | PARCIAL: drag-and-drop e reset de todas as composições não explorados integralmente |
| Busca | Comandos/configurações existentes, nota salva encontrada no E2E; downloads adicionados à Central | PARCIAL: omnibox universal, typo e pesquisa semântica não implementados |
| Research | HTML real, limite de cinco fontes/60k caracteres, ausência de base, conteúdo inerte, permissões e isolamento em testes | PARCIAL: PDF ausente; múltiplas fontes testadas no motor, não E2E; timeout/offline/dinâmica/cancelamento real sem matriz exaustiva |
| Memory | Opt-in anterior à escrita, revisão, expiração, quotas, deleção e isolamento em unitários/storage; sessão gravada via UI | PARCIAL: edição/exportação/apagar tudo existentes, sem E2E dedicado de todos os botões |
| Estudo | Trechos, referências e nota real; cartões/checklist/comparação no motor | PARCIAL: não há quiz adaptativo, resumo generativo ou validação pedagógica |
| Downloads | Testes do manager/política; UI e busca conectadas | PARCIAL: matriz real de interrupção/arquivo perigoso/pausa não homologada |
| Mídia | Tela cheia HTML e retorno à shell no E2E; serviço de permissões | PARCIAL: webcam/microfone/áudio/vídeo/PiP não homologados |
| Temas/wallpapers | Tokens claro/escuro, extração de paleta, contratos de mídia inválida, persistência, wallpaper animado/poster/redução de movimento | PARCIAL: alto contraste integral, todos os estados de componentes e imagem extrema pendentes |
| Privacidade | Privado não restaurado, partições/perfis separados; todas as rotas Research recusam privado/convidado antes do storage | PARCIAL: teste não constitui auditoria completa de tráfego e remoção forense |
| Segurança | URL/sender/frame/ownership, XSS por renderização textual, texto malicioso inerte, consentimento; scans limitados | PARCIAL: pentest/CSP completa e auditoria de toda dependência pendentes |
| Acessibilidade | Foco de nota, controles rotulados, viewports e redução de movimento existentes | PARCIAL: leitor de tela, zoom 200% e contraste WCAG completo NÃO EXECUTADOS |
| Desempenho | Tempos UI e amostras 1/10/50 abas abaixo | PARCIAL: sem p95, teste prolongado de vazamento ou comparação com concorrentes |
| Atualização | Perfil fictício anterior, backup integral e rollback verificados conforme seção 12 | PARCIAL: updater interrompido/assinatura inválida não testáveis como recurso operacional |

## 7. Desempenho antes/depois

Mesma máquina, processos instrumentados via Playwright/Electron. Valores pontuais, não benchmark estatístico. UI anterior usa baseline com alterações locais preexistentes; recursos anteriores usam fonte `33ec7f3` (0.5.0-demo.2). Perfis novos, nenhuma carga pessoal. Working set somado inclui páginas compartilhadas e instrumentação: não é memória privada atribuível exclusivamente ao produto.

| Medida | Antes | Alpha |
| --- | ---: | ---: |
| Home interativa, partida fria | 740,1 ms | 720,7 ms |
| Retorno à Home | 22,4 ms | 692,3 ms |
| Feedback de troca de aba | 0,6 ms | 0,7 ms |
| Superfície de aba assentada | 0,4 ms | 0,6 ms |
| Feedback/assentamento de painel | 13,7 / 237,3 ms | 17,7 / 246,6 ms |
| Abertura de configurações | 129,5 ms | 145,2 ms |
| Working set somado: 1 aba | 1103 MiB | 1101 MiB |
| 10 abas | 2076 MiB | 2088 MiB |
| 50 abas | 6957 MiB | 7013 MiB |
| CPU ociosa somada: 1/10/50 | 0,2 / 0,2 / 0,2% | 0,2 / 0,1 / 0,3% |

A divergência de retorno à Home motivou uma repetição registrada em `performance-repeat.log`: partida fria 726,6 ms; retorno 41,8 ms; painel 25,8/288,3 ms; configurações 160,4 ms. Ambas as medições são preservadas. Não declarar melhoria ou regressão causal com uma amostra. O método inclui espera de automação e, no script UI legado, navegação externa; a amostra de recursos usa HTML simples local. Os 50 processos de renderização constituem prioridade antes de estabilidade.

## 8. Privacidade e segurança

Não há provedor de IA nem transmissão de fontes por Research. Captura explícita, até cinco abas públicas deste workspace; exclui campos/formulários, elementos ocultos e URLs/páginas heurísticamente sensíveis. Instruções da página permanecem dados. Isso não garante reconhecer segredos em texto comum.

Memória opt-in por categoria, manual, local no SQLite do perfil, com revisão/expiração/quotas. Notas salvas seguem o repositório canônico; exports dependem de escolha de arquivo. Desligar categoria não apaga itens existentes; ações de exclusão retiram registros ativos. Backups/exports têm vida independente; não há criptografia própria nem apagamento forense garantido. [Limites completos](ARQUITETURA.md).

Scan local: 1059 blobs históricos de até 2 MB e arquivos atuais não ignorados, procurando chaves privadas e formatos comuns de tokens; nenhum padrão encontrado. Não é prova de ausência de todo segredo, nem auditoria de remotos inacessíveis. Dependências: alta js-yaml corrigida; dois alertas moderados em ferramentas Vitest/mocker permanecem (não são dependências de produção). Os testes usam modo `run`, não servidor de testes público. Não rodar servidor de testes exposto enquanto a atualização maior não for homologada.

## 9. Galeria real

Capturas de perfis fictícios, geradas pelo desktop da alpha. Os painéis são recortes reais porque a captura da shell nesta plataforma não inclui de modo confiável o WebContentsView nativo. Não são mockups de IA. Versões originais ficam no histórico Git; nomes `update-*` identificam esta entrega.

![Home escura com workspaces, busca e atalhos](../../assets/screenshots/update-home-dark.png)
![Home clara com regiões e textos ajustados para leitura](../../assets/screenshots/update-home-light.png)
![Home com wallpaper procedural e paleta extraída localmente](../../assets/screenshots/update-home-wallpaper.png)
![Painel Research com passagens literais e fontes de uma página de teste](../../assets/screenshots/update-research.png)
![Memória opt-in e sessão de biologia para retomar páginas](../../assets/screenshots/update-memory.png)
![Nota Markdown criada a partir da leitura com referências](../../assets/screenshots/update-study-note.png)

`assets/wallpapers/update-gradient.png`: gradiente procedural original, licença MIT do projeto. Wallpapers SVG existentes vêm da base; nenhum arquivo externo novo foi baixado. Não há captura de quiz/IA generativa porque esses recursos não estão operacionais.

## 10. Documentação atualizada

- `README.md`: promessa real, fluxo, estados, limites, instalação isolada, privacidade, atalhos e equipe; João Pedro Siqueira Melo confirmado.
- `CHANGELOG.md`: entrada alpha, preservando versões anteriores.
- `docs/roadmap/status.md`: distingue estado atual do histórico 0.5.
- `docs/releases/v0.6.0-alpha.1.md`: escopo e bloqueios desta versão.
- `docs/update/ARQUITETURA.md`: contratos, modelo de memória, limites e riscos.
- `docs/update/PESQUISA.md`: fontes e decisões, hipóteses sem promessas de superioridade.
- `docs/update/MIGRACAO.md`: transporte seletivo, backup, rollback e aprovação.
- Este relatório: bugs, matriz, métricas, capturas e distribuição.

Documentos históricos não foram reescritos como se registrassem testes atuais. Nenhuma alteração em fontes sincronizadas ou documentos pessoais.

## 11. Migração

**NÃO INICIADA.** Mudanças permanecem na branch isolada. Comparação desta atualização: baseline `5d3117b` até HEAD; comparar também a base original antes de transportar, para incluir conscientemente as alterações preexistentes. Evidências locais e bundle preservam o trabalho para revisão.

Não houve push, PR, merge, release ou substituição de perfil pessoal. Revisão humana final continua obrigatória por solicitação do usuário e do documento. [Plano e rollback](MIGRACAO.md). Mesmo com aprovação, revalidar o estado dos remotos e suas proteções antes da integração.

## 12. Artefatos de release

Versão dos artefatos: **0.6.0-alpha.1, Linux x64, locais e sem assinatura**. O build sempre desabilita publicação.

| Arquivo local | Tamanho | Estado |
| --- | ---: | --- |
| [Moon-Browser-0.6.0-alpha.1-Linux-x64.AppImage](../../release/Moon-Browser-0.6.0-alpha.1-Linux-x64.AppImage) | 135.2 MiB | CONCLUÍDO: geração e extração |
| [Moon-Browser-0.6.0-alpha.1-Linux-x64.deb](../../release/Moon-Browser-0.6.0-alpha.1-Linux-x64.deb) | 108.6 MiB | CONCLUÍDO: geração e extração |
| [Moon-Browser-0.6.0-alpha.1-Linux-x64.pacman](../../release/Moon-Browser-0.6.0-alpha.1-Linux-x64.pacman) | 98.7 MiB | CONCLUÍDO: geração e extração |
| RPM | — | BLOQUEADO: `rpmbuild` ausente |
| Windows Setup/Portable | — | NÃO GERADOS nesta máquina; workflow preparado, homologação Windows pendente |
| macOS/ARM/mobile | — | NÃO HOMOLOGADOS |

[SHA256SUMS](../../release/SHA256SUMS), para verificar os arquivos locais:

```text
95e58d4e15c02fdd74ee55f0dc11c8b676129f51b6adf58903bd177ad6728ced  Moon-Browser-0.6.0-alpha.1-Linux-x64.AppImage
0d10b62bea5ff7721238baf5a0e3177428528b5b4bdb1e3ed8554cbbbd6bfcc3  Moon-Browser-0.6.0-alpha.1-Linux-x64.deb
acacf2f50e253b339919f6fc3a3e48f279783f915924c0959bc3a9e2632ac7f2  Moon-Browser-0.6.0-alpha.1-Linux-x64.pacman
```

Os três pacotes foram extraídos em diretórios temporários; possuem o mesmo `app.asar`, versão interna 0.6.0-alpha.1. Inspeção de 2628 entradas e 791 arquivos de aplicação por pacote não encontrou os padrões de segredo pesquisados nem perfis, `.env`, Git ou relatórios de teste. Esse scan é limitado; não equivale a auditoria completa de bibliotecas/binários.

**CONCLUÍDO no ensaio:** fonte anterior `33ec7f3`, versão 0.5.0-demo.2, gerou um perfil fictício; o executável empacotado e depois o AppImage extraído preservaram favorito, scratchpad e largura personalizada do painel; reinício passou; rollback usando backup integral e versão anterior passou. Evidências: `upgrade-unpacked.log`, `upgrade-appimage.log`, `installer-extraction.json`, `artifact-inspection.json`.

**PARCIAL para instalação de usuários:** não houve instalação com privilégios pelo SO, registro de protocolo/atalhos, remoção/reinstalação, FUSE AppImage em distribuições distintas, comparação de todos os campos de um perfil real ou teste de atualização assinada/interrompida. DEB e pacman tiveram extração/identidade do payload verificadas; seus gerenciadores de pacotes não foram executados. Os arquivos não são uma release pública aprovada.


## 13. Próximos passos e respostas finais

| Prioridade | Entrega | Impacto / esforço / risco |
| --- | --- | --- |
| P0 | Homologar instalação/update/remoção por SO, revisar ambiente de aprovação e assinatura | Alto / médio / alto |
| P0 | Resolver alertas de ferramentas de teste e ampliar auditoria de dados/IPC | Alto / médio / médio |
| P1 | Provedor generativo real com consentimento, chaves seguras, fontes, streaming e cancelamento | Alto / alto / alto |
| P1 | PDFs, busca integrada à omnibox e sessões com contexto além de URLs | Alto / alto / médio |
| P1 | Hibernação e medições repetidas de muitas abas; investigar fechamento intermitente | Alto / alto / médio |
| P1 | Leitor de tela, zoom 200%, contraste em todos os estados, mídia e rede adversa | Alto / médio / médio |
| P2 | Estudo com novos usuários: tempo até primeira nota útil e retenção de 30 dias | Alto / médio / baixo |
| P2 | Grupos/split view e integrações futuras apenas após validar o fluxo central | Médio / alto / médio |

**Problema cotidiano:** organizar leitura, referências, notas e páginas de um estudo no mesmo lugar. Superioridade sobre Chrome/Edge/Opera/Arc/Vivaldi ainda não demonstrada.

**Tempo até valor:** objetivo de poucos minutos para a primeira nota; não medido com novos usuários.

**Real versus protótipo:** extração local, notas, memória e retomada de URLs estão conectadas. IA generativa/PDF ausentes; sync/Hub/cofre têm componentes de teste, não serviços liberados.

**Dados:** somente fontes explicitamente escolhidas; memória/notas locais e exports manuais. Exclusão de registros não limpa backups nem garante sanitização do disco.

**Atualização antiga:** o ensaio descrito na seção 12 cobre um perfil fictício de referência. Não prova todos os perfis ou versões; exigir backup integral e homologação antes de atualizar usuários.

**Voltar atrás:** fechar processos e iniciar a versão antiga com cópia integral anterior restaurada em diretório separado, preservando também dados criados na alpha.

**Estabilidade:** faltam homologações de instaladores/assinaturas/plataformas, auditoria integral, acessibilidade, muitas abas e investigação da intermitência de fechamento. O produto não é declarado estável.

**Permanecer após 30 dias:** hipótese de benefício por recuperar estudos e fontes sem reconstruir contexto. Ainda não há evidência de retenção que sustente prometer isso.
