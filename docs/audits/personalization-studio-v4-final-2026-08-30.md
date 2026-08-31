# Moon Browser — auditoria final da Personalização V4

Data: 30 de agosto de 2026  
Branch local: `codex/personalization-studio-v4-2026-08-29`  
Base auditada: `d78522d`

## Resultado

O corte solicitado foi conectado ao runtime desktop real. Settings V4, biblioteca de temas, editor de ícones, Home editável, perfis locais, fundação de sync E2EE e fronteira do Moon Hub não são telas isoladas: usam os contratos, a persistência e os gates existentes do Moon Browser.

Moon Intelligence continua deliberadamente desativada. Não existe provider de produção, consentimento por site, budgets, memória controlável e backend seguro suficientes para ativá-la sem transformar intenção em promessa falsa.

## Checkpoints preservados

| Checkpoint | Entrega                                     |
| ---------- | ------------------------------------------- |
| `92cc3c0`  | Settings V4 transacional e schema canônico  |
| `590c89d`  | temas unificados e editor direto da Home    |
| `8504c01`  | perfis locais, sessões e partições isoladas |
| `8ace576`  | fundação offline-first e E2EE               |
| `6bbb871`  | fronteira segura e honesta do Moon Hub      |

## Entregas verificadas neste fechamento

### Settings e preview

- modos Simples e Avançado compartilham o mesmo documento V4;
- preview, aplicar, cancelar, undo/redo, escopo global/workspace e recuperação usam o store transacional;
- preview expandido representa wallpaper, regiões semânticas, chrome, ícones e widgets da Home;
- migrações V2/V3 para V4 são idempotentes e valores antigos recebem defaults seguros.

### Temas, ícones e wallpapers

- catálogo único para temas Moon, temas locais e `.moontheme`;
- cards com thumbnail determinística, origem/confiança, versão, capacidades, estado ativo, busca, filtro e ordenação;
- temas locais suportam nome, descrição, áreas incluídas, duplicação, favorito, uso, atualização e até dez revisões de rollback;
- o tema ativo local é reconhecido novamente ao reabrir o Studio pela configuração canônica aplicada;
- overrides de ícones semânticos persistem por perfil/workspace e passam pelo `IconRegistry`, sanitização e fallback nativo;
- importação de wallpaper local verifica tamanho, MIME permitido, magic bytes, decode e dimensões;
- GIF e WebP animados geram poster estático e podem ser pausados manualmente ou automaticamente por movimento reduzido, energia e visibilidade da Home;
- extração de paleta é local, explícita, one-shot e aplicada apenas ao preview até confirmação.

### Home e perfis

- editor direto da Home suporta pointer/mouse/touch e alternativa por teclado para mover e redimensionar;
- tray de conteúdo, presets, grid e posição do botão de nova aba continuam no mesmo modelo transacional;
- perfis locais isolam SQLite, partições Chromium, sessões e preferências; convidado é temporário;
- troca de perfil protege rascunho aberto e janela privada nunca entra na restauração normal.

### Segurança e produto futuro

- sync é uma engine offline-first com contratos E2EE e provider somente de fixture; produção permanece release-gated sem provider oficial;
- cofre usa backend em memória apenas em testes e a UI informa que o backend seguro do sistema não está disponível;
- Moon Hub possui somente contrato/fronteira e threat model; não há endpoint, OAuth, trust root, catálogo ou moderação fingidos;
- arquivos `.moontheme` continuam em quarentena e validação declarativa; nenhuma execução arbitrária foi adicionada.

## Gates executados

| Gate                                          | Resultado                 |
| --------------------------------------------- | ------------------------- |
| `npm run typecheck`                           | aprovado                  |
| `npm run lint`                                | aprovado                  |
| `npm run test:unit`                           | 108/108                   |
| `npm run test:integration`                    | 28/28                     |
| `npm run test:electron-storage`               | 15/15                     |
| `npm run test:e2e`                            | 8/8                       |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilidades        |
| `npm run screenshots:desktop`                 | aprovado                  |
| `npm run measure:ui`                          | aprovado                  |
| `npm run build:desktop`                       | AppImage e Debian gerados |

Artefatos locais:

- `release/Moon-Browser-0.5.0-demo.1-linux-x86_64.AppImage` — 134 MB;
- `release/Moon-Browser-0.5.0-demo.1-linux-amd64.deb` — 108 MB.

Medição desta máquina, sem alegação de p95: boot frio 714,1 ms; Home quente 24,4 ms; feedback da aba 0,7 ms; superfície da aba 0,5 ms; feedback do drawer 18,6 ms; drawer assentado 247,2 ms; Settings 115,6 ms.

## Evidência visual

- `assets/screenshots/personalization-v4-simple.png`;
- `assets/screenshots/personalization-v4-advanced.png`;
- `assets/screenshots/personalization-v4-preview-expanded.png`;
- `assets/screenshots/personalization-v4-theme-library.png`;
- `assets/screenshots/personalization-v4-theme-editor-icons.png`;
- `assets/screenshots/personalization-v4-home-editing.png`;
- `assets/screenshots/personalization-v4-home-final.png`;
- `assets/screenshots/personalization-v4-profiles.png`.

As capturas são produzidas pelo Electron real com perfil temporário via `npm run screenshots:desktop`; não são mocks de design.

## Limites explícitos

1. Wallpaper em WebM/MP4 não foi ativado. Um loader com streaming, limites de recursos e política de ciclo de vida ainda precisa ser desenhado; vídeos grandes não são convertidos para data URL.
2. Sync em nuvem não está disponível sem provider oficial, autenticação e políticas operacionais.
3. O cofre não persiste credenciais nesta build sem backend seguro do sistema operacional.
4. Moon Hub é contrato de integração, não serviço implantado.
5. Moon Intelligence permanece invisível e bloqueada até provider, consentimento, budgets, memória controlável, provenance, cancelamento, timeout e segurança completos.
6. A demo ainda não deve ser usada como navegador principal para dados críticos; o hardening de distribuição e cobertura multiplataforma continuam necessários.
