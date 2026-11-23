# Requisições de rede iniciadas pelo Moon

Esta lista cobre o código da alpha.8. O tráfego normal das páginas visitadas, cookies, subrecursos e serviços de login pertence ao site aberto pelo usuário.

| Origem | Destino | Quando ocorre | Controle e dados enviados |
| --- | --- | --- | --- |
| Verificador de versão (`update-checker.ts`) | `api.github.com/repos/heitgh/Moon-browser/releases` | Cerca de 1 s após abrir a UI e a cada 6 h, se `moon:automatic-updates` estiver ativo; consulta manual nas configurações | GET com metadados HTTP normais e IP; configuração permite desligar consulta automática. O verificador não envia histórico nem URL de páginas. |
| Download nativo (`native-updater.ts`) | Anexos do release oficial no GitHub e CDN de download | Após ação de baixar uma atualização conferida | Baixa manifesto, instalador e assinatura do AppImage; versão/plataforma ficam visíveis nas requisições. Instalação exige segunda ação. |
| Favicons (`browser-shell.ts:847-860`, `product-ipc.ts`) | URL HTTPS de favicon anunciada pelo site aberto | Quando ícones estão habilitados e uma aba fornece favicon ainda não cacheado | Faz GET da URL do ícone, com IP e cabeçalhos de rede usuais. Pode ser desabilitado nas configurações. Não consulta um serviço global de favicon. |
| Wallpaper remoto (`customization-center.ts`) | URL HTTPS escolhida pelo usuário | Após escolher ou informar wallpaper remoto | GET da imagem, com validação de IP, redirects, MIME e tamanho. |
| Busca e tradução | Buscador escolhido; Google Translate no comando Traduzir | Somente após pesquisa ou clique do usuário | Termo de busca ou URL da página pode ser enviado ao serviço escolhido. |
| Listas de bloqueio (`adblock-service.ts:39-47`) | `raw.githubusercontent.com/ghostery/adblocker/<commit>/packages/adblocker/assets/...` | Inicialização do app, se o cache da versão fixada ainda não existir; ocorre mesmo quando a proteção está desligada | Cerca de 15 listas/recursos são buscados pela dependência Ghostery. O Moon reescreve URLs `master` para o commit `6f0610bf5eec1f31c4975ce0e707cdf47023e5b5` e rejeita outros caminhos. Consulta automática sem opt-in específico continua pendente; o cache local evita novas consultas enquanto válido. |
| Diagnóstico local (`local-diagnostics.ts`) | Nenhum | Só com `MOON_LOCAL_DIAGNOSTICS=1` | Arquivo local, sem envio automático. |

Não foi encontrada integração operacional de telemetria, crash reporting remoto, sugestões de busca em rede, Safe Browsing remoto ou sync. A ausência desses serviços **não** implica proteção equivalente contra phishing/malware. A configuração declarativa de DoH em `config/network-config.ts` ainda não instala um resolver Chromium; não a apresentar como funcional.
