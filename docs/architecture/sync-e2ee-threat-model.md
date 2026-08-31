# Moon Sync E2EE — arquitetura, recuperação e threat model

Status: engine e provider de teste implementados; sincronização de produção desativada.

## Limite honesto do corte

O browser contém contratos `SyncEngine`, `SyncProvider`, `SyncRecord`, `SyncEnvelope` e `DeviceIdentity`, uma engine offline-first e um provider somente em memória para testes. Não existe endpoint, Moon ID, fluxo de autorização, política de privacidade ou trust root oficial. Por isso `mobile-sync` é um gate de release que nem overrides locais ativam, e a interface informa: **Sincronização em nuvem ainda não configurada**.

O fixture prova merge, tombstones, conflito determinístico, retry, cancelamento e criptografia; ele não representa uma nuvem disponível.

## Separação de segredos

- senha/login de uma futura conta autentica no serviço, mas não deriva nem recebe acesso aos dados;
- frase de criptografia é digitada localmente e nunca integra `SyncEnvelope` ou chamadas do provider;
- a frase deriva uma chave de wrapping com PBKDF2-HMAC-SHA-256, salt aleatório de 128 bits e 600.000 iterações;
- uma chave mestra aleatória de 256 bits criptografa os registros e é envolvida localmente pela chave derivada;
- identidades/chaves de dispositivo são contratos revogáveis e não substituem a chave mestra;
- a recovery key exportável contém a chave mestra e precisa ser tratada como o próprio conteúdo descriptografado.

PBKDF2 foi escolhido neste corte por estar disponível no WebCrypto do Electron sem dependência nativa. Os parâmetros ficam versionados no pacote envolvido. Uma troca futura por KDF memory-hard exige nova versão e migração, nunca alteração silenciosa.

## Envelope criptográfico

Cada registro usa AES-256-GCM, nonce aleatório único de 96 bits e tag de 128 bits. ID estável, categoria, versão lógica, dispositivo, timestamp e tombstone são metadados mínimos em claro e também entram como AAD; adulterá-los invalida a descriptografia. O payload serializado é sempre ciphertext. Testes procuram texto conhecido em envelopes e no provider e falham se houver plaintext.

Histórico começa desligado. Credenciais começam desligadas e exigem consentimento separado, além de E2EE ativa. Cookies, tokens de sessão, carteiras e chaves privadas não são categorias de sync.

## Merge, exclusão e recuperação

O primeiro sync faz união não destrutiva. O vencedor é escolhido, em ordem, por versão lógica, `updatedAt`, tombstone e ID do dispositivo. Empates são determinísticos. Exclusões viram tombstones; logout futuro não pode chamar reset remoto. `resetRemote()` é uma operação distinta e deve receber confirmação própria na futura UI.

Fluxo de recuperação planejado:

1. o usuário exporta conscientemente `moon-recovery-v1:*` e guarda fora do perfil;
2. num novo dispositivo, autentica a conta por um fluxo ainda a definir;
3. importa a recovery key localmente;
4. o dispositivo valida um envelope de teste antes de aceitar a chave;
5. o provider continua vendo apenas ciphertext;
6. depois da recuperação, o usuário pode revogar dispositivos anteriores.

Não existe recuperação pelo servidor sem a recovery key ou frase. A interface futura deve explicar esse risco antes da ativação.

## Ameaças e controles

| Ameaça | Controle atual | Risco residual / gate |
|---|---|---|
| Provider ou banco remoto lê dados | payload criptografado localmente; teste de ausência de plaintext | metadados mínimos revelam categoria e tempo |
| Replay ou downgrade de registro | versão lógica e metadata autenticada | provider real ainda precisa proteção de cursor/conta |
| Nonce reutilizado | 96 bits aleatórios novos por criptografia; teste de não repetição | saúde do CSPRNG depende do runtime |
| Alteração de categoria/ID/tombstone | AAD autenticada pelo GCM | negação de serviço continua possível |
| Frase enviada ao servidor | API do provider recebe apenas envelopes; chave derivada não é exportável | futura telemetria/logs deve passar auditoria |
| Dispositivo roubado | contrato de revogação, cofre com bloqueio automático | proteção da chave em repouso depende do backend do SO |
| Merge destrutivo inicial | união local/remota e vencedor determinístico | UX de conflitos ainda precisa de provider real |
| Exclusão acidental remota | tombstones e reset remoto separado | retenção/rollback depende do serviço futuro |
| Vazamento de senhas | categoria separada, opt-in duplo, cofre selado | captura/autofill bloqueados |

## Cofre de credenciais

`LocalCredentialVault` exige interação consciente para desbloquear, salvar, revelar ou excluir; normaliza uma origem HTTPS exata, impede revelação para outra origem e bloqueia automaticamente. Registros guardam o segredo selado por `SecretProtectionBackend`, separado das configurações. O backend seguro em memória existe exclusivamente para testes.

Esta build não integra Secret Service/libsecret, Keychain ou Credential Manager. `UnavailableSecretBackend` mantém o cofre indisponível, e captura/autofill são constantes `false`. Não há injeção de scripts em páginas remotas. Import/export de credenciais e sync ficam bloqueados até backend do SO, arquivo próprio criptografado, revisão de vazamentos e testes E2E de origem.

## Condições para liberar produção

- provider oficial e autenticação/Device Authorization definidos;
- política de privacidade, retenção, exclusão e exportação publicadas;
- armazenamento seguro da chave mestra por plataforma;
- auditoria independente de criptografia e logs;
- E2E contra infraestrutura real, incluindo recuperação e revogação;
- orçamento de payload, quota e proteção contra abuso;
- revisão separada do cofre antes de qualquer captura/autofill.
