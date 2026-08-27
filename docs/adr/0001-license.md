# ADR 0001 — Licença e proveniência

Status: Aceito para a fundação; revisão jurídica necessária antes de incorporar código histórico  
Data: 24 de agosto de 2026

## Contexto

A fundação atual declara MIT em `LICENSE` e `package.json`. A documentação histórica do protótipo citava MPL-2.0. Misturar código das duas bases sem registrar proveniência pode tornar a distribuição ambígua.

## Decisão

Manter MIT para o código original da nova fundação. O repositório histórico será usado como referência de requisitos e identidade, não como fonte para copiar implementação. Qualquer migração textual de código ou assets históricos exige, antes do merge, registro de origem, titularidade e compatibilidade de licença. Se a proveniência não puder ser comprovada, a capacidade será reimplementada de forma limpa.

## Consequências

- `LICENSE` não será alterado silenciosamente.
- Toda contribuição nova deve ser compatível com MIT.
- Uma auditoria jurídica continua obrigatória antes de distribuição comercial caso código histórico seja incorporado.

