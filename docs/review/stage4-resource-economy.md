# Etapa 4 — Economia e suspensão de abas

Em Menu Moon → Recursos → Economizar, selecione Equilibrado, Economia ou Personalizado. A automação começa desligada. Informe a origem exata de cada site que aceita recarregar, salve e confirme a ativação no diálogo nativo. Exceções prevalecem. Avaliar abas explica quais páginas seriam preservadas. Economizar agora apresenta uma confirmação separada e Parar cancela ações pendentes.

A política fica no perfil, em `resource-policy:v1`, sem migração de esquema. `ResourcePolicy` filtra candidatos e `TabLifecycleService` mede a inatividade. `ResourcePolicyController` valida a janela, o perfil e o consentimento. O gerenciador Electron verifica novamente o documento e destrói seu WebContents apenas se continuar elegível. Ao retomar, recria a superfície na mesma partição e restaura o histórico e a rolagem mantidos em memória. Após reiniciar, a restauração de sessão continua baseada nas URLs.

Abas ativas, privadas, temporárias, com scripts, interação, formulários, mídia, popups, downloads em andamento ou sinais de resposta sensível são preservadas. Casos não verificáveis permanecem acordados. A interface informa a RAM observada antes e depois. O alvo é indicativo e processos compartilhados podem permanecer ativos.

Para validar em Windows ou Linux, execute `npm run quality`, `npm run compile` e `npx playwright test tests/e2e/resource-economy.spec.ts --workers=1`. O teste de desktop verifica 30 superfícies, exceções, confirmação, preservação de formulário e script, histórico e rolagem. As amostras reais de RAM são anexadas ao resultado. Validação de desktop pendente até a CI concluir.
