# Auditoria de estabilidade e compatibilidade — 2026-09-14

## Escopo

Revisão do repositório oficial `heitgh/Moon-browser` (main em `289a986`) e comparação histórica com `heitgh/Moon-tests-1`. O histórico conserva a fundação Electron/TypeScript; o oficial evoluiu para 0.6.0-alpha.1 com perfis, SQLite, Settings V4, E2E e documentação adicionais. Nenhum código foi copiado cegamente do protótipo.

## Diagnóstico confirmado no código

| Sintoma | Causa encontrada | Correção |
| --- | --- | --- |
| OAuth/Pinterest não conclui | aberturas com disposition `default` viravam abas, perdendo semântica de popup/opener | classificador de autenticação e popup sandboxed com a mesma `Session` |
| sites discriminam o runtime | user-agent preservava token `Electron/x` | normalização para a identidade real do Chromium |
| navegação/login bloqueia | toda requisição entrava no AdBlock e política assíncrona não tinha deadline | bypass mínimo de main frame/identidade e timeout de 1,5 s com fail-open |
| TikTok/renderer cai | `render-process-gone` apenas emitia erro | recarga progressiva, no máximo duas vezes, mais tratamento de `unresponsive` |
| detalhes internos aparecem | `did-fail-load` enviava descrição bruta | mensagens estáveis por categoria de erro |
| interface pesada | padrão confortável usava 48 px, sidebar 56 px, tabs 240 px e workspace sempre visível | novo padrão compacto; controles avançados e documentos existentes preservados |

## Mudanças implementadas

- `compatibility-policy.ts`: user-agent, classificação de falha e bypass restrito.
- `window-open-policy.ts`: reconhecimento de OAuth/SSO e popup programático.
- `browser-manager.ts`: sessão compatível, redirects seguros e recuperação limitada.
- `session-request-pipeline.ts`: deadline por política.
- `adblock-service.ts`: exceções mínimas de compatibilidade.
- `professional-compact.css` e defaults V4: chrome compacto, touch targets em ponteiro coarse, drawer overlay e Home minimalista.
- testes unitários, E2E determinístico e workflow externo semanal/manual.

## Validação

Status do commit de código `c0ca1ba`: **aprovado no GitHub Actions em 14 de setembro de 2026**.

- [Quality #56](https://github.com/heitgh/Moon-browser/actions/runs/34844035905): typecheck e lint aprovados; 141 unitários, 34 de integração, 20 Electron/SQLite e 11 E2E aprovados; 2 probes externos ignorados nesse job; audit no nível alto aprovado com 2 vulnerabilidades moderadas registradas; build Linux aprovado.
- [Site compatibility #8](https://github.com/heitgh/Moon-browser/actions/runs/34844035967): 1 teste determinístico aprovado em 13,8 s e 2 probes externos (Pinterest/TikTok) aprovados em 14,0 s. [Captura/trace do modo compacto](https://github.com/heitgh/Moon-browser/actions/runs/34844035967/artifacts/10347121607).
- [CodeQL #59](https://github.com/heitgh/Moon-browser/actions/runs/34844035895): aprovado.
- [Desktop Releases #30](https://github.com/heitgh/Moon-browser/actions/runs/34844036179): setup/portátil Windows e AppImage/deb/rpm/pacman Linux, com checksums, aprovados como artefatos temporários. A etapa de publicação foi ignorada.

## Limites

- Login real de Pinterest/Google exige interação e credenciais do usuário; a automação valida o contrato técnico, não afirma autenticação de conta.
- TikTok e Pinterest podem variar por região, CAPTCHA, anti-bot e versão entregue pelo servidor.
- Duas recargas reduzem o impacto do crash, mas não corrigem bugs nativos do Chromium, driver gráfico ou falta de memória do sistema.
- O novo padrão vale para perfis novos; preferências existentes são preservadas.
- Windows e macOS ainda exigem homologação própria.

## Distribuição

Após autorização, o PR #21 foi mesclado no commit `3084063` e a prerelease [`v0.6.0-alpha.2`](https://github.com/heitgh/Moon-browser/releases/tag/v0.6.0-alpha.2) foi publicada com seis instaladores/pacotes e dois arquivos de checksums. O workflow de publicação #33 foi aprovado.