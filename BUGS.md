# Bugs do Moon Browser

Atualizado em 14 de setembro de 2026.

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