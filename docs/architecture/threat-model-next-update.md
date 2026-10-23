# Threat model — preparação da próxima atualização

Nexus Inc. · 2026-10-23. Complementa os modelos históricos; não é certificação de segurança.

| Fronteira | Ameaça | Controle implementado | Evidência / limite |
| --- | --- | --- | --- |
| Web → main | Site remoto/iframe invoca comando interno | Janela registrada, identidade WebContents, frame principal e documento exato no router | Unitários e E2E de navegação remota. XSS no shell permanece fora dessa garantia. |
| Argumentos → handlers | Payload excessivo, tipos inesperados | Limites estruturais globais + parsers do domínio | Unitários de tipos/tamanho/profundidade; parsers legados ainda exigem revisão contínua. |
| Frames → permissões | Confundir origem incorporadora com solicitante | requestingUrl / requestingOrigin do Chromium; origem opaca negada | Unitários de iframe e normalização; dispositivos reais pendentes. |
| Imagens → rede interna | SSRF por DNS/redirect/literal alternativo | IP público validado e fixado no lookup TLS; agente isolado; HTTPS/443; limites por recurso | Regressões DNS rebinding, redirects e endereços especiais; classificação conservadora. |
| Área → sessão | Referências órfãs ou perda de cookies ao mover | Comando de ciclo de vida, transação de sessão e partição original persistida | SQLite + E2E de cookie após reinício; concorrência multijanela adicional pendente. |
| Metadados de release → execução | Link arbitrário/instalação não verificada | Origem/repositório da release restritos; apenas abertura da página conferida | Unitários e E2E; sem instalação/execução automática. |
| Diagnóstico → privacidade | Coleta silenciosa de URLs/conteúdo | Opt-in, metadados mínimos, arquivos locais limitados, sem upload | Unitário de desativação e rotação; não captura stacks nativas completas. |

Sem mudanças neste pacote: criptografia em repouso, mecanismo completo de backup/migração, assinatura e rollback de instaladores, execução de modelos locais. Não publicar como proteção existente.
