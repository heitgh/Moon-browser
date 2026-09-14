<div align="center">
  <img src="assets/branding/moon-icon.svg" alt="Moon Browser" width="92" />

# Moon Browser

### A browser that adapts to the way you work.

**Open-source desktop browser focused on deep customization, workspaces, local research tools and explicit user control.**

[![Quality](https://github.com/heitgh/Moon-browser/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/heitgh/Moon-browser/actions/workflows/quality.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-7C3AED.svg)](LICENSE)
[![Public demo](https://img.shields.io/badge/public%20demo-v0.5.0--demo.2-2563EB.svg)](https://github.com/heitgh/Moon-browser/releases/tag/v0.5.0-demo.2)
[![Alpha](https://img.shields.io/badge/main-0.6.0--alpha.1-9333EA.svg)](CHANGELOG.md)

[**Download**](#download) · [**Website**](https://moon-browser.vercel.app) · [**See the product**](#o-que-o-moon-propoe) · [**Contribute**](CONTRIBUTING.md) · [**Report a bug**](https://github.com/heitgh/Moon-browser/issues)

</div>

![Moon Browser home with workspaces, search and shortcuts](assets/screenshots/update-home-dark.png)

> [!IMPORTANT]
> **Moon is experimental.** The public download is `v0.5.0-demo.2`. The `main` branch currently contains `0.6.0-alpha.1`, including work that is not yet available in the public demo. Do not use Moon as your only browser for critical data.

A correção candidata foi validada na branch/PR separada: recuperação limitada de páginas travadas, compatibilidade de sessão/OAuth, sondas para Pinterest e TikTok e um padrão visual mais compacto. Quality, CodeQL, matriz de compatibilidade e builds de Windows/Linux passaram no commit `c0ca1ba`; login humano e publicação continuam pendentes. Consulte a [auditoria de compatibilidade](docs/audits/compatibility-stability-2026-09-14.md) e a [matriz de testes](docs/roadmap/compatibility.md). Isso **não altera os downloads públicos**.

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

As capturas acima vêm da alpha e usam dados de teste. Elas mostram cenários reais do projeto, mas não significam que todos esses recursos já estejam presentes na demo pública `v0.5.0-demo.2`.

<a id="download"></a>
## Download

### Demo pública — `v0.5.0-demo.2`

| Sistema | Download | Integridade |
| --- | --- | --- |
| **Windows x64** | [Instalador `.exe`](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Windows-x64-Setup.exe) · [Portátil `.exe`](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Windows-x64-Portable.exe) | [SHA-256](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/SHA256SUMS-windows.txt) |
| **Linux x64** | [AppImage](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Linux-x64.AppImage) · [DEB](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Linux-x64.deb) · [RPM](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Linux-x64.rpm) · [pacman](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/Moon-Browser-Linux-x64.pacman) | [SHA-256](https://github.com/heitgh/Moon-browser/releases/download/v0.5.0-demo.2/SHA256SUMS-linux.txt) |

[**Ver todas as releases →**](https://github.com/heitgh/Moon-browser/releases)

Para AppImage:

```bash
chmod +x Moon-Browser-Linux-x64.AppImage
./Moon-Browser-Linux-x64.AppImage
```

> A demo pública é anterior ao Research/Memory mostrado nas capturas da alpha. A versão atual da `main` ainda não possui instalador público oficial.

## Estado do projeto

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
