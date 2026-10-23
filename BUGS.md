# Bugs do Moon Browser

Atualizado em 23 de outubro de 2026.

As entradas históricas abaixo não substituem a homologação desta atualização. Os probes externos não foram repetidos nesta entrega.

| ID | Problema | Estado | Evidência/limite |
| --- | --- | --- | --- |
| MB-001 | Renderer cai em páginas pesadas como TikTok | Correção automatizada validada | recuperação limitada passou no fixture; TikTok abriu no probe externo sem crash, mas observação prolongada e outras plataformas continuam pendentes |
| MB-002 | Login Pinterest/OAuth perde popup ou sessão | Contrato técnico validado | opener, mesma Session, redirects e cookies passaram no fixture; Pinterest abriu sem crash, mas login humano/CAPTCHA exige validação manual |
| MB-003 | Erro interno aparece na interface | Corrigido no código | mensagens mapeadas sem `ERR_`/TypeScript |
| MB-004 | Toolbar, abas e sidebar parecem grandes/pesadas | Corrigido para perfis novos | modo Simples compacto; perfis existentes não são sobrescritos |
| MB-005 | Login real pode exigir CAPTCHA/credencial | Limitação externa | teste humano obrigatório antes de afirmar compatibilidade integral |
| MB-006 | Crash por driver/OOM pode persistir após duas recargas | Aberto | Moon interrompe o loop e recomenda reduzir abas/recarregar |
| MB-007 | Homologação Windows/macOS da alpha | Aberto | não executada nesta branch |

Ao reportar regressão, registre SO, versão do Moon, URL, horário, passos, comportamento esperado e observado. Nunca anexe cookies, tokens ou credenciais.

## Próxima atualização — evidências locais

| ID | Problema | Estado e limite |
| --- | --- | --- |
| MB-008 | IPC sem fronteira central de emissor/frame | Implementado; testes unitários e E2E rejeitam emissor remoto. Não equivale a prova contra toda forma de XSS no shell. |
| MB-009 | Permissão atribuída à aba incorporadora | Implementado usando requestingUrl; regressão unitária de iframe/origem opaca. Homologação com dispositivos e sites reais pendente. |
| MB-010 | DNS validado separadamente da conexão de imagem | Transporte fixado ao endereço validado; testes de DNS, redirects, IPs, IPv6, tamanho e MIME passaram. |
| MB-011 | Não é possível excluir área com abas | Mover/fechar abas implementado; SQLite e E2E cobrem exclusão/reinício/cookie persistente. Homologação multijanela adicional pendente. |
| MB-012 | Ícones de atalhos ausentes offline | YouTube/GitHub locais e cache por site implementados; regressões passaram. |
| MB-013 | Atualização exige consulta manual ao repositório | Aviso e consulta nas configurações implementados e testados com release simulada. Instalação automática permanece fora. |
| MB-014 | Consumo de memória e crash prolongado | Aberto: 20 abas locais sem crash; métricas de memória retornaram zero no ambiente e são inconclusivas. GPU física/TikTok pendentes. |
| MB-015 | Protótipo de IA local | Não implementado; flag ai desativada, fora do primeiro pacote. |

Detalhes: [relatório de validação](docs/review/next-update-validation.md).
