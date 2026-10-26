# Próxima atualização — segurança e estabilidade

Nexus Inc. · 26/10/2026 · desenvolvimento, sem release ou novos instaladores.

## Primeiro conjunto implementado

- Downloads anônimos possuem escopo por janela, separado do perfil normal em listagem, broadcasts e comandos. Ao fechar, os metadados são removidos e transferências ainda ativas são canceladas; arquivos já salvos permanecem no disco. Eventos nativos tardios não recriam os registros. Popups herdam o escopo da janela que os abriu.
- Encerramento executa flush/destruição de abas antes de fechar o banco. Um prazo global de cinco segundos força saída com código 1 se uma etapa não terminar. Diagnóstico local opt-in registra o nome da etapa, sem URLs; a gravação do último diagnóstico é best effort e pode não terminar antes da saída forçada. O fallback pode interromper gravações pendentes e não substitui a investigação de MB-016.
- Fechar durante `loadFile` pode abortar a navegação. Esse cancelamento durante shutdown não deve disparar o caminho de falha de inicialização e alterar a saída normal para código 1. O novo ensaio alterna fechamento imediato e após o evento load.
- A conexão SQLite verifica integridade antes de configurar o perfil para escrita. Migrações recusam versões desconhecidas em `moon_migrations`. Antes de migrações pendentes, ProfileStorage cria snapshot pela API SQLite de backup em `migration-backups/`, com permissões locais restritas e rotação de três cópias. Erro de backup impede a migração; não há restauração automática nem sobrescrita silenciosa do perfil danificado.

A verificação completa de integridade tem custo proporcional ao banco. Falta medir perfis muito grandes. A guarda de versão usa o registro de migrações existente; não introduz um segundo controle divergente em `user_version`.

## Validação desta implementação

- Typecheck e lint passaram, incluindo a repetição após o ajuste final de shutdown.
- 208 testes unitários passaram (46 arquivos), incluindo acesso cruzado de downloads/eventos tardios e deadline de flush travado.
- 35 testes de integração passaram.
- 25 testes Electron/SQLite passaram, incluindo schema futuro, backup legível após rollback e falha de escrita do backup sem alteração do schema.
- Primeiro E2E paralelo, excluindo a importação headless já conhecida: 14 passaram, 2 falharam, 2 probes externos pulados. Falharam o novo harness (consultava `application.process()` depois de fechar) e wallpaper (esperava running, recebeu paused).
- Após corrigir o harness e executar serialmente: 15 passaram, 1 falhou, 2 probes pulados. O wallpaper passou; o ensaio novo detectou saída 1 ao fechar durante carregamento, com `ERR_FAILED` em loadFile. Isso motivou a guarda de shutdown no tratamento de erro de inicialização. Não foi identificado como causa comprovada do MB-016 histórico.
- O teste de importação de personalização não foi removido nem marcado skip no código. Foi excluído explicitamente desse comando local porque o ambiente não tem Xvfb e já encerrou o processo nesse fluxo na revisão anterior. Continua obrigatório na matriz de CI com desktop.

- Após a correção da corrida em loadFile, o teste de 30 ciclos passou sozinho (11,9 s) e na rodada de regressão serial: **16 E2E passaram, 2 probes externos pulados**, em 37,3 s. Comando: `MOON_HEADLESS=1 npm run test:e2e -- --workers=1 --grep-invert 'exports and imports customization'`. O cenário de importação permanece fora desta execução, com limitação explicitada acima.
- O prazo de saída depende de o event loop continuar responsivo; não é um watchdog externo contra bloqueio nativo síncrono.

## Ainda necessário antes da release

Consentimento emitido pelo main para Research; confirmação de abertura de executáveis; recuperação de perfil na UI; importação de personalização em ambiente com desktop; isolamento privado de downloads em E2E real; Windows/Linux no CI; hardware/GPU e login humano. Nenhum destes itens é declarado concluído.

O package.json continua na versão publicada alpha.4 até fechar o escopo e a validação da nova versão. README/CHANGELOG identificam claramente desenvolvimento separado da release pública.
