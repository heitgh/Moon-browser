# Moon Browser — auditoria da Personalização V2, Fase 1

Data: 25 de agosto de 2026  
Escopo: personalização efetivamente conectada ao navegador Electron ativo.

## Veredito

A Fase 1 foi implementada como uma única fonte de verdade versionada, aplicada em tempo real ao shell que o usuário utiliza. Não há tela demonstrativa independente: Home, toolbar, layout, busca e aparência consomem o mesmo estado V2. Preferências antigas são migradas de forma recuperável e a bridge desktop oferece importação e exportação validadas.

## Caminho conectado

```text
CustomizationCenter
  -> CustomizationStore (preview / histórico / persistência V2)
  -> CustomizationApplier (CSS variables e atributos do shell)
  -> BrowserShell, HomeView e Toolbar ativos

Importação/exportação
  -> preload.cjs com APIs explícitas
  -> product-ipc.ts com validação e diálogo nativo
```

## Capacidades entregues

- Aparência: cores com contraste verificado, modo claro/escuro/sistema/agendado, transparência, formas, movimento, wallpaper local, cor, gradiente e wallpaper HTTPS opt-in.
- Layout: barra lateral, drawers, toolbar, omnibox, densidade e controles reais da janela.
- Home: presets, grid, largura/opacidade de cards, ordem/visibilidade de widgets e atalhos abertos na aba atual ou nova aba.
- Tipografia: família sanitizada, escalas de contexto e labels.
- Pesquisa: provedor padrão, provedores personalizados e keywords.
- Dados: escopo global/workspace, temas salvos, import/export V2, restauração do último estado válido, migração V1, preview/cancelar, undo/redo e reset por grupo.

## Segurança e recuperação

- O schema limita tamanhos, valida contraste e proíbe templates de busca e fontes inseguros.
- A importação só persiste conteúdo V2 completamente validado; o último estado válido permanece como fallback.
- A imagem remota não é carregada pelo renderer: o processo principal exige HTTPS na porta 443, rejeita destinos locais/privados, limita redirects, MIME e 1,5 MB e devolve dados locais.
- A CSP restritiva existente não foi relaxada.

## Código retirado ou substituído

Os editores de customização, Home/widgets e settings históricos que não participavam do runtime foram removidos somente após a central V2, `HomeView` e `Toolbar` ativos assumirem suas funções. O arquivo de entrada público passa a exportar apenas os módulos de personalização conectados.

## Cobertura reproduzida

| Gate | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm run test:unit` | passou: 22 testes |
| `npm run test:integration` | passou: 14 testes |
| `npm run test:e2e` | passou: 4 testes Electron |
| `npm run screenshots:desktop` | passou: Home, proteção e central V2 capturadas |

## Fora desta fase

Não são declarados prontos: configuração profunda de abas e painéis, Quick Commands/gestos, configurações por site, Zen/Circadian avançado, nem recursos de IA, extensões, VPN ou updater. Esses itens exigem seus próprios cortes verticais e critérios de aceite.
