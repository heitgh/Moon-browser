# Moon Browser — próxima atualização: matriz de aceite

Data da revisão: 2026-11-27. Base: `main` em `56aa12569b146a6704a73f8f05614630faf2e184`; trabalho local na branch `codex/moon-next-update-2026-11-27`. A versão do código é `0.6.0-alpha.8`; a última pré-release pública documentada é `v0.6.0-alpha.7`. Esta matriz não autoriza publicação.

| Requisito | Prioridade | Estado e evidência | Testes independentes exigidos antes de publicar |
| --- | --- | --- | --- |
| Instalador Windows e assinatura | P0 | Bloqueado: [ensaio assinado #146](https://github.com/heitgh/Moon-browser/actions/runs/45252762103/job/137966492117) falhou em `Missing CSC_LINK`. Ver `docs/security/release-policy.md`. | Assinatura Authenticode de instalador, portátil e executável interno; instalação limpa e sobre alpha anterior em Windows real. |
| AppImage Linux e assinatura | P0 | Bloqueado: [ensaio assinado #146](https://github.com/heitgh/Moon-browser/actions/runs/45252762103/job/137966492628) falhou em `Missing LINUX_UPDATE_SIGNING_KEY_B64`. | Verificar assinatura Ed25519 e GPG no artefato; instalar e iniciar em Linux real. |
| Atualização de versão anterior | P0 | Bloqueado: `alpha.7` usa feed legado; a migração inicial para o feed assinado exige instalador manual. | Migração de perfil descartável em Windows e Linux; atualização nativa posterior a partir de release já assinada. |
| Dados e recuperação | P0 | Parcial: há backup SQLite pré-instalação, mas ele não inclui partições Chromium e não há rollback transacional. | Fechamento forçado e recuperação; interrupção de upgrade e restauração com perfil descartável. Conferir cookies, abas, notas e preferências separadamente. |
| Consulta de atualização | P1 | Código verifica ao abrir e a cada seis horas quando habilitado; botão permite consulta manual. O verificador agora invalida candidato anterior durante nova consulta e após falha. | Consulta com release válida; falha de rede após release válida e nova consulta. |
| Personalização e wallpapers | P1 | Central e testes existentes; importação da biblioteca agora limita dimensões e rejeita arquivos indecodificáveis. Vídeo MP4/WebM não habilitado. Capturas existentes não provam todas as combinações pedidas. | Importação válida e inválida coberta em unidade; persistência após reinício e inspeção visual de cada preset ainda pendentes no app real. |
| Pesquisa local | P1 | Fluxo experimental de fontes e notas no perfil. Resumo por IA não disponível. | Salvar e retomar uma sessão; falha/cancelamento com preservação do estado anterior. |
| Compatibilidade com sites e sistemas | P1 | Sondas e testes locais não equivalem a login, DRM, passkeys ou homologação de plataformas. | Fluxo funcional por site em conta autorizada; repetição em versão/sistema suportado com evidência. |
| Performance | P1 | Medição histórica de uma amostra não serve como comparação controlada antes/depois. | Medir baseline e candidato no mesmo host/workload; repetir em condição alternativa com wallpaper animado e estático. |
| Publicação e instalação local | P0 | Bloqueado até assinatura, testes de pacote e autenticação de publicação. Nenhuma instalação Moon foi localizada nas pastas usuais deste host nesta revisão. | Validar release, checksums e feed publicados; instalar pelo fluxo oficial com backup do perfil identificado. |

## Decisão de lançamento

**Não publicar a alpha.8 nem anunciar a atualização nativa como validada nesta etapa.** O workflow exige certificado Authenticode, chaves Linux de produção e ensaio assinado na branch `main`. A política também exige testes reais de instalação, upgrade, recuperação e remoção. Sem esses resultados, um build local ou teste de unidade não satisfaz o gate.

## Evidência nova desta rodada

- `npm run typecheck` e `npm run lint` passaram. `npm run test:unit` passou com 309 testes em 70 arquivos; `npm run test:integration` passou com 35 testes. Os dois novos cenários do verificador cobrem falha de rede após oferta válida e indisponibilidade durante consulta pendente. Isso é evidência de código, não de instalação ou atualização real.
- Após a validação de wallpapers, typecheck e lint passaram novamente; 312 testes unitários passaram em 71 arquivos. Cenários novos cobrem importação válida, rejeição sem gravação de imagem grande ou indecodificável e miniatura de proporção extrema limitada a 320 px. O decodificador foi simulado; falta validar no Electron empacotado com arquivos reais.
- [PR rascunho #62](https://github.com/heitgh/Moon-browser/pull/62): CodeQL, qualidade Windows/Linux, compatibilidade de sites (fixtures e sondas), e builds Windows/Linux de teste passaram. Os passos de assinatura de produção e publicação foram ignorados nesse PR. Isso não valida artefatos de release nem contas, DRM ou passkeys em sites externos.
- Node 22.23.5 portátil também tentou compilar `better-sqlite3` e falhou por ausência do toolchain Visual Studio C++. Reinstalação com `--ignore-scripts` restaurou os testes que não usam o módulo nativo.
- `npm ci` comum falhou: `better-sqlite3` tentou compilar sob Node 26 e não havia Visual Studio com C++ neste Windows. `npm ci --ignore-scripts` permitiu os testes de TypeScript/Vitest, mas não produz módulo nativo nem aplicativo empacotável. O ambiente declarado pelo projeto inclui Node 22 e 24; repetir os gates nativos em runtime suportado e runner configurado.
- A documentação oficial do [Electron 45.5.0](https://releases.electronjs.org/release/v45.5.0) registra Chromium `156.0.8078.109` e correções de crash, spellcheck, diálogo e contraste. O manifesto e lockfile agora fixam essa versão; reconstrução nativa e regressão do pacote ainda dependem do CI.
- A [orientação de segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security) reforça isolamento de contexto, sandbox, validação de IPC e restrição de conteúdo remoto. Nenhuma dessas proteções deve ser removida para compatibilidade.
- Não foi confirmada uma instalação Moon em `AppData/Local`, `AppData/Roaming` ou `Program Files` neste host. Isso não prova ausência em outros locais.

## Próximo checkpoint

Executar os testes locais e registrar seus resultados; obter ensaio assinado de produção no CI; homologar instalação e upgrade em Windows/Linux com perfis descartáveis; só então revisar a decisão de publicação. A instalação pessoal deve identificar primeiro o executável e a pasta de dados reais e fazer backup verificável.
