# ADR 0005 — Moon Intelligence e providers

Status: Aceito  
Data: 24 de agosto de 2026

## Decisão

Moon AI permanece desativada como feature real até existir ao menos um provider end-to-end. Providers rodam no processo principal ou serviço isolado; secrets ficam no keychain do sistema; a UI recebe apenas dados sanitizados e eventos de streaming.

Priorizar provider local quando viável. Providers remotos são opt-in e devem exibir provider, modelo, fontes e conteúdo que será enviado. Consentimento distingue uso único, sessão e política revogável.

Conteúdo de páginas é dado não confiável. Ações com efeitos externos exigem aprovação; texto gerado nunca é executado como JavaScript. Modo privado não alimenta memória persistente por padrão.

Critério mínimo para ativação: consentimento, streaming, cancelamento, timeout, erro visível, budget, provenance e testes.

