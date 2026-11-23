# Prontidão de release assinada — 2026-11-23

Escopo: código da `0.6.0-alpha.8` e a última release pública, `v0.6.0-alpha.7`. Este registro distingue correções no repositório de credenciais e testes operacionais ainda não comprovados. Nenhuma release `alpha.8` foi criada nesta revisão.

## Matriz de diagnóstico antes da mudança

| Classe / área | Evidência | Estado e risco | Correção recomendada | Prioridade | Teste de validação |
| --- | --- | --- | --- | --- | --- |
| Bug confirmado / documentação | `README.md` anterior, linhas 12 e 84–100: badge e seis links diretos para `alpha.5`; `gh release view v0.6.0-alpha.7` mostra os seis anexos `alpha.7` | Instruções principais atrasadas duas versões; usuários podem baixar a versão errada | Atualizar apenas o endereço público e separar código candidato de release publicada | P1 | Conferir nomes com a lista de anexos da release pública e procurar links `alpha.5` na seção Download |
| Risco de segurança / feed legado | Tag `v0.6.0-alpha.7`, `apps/desktop/electron/services/native-updater.ts:43–45`: `downloadUpdate()` seguido de estado `downloaded`, sem verificação independente de assinatura do AppImage; `alpha-linux.yml` está publicado | Instalações antigas aceitam o feed legado para releases futuras; a nova verificação Ed25519 não protege binários já instalados | Usar `signed-alpha`/`signed-beta`/`signed-latest` nos builds novos e não publicar manifestos legados | P0 | Testar nomes gerados pelo build, canal usado pelo updater e ausência dos manifestos legados nos artefatos publicados |
| Risco de segurança / assinatura Windows | `.github/workflows/release-desktop.yml` anterior, linhas 122–139: `Get-AuthenticodeSignature` cobre dois `.exe` em `release/`, sem conferir `win-unpacked` | Evidência de assinatura incompleta para o executável instalado | Verificar os três executáveis e o `publisherName` embutido | P1 | Gate Authenticode em runner Windows com certificado real |
| Melhoria / ensaio de release | `.github/workflows/release-desktop.yml` anterior, linhas 97–117: build assinado só com `publish_release=true` | Não havia como inspecionar um candidato assinado antes da publicação | Entrada `prepare_signed` para gerar artefatos assinados sem criar release | P1 | Disparar workflow em `main` com `prepare_signed=true` e confirmar artefatos, assinaturas e ausência de release |
| Dívida técnica / organização | `README.md` anterior, linhas 19–43 e 108–118: histórico `alpha.4`/`alpha.5` misturado com estado atual | Informação duplicada com `docs/releases/` e leitura inicial confusa | Reduzir o README ao estado público atual e apontar para notas/versionamento | P2 | Revisão de links e consistência entre README, changelog e página pública |
| Suposição a validar / credenciais e upgrade | `docs/security/release-policy.md:8–16`: exige Authenticode, GPG/Ed25519, CI e upgrade real; API de segredos do repositório respondeu HTTP 403 nesta sessão | Não há evidência de chaves de produção nem de upgrade `alpha.7 → alpha.8` em Windows/Linux | Rodar ensaio assinado e homologar em máquinas reais antes de `publish_release=true` | P0 | Resultado do workflow de ensaio, assinatura de cada pacote e roteiro de instalação/recuperação preenchido |

## Resultado exigido antes de publicar

- `prepare_signed=true` em `main` deve passar no Windows e Linux, sem artefatos públicos novos.
- O certificado Windows precisa ter cadeia confiável e identidade de publicador constante; a chave Ed25519 Linux precisa permanecer a mesma para upgrades posteriores. GPG deve assinar pacotes, checksums, SBOM e manifesto.
- Testar instalação limpa, migração manual da `alpha.7`, abertura do navegador, atualização a partir do canal assinado quando existir uma segunda versão, interrupção e falha de assinatura, backup/restauração e desinstalação.
- Documentar que Authenticode não garante aprovação imediata do SmartScreen; reputação de código e distribuição são fatores externos ao repositório.

O acesso de leitura aos segredos via `gh api repos/heitgh/Moon-browser/actions/secrets` retornou 403 (`Resource not accessible by integration`). Isso não prova ausência dos segredos. O workflow de ensaio é a verificação operacional disponível.

## Validação local desta revisão

- `npm run typecheck`, `npm run lint`, `bash -n` nos scripts de assinatura e `git diff --check` passaram.
- Os 7 testes focados de `native-updater` e `release-channel` passaram. O workflow YAML foi analisado por `js-yaml`.
- Um AppImage de teste com chave Ed25519 **temporária** gerou `signed-alpha-linux.yml` sem `alpha-linux.yml`; `npm run verify:fuses` confirmou os cinco fuses. A chave pública extraída do ASAR coincidiu com a chave de saída do build. Este artefato local não é publicável.
- Pendente: ensaio `prepare_signed=true` com credenciais de produção completas, verificação de Windows e instalação/upgrade em máquinas reais.

## Primeiro ensaio oficial

O [workflow `45252762103`](https://github.com/heitgh/Moon-browser/actions/runs/45252762103), executado na `main` após atualizar Electron para `45.4.1`, usou `prepare_signed=true` e `publish_release=false`. Os dois jobs de build falharam antes de assinar: o Windows informou falta de `WINDOWS_CSC_LINK` (variável `CSC_LINK` no runner) e o Linux informou falta de `LINUX_UPDATE_SIGNING_KEY_B64`. A checagem antiga parava no primeiro segredo ausente; os demais ainda precisam ser verificados. Nenhum instalador `alpha.8` foi publicado. A checagem foi movida para antes de `npm ci` e passou a listar todos os nomes ausentes para o próximo ensaio.
