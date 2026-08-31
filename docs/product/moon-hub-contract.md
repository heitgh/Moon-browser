# Moon Hub — contrato de fronteira do produto

Status: planejamento e contratos locais; nenhum portal, domínio ou serviço foi implementado neste repositório.

## Responsabilidades

O browser é responsável por perfis locais, consentimento, preview seguro, validação `.moontheme`/`.moonhome`, E2EE antes do upload, armazenamento de referências de token no backend seguro do SO e apresentação honesta de estados. Ele não deve conter client secrets, chaves privadas de assinatura do catálogo, regras de moderação remota ou URLs de infraestrutura codificadas.

O futuro serviço Moon Hub seria responsável por Moon ID, autorização de dispositivos, sessões de conta, armazenamento de ciphertext do sync, catálogo e blobs de temas/modelos, versionamento, moderação, denúncias, perfis públicos de criadores, documentação, notícias, comunidade e suporte. O serviço não recebe frase de criptografia, chave mestra ou payload de sync em claro.

## Autorização ainda a definir

`MoonHubAccountProvider` prevê Device Authorization: o browser solicita um código, mostra ao usuário a URI retornada pelo provider e faz polling limitado até receber uma referência de token. Issuer, client ID, scopes, endpoints, TTLs e política de refresh ainda não existem e não são inventados aqui. PKCE ou Device Authorization definitivo deve ser escolhido após threat model do serviço e registro público do cliente.

Senha/login da conta e frase de criptografia do sync permanecem fluxos distintos. Logout revoga/descarta a sessão da conta; não apaga dados remotos nem a recovery key. Reset remoto é uma operação separada da engine de sync.

## Recursos/API necessários

- iniciar e consultar autorização de dispositivo;
- renovar/revogar sessão e listar/revogar dispositivos;
- push/pull paginado de envelopes E2EE, cursor, quota e tombstones;
- reset remoto com confirmação reforçada e trilha de auditoria;
- criar e consultar exportação de dados e exclusão de conta;
- pesquisar/listar detalhes e versões de temas/modelos;
- resolver um intent opaco para bytes do pacote, com tamanho e MIME limitados;
- upload assinado, status de moderação, rollback e retirada emergencial;
- denúncia de malware, copyright, impersonation e abuso;
- changelog/documentação pública versionada.

Esses itens são capacidades abstratas. Não há hostname ou rota HTTP presumidos. Providers injetados implementam a interface e sua configuração pertence ao ambiente/release oficial.

## Intent e deep link de preview

O metadata contract `moon-hub-theme-intent` v1 contém somente:

- ação fixa `preview`;
- `intentId` opaco e expiração máxima de 24 horas;
- ID/versão do pacote;
- SHA-256 esperado;
- ID da chave de assinatura.

Ele não aceita URL, HTML, CSS, JavaScript ou bytes do tema. A rota interna reservada é `moon://themes/preview/<intent-id>`. Ao implementá-la, o browser deverá pedir os bytes ao `MoonHubCatalogProvider`, verificar hash/assinatura, passar pela quarentena `.moontheme` existente e exigir confirmação. A rota ainda não está registrada no navegador para evitar um deep link parcialmente funcional.

## Trust roots e rotação

- trust roots oficiais são distribuídos apenas em releases assinados do browser;
- o serviço publica cadeia/versionamento de chaves, mas não pode autodeclarar uma nova root confiável;
- rotação usa sobreposição de chaves antiga/nova e data de validade;
- revogação emergencial precisa de lista assinada, cache, modo offline e motivo auditável;
- temas de criadores podem usar chaves subordinadas; “oficial” nunca decorre apenas de nome/conta;
- rollback mantém a última versão local validada e não executa conteúdo declarativo fora das allowlists.

## Upload, direitos e moderação

O futuro fluxo exige prova de autoria/licença dos assets, hash imutável por versão, scanner de malware/ZIP bomb, revisão de SVG/MIME, classificação etária quando aplicável e aceite dos termos. Denúncias precisam de protocolo, prazo, recurso e registro de decisão. Takedown não apaga silenciosamente instalações locais; o browser mostra o risco e oferece rollback/desativação. Reincidência, impersonation e manipulação de avaliações precisam de políticas públicas.

## Privacidade e direitos do usuário

- minimização de dados e finalidade explícita por categoria;
- histórico e credenciais desligados por padrão;
- exportação legível de conta e catálogo, separada da recovery key;
- exclusão de conta/dados com prazo, retenções legais declaradas e recibo;
- revogação de dispositivo sem reset automático do perfil local;
- logs sem frase, chave, payload descriptografado ou tokens;
- localização/região de armazenamento e subprocessadores publicados;
- perfis de criadores públicos somente por opt-in.

## Dependências que bloqueiam ativação

1. entidade operacional, termos, política de privacidade e processo de suporte;
2. domínio/infraestrutura oficiais e proteção contra abuso;
3. issuer OAuth/Device Authorization, client registration e backend seguro de token;
4. provider de sync, quotas, retenção, backup e disaster recovery;
5. PKI/trust roots, pipeline de assinatura e rotação;
6. moderação, copyright, denúncias e resposta a incidentes;
7. auditoria de segurança/E2EE e E2E contra infraestrutura real;
8. observabilidade que prove ausência de segredos em logs.

Até esses gates existirem, Moon Hub, conta, catálogo remoto, upload e sync em nuvem permanecem indisponíveis na UI de produção.
