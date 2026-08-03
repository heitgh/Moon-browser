# 🌙 Moon Browser

<p align="center">
  <img src="assets/Moon.png" alt="Moon Browser Logo" width="220" />
</p>

<h3 align="center">O Navegador Inteligente, Ergonômico e Hiper-Personalizável para Heavy Users</h3>

<p align="center">
  <a href="https://www.catarse.com.br/posts/moon-browser?from=profile_list">
    <img src="https://img.shields.io/badge/Catarse-Apoie_o_Projeto-FF4858?style=for-the-badge&logo=catarse&logoColor=white" alt="Apoie no Catarse" />
  </a>
  <a href="https://discord.gg/skb4s8KWW">
    <img src="https://img.shields.io/badge/Discord-Entrar_no_Servidor-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Community" />
  </a>
  <a href="#-licença">
    <img src="https://img.shields.io/badge/License-MPL_2.0-blue?style=for-the-badge" alt="License" />
  </a>
</p>

<p align="center">
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-seja-um-apoiador-fundador-catarse">Apoiar no Catarse</a> •
  <a href="#-comunidade-no-discord">Discord</a> •
  <a href="#-pilares-do-moon">Pilares</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-estrutura-do-repositorio">Estrutura</a> •
  <a href="#-como-começar">Como Começar</a> •
  <a href="#-desenvolvedores">Desenvolvedores</a>
</p>

---

> 🚀 **Ajude a financiar o Moon Browser e receba Acesso Antecipado!**  
> Estamos com uma campanha aberta no Catarse para quem deseja testar as compilações *Alpha/Beta* antes do lançamento oficial e ajudar na construção do navegador.  
> 🔗 **[Clique aqui para apoiar o Moon Browser no Catarse](https://www.catarse.com.br/posts/moon-browser?from=profile_list)**  
> 💬 **[Junte-se à nossa comunidade no Discord](https://discord.gg/skb4s8KWW)**

---

## 🌙 Sobre o Projeto

O **Moon Browser** é um navegador de alta performance construído **dos usuários para os usuários**. Ele foi projetado especificamente para desenvolvedores, pesquisadores, designers e profissionais que passam **mais de 8 horas por dia no computador**.

Combinando o minimalismo fluido e ergonômico com um nível insano de customização, o Moon redefine a experiência de navegação através da **Ergonomia Cognitiva e Visual**. Em vez de você se adaptar ao navegador, o Moon adapta sua interface, cores, tipografia e fluxo de trabalho de acordo com suas necessidades e nível de fadiga visual ao longo do dia.

---

## 🤝 Seja um Apoiador Fundador (Catarse)

O Moon Browser é um projeto totalmente independente e focado em privacidade. Não dependemos de corporações de anúncios ou investidores que comprometam seus dados.

Ao apoiar nossa campanha no Catarse, você garante:
* 🔑 **Acesso Antecipado (Early Build Access):** Teste as compilações do Moon meses antes do público geral.
* 💬 **QG dos Fundadores:** Acesso a canais exclusivos no Discord diretamente com os criadores para sugerir *features* e reportar bugs.
* 🏅 **Eternizado nos Créditos:** Seu nome gravado na aba oficial de Apoiadores Fundadores do navegador.

👉 **[Acesse nossa página no Catarse e garanta sua recompensa!](https://www.catarse.com.br/posts/moon-browser?from=profile_list)**

---

## 💬 Comunidade no Discord

Quer acompanhar o desenvolvimento em tempo real, dar sugestões, relatar bugs ou simplesmente trocar uma ideia com a equipe? 

Entrar na nossa comunidade no Discord é a melhor forma de se manter atualizado sobre o futuro do **Moon Browser**.

👉 **[Clique para entrar no Servidor do Discord](https://discord.gg/skb4s8KWW)**

---

## ⚡ Pilares do Moon

### 👁️ 1. Ergonomia Visual (Foco Anti-Fadiga)
* **Circadian Engine Nativo:** Ajusta automaticamente a temperatura de cor (luz azul) da interface e das páginas em sincronia com o relógio biológico.
* **Smart Dark Mode Adaptativo:** Inverte cores de páginas claras sem destruir a paleta visual de imagens e vídeos.
* **Tipografia Legível:** Suporte nativo a fontes de alta legibilidade.
* **Alertas de Descanso (Regra 20-20-20):** Lembretes sutis e não-intrusivos para pausa e descanso ocular.

### 🧠 2. Ergonomia Cognitiva & Modos de Contexto (Workspaces)
* **Modo Zen (Foco Extremo):** Interface 100% limpa. Oculta abas e barra de navegação, revelando-as dinamicamente ao aproximar o cursor do mouse.
* **Modo Dashboard (Multitarefa Pro):** Abas verticais retráteis, painéis laterais de ferramentas rápidas (notas, downloads, favoritos e extensões).
* **Hibernação Inteligente de Abas:** Gerenciamento otimizado de recursos para manter o consumo de RAM sempre sob controle.

### 🎨 3. Hiper-Personalização No-Code
* **Interface Totalmente Modular:** Alterne módulos na barra lateral (favoritos, histórico, notas, tradutor e extensões) de acordo com o seu fluxo de trabalho.
* **Barra Lateral e Gavetas Flutuantes (Drawers):** Acesso instantâneo a ferramentas internas sem precisar trocar de aba.

---

## 🛠️ Tech Stack

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Framework Base** | **Electron** | Ambiente de execução multiplataforma unindo Chromium e Node.js. |
| **Interface (UI)** | **HTML5, CSS3 Moderno, JavaScript (ES6+)** | UI altamente reativa, estilizada nativamente para performance rápida. |
| **Gerenciamento de Navegação** | **Electron Webview / WebContents** | Controle isolado, seguro e modular de abas e sessões web. |
| **Armazenamento Local** | **LocalStorage / JSON** | Persistência leve e rápida de configurações, notas e estados do navegador. |

---

## 📂 Estrutura do Repositório

```text
Moon-browser/
├── assets/             # Ícones, imagens e recursos visuais do projeto
├── index.html          # Interface principal do navegador (Toolbar, Sidebar, Drawers)
├── main.js             # Processo principal do Electron (Janela, ciclo de vida)
├── package.json        # Dependências e scripts de execução do Node.js
├── .gitignore          # Arquivos e pastas ignorados pelo Git (ex: node_modules)
└── README.md           # Documentação e apresentação do projeto
