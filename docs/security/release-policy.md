# Política de atualização e publicação

Meta de manutenção para versões distribuídas: incorporar correções **críticas** do Electron/Chromium em até **cinco dias úteis** após uma versão corrigida compatível ficar disponível. Falhas graves no próprio Moon exigem triagem no mesmo dia útil e podem exigir suspender downloads até sair uma correção. Esta meta deve ser medida por release, com data do aviso, versão do Electron/Chromium e resultado dos gates; não significa que a alpha atual já esteja homologada.

Os canais são `stable` (sem sufixo) e `beta` (`-beta.N`); `alpha` permanece experimental. O verificador não oferece alpha a beta nem prerelease a stable. Não há downgrade automático. Se uma versão falhar, retire o release do feed, publique uma versão maior corrigida e forneça instruções de restauração manual. O backup SQLite antes de instalar **não** inclui cookies nem partições Chromium. Não há rollback transacional de instalador.
O download diferencial está desativado no código atual: a verificação de assinatura Ed25519 cobre o AppImage completo e a economia de banda não compensa perder um caminho de verificação simples antes de homologar o updater.

## Gate de publicação

1. Bump de versão e notas, lockfile íntegro, CI Windows/Linux, E2E, `npm audit --audit-level=high`, SBOM CycloneDX e fuses verificados.
2. Windows: certificado Authenticode provisionado via `WINDOWS_CSC_LINK`/`WINDOWS_CSC_KEY_PASSWORD`, nome distinto completo em `WINDOWS_PUBLISHER_NAME`; `forceCodeSigning` e `Get-AuthenticodeSignature` devem passar. Confirmar `publisherName` no `app-update.yml` empacotado.
3. Linux: `LINUX_GPG_PRIVATE_KEY_B64`, `LINUX_GPG_FINGERPRINT`, `LINUX_GPG_PASSPHRASE` e chave Ed25519 `LINUX_UPDATE_SIGNING_KEY_B64` provisionadas fora do Git. O build embute a chave pública Ed25519; o workflow assina AppImage, pacotes, checksum, SBOM e manifesto, e verifica tudo antes de publicar. O atualizador do AppImage exige a assinatura Ed25519 do arquivo recebido. A assinatura GPG permite verificação independente dos downloads; não cria, por si só, um repositório apt/rpm assinado.
4. Usar somente `workflow_dispatch` na branch `main`, com `publish_release=true` e tag exatamente igual à versão do código. Segredos de assinatura são injetados somente nos passos de build assinado em `main`; PRs executam build de teste sem esses segredos. O workflow recusa release existente e artefatos incompletos. O ambiente `release-approval` continua sendo um gate do GitHub configurado fora do repositório.
5. Testar instalação, upgrade da versão anterior, interrupção de download, certificado inválido, restauração e remoção em máquinas Windows/Linux reais antes de promover beta/stable. Para macOS/ARM, exigir workflow, assinatura e notarização próprios antes de declarar suporte.

Chaves comerciais não são incluídas no repositório. Sem elas, o código pode gerar build de teste, mas **nenhuma release assinada deve ser anunciada**. Builds de desenvolvimento sem raiz de confiança não disponibilizam instalação nativa pelo atualizador.
