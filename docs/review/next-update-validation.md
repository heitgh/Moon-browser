# Moon Browser v0.6.0-alpha.4 — implementação e evidências

Nexus Inc. · 23/10/2026 · pré-release publicada.

A implementação foi integrada pelo [PR #30](https://github.com/heitgh/Moon-browser/pull/30), preservando commits focados. O ajuste de publicação foi integrado pelo [PR #31](https://github.com/heitgh/Moon-browser/pull/31). O commit publicado é `6316fe8dc757fb591d3813a3483efa6763077fb7`.

## Escopo implementado

- IPC: router exige janela viva registrada, identidade exata do WebContents, frame principal não destacado e documento `index.html` exato. Rejeita páginas remotas, documentos irmãos, subframes, argumentos excessivos, valores não finitos, tipos não serializáveis e payloads excessivos. Parsers específicos dos handlers continuam responsáveis pelo domínio. O evento limitado de Ctrl+scroll aceita apenas direções conhecidas de frames principais de WebContents associados ao navegador; não concede acesso ao router privilegiado.
- Permissões: a solicitação usa `details.requestingUrl`, incluindo iframes, em vez da URL da aba. Origem ausente/opaca é negada, sem atribuição à página incorporadora. A checagem usa a origem fornecida pelo Chromium, sem fallback para a aba.
- Imagens: wallpapers/favicons usam HTTPS na porta 443, DNS validado por salto e conexão fixada ao IP aprovado. Sem reutilização de agente. Credenciais, redes privadas, endereços especiais e nomes locais são rejeitados; redirects, tamanho, MIME e prazo total são limitados. IPv6 é normalizado antes da classificação.
- Diagnóstico: opt-in `MOON_LOCAL_DIAGNOSTICS=1`, desativado por padrão. Eventos de renderer/GPU/processos e amostras de working set ficam em `app.getPath("userData")/diagnostics`. Rotação de aproximadamente 1 MB, mantendo arquivo anterior. Sem URLs, conteúdo de páginas ou envio automático. Eventos nativos não oferecem stack JavaScript do renderer; não prometemos essa informação.
- Áreas: criar, renomear, ordenar, cor, ícone, arquivar/restaurar e excluir movendo ou fechando abas. A última área ativa é preservada. Exclusão passa por comando próprio, contempla janelas do mesmo perfil, atualiza sessão e sinaliza a UI para não recriar abas durante a operação. Restaurar sessão remapeia referências órfãs. Abas movidas mantêm sua partição original de cookies, inclusive depois de reiniciar e ao abrir popups. Excluir área não chama limpeza de cookies/armazenamento. Comando destrutivo indisponível em janela privada/convidada.
- Atualizações: consulta assíncrona iniciada após o carregamento da UI, timeout de cinco segundos, canais herdados da versão instalada, novidades em texto, Baixar/Depois e consulta manual nas configurações. Baixar abre a página oficial da release conferida; não instala automaticamente, executa binários ou modifica o perfil.
- Ícones: YouTube/GitHub empacotados localmente, fallback de imagem e cache por site persistente. Respeita as opções existentes de cache. A Home oculta não é reconstruída ao hidratar favicon.
- Windows: matriz Linux/Windows e runner de armazenamento sem sintaxe exclusiva de shell Unix. E2E tem modo headless explícito para ambientes sem desktop.


## Validação e publicação

O [workflow oficial final](https://github.com/heitgh/Moon-browser/actions/runs/39998001695) passou e publicou a [v0.6.0-alpha.4](https://github.com/heitgh/Moon-browser/releases/tag/v0.6.0-alpha.4). A API confirmou release pública, não draft, marcada como pré-release, com seis instaladores e dois arquivos de checksum, todos no estado uploaded. Nenhum relatório E2E foi anexado.

| Verificação no workflow de release | Windows | Linux |
| --- | --- | --- |
| Typecheck e lint | passaram | passaram |
| Unitários | 205 passaram | 205 passaram |
| Integração | 35 passaram | 35 passaram |
| Rebuild nativo Electron | passou | passou |
| Armazenamento Electron/SQLite | 22 passaram | 22 passaram |
| E2E determinísticos | 16 passaram | 16 passaram com Xvfb |
| Auditoria de dependências | passou | passou |
| Pacotes | Setup e Portable | AppImage, DEB, RPM e pacman |

O [CodeQL do commit publicado](https://github.com/heitgh/Moon-browser/actions/runs/39998001724) passou. Também passaram antes do merge os gates de [qualidade do PR #30](https://github.com/heitgh/Moon-browser/actions/runs/39993255633), [builds](https://github.com/heitgh/Moon-browser/actions/runs/39993255775), [CodeQL](https://github.com/heitgh/Moon-browser/actions/runs/39993255759) e [compatibilidade](https://github.com/heitgh/Moon-browser/actions/runs/39993255969). O log dos probes externos registra dois testes aprovados, separados e opt-in na suíte padrão. Não validam autenticação com contas.

A suíte E2E cobre zoom de página versus UI, Ctrl++/Ctrl+-/Ctrl+0, Ctrl+scroll, popup OAuth local, cookies/redirect, fullscreen, wallpapers, personalização, restauração, isolamento de perfis, recuperação de renderer, IPC remoto, áreas, aviso de atualização e 20 abas locais. O fullscreen usa o evento Electron no fixture; não comprova combinações de mídia, monitor e driver físico.

## Regressões encontradas no CI

- Caminhos de perfis: asserção com separador Unix substituída por `path.join` para Windows.
- Feed: a tag histórica `v1.0.0` não pode disparar atualização da linha atual. A seleção exige data compatível com a época do feed e com a versão instalada, além da ordem semântica; regressões cobrem datas inválidas e antigas.
- CodeQL: comparação de prefixo no teste substituída por origem URL exata; probes exigem hostname exato ou fronteira de subdomínio. Nenhum alerta foi suprimido.
- OAuth no Windows: metadados de aba precediam o documento carregado. O teste aguarda o DOM real e verifica popup nativo, opener, retorno e fechamento, respeitando WebContents destruído durante o fechamento. Passou no Windows e Linux.
- Os testes determinísticos desativam rede externa em modo de teste, exceto o cenário de atualização com feed controlado. A distribuição normal mantém suas consultas de atualização.

A [primeira tentativa oficial](https://github.com/heitgh/Moon-browser/actions/runs/39994668671) passou em testes/builds, mas falhou ao anexar um diretório de relatório E2E. Não deixou release/tag pública. O PR #31 restringiu o download a `moon-browser-*-x64` e a publicação a seis instaladores e dois checksums; um conjunto incompleto é rejeitado. A etapa Bash real passou em fixture com relatórios extras e com instalador ausente. Typecheck/lint e todos os gates Windows/Linux passaram novamente no [CI do ajuste](https://github.com/heitgh/Moon-browser/actions/runs/39996615271). A execução oficial posterior publicou somente os oito anexos esperados.

## Timeout de encerramento em investigação

O workflow independente [Quality](https://github.com/heitgh/Moon-browser/actions/runs/39998001705) encontrou timeout em dois cenários E2E, enquanto a mesma árvore passou na validação incorporada à release. O trace Linux mostra que a navegação e a asserção da URL passaram; `application.close()`/Close context ficou pendente antes do reinício. No Windows, o ensaio de isolamento de perfis passou na repetição interna, mas houve timeout do worker no encerramento. Não atribuímos a causa a rede, hardware ou produto sem evidência adicional. A falha permanece MB-016; os jobs que falharam foram repetidos uma vez, sem desativar testes ou aumentar timeouts.

Resultado final da repetição: os dois jobs concluíram com sucesso, incluindo typecheck, lint, 205 testes unitários, 35 de integração, 22 de armazenamento, 16 E2E, auditoria de dependências e empacotamento por sistema. Esse resultado não comprova a causa dos timeouts anteriores nem encerra MB-016. Nenhum teste foi removido e nenhum timeout foi aumentado.

O primeiro ensaio local sem servidor gráfico falhou no X11; com Xvfb a suíte passou. Um diálogo nativo também impede executar toda a suíte em headless neste ambiente. Esses limites do ambiente não foram classificados como bugs resolvidos no produto.

A amostra local de muitas abas retornou métricas de memória zero/indisponíveis. **Não é uma medição válida de memória** nem prova ausência de vazamentos. Nenhuma política automática nova de hibernação foi adicionada.

## Limites conhecidos

- Login real Google/Pinterest, CAPTCHA e sessões de conta não foram validados. O fixture OAuth local não substitui esses testes.
- TikTok real/prolongado, reprodução de mídia e GPU física/driver permanecem pendentes. Nenhuma causa raiz de crash de TikTok foi comprovada ou declarada resolvida.
- Classificação de IPs é conservadora. Testes mockados cobrem DNS rebinding/redirect e classificação; não equivalem a uma auditoria independente ou teste de todas as redes possíveis.
- A confiança no shell pressupõe ausência de XSS no próprio documento privilegiado. Validação do emissor não substitui auditoria de todos os parsers, sanitização e permissões de cada feature.
- Sessões simultâneas em várias janelas e importações concorrentes merecem homologação adicional. Os testes novos cobrem exclusão/restauração em uma janela e preservação de cookie persistente.
- Criptografia em repouso, novo sistema de backups e instalação automática assinada não foram implementados neste pacote.
- **IA local:** a flag existente `ai` continua desativada e bloqueada para release. Motor local, gerenciador de modelos, importação/download com progresso, cancelamento e avaliação em hardware modesto **ainda não foram implementados**. O protótipo permanece fora desta entrega; não há alegação de funcionamento offline de IA.

O preview Vercel possui falha também no main anterior; é independente dos instaladores Electron.

## Como atualizar

A alpha.3 e anteriores não contêm verificador de atualização; precisam de uma instalação manual inicial. A alpha.4 oferece aviso assíncrono para futuras versões compatíveis, novidades, Baixar/Depois e consulta manual. Baixar abre a página oficial conferida. Não há instalação automática nem promessa de assinatura digital.

README, BUGS e CHANGELOG foram atualizados após os testes e a confirmação dos oito anexos publicados.
