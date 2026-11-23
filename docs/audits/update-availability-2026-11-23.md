# Disponibilidade de atualizações — 23 de novembro de 2026

## Diagnóstico antes da correção

| Categoria | Evidência na base `3ff02e3` | Impacto |
| --- | --- | --- |
| Bug confirmado | `ui/browser-shell.ts:237-258`: a consulta automática descarta erros; `customization-center.ts:364`: a consulta manual aparece só em Configurações → Privacidade e dados | Sem conexão ou com limite da API, o usuário não via que a verificação falhou nem encontrava facilmente como repetir. |
| Risco de segurança | `native-updater.ts:26-45`: instalação nativa requer build assinado; `docs/security/release-policy.md:10-16`: faltam chaves de produção | Publicar uma alpha.8 sem assinatura para forçar um upgrade quebraria a raiz de confiança. |
| Melhoria | `ui/browser-shell.ts:229-232`: verificação ao abrir e a cada 6 h, mas nenhum controle visível permanente | Um botão na barra de abas deve oferecer estado, nova consulta e link oficial mesmo sem versão mais recente. |
| Dívida técnica | `ui/browser-shell.ts:229-232`: agendamento fica em cada renderer de janela | Janelas múltiplas podem repetir consultas. Coordenar no processo principal requer migrar a preferência por perfil. |
| Suposição a validar | GitHub Releases listava alpha.7 como última versão publicada em 23/11/2026; o código da `main` estava em alpha.8 | A alpha.8 só pode ser oferecida aos usuários instalados após publicação real de binários assinados. A API de segredos do GitHub respondeu 403; não foi possível verificar se as chaves estão configuradas. |

## Correção e validação

- O botão permanente na barra de abas mostra versão disponível ou falha de verificação. Ele funciona mesmo se a consulta automática for desativada.
- O painel de atualização oferece a página oficial de lançamentos quando não há versão nova ou a consulta falha. Janelas anônimas e de convidado oferecem o link por ação manual, sem consultar a rede automaticamente nem instalar. Links continuam fixos ao repositório oficial e a instalação nativa mantém a exigência de assinatura.
- E2E cobre versão encontrada, adiamento mantendo o indicador, ausência de versão, link oficial e recuperação após falha de rede. Unitário cobre a transição alpha.7 → alpha.8 publicada.

## Risco residual

Não há alpha.8 publicada. Usuários da alpha.7 não receberão esta mudança de interface até instalar uma release posterior. A atualização automática de binários depende de um release assinado e de testes de upgrade Windows/AppImage com as chaves de produção. A consulta automática continua opcional por privacidade; janelas anônimas e de convidado recebem apenas o link para os lançamentos oficiais.
