# Moon Themes — checkpoint de integração

Atualizado em 2026-08-26.

## Escopo ativo

- Fase A: contrato `.moontheme` v1, validação hostil, quarentena, prévia, confirmação, aplicação, remoção e rollback.
- Fase B: menu contextual nativo usando somente dados e APIs do Electron.
- Deep links, API pública e conta/sincronização aguardam os parâmetros oficiais descritos em "Dependências externas".

## Diagnóstico

| Área | Estado inicial | Direção |
| --- | --- | --- |
| Personalização | Store V2 funcional com preview/cancel/undo | Reutilizar como única aplicação visual |
| Temas | Registros simples no SQLite, sem pacote seguro | Estender sem quebrar temas legados |
| Downloads | DownloadManager já observa a sessão | Reutilizar `downloadURL` |
| Browser | Abas em `WebContentsView` | Menu no processo main |
| Segurança web | sandbox + contextIsolation; sem preload nas páginas | Preservar sem exceções |

## Invariantes

- Nenhum HTML, CSS, JavaScript ou fonte de pacote é executado.
- Nenhuma extração ocorre antes de validar estrutura, caminhos, tamanhos, hashes, assinatura, esquema e compatibilidade.
- Pacote importado entra em quarentena privada e só é promovido após confirmação explícita.
- Páginas web não recebem acesso à bridge do Moon.
- O menu contextual não usa scraping nem `executeJavaScript`.

## Baseline antes da mudança

- Typecheck: verde.
- Lint: verde.
- Unitários: 25 verdes.
- Integração: 14 verdes.

## Resultado dos gates

- Typecheck e lint: verdes.
- Unitários: 35 verdes, incluindo contrato e menu.
- Integração do shell: 14 verdes.
- Electron/SQLite: 6 verdes, incluindo ciclo completo e reinício do serviço de temas.
- E2E desktop: 5 verdes.

## Dependências externas

A Fase C não pode ser ativada com segurança sem domínio oficial, endpoint HTTPS de intents, formato de resposta e chaves públicas oficiais. A Fase D também exige issuer OAuth Device Authorization, client ID e escopos. O runtime não inventa endpoints, não aceita URL de pacote da página e não classifica uma chave desconhecida como oficial; pacotes autoassinados válidos aparecem como “local / não oficial”.
