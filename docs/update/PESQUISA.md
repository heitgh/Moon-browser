# Pesquisa e recorte — 8 de setembro de 2026

A pesquisa serve para escolher um fluxo, não para declarar superioridade sem teste com usuários.

- A página consultada da [StatCounter](https://gs.statcounter.com/browser-market-share/desktop-/worldwide) mostra ampla liderança do Chrome. Participação observada não demonstra qualidade nem preferência livre de custos de troca. Não foi usada como meta de implementação.
- O estudo [Five Walled Gardens, Mozilla](https://research.mozilla.org/files/2022/10/Mozilla-Five-Walled-Gardens.pdf) sustenta a importância dos padrões e da arquitetura de escolha; é pesquisa de 2022, não um retrato atualizado de todos os navegadores.
- [Chrome Safety](https://www.google.com/chrome/safety/) reforça que segurança e compatibilidade são parte central do valor de um navegador.
- [Edge Workspaces](https://explore.microsoft.com/en-us/edge/features/workspaces) descreve abas e favoritos organizados por projeto. A experiência atual documentada não oferece compartilhamento/colaboração de workspaces; não repetir a descrição histórica como se fosse universal.
- [Vivaldi Workspaces](https://vivaldi.com/features/workspaces/) combina organização, Tab Stacks e mosaicos. O Moon não deve anunciar equivalência enquanto não tiver grupos e split view reais.
- [Opera Features](https://help.opera.com/en/latest/features/) e o [anúncio de Opera AI](https://blogs.opera.com/news/2025/12/opera-ai-comes-to-opera-one-opera-gx-opera-air/) mostram integração de ferramentas na experiência de navegação. O Moon não tem ainda um provider comparável.
- [Arc](https://arc.net/) é referência de organização e identidade; a inspeção desta página não é uma auditoria de manutenção ou segurança do produto.

## Decisão de produto

Hipótese: um estudante valoriza reunir trechos, referências e notas no próprio navegador e retomar as páginas sem reconstruir o contexto. O corte local permite testar essa hipótese sem transmitir conteúdo ou fabricar respostas de IA.

O objetivo de percepção de valor é concluir a primeira nota referenciada em poucos minutos. Ainda não houve estudo com novos usuários nem medição de retenção de 30 dias; esse prazo é meta, não resultado.

Foram adiados: modelo generativo sem provedor configurado, agentes com ações externas, terminal/SSH, VPN própria, sync remoto, marketplace, integração prematura com Nexus School, reconstrução integral e promessas de compatibilidade com todas as extensões.

## Referências técnicas verificadas

- [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents): mundo isolado e API de leitura/captura.
- [Node CLI](https://nodejs.org/api/cli.html): compatibilidade com Web Storage do runtime. A correção usa armazenamento DOM isolado nos testes, sem alterar a persistência do produto.
