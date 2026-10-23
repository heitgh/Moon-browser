# Moon Browser — próxima atualização: implementação e evidências

Nexus Inc. · 23/10/2026 · pacote em preparação, não publicado.

## Escopo implementado

- IPC: router exige janela viva registrada, identidade exata do WebContents, frame principal não destacado e documento `index.html` exato. Rejeita páginas remotas, documentos irmãos, subframes, argumentos excessivos, valores não finitos, tipos não serializáveis e payloads excessivos. Parsers específicos dos handlers continuam responsáveis pelo domínio. O evento limitado de Ctrl+scroll aceita apenas direções conhecidas de frames principais de WebContents associados ao navegador; não concede acesso ao router privilegiado.
- Permissões: a solicitação usa `details.requestingUrl`, incluindo iframes, em vez da URL da aba. Origem ausente/opaca é negada, sem atribuição à página incorporadora. A checagem usa a origem fornecida pelo Chromium, sem fallback para a aba.
- Imagens: wallpapers/favicons usam HTTPS na porta 443, DNS validado por salto e conexão fixada ao IP aprovado. Sem reutilização de agente. Credenciais, redes privadas, endereços especiais e nomes locais são rejeitados; redirects, tamanho, MIME e prazo total são limitados. IPv6 é normalizado antes da classificação.
- Diagnóstico: opt-in `MOON_LOCAL_DIAGNOSTICS=1`, desativado por padrão. Eventos de renderer/GPU/processos e amostras de working set ficam em `app.getPath("userData")/diagnostics`. Rotação de aproximadamente 1 MB, mantendo arquivo anterior. Sem URLs, conteúdo de páginas ou envio automático. Eventos nativos não oferecem stack JavaScript do renderer; não prometemos essa informação.
- Áreas: criar, renomear, ordenar, cor, ícone, arquivar/restaurar e excluir movendo ou fechando abas. A última área ativa é preservada. Exclusão passa por comando próprio, contempla janelas do mesmo perfil, atualiza sessão e sinaliza a UI para não recriar abas durante a operação. Restaurar sessão remapeia referências órfãs. Abas movidas mantêm sua partição original de cookies, inclusive depois de reiniciar e ao abrir popups. Excluir área não chama limpeza de cookies/armazenamento. Comando destrutivo indisponível em janela privada/convidada.
- Atualizações: consulta assíncrona iniciada após o carregamento da UI, timeout de cinco segundos, canais herdados da versão instalada, novidades em texto, Baixar/Depois e consulta manual nas configurações. Baixar abre a página oficial da release conferida; não instala automaticamente, executa binários ou modifica o perfil.
- Ícones: YouTube/GitHub empacotados localmente, fallback de imagem e cache por site persistente. Respeita as opções existentes de cache. A Home oculta não é reconstruída ao hidratar favicon.
- Windows: matriz Linux/Windows e runner de armazenamento sem sintaxe exclusiva de shell Unix. E2E tem modo headless explícito para ambientes sem desktop.

## Evidência de testes executados em Linux

| Verificação | Resultado observado |
| --- | --- |
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm run test:unit` | 204 passaram em 45 arquivos |
| `npm run test:integration` | 35 passaram |
| `npm run native:electron` | rebuild concluiu |
| `npm run test:electron-storage` | 22 passaram em 4 arquivos |
| E2E com Xvfb | 15 passaram; 2 sondas externas opt-in não executadas |
| E2E adicional de 20 abas locais | passou; 22 WebContents, nenhum marcado como crashed |
| `npm audit --audit-level=high` | 0 vulnerabilidades reportadas pelo serviço nesta execução |
| `git diff --check` | passou |

A suíte E2E cobre zoom de página versus UI, Ctrl++/Ctrl+-/Ctrl+0, Ctrl+scroll, popup OAuth local, cookies/redirect, fullscreen, wallpapers, personalização, restauração, isolamento de perfis, recuperação de renderer, IPC remoto, áreas e aviso de atualização. O teste adicional local foi executado separadamente após a inclusão do cenário de muitas abas.

O primeiro ensaio sem desktop falhou ao inicializar o X11. Em headless, o diálogo nativo de importação encerrou o processo; com Xvfb o mesmo teste passou. Não classificamos essa falha do ambiente como correção de bug do produto.

O ensaio de muitas abas retornou `beforeKiB=0` e `workingSetKiB=0` neste ambiente, portanto **não é uma medição válida de memória**. Não demonstra ausência de vazamento, comportamento sob carga real nem estabilidade prolongada. Nenhuma política automática nova de hibernação foi adicionada.

## Limites e gates pendentes

- Windows não foi executado localmente nem em CI nesta entrega; a matriz precisa rodar após publicação autorizada dos PRs.
- Login real Google/Pinterest, CAPTCHA e sessões de conta não foram validados. O fixture OAuth local não substitui esses testes.
- TikTok real/prolongado, reprodução de mídia e GPU física/driver permanecem pendentes. Nenhuma causa raiz de crash de TikTok foi comprovada ou declarada resolvida.
- Classificação de IPs é conservadora. Testes mockados cobrem DNS rebinding/redirect e classificação; não equivalem a uma auditoria independente ou teste de todas as redes possíveis.
- A confiança no shell pressupõe ausência de XSS no próprio documento privilegiado. Validação do emissor não substitui auditoria de todos os parsers, sanitização e permissões de cada feature.
- Sessões simultâneas em várias janelas e importações concorrentes merecem homologação adicional. Os testes novos cobrem exclusão/restauração em uma janela e preservação de cookie persistente.
- Criptografia em repouso, novo sistema de backups e instalação automática assinada não foram implementados neste pacote.
- **IA local:** a flag existente `ai` continua desativada e bloqueada para release. Motor local, gerenciador de modelos, importação/download com progresso, cancelamento e avaliação em hardware modesto **ainda não foram implementados**. O protótipo permanece fora desta entrega; não há alegação de funcionamento offline de IA.
- README/BUGS/CHANGELOG foram atualizados após os testes. O relatório inicial foi produzido com `0.6.0-alpha.3`; a preparação posterior da `0.6.0-alpha.4` está registrada abaixo. Não há novos instaladores, checksums de instaladores, merge ou release publicada.

## Commits e revisão proposta

As branches locais formam uma pilha; cada PR deverá ter como base a entrega anterior, para evitar diffs duplicados. Não misturar IA no pacote inicial.

1. `security/ipc-hardening` — fronteira central e regressões unitárias.
2. `security/permission-origin` — origem real das permissões.
3. `security/image-download` — transporte fixado ao DNS validado.
4. `stability/local-diagnostics` — logs locais opt-in.
5. `test/windows-regressions` — matriz e runners portáveis.
6. `workspaces/management` — ciclo de vida das áreas.
7. `app/update-check` — consulta/aviso sem instalação automática.
8. `ui/favicon-icons` — ícones locais e cache.
9. `test/release-security-regressions` — E2E de IPC e áreas.
10. `workspaces/preserve-partitions` — restauração da partição das abas movidas.
11. `security/image-ipv6-normalization` — formas equivalentes de IPv6.
12. `test/release-validation` — cookies, avisos e amostra local de muitas abas.
13. `docs/next-update-validation` — documentação das evidências e limites.

Antes de cada PR efetivo, executar os gates no respectivo head e registrar o resultado, além dos resultados agregados acima. Descrições devem citar problema, causa, solução, risco, testes e limitações; nenhuma branch deve ser marcada pronta para release enquanto Windows e testes humanos estiverem pendentes.

O envio das branches foi bloqueado pela revisão automática por exigir autorização explícita de publicação de código. Não se tentou contornar a rejeição por outro meio. Nenhum PR foi criado.


## Preparação da release v0.6.0-alpha.4

Após autorização de publicação do usuário, a entrega foi reunida na branch `release/v0.6.0-alpha.4`, preservando os commits focados. O envio em lote das 13 branches foi recusado pela revisão automática; a publicação proposta foi reduzida à branch da release no destino confirmado `heitgh/Moon-browser`.

Validação repetida na versão alpha.4: typecheck e lint passaram, 204 unitários, 35 integração, 22 Electron/SQLite e 16 E2E passaram. Os dois probes externos permaneceram desativados nessa execução local. O cenário de atualização valida também o aviso automático ao iniciar, além de Depois, consulta manual e abertura da release conferida.

A alpha.3 não possui verificador de atualização instalado; precisa receber a alpha.4 manualmente uma vez. O novo verificador só pode avisar sobre futuras releases em aplicativos que já contenham esse código. Instalação automática continua fora do escopo.


## Correções encontradas no CI da release

- Windows encontrou uma asserção antiga que comparava caminhos com separador Unix. A descoberta de perfis estava correta; a asserção passou a usar `path.join`.
- O feed real contém uma tag histórica `v1.0.0` de agosto. A comparação passou a exigir data de publicação compatível com a época do feed e com a versão instalada, além da ordem semântica. Uma nova regressão cobre essa tag e datas inválidas/anteriores. Validação local atualizada: 205 unitários, 35 integração, 22 SQLite/Electron e 16 E2E passaram.
- CodeQL sinalizou a comparação de prefixo `https://example.com` no teste de cookie restaurado. O teste agora compara a origem URL exata. Os probes externos também exigem hostname exato ou subdomínio com fronteira de ponto; nenhum alerta foi suprimido.
- A suíte determinística utiliza o modo offline de teste, exceto o cenário de aviso de atualização com feed controlado; o feed público permanece exercitado nos probes separados. Builds antigos de PR podem ser cancelados por uma revisão mais recente, enquanto pipelines de publicação em main não são cancelados.
