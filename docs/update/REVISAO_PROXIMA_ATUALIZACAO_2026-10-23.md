# Moon Browser — revisão e próxima atualização
Nexus Inc. · 23/10/2026

## Escopo e evidência
Revisão estática da main no commit 291c704f08f0a10db76c5f81ecabd2358cdffe77, versão 0.6.0-alpha.3. Foram inspecionados entrada real, shell, workspaces, favicons, IPC, permissões, armazenamento, build e workflows. Não é auditoria exaustiva nem homologação de execução. Não foram instaladas dependências nem executados testes nesta revisão. AI Brain referenciado no AGENTS.md não está disponível neste ambiente.

## Visão geral
Electron/Chromium com UI TypeScript local e páginas remotas em WebContentsView; SQLite para dados do perfil; workspaces com partições de sessão próprias; personalização, notas, Research, downloads e adblock. main.js é apenas um import: implementação real em apps/desktop/electron/main/main.ts. Não é correto tratá-lo como monólito.
O README informa corretamente que Research não é IA generativa, que a memória não tem criptografia própria e que atualizador assinado não está disponível.

## Achados de segurança e confiabilidade
### P1 — autorização de IPC inconsistente (confirmado no código; exploração não demonstrada)
apps/desktop/electron/ipc/ipc-router.ts:3 registra handlers sem validação central de remetente/origem/frame. browser-ipc.ts:18-29 valida janela e propriedade da aba; research-ipc.ts valida mainFrame; product-ipc.ts:89-154 contém handlers como adblock:set-enabled, import/export e fetch de imagens que ignoram o remetente. Portanto não se deve afirmar que toda chamada está igualmente autorizada.
Correção proposta: exigir WebContents da shell registrada + frame principal + URL local exata autorizada, antes de encaminhar cada canal; preservar validação de payload e propriedade por perfil. Não expor o preload da shell em páginas remotas.
Limite: isolamento e ausência do bridge na página remota reduzem exposição; a ausência do guard não comprova acesso remoto ao IPC.
Teste: rejeitar chamadas de página remota, subframe, janela desconhecida e shell navegada; permitir shell legítima.

### P1 — atribuição de permissões a subframes (risco a validar em execução)
browser-manager.ts:607-630 usa contents.getURL() no request handler e ignora details.requestingUrl. Uma solicitação originada em frame de outra origem pode ser apresentada/armazenada como origem da página principal. O check handler usa requestingOrigin, portanto os dois caminhos precisam de consistência.
Correção: usar a origem efetivamente solicitante e detalhes do frame, tratar origem opaca com negação e mostrar contexto do frame ao usuário.
Teste: iframe de outra origem pedindo mídia/geolocalização, decisão persistida por origem correta e timeout negando.

### P1 — downloads de imagens: resolução DNS separada da conexão (risco estrutural)
product-ipc.ts:237-280 valida endereços com lookup, depois fetch resolve o hostname novamente. Existe janela entre checagem e uso; isPublicAddress também usa prefixos manuais para IPv6.
Correção: normalizar endereços IPv4/IPv6 e vincular conexão ao endereço validado preservando TLS/SNI, revalidando cada redirect; usar biblioteca de classificação revisada. Limitar concorrência. Não retirar bloqueio de rede privada para corrigir favicons.
Teste: DNS variável, IPv4 mapeado em IPv6, redirects privados, corpo acima do limite e timeout.
Não foi realizada exploração de DNS rebinding.

### P1 — distribuição sem fluxo de atualização integrado
package.json não inclui electron-updater e main.ts não inicializa atualizador. electron-builder.yml não declara fuses nem publish. O workflow contém CSC_IDENTITY_AUTO_DISCOVERY=false; não foi verificada assinatura de cada artefato publicado.
Priorizar aviso de atualização antes de instalação automática; assinatura, metadados e integridade devem anteceder aplicação automática. Não prometer rollback automático sem projeto e testes.

### P2 — dados e backups sem criptografia própria
README:109-112 e scripts/database/backup.ts:2: backup SQLite direto. Tratar histórico, notas e Research como dados sensíveis. Planejar chave por perfil com cofre do SO, migração recuperável e backups cifrados; validar fallback Linux. Evitar prometer que todo cache/cookie estará protegido pela mesma camada.

### P2 — homologação e consumo de memória
BUGS.md mantém MB-006 (driver/OOM) e MB-007 (Windows/macOS) abertos. quality.yml roda em Ubuntu; builds Windows não equivalem a testes Windows. Hibernação pode reduzir memória, mas não resolve por si só driver/OAuth.
Adicionar matriz de testes por plataforma publicada. Preservar abas com formulário, áudio/vídeo, download ou atividade importante ao considerar descarte.

### Proteções já presentes
Shell e páginas remotas usam contextIsolation, sandbox e nodeIntegration:false (main.ts:50-62; browser-manager.ts:136-143). Shell nega popups e navegação externa. CSP local restringe scripts e conexões; frame-ancestors via meta não deve ser contado como proteção efetiva sem validação do mecanismo suportado. Há controles de permissões e propriedade de abas, limites/timeout/redirects no carregamento de imagens.
Dependabot, CodeQL, npm audit e quality como dependência da publicação já existem. Recomendação anterior para simplesmente adicioná-los está desatualizada. Existência de workflows não prova execução verde.

## Itens solicitados para a próxima atualização
### NEXT-01 — gerenciamento completo das áreas (P1)
Relato: não é possível excluir área como Estudos ou Pesquisa.
Confirmado: ui/browser-shell.ts:360 só exibe Excluir quando há mais de uma área e count===0. Toda área com aba aberta esconde o botão; não falta apenas implementação de delete.
#removeWorkspace (651-655) altera estado local e chama workspace:delete; profile-storage.ts:288 remove registro sem orquestrar abas/sessões/partição.
Entrega:
- Gerenciar pelo menu da área e painel central: criar, renomear, ordenar, cor/ícone, arquivar e excluir.
- Excluir área com abas oferece mover abas para outra área ou fechar, com confirmação explícita.
- Preservar pelo menos uma área, escolher ativa válida e persistir atomicamente.
- Separar excluir organização de apagar cookies/dados da partição; informar a escolha.
- Ao mover abas entre partições, definir se recria a aba/sessão: não prometer transferência de login transparente.
Aceite: excluir ativa/inativa/vazia/com abas, cancelar, reiniciar, falha de persistência e duas janelas do mesmo perfil sem abas órfãs.

### NEXT-02 — aviso ao abrir quando há versão nova (P1)
Entrega inicial: checagem assíncrona das releases oficiais após iniciar, sem bloquear navegação; comparação semântica com canal alpha/beta/stable; banner com versão, novidades, Baixar e Depois; Configurações > Sobre > Verificar atualizações.
Usar endpoint HTTPS fixo, timeout/cache/backoff, ignorar drafts e separar prerelease conforme canal; validar links de download. Sem coleta de histórico.
A experiência já evita exigir visita manual ao repositório mesmo antes de auto-update.
Etapa seguinte: download e instalação integrados após assinatura/integridade, consentimento e preservação/restauração do perfil. Definir suporte separado para NSIS, portable, AppImage e pacotes Linux; respeitar gerenciador de pacotes.
Aceite: offline, release antiga/igual/nova, prerelease, rate limit, metadados inválidos, adiamento, instalador versus portable e atualização preservando dados.

### NEXT-03 — ícones YouTube/GitHub e atalhos (P1)
Confirmado: home-view.ts:645-659 consulta apenas favicons por origem e senão exibe fallback textual. browser-shell.ts:708-722 popula mapa de origens a partir de abas que reportaram favicon; cache persiste por URL de imagem, sem mapa persistente correspondente por origem.
Hipótese causal forte: atalhos sem navegação prévia ou após reiniciar não têm ícone na home. Não foi reproduzido visualmente.
Favicon SVG é rejeitado pelo caminho atual; não mudar para SVG remoto sem validação/conversão segura.
Entrega: ícones locais licenciados dos atalhos padrão, cache persistente origem→ícone, busca limitada para atalhos personalizados sem abrir aba, fallback legível e recuperação onerror. Canonicalizar origens/aliases (www/apex) com regras explícitas; evitar serviço externo de favicon por padrão.
Aceite: perfil novo, reinício, offline, ícone ausente/corrompido, MIME não suportado, dark/light, importação e isolamento de dados privados.

### NEXT-04 — Moon AI local sem Ollama externo (P2, protótipo após correções)
É viável integrar um runtime no produto, sem exigir instalação de outro aplicativo. O usuário ainda precisa dos pesos do modelo: baixar pelo Moon com consentimento ou importar arquivo local.
Há contratos AiProvider/AiEngine em packages/intelligence, mas README informa IA generativa indisponível; contratos não comprovam recurso integrado.
Proposta: runtime baseado em llama.cpp, avaliar node-llama-cpp para Electron; executá-lo em processo separado da UI, com comunicação restrita e cancelamento. Se usar servidor local, bind loopback, autenticação por execução e sem exposição à LAN; preferir IPC controlado quando possível.
Fluxo: Ativar IA local → verificar capacidade/espaço → mostrar download/licença → baixar com progresso/retomada e integridade autenticada → carregar sob demanda → resumir ou perguntar sobre conteúdo selecionado.
Começar com modelo quantizado pequeno candidato (1–3B); tamanho, contexto, velocidade e RAM devem ser medidos em máquinas reais antes de definir requisitos. Não prometer desempenho uniforme nem equivalência a modelos em nuvem.
Segurança: páginas são dados não confiáveis, não instruções; sem executar comandos ou acessar disco livremente; conteúdo só das abas autorizadas; privado/convidado sem persistência; nenhuma nuvem automática; botão parar/descarregar/apagar modelo; teto de RAM/CPU e fila.
Aceite: Windows/Linux sem Ollama, CPU sem GPU, pouca memória, instalação offline por arquivo, cancelamento, primeira descarga, checksum inválido e ausência de tráfego de inferência externo.
Fontes primárias consultadas: https://node-llama-cpp.withcat.ai/guide/electron e https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md .

## Ordem de entrega
1. Guards IPC, permissões e proteção das requisições de imagem, com testes focados.
2. NEXT-01 e NEXT-03; regressão de zoom/site/UI, wallpapers e OAuth.
3. NEXT-02 aviso de versão; assinatura e atualização automática em etapa própria.
4. Protótipo NEXT-04 com orçamento de memória, antes de prometer IA para todos.

## Limites e próximos testes
Não foram executados Moon, login real, testes, scan de vulnerabilidades ou medição de RAM neste ambiente. As linhas são referências do commit acima e podem mudar. Este registro documenta achados/propostas, não correções entregues. Preservar funcionalidades e atualizar README/BUGS/CHANGELOG quando cada implementação for validada.
