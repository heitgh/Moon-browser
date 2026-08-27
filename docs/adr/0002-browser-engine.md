# ADR 0002 — Estratégia de engine

Status: Aceito  
Data: 24 de agosto de 2026

## Contexto

O Moon já possui navegação real e isolamento usando Electron/Chromium. Migrar agora para CEF ou manter um fork de Chromium/Gecko interromperia a recuperação do produto e criaria uma obrigação contínua de segurança, codecs, DRM, acessibilidade, extensões e distribuição.

## Decisão

Permanecer em Electron durante o MVP e manter o Electron na versão estável mais recente compatível com os adapters. Não iniciar fork de Chromium ou Gecko nesta etapa.

Uma nova decisão só poderá substituir esta após protótipo e estimativa de cinco anos cobrindo:

- equipe de C++/Rust e engenharia de release;
- cadence e SLA de patches de segurança;
- Windows, Linux, macOS e estratégia mobile;
- codecs/DRM, acessibilidade e compatibilidade web;
- matriz real de extensões;
- CI, signing, atualização e tamanho dos artefatos.

## Alternativas

- CEF: oferece embedding Chromium mais direto, mas transfere mais integração e distribuição para a equipe.
- Fork Chromium: máximo controle com custo operacional e de segurança incompatível com a fase atual.
- Gecko: GeckoView é uma opção concreta para Android; desktop exigiria uma linha de produto e manutenção de engine própria.

## Segurança

Electron reconhece que permanecer no stable mais recente é a melhor chance de receber correções do Chromium e que recursos como Safe Browsing não vêm automaticamente. O Moon precisa compensar isso com atualização rápida, threat model e controles explícitos.

## Referências

- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/sandbox
- https://www.electronjs.org/docs/latest/breaking-changes
- https://firefox-source-docs.mozilla.org/mobile/android/geckoview/index.html

