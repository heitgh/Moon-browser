# Super Prompt — reconstrução total do README oficial do Moon Browser

> Este documento é uma especificação autocontida para orientar uma futura reconstrução do `README.md` do repositório oficial `heitgh/Moon-browser`. Ele não autoriza mudanças em código, configuração, documentação auxiliar, assets, releases ou infraestrutura.

## 1. Papel e missão

Você atua como responsável por documentação técnica, comunicação de produto, experiência de desenvolvedor e revisão editorial do **Moon Browser**, navegador desktop open source da **Nexus Inc.**

Sua missão é reconstruir integralmente o `README.md` para que ele alcance o padrão de apresentação dos melhores projetos open source do GitHub: profissional, visual, fácil de escanear, tecnicamente preciso, convincente sem exageros e útil tanto para pessoas interessadas no produto quanto para desenvolvedores e avaliadores de segurança.

O README deve responder rapidamente:

1. O que é o Moon Browser?
2. Qual problema cotidiano ele resolve?
3. Por que alguém deveria experimentá-lo?
4. O que funciona hoje?
5. O que ainda é experimental, planejado ou indisponível?
6. Como instalar, testar, contribuir e recuperar dados?
7. Como o Moon lida com privacidade, memória, conteúdo de páginas e isolamento?
8. Quem participa do projeto e qual é a responsabilidade atual de cada pessoa?

O resultado deve tornar o projeto mais claro e desejável sem transformar hipóteses, fundações técnicas ou interfaces incompletas em funcionalidades prontas.

## 2. Limite absoluto desta tarefa

Ao executar este prompt:

- faça descoberta e leitura em todo o repositório;
- consulte fontes externas somente de forma read-only;
- altere **exclusivamente** o arquivo `README.md`;
- não modifique código, testes, configurações, workflows, dependências, lockfiles, outros documentos, imagens ou instaladores;
- não crie novos assets, badges externos, releases, tags ou páginas;
- não altere issues, pull requests, projetos, discussões ou configurações do GitHub;
- não publique downloads nem acione deploys;
- não atualize o AI Brain, memórias externas ou arquivos pessoais;
- não apague histórico relevante;
- não faça mudanças “aproveitando a oportunidade”.

Se uma informação necessária não puder ser comprovada, registre a lacuna no relatório inicial e escreva o README de forma honesta. Se uma captura estiver desatualizada ou insuficiente, use apenas uma imagem existente que corresponda ao produto real ou omita a captura; não produza um mockup para preencher espaço.

## 3. Fonte de verdade e estado de referência

Antes de escrever, confirme novamente todos os fatos. O ponto de partida verificado durante a criação deste prompt foi:

| Item | Referência encontrada |
| --- | --- |
| Repositório oficial | `https://github.com/heitgh/Moon-browser` |
| Branch principal | `main` |
| Versão no código | `0.6.0-alpha.1` |
| Última release pública encontrada | `v0.5.0-demo.2` |
| Licença | MIT |
| Produto | Navegador desktop open source da Nexus Inc. |
| Stack principal | Electron/Chromium, TypeScript, Node.js e SQLite com `better-sqlite3` |
| Testes | Vitest, testes Electron/SQLite e Playwright E2E |
| Empacotamento | `electron-builder`; alvos declarados para Windows, Linux e macOS, com homologação desigual |
| Maturidade | Alpha experimental; não deve ser apresentado como estável para dados críticos |

Esses dados são contexto, não licença para copiar números desatualizados. Compare-os com a `main`, com releases e com os workflows no momento da execução.

Em qualquer divergência:

1. o código e a configuração da `main` vencem;
2. resultados recentes de CI vencem relatórios antigos;
3. a release pública deve ser distinguida da versão presente no código;
4. documentação histórica continua histórica;
5. interfaces, contratos e feature flags não provam que um recurso está disponível ao usuário.

## 4. Leitura obrigatória antes de editar

Comece em modo read-only. Leia integralmente e faça anotações factuais sobre:

### Identidade, versão e narrativa

- `README.md` atual;
- `CHANGELOG.md`;
- `LICENSE`;
- `package.json` e manifests dos workspaces;
- `docs/releases/`;
- `docs/roadmap/`;
- `docs/update/`;
- histórico recente do Git, tags e releases públicas.

### Arquitetura e segurança

- `AGENTS.md` e demais instruções aplicáveis;
- `docs/adr/`;
- `docs/architecture/`;
- `docs/security/`;
- `docs/database/` e `database/`;
- `config/feature-flags.ts`;
- `preload.cjs`;
- entradas principais de Electron, IPC e UI;
- contratos de perfis, pesquisa, memória, temas, importação e permissões.

### Produto real

- `apps/desktop/`;
- `packages/core/`, `packages/storage/`, `packages/research/`, `packages/ipc/`, `packages/security/`, `packages/network/` e `packages/theme-contract/`;
- `ui/browser-shell.ts` e módulos ativos de Home, workspaces, notas, Research, personalização, comandos, foco e Zen;
- `tests/`, especialmente integração, Electron/SQLite e E2E;
- screenshots existentes em `assets/screenshots/`;
- wallpapers e identidade visual em `assets/branding/` e `assets/wallpapers/`;
- scripts de build, medição, captura e migração.

### Histórico, ideias e contexto

- auditorias e checkpoints em `docs/audits/` e `docs/checkpoints/`;
- documentos de API e produto em `docs/api/` e `docs/product/`;
- issues, releases e metadados públicos do repositório;
- quando acessível e permitido pelas instruções locais, o contexto específico do Moon no AI Brain, começando por `STATE.md` e consultando somente arquivos relacionados a arquitetura, decisões, bugs, roadmap, ideias e identidade.

Não leia arquivos secretos, tokens, cookies, perfis pessoais ou dados privados. Não publique e-mails extraídos do histórico Git.

## 5. Relatório inicial obrigatório

Antes de editar o README, apresente um relatório curto e verificável com cinco blocos.

### 5.1 Estado encontrado

Inclua:

- commit e branch analisados;
- versão no código e última release pública;
- plataformas comprovadamente construídas ou homologadas;
- status do CI;
- maturidade real do produto;
- quantidade e estado das issues públicas, sem inferir ausência de bugs pela ausência de issues.

### 5.2 Matriz de verdade das funcionalidades

Classifique cada área como `DISPONÍVEL`, `EXPERIMENTAL`, `FUNDAÇÃO TÉCNICA`, `PLANEJADA`, `DESATIVADA` ou `NÃO COMPROVADA`.

No mínimo, avalie:

- navegação, abas e janelas;
- workspaces;
- favoritos e histórico;
- perfis locais, convidado e janela privada;
- sessões e recuperação;
- Home e personalização;
- temas, ícones e wallpapers;
- downloads, permissões e AdBlock;
- notas;
- Central de comandos e busca;
- Foco/Zen;
- Moon Research;
- Moon Memory;
- IA generativa e PDF;
- sincronização e cofre;
- extensões e plugins;
- Moon Hub/Nexus School;
- VPN;
- mobile;
- atualização automática e assinatura.

Para cada classificação, cite ao menos uma evidência concreta: arquivo, teste, workflow, screenshot, release ou comportamento reproduzido.

### 5.3 Inventário editorial

Liste:

- afirmações atuais corretas;
- afirmações confusas, fracas, redundantes ou desatualizadas;
- informações importantes ausentes;
- capturas aproveitáveis e o que cada uma realmente demonstra;
- links quebrados ou destinos ainda não operacionais;
- badges possíveis e badges que não devem ser usados;
- conteúdo que deve sair do README e permanecer apenas na documentação técnica.

### 5.4 Público e trabalho a ser resolvido

Defina públicos primários sem inventar pesquisa de usuários:

- estudantes e pesquisadores que precisam guardar fontes e retomar contexto;
- profissionais que trabalham com muitas páginas, notas e espaços;
- usuários que valorizam personalização e controle local;
- desenvolvedores e colaboradores interessados no projeto.

Descreva as hipóteses de “jobs to be done” e identifique claramente o que ainda não foi validado com usuários reais.

### 5.5 Recorte editorial proposto

Mostre a arquitetura do novo README antes de escrevê-lo. Para cada seção, explique em uma frase o objetivo e a prova usada.

## 6. Posicionamento central

Use como hipótese principal, sujeita à validação no repositório:

> **Moon Browser — o navegador que lembra, organiza e explica o que você faz.**

Promessa expandida possível:

> Um ambiente de navegação para estudo e trabalho que mantém páginas, fontes, notas, sessões e personalização no mesmo fluxo, com controle local e consentimento explícito.

Não prometa que o Moon “entende”, “pensa”, “responde com IA” ou “resume inteligentemente” se o runtime continuar baseado apenas em extração local de trechos. Prefira termos concretos como:

- selecionar trechos;
- preservar fontes;
- comparar páginas;
- criar notas vinculadas;
- organizar sessões;
- retomar URLs e contexto disponível;
- manter memória manual e opcional por workspace.

O README deve explicar o ganho cotidiano em linguagem simples:

> abrir material → selecionar fontes → extrair e organizar trechos → salvar uma nota ou sessão → fechar → voltar depois e retomar.

## 7. Princípios editoriais

O novo README deve ser:

- **profissional:** texto revisado, hierarquia previsível e tom seguro;
- **específico:** verbos concretos, exemplos e limites mensuráveis;
- **escaneável:** parágrafos curtos, tabelas úteis e títulos informativos;
- **visual:** identidade do Moon, capturas reais e bom ritmo entre texto e imagem;
- **honesto:** status e limitações próximos das promessas correspondentes;
- **acolhedor:** compreensível para quem não conhece Electron ou arquitetura de browsers;
- **útil para contribuidores:** instalação de desenvolvimento e links técnicos corretos;
- **acessível:** alt text descritivo, links com rótulos claros e nenhuma informação transmitida somente por cor;
- **durável:** evitar números e frases que envelhecem sem contexto ou data;
- **brasileiro:** português brasileiro natural e profissional, sem tradução literal de slogans estrangeiros.

Evite:

- texto genérico de startup;
- excesso de emojis;
- badges decorativos ou sem fonte confiável;
- tabelas enormes sem decisão prática;
- repetição do relatório técnico inteiro;
- superlativos como “melhor”, “mais seguro”, “revolucionário” ou “definitivo” sem prova independente;
- comparação depreciativa com concorrentes;
- chamar contratos, mocks ou testes unitários de funcionalidades prontas;
- esconder limitações em notas de rodapé;
- usar contagem de estrelas, downloads ou cobertura sem fonte e data;
- expor nomes de usuário locais, caminhos pessoais, e-mails, tokens ou dados de perfis.

## 8. Estrutura obrigatória do novo README

Adapte a ordem apenas se houver justificativa editorial melhor. Mantenha uma progressão de produto → prova → uso → confiança → participação.

### 8.1 Hero

Incluir:

- logo ou wordmark existente;
- nome Moon Browser;
- proposta de valor em uma linha;
- descrição curta em até duas frases;
- badges reais e úteis;
- links principais: experimentar ou releases, documentação, reportar bug e licença;
- uma captura principal real, atual e legível.

O hero deve deixar visível a maturidade (`alpha`, `demo`, `beta` ou `stable`) e não deve sugerir que a versão da `main` já está disponível para download se a release pública for anterior.

### 8.2 “Por que usar o Moon?”

Apresente de três a cinco motivos baseados em comportamento real. Exemplos de eixos:

| Eixo | Benefício que precisa ser comprovado |
| --- | --- |
| Contexto | Retomar páginas, workspaces, notas e sessões sem reconstruir tudo manualmente |
| Pesquisa | Trabalhar com trechos e fontes explícitas no mesmo navegador |
| Controle | Memória opcional, editável, exportável e apagável por workspace |
| Personalização | Adaptar Home, layout, temas, ícones e wallpapers ao modo de trabalho |
| Privacidade | Processamento local no Research atual e isolamento de perfis/janelas privadas |

Não use esses benefícios se a implementação corrente não os sustentar.

### 8.3 Demonstração do fluxo principal

Mostre em quatro a seis passos o fluxo mais convincente do produto. Use uma pequena sequência visual ou tabela se as capturas existentes forem coerentes:

1. abrir uma página ou conjunto de abas;
2. escolher explicitamente as fontes;
3. extrair trechos, comparar ou criar material de revisão;
4. salvar em nota ou sessão;
5. voltar depois;
6. localizar e retomar o trabalho.

Explique que a versão atual não oferece IA generativa se isso continuar verdadeiro.

### 8.4 Funcionalidades por estado

Use uma tabela compacta que separe sem ambiguidade:

- disponível;
- experimental;
- em desenvolvimento/planejado;
- indisponível ou bloqueado.

Não misture roadmap com recursos prontos. Links técnicos devem levar à documentação correspondente.

### 8.5 Comparação justa com alternativas

Crie uma tabela útil, com data de verificação e fontes primárias. Compare o Moon com Chrome, Edge, Opera, Arc e Vivaldi apenas nos eixos que ajudam uma pessoa a escolher um navegador.

Eixos recomendados:

| Critério | Pergunta prática |
| --- | --- |
| Maturidade e compatibilidade | Posso depender dele como navegador principal hoje? |
| Organização por contexto | Há workspaces, sessões, grupos ou formas equivalentes de retomar trabalho? |
| Pesquisa e estudo | O navegador conecta páginas, fontes, notas e revisão? |
| Memória | Existe memória, como é acionada e quem controla os dados? |
| Personalização | Até onde layout, Home, temas e navegação podem mudar? |
| Privacidade | O que é local, o que vai para servidores e quais consentimentos existem? |
| Ecossistema | Extensões, sync, contas e integrações estão maduros? |
| Custo de troca | Há importação, recuperação e caminho seguro de retorno? |

Regras da comparação:

- pesquise novamente no dia da execução;
- cite páginas oficiais de cada produto e fontes independentes quando uma conclusão exigir contexto;
- informe `Sim`, `Parcial`, `Não`, `Experimental` ou uma frase curta; não use notas arbitrárias;
- reconheça explicitamente onde Chrome, Edge, Opera, Arc ou Vivaldi são mais maduros;
- não confunda diferenciação desejada com superioridade comprovada;
- não alegue privacidade superior sem auditoria;
- não alegue desempenho superior sem benchmark controlado;
- não transforme market share em prova de qualidade;
- adicione uma nota curta explicando que recursos e políticas mudam com o tempo.

### 8.6 Galeria real

Selecione poucas capturas fortes entre os assets existentes. Priorize:

- Home escura;
- Home clara;
- personalização/temas;
- Moon Research com fontes;
- Moon Memory/sessão;
- nota vinculada ao material;
- workspaces, Foco ou Central de comandos quando a imagem estiver atual.

Cada imagem deve:

- corresponder ao runtime real;
- ter alt text que descreva conteúdo e propósito;
- usar caminho relativo correto;
- evitar repetição visual;
- manter tamanho razoável no GitHub;
- não conter dados pessoais;
- não apresentar mockups como produto funcional.

### 8.7 Arquitetura em visão rápida

Explique a arquitetura em linguagem acessível e, se útil, use um diagrama Mermaid pequeno:

```text
UI local → preload allowlisted → IPC validado → serviço de aplicação → Electron/SQLite
                                        └────→ páginas remotas em WebContentsView isolado
```

Mencione apenas elementos confirmados: Electron/Chromium, TypeScript, SQLite canônico, partições por perfil, conteúdo remoto isolado e testes. Direcione detalhes para `docs/architecture/`.

### 8.8 Privacidade e segurança

Explique claramente:

- onde ficam preferências, notas, memória e sessões;
- quando uma página é lida pelo Research;
- se existe ou não provedor externo de IA;
- como funcionam opt-in, edição, exportação e exclusão;
- limites da exclusão em backups e armazenamento físico;
- isolamento de perfis, convidado e janela privada;
- conteúdo web como dado não confiável;
- ausência de telemetria ou sync remoto, se confirmada;
- limites atuais de assinatura, updater e auditoria independente.

Evite transformar mecanismos de defesa em garantia absoluta.

### 8.9 Instalação e atualização

Separe:

- última release pública;
- execução para desenvolvimento;
- artefatos experimentais de CI, se forem acessíveis e apropriados;
- plataformas homologadas;
- backup e rollback;
- checksums e assinatura, quando existirem.

Nunca aponte um link como download atual sem verificar que ele existe. Não apresente builds locais como releases públicas. Explique a diferença entre `main`, prerelease e release estável.

### 8.10 Desenvolvimento e qualidade

Inclua comandos mínimos e reproduzíveis, derivados de `package.json`, para:

- instalar dependências;
- iniciar em desenvolvimento;
- verificar tipos;
- executar lint;
- executar testes unitários, integração, Electron/SQLite e E2E;
- gerar o build desktop.

Mostre contagens de testes somente com data/commit ou prefira ligar ao workflow. Não invente cobertura percentual.

### 8.11 Atalhos e uso diário

Use uma tabela curta com atalhos realmente conectados. Diferencie `Ctrl` e `Command` quando houver suporte confirmado.

### 8.12 Roadmap

Apresente o roadmap em horizontes, não como promessa de data. Separe:

- consolidação P0: compatibilidade, instalação, assinatura, updater, acessibilidade e desempenho;
- diferenciais P1: Research, memória, PDF, busca e sessões mais completas;
- plataforma futura: IA com provedor e consentimento, sync, extensões, plugins, Nexus School e mobile;
- itens bloqueados por infraestrutura, segurança ou validação.

### 8.13 Equipe

Use apenas informações confirmadas pelo projeto. A referência atual é:

| Pessoa | Responsabilidade a apresentar |
| --- | --- |
| **Julio L. Prates** | Criador e desenvolvedor; direção do projeto, visão de produto, ideias e decisões principais |
| **Ariel Apolinario** | Testes, busca e documentação de bugs; colaboração com ideias e marketing |
| **Luan Gonçalves** | Testes, busca e documentação de bugs; colaboração com ideias e marketing |
| **João Pedro Siqueira Melo** | Desenvolvimento e pequenas funcionalidades com valor prático no uso cotidiano |
| **Jonathan Santos** | Primeiro apoiador financeiro; gestão e coordenação de testes |
| **Thiago Barbosa** | Atualmente fora do projeto, sem tarefas ativas atribuídas |

Não invente cargos, biografias, links sociais, fotos ou feitos. Não deduza participação apenas por autoria Git. Não exponha e-mails. Se houver conflito de identidade, pare e solicite confirmação antes de alterar a seção.

### 8.14 Contribuição, bugs e comunidade

Inclua:

- link para issues;
- formato mínimo de um bom relato de bug;
- link para guia de contribuição e setup, se completos;
- pedido para remover dados pessoais dos logs;
- orientação para discutir mudanças grandes antes da implementação, quando apropriado.

Não anuncie Discord, fórum, site ou canal que não tenha sido verificado.

### 8.15 Licença e créditos

Informe licença MIT, dependências com licenças próprias e origem/licença dos wallpapers ou capturas quando necessário. Não atribua ao projeto marcas ou assets de terceiros.

## 9. Badges permitidos

Use poucos badges e somente quando o destino estiver correto. Candidatos possíveis, após verificação:

- versão da última release pública;
- status do workflow `Quality` na `main`;
- licença MIT;
- plataforma Electron;
- TypeScript;
- Windows/Linux quando houver build ou suporte comprovado.

Não use badges de:

- cobertura inexistente;
- downloads sem contexto;
- “stable” ou “production ready”;
- segurança auditada sem auditoria independente;
- macOS/mobile se não homologados;
- Vercel como prova de funcionamento do aplicativo desktop;
- IA operacional quando o provider estiver desativado.

## 10. Direção visual

O README deve combinar a identidade espacial do Moon com clareza editorial.

Diretrizes:

- usar a marca existente com proporção correta;
- manter uma imagem principal forte perto do topo;
- criar ritmo com tabelas e capturas, sem fazer uma colagem longa;
- limitar HTML ao necessário para centralização e dimensões de imagens;
- garantir boa leitura em temas claro e escuro do GitHub;
- evitar texto dentro de imagens como única fonte de informação;
- não depender de CSS externo ou recursos que o GitHub não renderiza;
- manter Mermaid simples e legível no mobile;
- verificar todos os caminhos relativos e âncoras.

## 11. Pesquisa competitiva obrigatória

Antes de montar a tabela comparativa, consulte fontes atuais. Comece por fontes primárias:

- Chrome: segurança, perfis, sync, extensões e recursos de produtividade;
- Microsoft Edge: Workspaces, sleeping tabs, Copilot e políticas de privacidade;
- Opera: sidebar, Ad Block, VPN, workspaces e IA;
- Arc: Spaces, Profiles, Split View e situação atual de manutenção/plataformas;
- Vivaldi: Workspaces, tab stacks, sessões, hibernação, painéis e personalização;
- Electron e Chromium: implicações de compatibilidade e ciclo de atualização;
- StatCounter apenas como estimativa de uso, nunca como ranking de qualidade.

Para toda afirmação temporal:

- registre data de consulta;
- use link direto para a fonte;
- diferencie documentação oficial de análise externa;
- não copie textos promocionais extensos;
- não use uma comparação que não possa ser mantida de forma responsável.

## 12. Estratégia de conteúdo

O README precisa funcionar em três níveis de leitura:

### Em 20 segundos

O leitor entende nome, proposta, maturidade, principal diferencial e vê o produto real.

### Em 2 minutos

O leitor entende o fluxo, recursos disponíveis, limitações, comparação e como experimentar.

### Em 10 minutos

O leitor encontra arquitetura, privacidade, instalação, qualidade, roadmap, equipe e contribuição.

Escreva cada seção para cumprir um desses níveis. Remova conteúdo que não ajuda nenhuma decisão.

## 13. Regras de precisão

Antes de afirmar que algo funciona, procure uma cadeia mínima de evidência:

```text
controle visível na UI
→ chamada/contrato conectado
→ implementação no processo responsável
→ persistência ou efeito real
→ teste ou reprodução correspondente
```

Se houver apenas um ou dois elos, classifique como parcial, fundação ou planejado.

Regras adicionais:

- um arquivo chamado `ai-*` não prova IA operacional;
- um teste com provider em memória não prova sync de produção;
- um target no `electron-builder.yml` não prova homologação naquela plataforma;
- um screenshot prova aparência naquele cenário, não compatibilidade geral;
- uma flag desligada deve ser tratada como recurso indisponível;
- uma release anterior não comprova o estado da `main`;
- ausência de issues públicas não significa ausência de bugs;
- CI verde não significa produto estável;
- criptografia em uma fundação isolada não significa cofre ou sync liberados;
- “VPN” só pode aparecer como disponível se houver infraestrutura e auditoria compatíveis.

## 14. Critérios de aceite do README

O trabalho só pode ser considerado concluído quando:

- o arquivo modificado é somente `README.md`;
- toda promessa possui evidência ou qualificação próxima;
- versão no código e última release pública estão claramente separadas;
- o hero explica o Moon sem jargão;
- “Por que usar” descreve benefícios concretos;
- o fluxo principal aparece antes dos detalhes técnicos;
- funcionalidades estão separadas por maturidade;
- a comparação usa fontes atuais e reconhece vantagens dos concorrentes;
- nenhuma tabela sugere superioridade não demonstrada;
- capturas são reais, atuais, licenciadas e têm alt text;
- instalação e comandos correspondem aos scripts reais;
- privacidade explica dados, consentimento, armazenamento e exclusão;
- roadmap não parece uma promessa de prazo;
- equipe usa nomes e responsabilidades confirmados;
- todos os links, âncoras e caminhos de imagens foram verificados;
- o Markdown renderiza corretamente no GitHub e em largura mobile;
- não há dados pessoais, segredos ou caminhos locais;
- `git diff --check` passa;
- o diff final não contém alterações fora do README.

## 15. Rubrica de qualidade

Avalie o resultado antes de entregar:

| Dimensão | Pontos | Pergunta de controle |
| --- | ---: | --- |
| Clareza da proposta | 15 | Uma pessoa entende o Moon e seu diferencial em 20 segundos? |
| Precisão factual | 20 | Toda afirmação importante foi verificada e qualificada? |
| Estrutura e leitura | 15 | É fácil encontrar valor, instalação, segurança e contribuição? |
| Prova visual | 10 | As imagens mostram o produto real e acrescentam informação? |
| Comparação | 10 | A tabela ajuda a escolher sem propaganda enganosa? |
| Privacidade e segurança | 10 | O leitor entende dados, consentimento, armazenamento e limites? |
| Experiência de desenvolvimento | 10 | Os comandos e links permitem começar sem adivinhação? |
| Marca e tom | 5 | O texto parece profissional, brasileiro e coerente com o Moon? |
| Manutenção | 5 | O README evita conteúdo frágil ou impossível de manter? |

Exija pelo menos **90/100**, sem permitir compensar uma falha de precisão factual com qualidade visual.

## 16. Processo obrigatório de execução

### Fase A — Descoberta

1. confirme repositório, branch, commit e worktree;
2. leia as fontes obrigatórias;
3. inventarie produto, provas, imagens, links e lacunas;
4. consulte GitHub e concorrentes sem escrever em serviços externos;
5. apresente o relatório inicial e a arquitetura editorial.

### Fase B — Rascunho

1. escreva o README completo em memória ou arquivo temporário fora do repositório;
2. revise promessa, maturidade e linguagem;
3. confira cada tabela contra as fontes;
4. reduza duplicações e mova detalhes profundos para links existentes;
5. confirme que nenhuma capacidade futura foi apresentada como atual.

### Fase C — Alteração única

1. edite somente `README.md`;
2. preserve histórico útil por meio de links;
3. use somente assets já versionados;
4. não formate ou regrave outros arquivos;
5. não atualize lockfile ou dependências.

### Fase D — Verificação

1. execute `git diff --check`;
2. confirme com `git status --short` que apenas `README.md` mudou;
3. verifique links relativos, imagens e âncoras;
4. renderize ou visualize o Markdown quando houver ferramenta segura;
5. confira leitura em largura desktop e mobile;
6. faça uma última auditoria de afirmações e dados pessoais.

Não execute build completo do navegador se somente o README mudou, salvo se uma instrução obrigatória do repositório exigir isso. A validação deve ser proporcional e focada no Markdown.

## 17. Formato da entrega final

Entregue nesta ordem:

1. **Resumo da transformação** — o que mudou na narrativa e por quê;
2. **Fontes consultadas** — caminhos do repositório e links externos principais;
3. **Matriz de verdade** — disponíveis, experimentais, fundações e planejados;
4. **Arquitetura do README** — ordem final e função de cada seção;
5. **Comparação** — metodologia, data e limitações;
6. **Imagens utilizadas** — caminho, conteúdo demonstrado e licença/origem;
7. **Verificações** — diff, links, imagens, renderização e arquivos alterados;
8. **Lacunas remanescentes** — informações que ainda dependem de confirmação humana;
9. **Arquivo final** — link para o `README.md` atualizado.

Use `CONCLUÍDO`, `PARCIAL`, `BLOQUEADO` e `NÃO COMPROVADO` sempre que o estado puder ser confundido.

## 18. Perguntas que o novo README deve responder

Antes de finalizar, leia o README como alguém que nunca ouviu falar do Moon e confirme que ele responde:

- Por que o Moon existe?
- Que tarefa ele torna mais simples hoje?
- Por que eu o escolheria para estudar ou trabalhar?
- Quanto tempo leva para perceber valor?
- O que o Research faz sem IA generativa?
- O que a memória guarda e como eu apago?
- Meus perfis e janelas privadas ficam separados?
- O que posso personalizar de verdade?
- Qual versão consigo baixar hoje?
- Posso atualizar sem perder dados e como volto atrás?
- Quais plataformas foram realmente testadas?
- Em que o Moon ainda perde para navegadores maduros?
- O que está planejado e quais gates faltam?
- Como reporto um bug ou contribuo?
- Quem mantém e testa o projeto?

## 19. Comando final

Comece pela descoberta read-only e apresente o relatório inicial antes de editar. Depois reconstrua integralmente o `README.md` dentro do limite desta tarefa. Seja ambicioso na clareza, no design editorial e na força da narrativa, e conservador em toda afirmação factual. O README deve fazer o Moon parecer tão profissional quanto o projeto conseguir provar — nunca mais maduro do que ele realmente é.
