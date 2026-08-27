# ADR 0004 — Workspaces, perfis e partições

Status: Aceito  
Data: 24 de agosto de 2026

## Contexto

Hoje todo workspace recebe uma partição persistente própria. Isso isola cookies e login como efeito silencioso de uma organização visual.

## Decisão

Separar dois conceitos:

- workspace organiza abas, layout e contexto;
- container/profile define isolamento de cookies, cache, permissões e extensões.

Por padrão, workspaces usam o perfil persistente padrão. O usuário poderá optar por um container isolado por workspace, com explicação e migração. Abas privadas usam partições em memória compartilhadas apenas dentro da mesma sessão privada e nunca são restauradas.

Durante a transição, as partições existentes não serão apagadas. Um migrador deverá detectar o modelo antigo e pedir uma escolha antes de consolidar dados.

