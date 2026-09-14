# Matriz de compatibilidade do Moon Browser

Esta matriz separa garantias determinísticas de sondas externas sujeitas a rede, geolocalização, CAPTCHA e mudanças dos sites.

| Fluxo | Cobertura automática | Gate de PR | Limite conhecido |
| --- | --- | --- | --- |
| Cookies e sessão após redirect | fixture HTTP local real no Electron | obrigatório | não autentica contas de terceiros |
| Popup OAuth e `window.opener` | provider local com callback e fechamento | obrigatório | consentimento real depende do provedor |
| Queda do renderer | `forcefullyCrashRenderer()` e recarga limitada | obrigatório | não elimina falhas nativas do Chromium |
| TikTok | navegação externa opt-in, crash, título e user-agent | semanal/manual, informativo | anti-bot, região e login podem variar |
| Pinterest | tela de login externa opt-in, crash, título e user-agent | semanal/manual, informativo | OAuth completo exige credencial humana |
| Build Linux | AppImage, deb, rpm e pacman no Quality/Release | aprovado no commit `c0ca1ba` | artefato de CI, publicação permanece manual |
| Build Windows | setup, portátil e checksums no workflow de release | aprovado no commit `c0ca1ba` | artefato de CI; publicação foi ignorada |

Comandos:

- `npm run test:compat`: matriz local determinística.
- `npm run test:compat:external`: sondas reais de Pinterest e TikTok com `MOON_EXTERNAL_COMPAT=1`.
- `npm run quality`: typecheck, lint, unitários, integração e storage Electron.
- `npm run test:e2e`: todos os E2E, incluindo a matriz determinística.

As sondas externas nunca são usadas para afirmar que um login real foi concluído. Elas provam somente que a navegação abre, que o renderer permanece vivo e que detalhes internos não vazam para a interface.
