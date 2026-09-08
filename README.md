<div align="center">
<img src="assets/branding/moon-logo.svg" alt="Logo Moon Browser" width="120">

# Moon Browser

**Pesquisa com fontes, notas locais e sessões que você pode retomar.**

Navegador desktop da Nexus Inc., construído com Electron, Chromium e TypeScript.

</div>

## Estado desta versão

**0.6.0-alpha.1 — experimental, preparada localmente; não publicada.**

Esta atualização preserva a base 0.5 Demo e acrescenta um fluxo de estudo local. Não deve ser anunciada como estável nem como uma IA generativa operacional. O relatório distingue testes aprovados, recursos parciais e bloqueios de distribuição.

![Home escura do Moon 0.6 com navegação, workspaces e personalização](assets/screenshots/update-home-dark.png)

## O que está disponível

| Área | Estado e limite |
| --- | --- |
| Navegação, abas, workspaces, favoritos e histórico | Funcionais no runtime desktop; compatibilidade universal não comprovada |
| Perfis locais, janela privada e sessões restauráveis | Persistência SQLite e partições separadas; regressões com perfis temporários |
| Home, temas e wallpapers | Personalização V4, importação validada, paleta local opcional, preview e reversão |
| Downloads, permissões e bloqueador | Integrações nativas existentes; reputação de downloads não equivale a um antivírus |
| Moon Research | **Experimental funcional:** leitura de até cinco abas HTML/texto, trechos referenciados, comparação inicial, cartões e roteiro de revisão |
| Notas | Markdown, fontes, pastas, tags, histórico de versões e exportação |
| Moon Memory | **Experimental funcional:** gravação manual, opt-in por categoria e workspace, edição, expiração e exclusão |
| Sessões nomeadas | Lista de até 50 URLs elegíveis por snapshot; prévia, seleção parcial e restauração sem duplicar URLs já abertas no workspace |
| Busca local | Central de comandos com abas, histórico, favoritos, notas do workspace, downloads, configurações e comandos |
| IA generativa e PDFs no Research | **Indisponíveis:** sem provedor configurado; a seleção de trechos não é um resumo inteligente nem resposta semântica |
| Sync remoto, VPN, cofre persistente e atualizador automático | Desativados ou incompletos; não fazem parte da promessa desta versão |
| Extensões, plugins e aplicações móveis | Contratos e planejamento; não são produtos liberados |

## Experimentar o fluxo de estudo

1. Abra uma página HTML com material não sensível e clique em **Moon Research** na barra lateral.
2. Escolha de uma a cinco abas deste workspace e autorize a leitura local.
3. Escolha trechos principais, leitura detalhada, localização por pergunta, comparação, cartões ou roteiro de estudo.
4. Confira os trechos e as referências. O modo local copia passagens; não verifica a veracidade da página nem interpreta perguntas como um modelo de linguagem.
5. Salve como nota ou exporte Markdown. Encontre a nota na Central de comandos com `Ctrl+Shift+P`.
6. Em **O que o Moon lembra sobre mim?**, habilite somente as categorias desejadas. Escolha **Sessões**, dê um nome e guarde as URLs abertas elegíveis.
7. Ao voltar, abra a lembrança, selecione as páginas e clique em **Retomar**. As notas permanecem no perfil; não são duplicadas pelo snapshot.

![Pesquisa local mostrando trechos e a página usada como fonte](assets/screenshots/update-research.png)

![Memória do workspace com sessão nomeada e escolha de páginas para retomada](assets/screenshots/update-memory.png)

![Nota Markdown com os trechos e as referências preservadas](assets/screenshots/update-study-note.png)

## Privacidade e memória

- A pesquisa desta versão não usa provedor externo, API paga, chave ou modelo generativo. Conteúdo capturado fica temporariamente no painel até uma ação explícita de salvar ou exportar.
- Leitura e memória são bloqueadas no processo principal para janelas privadas e de convidado. As fontes precisam pertencer à janela e ao workspace selecionados.
- O extrator ignora formulários, campos editáveis, scripts e elementos ocultos. Páginas com senha, marcação de sensibilidade ou URLs possivelmente sensíveis são recusadas. **Essas heurísticas não identificam todo dado sensível**; confira o material antes de autorizar.
- Categorias: preferências, projetos, páginas salvas, notas e sessões. Todas começam desligadas. Nenhuma categoria realiza captura automática.
- Lembranças ficam no SQLite do perfil, separadas por workspace. O formato é versionado, com limite de 100 itens/2 MB por workspace e expiração de novas lembranças em 7, 30 ou 90 dias.
- Desativar categoria impede novas gravações. Itens existentes continuam visíveis para consulta e exclusão. **Esquecer**, **Apagar categoria** e **Apagar toda a memória deste workspace** removem os registros ativos. Exportações e backups são arquivos separados e não são apagados automaticamente; exclusão não é uma garantia de apagamento forense de SQLite/WAL ou do disco.
- A memória não possui criptografia própria em repouso. Use-a somente para material não sensível. O acesso local depende das proteções do sistema operacional.
- Telemetria e sincronização remota continuam desativadas. A navegação normal e o bloqueador existente podem realizar suas próprias requisições; isso é separado da pesquisa local.

## Instalação, atualização e recuperação

Os artefatos desta alpha são locais. Consulte a [matriz e os checksums](docs/update/RELATORIO.md) antes de distribuir qualquer arquivo. Downloads da versão anterior continuam no [histórico de releases](https://github.com/heitgh/Moon-browser/releases).

Para experimentar um AppImage local em **perfil separado**:

```bash
chmod +x Moon-Browser-0.6.0-alpha.1-Linux-x64.AppImage
./Moon-Browser-0.6.0-alpha.1-Linux-x64.AppImage --user-data-dir="$HOME/.local/share/moon-alpha-test"
```

Para atualizar um perfil existente, feche todas as janelas, faça uma cópia integral do diretório de dados e siga o [procedimento de migração e rollback](docs/update/MIGRACAO.md). A exportação antiga em JSON não representa todos os dados Chromium, notas estruturadas e memória nova; não a use como único backup.

Requisitos de desenvolvimento: Node.js 22 ou superior, npm 10 ou superior, Python e ferramentas C/C++ para SQLite. O desktop depende das bibliotecas gráficas do Electron. Windows x64 exige validação em Windows; macOS, ARM, Android e iOS não estão homologados nesta entrega.

## Desenvolvimento e testes

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run native:electron
npm run test:electron-storage
npm run test:e2e
npm run build:desktop
```

Build local com alvos Linux específicos, sempre sem publicação:

```bash
npm run build:desktop -- --linux AppImage deb pacman
```

RPM requer `rpmbuild`. Os testes E2E exigem sessão gráfica e permissão para iniciar um servidor local. Perfis de teste são temporários; não reutilize perfis pessoais. A suíte DOM possui armazenamento isolado para compatibilidade com o Node 26.

A flag `research` permite desligar o módulo experimental. A flag `ai` permanece bloqueada. Veja [arquitetura e limites](docs/update/ARQUITETURA.md), [relatório e matriz](docs/update/RELATORIO.md) e [notas da versão](docs/releases/v0.6.0-alpha.1.md).

## Atalhos

| Ação | Atalho |
| --- | --- |
| Nova aba | Ctrl+T |
| Nova janela privada | Ctrl+Shift+N |
| Central de comandos | Ctrl+Shift+P |
| Configurações | Ctrl+, |
| Workspaces | Ctrl+Shift+W |
| Foco/Zen | Ctrl+Shift+Z |
| Salvar nota no editor | Ctrl+S |

No macOS, vários controles usam Command; esse sistema ainda exige homologação desta versão.

## Equipe

- **Julio L. Prates** — criador e desenvolvedor; diretor-chefe do projeto, responsável pela visão de produto, ideias e decisões principais.
- **Ariel Apolinario** — testes, busca e documentação de bugs; colaboração com ideias e marketing.
- **Luan Gonçalves** — testes, busca e documentação de bugs; colaboração com ideias e marketing.
- **João Pedro Siqueira Melo** — desenvolvimento e adição de pequenas funcionalidades com valor prático no cotidiano. Nome confirmado pelo responsável durante esta atualização.
- **Jonathan Santos** — primeiro apoiador financeiro; gestão e coordenação de testes.
- **Thiago Barbosa** — atualmente fora do projeto, sem tarefas ativas atribuídas.

## Roadmap e limitações

Prioridades seguintes: provedor de IA real com consentimento e armazenamento seguro de chaves; PDFs e citações verificáveis; busca integrada à omnibox; sessões com grupos e posição de leitura; testes de acessibilidade assistiva e desempenho prolongado; atualização assinada e homologação de instaladores por plataforma. Integrações Nexus School e Obsidian permanecem futuras.

Para reportar bugs, informe versão, sistema, passos, esperado e observado, usando dados fictícios e logs sem dados pessoais. Use os [issues do projeto](https://github.com/heitgh/Moon-browser/issues); criar esta atualização não publica automaticamente um issue.

## Licenças e histórico

Código sob [MIT](LICENSE). Electron/Chromium e dependências mantêm suas próprias licenças, incluídas nos pacotes quando fornecidas pelas ferramentas. O wallpaper `update-gradient.png` é uma imagem procedural criada nesta atualização e segue a licença do projeto. Os SVGs locais usados nas demais capturas já pertenciam à base; nenhum wallpaper externo foi baixado.

As capturas mostram o produto executado com dados fictícios. Não representam funcionalidades de IA generativa.

A [versão 0.5 Demo](docs/releases/v0.5.0-demo.2.md), as auditorias anteriores e o histórico Git foram preservados. Consulte a [pesquisa e as decisões desta atualização](docs/update/PESQUISA.md).
