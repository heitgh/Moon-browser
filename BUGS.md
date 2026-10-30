# Bugs do Moon Browser

## Etapa 1 em revisão — 30/10/2026

MB-016 permanece aberto. Esta branch ordena drenagem de IPC, persistência, destruição
efetiva das páginas e fechamento/checkpoint dos bancos. Foram observados encerramentos
por sinal em headless, além dos timeouts anteriores; passagem isolada não encerra o bug.
Recuperação agora trata falha do perfil selecionado e reconstrução confirmada de registro
danificado, preservando os originais. Resultados e limites atuais estão em
`docs/review/stage1-shutdown-recovery.md`; não confundir com a release alpha.5.

Atualizado em 26 de outubro de 2026.

A alpha.5 foi publicada após a matriz de release Windows/Linux passar (292 testes por sistema e auditoria sem vulnerabilidades). A execução independente Windows falhou no ensaio de encerramento: o trace mostra Close context ultrapassando cinco segundos, seguido de EBUSY na limpeza e timeout do worker. A causa raiz permanece não comprovada; MB-016 continua aberto.

O workflow da alpha.4 passou na matriz automatizada Windows/Linux. Os dois probes externos curtos de Pinterest/TikTok passaram no CI; não validam login com contas nem estabilidade prolongada. O workflow independente de qualidade encontrou timeouts de encerramento, registrados em MB-016.

| ID | Problema | Estado | Evidência/limite |
| --- | --- | --- | --- |
| MB-001 | Renderer cai em páginas pesadas como TikTok | Recuperação validada; causa pendente | recuperação limitada passou no fixture; TikTok abriu no probe externo sem crash, mas observação prolongada e outras plataformas continuam pendentes |
| MB-002 | Login Pinterest/OAuth perde popup ou sessão | Contrato técnico validado | opener, mesma Session, redirects e cookies passaram no fixture; Pinterest abriu sem crash, mas login humano/CAPTCHA exige validação manual |
| MB-003 | Erro interno aparece na interface | Corrigido no código | mensagens mapeadas sem `ERR_`/TypeScript |
| MB-004 | Toolbar, abas e sidebar parecem grandes/pesadas | Corrigido para perfis novos | modo Simples compacto; perfis existentes não são sobrescritos |
| MB-005 | Login real pode exigir CAPTCHA/credencial | Limitação externa | teste humano obrigatório antes de afirmar compatibilidade integral |
| MB-006 | Crash por driver/OOM pode persistir após duas recargas | Aberto | Moon interrompe o loop e recomenda reduzir abas/recarregar |
| MB-007 | Homologação Windows/macOS da alpha | Parcial | Windows/Linux: typecheck, lint, 205 unitários, 35 integração, 22 armazenamento e 16 E2E passaram no workflow de release; macOS e hardware físico pendentes |

Ao reportar regressão, registre SO, versão do Moon, URL, horário, passos, comportamento esperado e observado. Nunca anexe cookies, tokens ou credenciais.

## Alpha.4 — evidências automatizadas

| ID | Problema | Estado e limite |
| --- | --- | --- |
| MB-008 | IPC sem fronteira central de emissor/frame | Implementado; testes unitários e E2E rejeitam emissor remoto. Não equivale a prova contra toda forma de XSS no shell. |
| MB-009 | Permissão atribuída à aba incorporadora | Implementado usando requestingUrl; regressão unitária de iframe/origem opaca. Homologação com dispositivos e sites reais pendente. |
| MB-010 | DNS validado separadamente da conexão de imagem | Transporte fixado ao endereço validado; testes de DNS, redirects, IPs, IPv6, tamanho e MIME passaram. |
| MB-011 | Não é possível excluir área com abas | Mover/fechar abas implementado; SQLite e E2E cobrem exclusão/reinício/cookie persistente. Homologação multijanela adicional pendente. |
| MB-012 | Ícones de atalhos ausentes offline | YouTube/GitHub locais e cache por site implementados; regressões passaram. |
| MB-013 | Atualização exige consulta manual ao repositório | Alpha.5 oferece atualização nativa Moon/Chromium em Windows instalado e AppImage, com progresso e confirmação. Outros formatos usam instalação manual; upgrade entre dois pacotes ainda requer homologação. |
| MB-014 | Consumo de memória e crash prolongado | Aberto: 20 abas locais sem crash; métricas de memória retornaram zero no ambiente e são inconclusivas. GPU física/TikTok pendentes. |
| MB-015 | Protótipo de IA local | Não implementado; flag ai desativada, fora do primeiro pacote. |
| MB-016 | Timeout intermitente ao encerrar Electron no E2E | Aberto: workflow independente encontrou timeout em Close context no Linux e no ensaio de perfis Windows; a mesma árvore passou no workflow de release. A repetição completa passou em Windows/Linux; causa raiz não comprovada, investigação permanece aberta. |

Detalhes: [relatório de validação](docs/review/next-update-validation.md).

## Próxima atualização — implementação em desenvolvimento

- **Downloads anônimos:** escopo por janela e remoção de metadados implementados; teste unitário negativo cobre listagem, eventos, comandos e callbacks tardios. E2E de transferência privada real ainda pendente.
- **MB-016:** prazo global e ensaio de 30 ciclos adicionados. Foi identificada e corrigida outra condição de corrida: fechar durante loadFile resultava em saída 1. Isso não comprova a causa dos timeouts históricos; permanece pendente a homologação Windows/desktop.
- **Migrações:** backup prévio consistente, guarda de versões desconhecidas e integridade na abertura implementados e testados. UI de recuperação não implementada.

Veja [validação do primeiro conjunto](docs/review/alpha5-security-stability.md). Nenhuma nova release foi publicada por esta alteração.
