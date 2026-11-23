# Auditoria Moon Browser — 23 de novembro de 2026

Base examinada antes das edições: `3715c6ad1a6692626759866e44722c2d98797231` (`0.6.0-alpha.7`). As referências de linha abaixo apontam para os arquivos atuais quando a correção está presente; o diagnóstico original foi feito sobre essa base. **Esta auditoria não homologa o produto para uso bancário ou distribuição estável.**

## Inventário verificado

| Camada | Código e configuração |
| --- | --- |
| Processo principal e janelas | `main.js` → `apps/desktop/electron/main/main.ts`; `window-manager.ts`, `profile-access-controller.ts`, janela de recuperação e popups em `browser-manager.ts` |
| Preload e renderers | `preload.cjs`, `zoom-preload.cjs`, `access-preload.cjs`, `recovery-preload.cjs`; UI em `ui/`, entrada `index.html`; páginas externas em `WebContentsView` via `browser-surface.ts` |
| IPC | `ipc-router.ts`/`ipc-policy.ts`, handlers em `apps/desktop/electron/ipc/`, guarda de perfil em `profile-access-controller.ts` |
| Dados | `profile-storage.ts` e `packages/storage/`; SQLite JSON com `better-sqlite3`; partições Chromium por perfil/workspace e partições privadas em memória |
| Pacotes | `packages/core`, `ipc`, `navigation`, `platform`, `research`, `security`, `storage`; workspaces npm `apps/desktop` e `apps/mobile` |
| Build e CI | `package.json`, lockfile npm, `electron-builder.yml`, `.github/workflows/{quality,release-desktop,compatibility,codeql}.yml`; Windows x64 e Linux x64 na matriz; macOS não homologado |
| Dependências críticas | Electron `^45.0.0` (Chromium embutido), `better-sqlite3 ^13.0.3`, `electron-updater ^6.8.11`, `@ghostery/adblocker-electron ^2.11.3`; versões efetivas são as do `package-lock.json` |

Scripts relevantes: `typecheck`, `lint`, `test:unit`, `test:integration`, `test:electron-storage`, `test:e2e`, `test:compat`, `native:electron`, `build:desktop`, `verify:fuses` e `measure:resources`. O empacotador usa ASAR, extrai somente o módulo nativo necessário e não publica diretamente (`--publish never`). A publicação depende do workflow manual.

## Classificação dos achados

**(1) Bugs confirmados.** O E2E de importação abortava com `SIGTRAP` ao acionar `confirm()` em Chromium headless (`tests/e2e/desktop-smoke.spec.ts:306`); o teste agora confirma o preview sem abrir o diálogo, preservando o ensaio do bridge. A janela privada não limpava explicitamente cache de autenticação/DNS e a shell privada não passava pela limpeza de partição (`browser-manager.ts:585`, `main.ts:195`); o fechamento nativo foi testado após a correção.

**(2) Riscos de segurança.** A base tinha atualização AppImage protegida apenas por SHA-512 do manifesto remoto (`native-updater.ts:42`), sem raiz de assinatura no aplicativo; o instalador Windows de desenvolvimento não exigia assinatura nem publisher. Dados de histórico, notas e memória continuam em JSON claro (`foundation-migrations.ts:27`, `profile-storage.ts:112`); senha de acesso ao perfil é uma barreira de uso, não criptografia. Downloads, rollback de binário e permissões de dispositivo exigem homologação adicional.
O adblocker buscava listas mutáveis no ramo `master` do GitHub em uma primeira inicialização (`adblock-service.ts:39-46`), independentemente da opção de proteção. Agora fixa um commit e rejeita outros caminhos; a consulta automática e a ausência de assinatura independente da lista continuam pendentes.

**(3) Melhorias.** Política central de `webPreferences`, bloqueio de webviews/redirecionamentos privilegiados, cinco fuses, validação do IPC de wheel, verificação de assinatura do AppImage, SBOM e benchmark reproduzível foram acrescentados. As assinaturas reais de release dependem de chaves fora do repositório.

**(4) Dívida técnica.** `ProfileStorage` executa `better-sqlite3` síncrono no processo principal; `HistoryRepository.search` e `NoteRepository.search` percorrem JSON em memória (`history-repository.ts:6`, `note-repository.ts:6`). O preload tem uma lista explícita, mas extensa, de métodos. O módulo nativo requer rebuild para a ABI do Electron.
`npm audit --audit-level=high` passa, mas informa 11 avisos **moderate** transitivos de `minimatch` em ferramentas de desenvolvimento/build; `npm audit --omit=dev --audit-level=moderate` informa zero avisos no conjunto de produção. Não aplicar `audit fix --force` que rebaixa `electron-builder` sem validar o build.

**(5) Suposições a validar.** Login de bancos brasileiros/Gov.br, Widevine, H.264/AAC em reprodução real, WebAuthn, dispositivos WebUSB/HID/Bluetooth/Serial, instalação e atualização entre duas versões assinadas, leitor de tela e macOS/ARM não foram validados nesta máquina. Os testes locais não provam esses fluxos.
Neste host Linux, `safeStorage.isEncryptionAvailable()` retornou `false` e o backend selecionado foi `basic_text`; portanto, usar `safeStorage` aqui não protegeria dados em repouso. A estratégia de chaves precisa falhar fechada ou pedir senha, com migração/backup testados antes de ativar criptografia.

## Matriz de auditoria

| Área | Arquivo/linha e trecho | Estado atual | Risco | Correção recomendada | Prioridade | Teste de validação |
| --- | --- | --- | --- | --- | --- | --- |
| Atualização Linux | `native-updater.ts:42` `downloadUpdate()`; `update-signature.ts:13` | Chave Ed25519 embutida em build assinado; assinatura verificada após download | Release anterior ou build sem chave não tem atualização assinada | Publicar somente via gate com chave real; ensaiar upgrade e falha de assinatura | P0 | `update-signature.test.ts`; upgrade AppImage entre versões reais pendente |
| Atualização Windows | `electron-builder.release.cjs:1-9` `publisherName`, `forceCodeSigning` | Build de publicação exige certificado; build comum não habilita updater nativo | Certificado ainda não configurado/homologado | Provisionar Authenticode, conferir editor e atualizar duas versões | P0 | PowerShell `Get-AuthenticodeSignature` no workflow; ensaio real pendente |
| Dados locais | `foundation-migrations.ts:27` `data TEXT`; `profile-storage.ts:112` `research:v1` | Histórico, notas e memória não criptografados | Leitura por quem obtiver cópia dos arquivos | Projetar migração atômica para criptografia por campo/SQLCipher, backups e recuperação | P0 | Fixture de migração e busca de texto claro no DB/WAL/backups, pendente |
| Listas de bloqueio | `adblock-service.ts:39-47` `fromPrebuiltAdsAndTracking(...)` | URLs fixadas em commit; primeira busca ainda é automática | Requisição sem opt-in específico; indisponibilidade da fonte | Empacotar snapshot auditado ou pedir consentimento antes de baixar | P1 | `adblock-rules-source.test.ts`; captura de rede em perfil novo pendente |
| Isolamento de janelas | `web-preferences.ts:4-14` flags impostas; `browser-surface.ts:15` | Todas as construções passam pelo helper | Nova janela fora do helper poderia perder sandbox | Manter gate estático e E2E de runtime | P0 | `web-preferences.test.ts`, build/fuses e E2E |
| IPC e iframes | `ipc-policy.ts:15-38` `senderFrame`; `main.ts:313` wheel | Guarda de frame/documento e posse de janela | Canal novo pode esquecer política | Registrar pelo `IpcRouter`; negativo de frame remoto | P0 | `ipc-policy.test.ts`, E2E IPC remoto |
| Navegação e popups | `browser-manager.ts:624`, `:683-710` | HTTP(S) e bloqueio de protocolos privilegiados; popup OAuth isolado | Redirect ou popup novo pode contornar revisão | Manter testes de URL, redirect e abertura | P1 | `web-preferences.test.ts`, E2E OAuth |
| Permissões | `browser-manager.ts:802-821` | Prompt por origem solicitante e decisão por sessão | Dispositivo real e iframe exigem teste | Homologar câmera/microfone/localização/notificação por SO | P1 | Unitários de origem e permissão; ensaio em hardware pendente |
| Sessão privada | `private-session.ts:4-9`; `main.ts:195` | Limpeza de dados/cache/auth/DNS em fechamento nativo | Download escolhido pelo usuário permanece em disco; crash encerra processo sem limpeza explícita | Manter partições efêmeras; documentar download e testar crash | P1 | `private-footprints.spec.ts` |
| Supply chain | `release-desktop.yml:131-181`, `sign-linux.sh` | SBOM CycloneDX, GPG e assinatura Ed25519 preparados | Sem chaves reais ou instaladores homologados não há release assinada | Configurar segredos, rodar release manual e validar artefatos | P0 | `verify-assets.sh`; release real pendente |
| Memória/CPU | `measure-resources.ts:27-57`; `resource-policy-controller.ts` | Suspensão estática opt-in; 30 abas locais: 3754 MiB | Alto consumo em abas comuns | Medir workloads reais e estudar política segura de descarte | P1 | `measure:resources`, `resource-economy.spec.ts` |
| Busca/SQLite | `history-repository.ts:6`, `note-repository.ts:6` | Varredura de JSON no main | Latência com perfil grande | Mover I/O para worker e só então planejar FTS5 criptografado | P1 | Benchmark em perfis grandes, pendente |
| Compatibilidade | `docs/roadmap/compatibility.md`; `external-compatibility.spec.ts` | Fixture local e sondas externas limitadas | Alegação de compatibilidade maior que a prova | Matriz por serviço/recurso com estados verificáveis | P2 | Sondas com contas de teste, DRM e dispositivos pendentes |

## Entrega por fase

### Amostra de recursos deste host

`MOON_HEADLESS=1 npm run measure:resources` usou HTML local simples e uma amostra de CPU em repouso por ponto. Memória é a soma do working set dos processos Electron; não é memória privada exclusiva.

| Abas | Processos | RAM | CPU amostrada | Tempo médio de criar nova aba |
| --- | ---: | ---: | ---: | ---: |
| 10 | 14 | 1560 MiB | 1,3% | 84 ms |
| 30 | 34 | 3754 MiB | 1,3% | 126 ms |

Inicialização com perfil novo e onboarding: 753 ms. Reinício com restauração das 30 abas: 2123 ms. Perfil após o teste: aproximadamente 6 MiB. Essas inicializações representam cargas diferentes; não formam uma comparação antes/depois. Não há benchmark da revisão anterior com o mesmo protocolo, portanto nenhum ganho de desempenho é alegado.

| Fase | Mudanças/arquivos | Risco residual | Testes e próximos passos |
| --- | --- | --- | --- |
| 0 — inventário | Este relatório; scripts/CI/manifests examinados | Dependências transitivas e plataformas não executadas | Revisar matriz a cada release |
| 1 — Electron | `web-preferences.ts`, gerenciadores de janela/aba, `ipc-policy.ts`, fuses | Prova formal de todos os canais e dispositivos ausente | Unitários, E2E IPC/OAuth, `verify:fuses`; ampliar matriz de hardware |
| 2 — atualização | `native-updater.ts`, `update-signature.ts`, build/release scripts e workflow | Chaves reais, upgrade Windows/Linux e rollback binário pendentes | Testes de assinatura e build com chave temporária; provisionar signing |
| 3 — privacidade | `private-session.ts`, E2E de footprints | Criptografia de DB, cache persistente normal, downloads privados escolhidos | E2E privado passou; desenhar migração sem perda de dados |
| 4 — desempenho | `measure-resources.ts` e comando npm | 30 abas usam muita RAM; SQLite no main | Benchmark local executado; worker/FTS e workloads reais pendentes |
| 5 — web | Matriz ampliada em `docs/roadmap/compatibility.md`; ADR 0006 já define extensões | DRM, sites e APIs sem prova | Executar contas/dispositivos em ambiente autorizado |
| 6 — produto/docs | Política de rede e release; bugs históricos arquivados | PDF, cofre, sync e acessibilidade total pendentes | Planejar fluxo a fluxo com testes de usuário |
| 7 — qualidade | E2E privado, assinatura, políticas IPC/fuses, corpus de URLs/IPC e cobertura V8 no CI | Fuzzing guiado e cobertura de módulos críticos ainda incompletos | 341 testes unitários/integração; 76,38% linhas e 57,44% ramos no corte local; definir metas por módulo |
