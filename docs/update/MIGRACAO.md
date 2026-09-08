# Migração, distribuição e rollback

**Status: integração no repositório original e publicação NÃO INICIADAS.** A cópia de trabalho isolada preserva as alterações locais anteriores em um commit de baseline. O repositório original e perfis pessoais não foram alterados por esta tarefa.

## Antes de atualizar usuários

1. Aprovar o diff, a versão, os testes e os limites conhecidos.
2. Homologar a instalação/atualização/desinstalação no sistema de destino. Execução a partir de um diretório extraído não prova integração com todos os gerenciadores de pacotes.
3. Fechar todas as janelas/processos do Moon. Identificar o diretório real de dados usado por aquela instalação (`userData`), inclusive quando houve `--user-data-dir` personalizado.
4. Copiar **o diretório inteiro**, incluindo `profile`, `profiles`, partições Chromium, bancos e respectivos arquivos WAL/SHM. Manter a cópia protegida e fora do destino da atualização. Não copiar um banco ativo isoladamente.
5. Verificar a integridade da cópia e dos instaladores. SHA-256 verifica integridade, não substitui assinatura/autenticidade.
6. Atualizar primeiro uma cópia de teste do perfil. Conferir favoritos, histórico, notas, temas, sessões e permissões. Não iniciar duas versões simultaneamente no mesmo diretório.

As configurações V4 e os schemas existentes são mantidos. A memória nova ocupa settings versionados separados. Nenhuma migration SQL publicada foi alterada; a importação legada preservada possui testes de idempotência e backup. A exportação JSON antiga não cobre todo o novo produto e não substitui a cópia integral.

## Rollback exato

1. Fechar a versão nova por completo.
2. Copiar o diretório usado pela nova versão para uma pasta separada, preservando dados criados depois da atualização.
3. Restaurar a cópia integral feita antes da atualização para um diretório de recuperação separado; não mesclar SQLite/WAL entre versões.
4. Iniciar o artefato da versão anterior apontando `--user-data-dir` para esse diretório restaurado.
5. Conferir os mesmos dados de referência e manter a cópia pós-atualização até decidir como importar/exportar as alterações novas.

A validação automatizada `scripts/development/verify-upgrade.ts` cria dados fictícios na fonte anterior, fecha, copia o perfil, executa o artefato novo, reinicia e valida rollback a partir da cópia integral. Os caminhos e resultados efetivos estão no relatório. Isso não autoriza substituir perfis pessoais nem confirma todas as versões antigas possíveis.

## Integração revisável

- Fonte original de referência: `heitgh/Moon-browser`; desenvolvimento prévio: `heitgh/Moon-tests-1`.
- Cópia desta tarefa: branch `codex/moon-super-update`, criada do checkout local com todas as alterações existentes preservadas.
- Antes de integrar, atualizar a leitura dos remotos e comparar com o estado atual; as referências locais podem estar antigas. Proteções de branch e revisores do ambiente GitHub precisam ser confirmados no servidor.
- Integrar por branch/PR após aprovação específica. Não usar force push, reset destrutivo ou cópia indiscriminada de diretórios.
- Transportar código, documentação e capturas; excluir dependências, logs, perfis de teste, caches, `.env`, artefatos antigos e arquivos de evidência que contenham caminhos locais.

## Travas de release

O empacotador sempre usa `--publish never`. O workflow não publica em push/tag automaticamente; publicação exige disparo manual com opt-in, jobs de qualidade e build aprovados e o ambiente `release-approval`. **Configurar revisores obrigatórios desse ambiente no GitHub é um requisito operacional externo**, não comprovado por uma linha de YAML.

O workflow recusa versão/tag divergente e release já existente, não usa `--clobber` e publica esta alpha como prerelease. Artefatos incluem a versão no nome. Não há atualizador assinado operacional; atualização automática interrompida, assinatura inválida e downgrade seguro não estão homologados. Nenhum link de download público novo foi criado.
