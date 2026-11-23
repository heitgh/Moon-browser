# Matriz pública de compatibilidade — alpha.8 em desenvolvimento

Estados: **funciona**, **funciona com limitação**, **não funciona**, **requer configuração**, **não testado**. Uma sonda que abre a URL não equivale a login, reprodução, pagamento ou uso de dispositivo. Esta matriz se refere ao código atual, não à prerelease alpha.5 publicada.

| Recurso ou site | Estado | Evidência e limite |
| --- | --- | --- |
| Cookies após redirect | Funciona | Fixture HTTP local no Electron (`site-compatibility.spec.ts`); não prova sites externos. |
| Popup OAuth e `window.opener` | Funciona | Fixture local real (`desktop-smoke.spec.ts`); consentimento de provedor externo não testado. |
| Recuperação de renderer | Funciona com limitação | Crash induzido e duas tentativas limitadas; crash nativo/GPU/OOM ainda possível. |
| GitHub | Não testado | Atalho e navegação existem; login, edição e passkeys não foram ensaiados. |
| Google e YouTube | Não testado | Atalhos/navegação existem; login, vídeo, codec, DRM e detecção de bot não validados. |
| Gov.br e bancos brasileiros | Não testado | Exigem contas de teste, ambiente autorizado e verificação de autenticação/passkeys. |
| Pinterest, WhatsApp Web, TikTok | Funciona com limitação | Sondas externas opt-in verificaram abertura, ausência de crash e UA sem `Electron`; login e uso prolongado não validados. |
| Netflix e Disney+ com Widevine | Não funciona | Não há provisionamento de CDM/Widevine no empacotamento; reprodução DRM não pode ser anunciada. |
| Spotify Web | Não testado | Reprodução, codec e DRM não ensaiados. |
| H.264 e AAC | Não testado | Presença de `canPlayType` ou `libffmpeg.so` não comprova decode real em todos os SOs. |
| WebAuthn/passkeys | Não testado | Exige authenticator físico/virtual e RP de teste. |
| WebUSB, WebHID, Web Bluetooth e Web Serial | Não testado | Exigem dispositivos e revisão das permissões por plataforma. |
| Extensões Manifest V3 | Não funciona na distribuição | ADR 0006 escolhe subconjunto desempacotado apenas para desenvolvimento; flag de produto desativada. |
| Auto-update AppImage/Windows instalado | Requer configuração | O código alpha.8 exige chaves/certificado de produção e release assinada; builds comuns usam página oficial. |
| macOS/ARM | Não testado | Nenhuma matriz de build, assinatura ou notarização publicada. |

O user-agent remove identificadores `Electron`/`MoonBrowser` (`browser/compatibility-policy.ts`), preservando a versão real do Chromium. Isso reduz falsos bloqueios simples, mas não garante que um site aceite o navegador.

Comandos: `npm run test:compat` executa fixtures determinísticos; `MOON_EXTERNAL_COMPAT=1 npm run test:compat:external` executa as sondas de Pinterest/WhatsApp/TikTok com rede. As sondas externas são informativas e não bloqueiam PR por variações de CAPTCHA, geolocalização e rede.

Estratégia de extensões: manter a decisão do [ADR 0006](../adr/0006-extensions.md). Avaliar um subconjunto explícito de MV3 em perfis persistentes, com permissões por host e revisão; plugins Moon terão isolamento próprio. Não promover a compatibilidade com Chrome Web Store antes de testes, assinatura, revogação e atualizações seguras.
