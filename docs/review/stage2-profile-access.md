# Proteção de acesso aos perfis — Nexus Inc.

A etapa 1 foi integrada na main pelo PR #37. Esta etapa adiciona proteção de acesso pelo aplicativo, não criptografia de arquivos. Quem controla a conta e os arquivos do sistema pode remover essa proteção. Não há recuperação de senha; a ativação exige confirmação nativa explícita desse limite.

## Implementação

- `ProfileAccessService`: scrypt com sal aleatório, comparação constante, hash fora do banco e dos backups do perfil, escrita temporária sincronizada e rename, limite de tamanho do registro e atraso progressivo persistido.
- `ProfileAccessController`: janela isolada sem acesso à API do navegador; desbloqueio antes de abrir SQLite; bloqueio de IPC antes e após operações; bloqueio manual, por inatividade e pela tela do sistema (Windows/macOS).
- Bloquear oculta todas as janelas do perfil, grava a sessão e destrói as superfícies. Uma falha de gravação preserva a janela oculta até o desbloqueio. A janela de acesso não pode ser fechada enquanto houver janela preservada.
- O gerenciador de perfis expõe ativar, alterar/remover senha e configurar bloqueio. Exclusão de outro perfil persistente também passa pela autorização do perfil de destino.
- Instância secundária e URLs externas não contornam a janela de desbloqueio.

## Validação

`npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration` e `npm run compile`.

Os testes `tests/e2e/profile-access.spec.ts` exercitam interface, senha incorreta/correta, reinício, notas preservadas, bloqueio manual/automático e segunda instância. Neste ambiente a execução foi bloqueada pelo sistema ao criar o socket Unix de instância única do Chromium (`Operation not permitted`), antes de abrir a interface. A proteção de instância única não foi desativada. A validação de interface em Windows/Linux ainda precisa passar na CI antes de integração ou publicação.

## Pendências da atualização completa

Monitor de recursos, suspensão segura, revisão de privacidade/UX, IA contextual e ações controladas continuam etapas separadas. Esta alteração não publica nova versão, não altera o feed de atualização e não afirma que todos os usuários foram notificados.

## Reprodução manual

1. Abra uma janela normal e entre em Gerenciar perfis → Segurança do perfil. Informe e confirme uma senha de pelo menos oito caracteres e escolha Ativar proteção. Leia e confirme o aviso nativo.
2. Salve uma nota e abra duas abas. Encerre pelo menu Sair e reinicie com o mesmo diretório de dados. Somente a janela Perfil bloqueado deve aparecer.
3. Informe senha incorreta: a interface deve recusar e aplicar espera progressiva. Informe a correta: confira nota e abas restauradas.
4. Em Segurança do perfil, clique Bloquear agora. Todas as janelas desse perfil devem desaparecer, inclusive as privadas. Uma segunda execução e um link externo não devem abrir conteúdo antes de desbloquear.
5. Configure bloqueio por inatividade de um minuto, informando a senha atual. Deixe o computador inativo por esse período; o próximo ciclo de verificação (até cinco segundos) deve bloquear. Em Windows/macOS, teste também o bloqueio da tela do sistema.
6. Tente alterar/remover com senha incorreta: deve recusar. Após a espera, use a senha correta. Confira que remover a proteção não apaga os dados.
7. Navegue pelos controles com Tab e Shift+Tab, abra os detalhes com Enter e envie o formulário com Enter. Confira os rótulos e mensagens de status no leitor de tela do sistema. Essa verificação com leitor de tela real ainda não foi realizada neste ambiente.
