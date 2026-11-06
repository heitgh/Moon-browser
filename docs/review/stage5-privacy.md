# Etapa 5 — Privacidade, downloads e revisão nativa

O painel fica em **Configurações → Privacidade e dados**, ou em `moon://settings/privacy`. As escolhas ficam no perfil e passam a valer nas próximas requisições. Janelas privadas e temporárias mostram os controles do perfil como somente leitura.

- **Rastreadores:** usa as listas do Ghostery. As exceções valem para a origem principal e as regras existentes de compatibilidade continuam. O estado do filtro mostra se as listas estão disponíveis. A contagem do perfil exclui janelas temporárias.
- **Cookies HTTP:** o padrão mantém o comportamento do Chromium. Os modos de bloqueio removem Cookie e Set-Cookie nas requisições e respostas alcançadas pelo filtro. O modo de terceiros compara esquema e domínio registrável, com sufixos privados. O controle não abrange leitura via document.cookie, outros armazenamentos ou fingerprinting.
- **Exceções e limpeza:** informe a origem exata. A limpeza usa o mecanismo de dados de navegação do Chromium nas partições conhecidas do perfil. Pode encerrar logins e limpar armazenamentos offline. A exclusão de cookies pode afetar sites que compartilham o mesmo domínio de cookies. Histórico e favoritos ficam separados.
- **Permissões:** esqueça decisões persistentes de uma origem. O site poderá solicitar de novo. O painel usa as permissões já aplicadas pelo navegador.
- **Downloads:** o painel mostra tipo informado, destino e aviso quando identifica risco. Antes de abrir, o processo principal verifica o arquivo, solicita confirmação para executáveis e rejeita substituição detectável durante a revisão. Isso não é análise antivírus.
- **Research:** a leitura depende de confirmação no processo principal. O navegador vincula a autorização ao conjunto de abas, workspace, URL, superfície e versão do documento. Um reload ou navegação invalida a revisão.
- **Coleta:** diagnósticos opt-in são locais. Atualizações consultam o GitHub, listas vêm do fornecedor e navegação se comunica com os sites. Não foi adicionada telemetria.

Rode `npm run quality`, `npm run compile` e `npx playwright test tests/e2e/privacy.spec.ts tests/e2e/desktop-smoke.spec.ts --workers=1` em Windows ou Linux. O cenário de privacidade usa um servidor de teste para verificar os cabeçalhos e as exceções no Chromium. O cenário de Research exercita cancelamento e autorização. Validação da CI e leitor de tela real pendentes no momento do envio do PR.
