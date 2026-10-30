<div align="center">
  <img src="assets/branding/moon-icon.svg" alt="Moon Browser" width="92" />

# Moon Browser

### A browser that adapts to the way you work.

**Open-source desktop browser focused on deep customization, workspaces, local research tools and explicit user control.**

[![Quality](https://github.com/heitgh/Moon-browser/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/heitgh/Moon-browser/actions/workflows/quality.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-7C3AED.svg)](LICENSE)
[![Current prerelease](https://img.shields.io/badge/prerelease-v0.6.0--alpha.5-7C3AED.svg)](https://github.com/heitgh/Moon-browser/releases/tag/v0.6.0-alpha.5)
[![Alpha](https://img.shields.io/badge/main-0.6.0--alpha.5-9333EA.svg)](CHANGELOG.md)

[**Download**](#download) · [**Website**](https://moon-browser.vercel.app) · [**See the product**](#o-que-o-moon-propoe) · [**Contribute**](CONTRIBUTING.md) · [**Report a bug**](https://github.com/heitgh/Moon-browser/issues)

</div>

## Atualização v0.6.0-alpha.5 — publicada

Atualização nativa de Moon + Chromium no Windows instalado e Linux AppImage: consulta ao abrir e a cada seis horas, download com progresso e instalação após confirmação. O Chromium acompanha o Electron e exige um pacote novo do Moon; não há atualização isolada do Chrome. Windows portátil e demais pacotes Linux mantêm o link para instalação manual. Versões antigas precisam instalar esta atualização uma vez para receber o novo mecanismo.

A barra inferior acompanha downloads com progresso, velocidade, pausa, retomada e cancelamento. Esta versão também isola downloads anônimos, limita o tempo de encerramento e cria backup antes de migrar o perfil. Consulte [notas e limites de validação](docs/releases/v0.6.0-alpha.5.md). A atualização do motor não comprova resolução do login no WhatsApp Web.

Publicação [confirmada no workflow](https://github.com/heitgh/Moon-browser/actions/runs/40334618699): 292 testes por sistema passaram, com 3 probes externos pulados e auditoria sem vulnerabilidades. A execução independente de qualidade apresentou timeout intermitente no ensaio de encerramento Windows, seguido de EBUSY ao limpar arquivos; MB-016 continua aberto. Não há comprovação de correção definitiva do encerramento.

## Atualização v0.6.0-alpha.4

Segurança de IPC, origem de permissões, downloads de imagens com DNS fixado, gerenciamento de áreas, ícones locais e aviso de atualização estão disponíveis nesta pré-release.

Validação do workflow de release em Windows e Linux: typecheck/lint, 205 unitários, 35 de integração, 22 de armazenamento Electron e 16 E2E passaram, além de CodeQL e builds. Um workflow independente apresentou timeouts ao encerrar Electron; veja MB-016 e o relatório. Login com contas reais, uso prolongado do TikTok e GPU física continuam pendentes. A IA permanece desativada; seu protótipo local não está implementado neste pacote.

Consulte [evidências, limites e sequência de revisão](docs/review/next-update-validation.md). Logs locais opcionais podem ser habilitados com `MOON_LOCAL_DIAGNOSTICS=1`; não contêm URLs nem são enviados automaticamente.


![Moon Browser home with workspaces, search and shortcuts](assets/screenshots/update-home-dark.png)

> [!IMPORTANT]
> **Moon is experimental.** The current public prerelease is `v0.6.0-alpha.5`, built from the validated `main` branch. Do not use Moon as your only browser for critical data.

A `v0.6.0-alpha.5` adiciona atualização nativa Moon/Chromium e barra de downloads, além de proteção de downloads privados e migrações. Consulte as [notas da versão](docs/releases/v0.6.0-alpha.5.md).

**Atualização inicial:** instale a alpha.5 uma vez. A alpha.4 pode abrir a página oficial pelo aviso existente. Depois, Windows instalado e Linux AppImage oferecem download e instalação dentro do Moon, com confirmação; demais formatos mantêm a instalação manual.

## O que é o Moon?

O Moon é um navegador desktop open source construído sobre **Electron + Chromium**. O projeto explora uma ideia simples:

> **E se o navegador se adaptasse ao usuário, em vez de obrigar o usuário a se adaptar ao navegador?**

A proposta não é esconder a complexidade atrás de promessas de “IA mágica”. O foco atual é tornar navegação, organização, pesquisa e personalização mais controláveis por quem usa o computador todos os dias.

### O que o Moon propõe

| Pilar | Como aparece no produto |
| --- | --- |
| **Personalização profunda** | Home, layout, temas, ícones, wallpapers e posição das abas podem ser adaptados ao usuário. |
| **Organização por contexto** | Workspaces, favoritos, histórico, notas e sessões ajudam a separar assuntos e retomar trabalho. |
| **Research local** | A alpha consegue ler abas selecionadas, extrair trechos e salvar material com referência à fonte. |
| **Memória sob controle** | O usuário escolhe manualmente o que guardar, por categoria e workspace. Nada é capturado automaticamente só porque a categoria foi habilitada. |
| **Transparência** | Recursos experimentais, limitações, arquitetura e decisões de segurança são documentados no repositório. |

## Veja em ação

### Personalização e Home

<p align="center">
  <img src="assets/screenshots/update-home-light.png" alt="Moon Browser home in light appearance" width="49%" />
  <img src="assets/screenshots/update-home-wallpaper.png" alt="Moon Browser home with customized wallpaper" width="49%" />
</p>

### Research e notas

<p align="center">
  <img src="assets/screenshots/update-research.png" alt="Moon Research panel with referenced excerpts" width="46%" />
  <img src="assets/screenshots/update-study-note.png" alt="Moon Notes with material saved from Research" width="46%" />
</p>

As capturas acima vêm da alpha e usam dados de teste. Elas mostram cenários reais do projeto, mas não garantem o mesmo comportamento em toda plataforma ou máquina.

<a id="download"></a>
## Download

### Prerelease pública — `v0.6.0-alpha.5`

| Sistema | Download | Integridade |
| --- | --- | --- |
| **Windows x64** | [Instalador `.exe`](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Windows-x64-Setup.exe) · [Portátil `.exe`](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Windows-x64-Portable.exe) | [SHA-256](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/SHA256SUMS-windows.txt) |
| **Linux x64** | [AppImage](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Linux-x64.AppImage) · [DEB](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Linux-x64.deb) · [RPM](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Linux-x64.rpm) · [pacman](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/Moon-Browser-0.6.0-alpha.5-Linux-x64.pacman) | [SHA-256](https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.5/SHA256SUMS-linux.txt) |

[**Ver todas as releases →**](https://github.com/heitgh/Moon-browser/releases)

Para AppImage:

```bash
chmod +x Moon-Browser-0.6.0-alpha.5-Linux-x64.AppImage
./Moon-Browser-0.6.0-alpha.5-Linux-x64.AppImage
```

> A `v0.6.0-alpha.5` é uma prerelease pública. Windows e Linux possuem instaladores oficiais e checksums; macOS ainda não possui build publicado.

## Estado do projeto

### Etapa 1 em revisão — encerramento e recuperação

Esta branch acrescenta espera de gravações e destruição de páginas, checkpoint SQLite,
backup antes de atualizações e uma janela isolada quando o perfil não abre.
Na recuperação é possível restaurar um backup íntegro, exportar os arquivos brutos
ou criar um perfil independente sem apagar o anterior. Um registro danificado é
preservado antes de reconstrução confirmada. Backups SQLite não incluem cookies
ou partições Chromium; a exportação bruta não é criptografada.
Consulte [escopo, testes e limitações](docs/review/stage1-shutdown-recovery.md).
Esta implementação não altera os downloads da alpha.5 nem comprova a resolução
definitiva do MB-016 em todas as plataformas.

| Área | Estado atual |
| --- | --- |
| Navegação, abas e janelas | **Disponível / em evolução** |
| Workspaces, favoritos e histórico | **Disponível** |
| Home e personalização | **Disponível** |
| Notas locais | **Disponível** |
| Central de comandos e Foco/Zen | **Disponível** |
| Research local | **Experimental na alpha** |
| Memory e sessões nomeadas | **Experimental na alpha** |
| Extensões / plugins | **Fundação técnica; não liberado** |
| Sync e cofre | **Fundação técnica; produção bloqueada** |
| IA generativa | **Não disponível** |
| Extração de PDF | **Não disponível** |
| Atualizador automático assinado | **Não disponível** |
| macOS / ARM / mobile | **Não homologados** |

Para a matriz detalhada de implementação e validação, consulte [`docs/update/RELATORIO.md`](docs/update/RELATORIO.md) e [`docs/update/ARQUITETURA.md`](docs/update/ARQUITETURA.md).

## Privacidade e controle

O Moon tenta tornar explícito quando uma ferramenta lê ou guarda informação.

- Research trabalha somente com abas selecionadas no fluxo atual.
- A memória começa **desligada** por categoria e exige gravação manual.
- Preferências, workspaces, histórico, notas e memória ficam no armazenamento local do perfil.
- O Research atual **não usa IA generativa** nem envia conteúdo para um modelo externo.
- Janelas privadas usam partições efêmeras e não expõem Research/Memory.
- A memória não possui criptografia própria em repouso; a proteção local depende também do sistema operacional.

Esses mecanismos reduzem riscos, mas **não tornam o Moon anônimo, invulnerável ou mais privado que todos os concorrentes**. Consulte a documentação de segurança antes de usar dados sensíveis.

[**Security policy →**](SECURITY.md) · [**Threat model →**](docs/architecture/threat-model-final-update.md)

## Arquitetura em 30 segundos

```text
Interface local
  → preload com operações permitidas
  → IPC validado no processo principal
  → serviços da aplicação
      ├─ SQLite do perfil
      └─ páginas em WebContentsView isolado
```

**Stack principal:** TypeScript · Electron · Chromium · Node.js · SQLite · Playwright · Vitest · GitHub Actions

As páginas remotas não recebem acesso direto ao Node.js nem ao preload interno do Moon. Detalhes e decisões arquiteturais estão em [`docs/architecture`](docs/architecture/) e [`docs/adr`](docs/adr/).

## Rodando a alpha a partir do código

### Requisitos

- Node.js **22+**
- npm **10+**
- Git
- Python e toolchain C/C++ para módulos nativos
- bibliotecas gráficas exigidas pelo Electron no sistema

```bash
git clone https://github.com/heitgh/Moon-browser.git
cd Moon-browser
npm ci
npm run native:electron
npm run dev:desktop
```

### Qualidade

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run native:electron
npm run test:electron-storage
npm run test:e2e
```

O CI da `main` executa as verificações documentadas no workflow [`quality.yml`](.github/workflows/quality.yml).

## Roadmap

O Moon não promete datas para funcionalidades futuras. A prioridade atual é consolidar a experiência desktop antes de ampliar o escopo.

### Agora

- compatibilidade e estabilidade do desktop;
- instalação, atualização e recuperação;
- acessibilidade e desempenho;
- amadurecimento de Research/Memory;
- validação com usuários externos.

### Depois

- PDF e busca mais inteligente;
- sessões mais completas;
- infraestrutura real de sync/cofre;
- avaliação responsável de IA integrada;
- extensões e plugins com modelo de segurança definido;
- expansão de plataforma somente após validação.

Veja o histórico e decisões em [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap`](docs/roadmap/) e [`docs/adr`](docs/adr/).

## Contribua

Contribuições úteis não precisam começar com uma grande feature. Bons primeiros passos incluem:

- reproduzir e documentar bugs;
- melhorar acessibilidade;
- testar em distribuições Linux e versões do Windows;
- melhorar documentação;
- adicionar testes para comportamentos já existentes;
- propor melhorias de UX partindo de um problema concreto.

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir um PR.

[**Abrir bug**](https://github.com/heitgh/Moon-browser/issues/new/choose) · [**Ver issues**](https://github.com/heitgh/Moon-browser/issues) · [**Guia de suporte**](SUPPORT.md) · [**Código de conduta**](CODE_OF_CONDUCT.md)

## Para quem quer divulgar ou escrever sobre o projeto

Criamos um pequeno [`Media Kit`](docs/MEDIA_KIT.md) com descrição oficial, estado atual, diferenciais, stack, links e termos recomendados. Ele existe para manter posts, vídeos e matérias alinhados ao que o Moon realmente entrega hoje.

## Equipe

O Moon é desenvolvido pela **Nexus Inc.** com participação em desenvolvimento, testes, documentação, produto e marketing.

- **Julio L. Prates** — criação, desenvolvimento e direção do projeto.
- **Ariel Apolinario** — testes, bugs, ideias e marketing.
- **Luan Gonçalves** — testes, bugs, ideias e marketing.
- **João Pedro Siqueira Melo** — desenvolvimento e funcionalidades.
- **Jonathan Santos** — apoio, gestão e coordenação de testes.

## Licença

Moon Browser é distribuído sob a [licença MIT](LICENSE). Electron, Chromium e demais dependências mantêm suas próprias licenças e marcas.

---

<div align="center">

### Built for people who live on their computers.

**Explore. Organize. Customize. Keep control.**

[Website](https://moon-browser.vercel.app) · [Releases](https://github.com/heitgh/Moon-browser/releases) · [Issues](https://github.com/heitgh/Moon-browser/issues) · [Media Kit](docs/MEDIA_KIT.md)

</div>

### Proteção de acesso integrada (PR #39, ainda não publicada)

Em **Gerenciar perfis → Segurança do perfil**, a próxima atualização permite ativar senha, alterá-la/removê-la com a senha atual, bloquear agora e configurar inatividade. O bloqueio pela tela do sistema é específico de Windows/macOS. A janela isolada exige senha antes de carregar o perfil; a proteção também é aplicada no processo principal ao IPC.

A senha impede acesso casual pelo aplicativo, mas **não criptografa os arquivos**. Não há recuperação de senha nesta implementação: o aviso nativo precisa ser confirmado ao ativar. Quem controla a conta e os arquivos do sistema pode remover essa proteção. Consulte os [passos de teste e limites](docs/review/stage2-profile-access.md). A matriz de testes e builds Windows/Linux passou no PR #39; os downloads públicos permanecem na versão publicada.

### Recursos em revisão (etapa 3, ainda não publicada)

**Menu Moon → Recursos** ou **Ctrl/Cmd+Shift+E** abre RAM, CPU, processos únicos e páginas pesadas. A opção do próprio painel adiciona o botão à sidebar. O consumo por aba corresponde ao processo inteiro, que pode ser compartilhado; amostras indisponíveis ou parciais são identificadas. Ainda não há suspensão nesta etapa. Consulte os [limites e passos de teste](docs/review/stage3-resource-monitor.md).
