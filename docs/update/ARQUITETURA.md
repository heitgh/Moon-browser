# Moon Research local e Moon Memory — 0.6 alpha

A flag `research` conecta a UI e o registrador IPC; `ai` continua bloqueada. A versão entrega extração determinística e armazenamento explícito, sem provedor generativo. Não há chave embutida, endpoint inventado ou chamada paga.

## Fluxo

`ResearchPanel → preload allowlisted → research-ipc → ElectronBrowserManager → mundo isolado da página`

O main valida janela, frame principal, privacidade, workspace, consentimento e limites. Um script fixo em mundo isolado lê apenas texto de HTML/texto simples; strings de páginas não são interpoladas em código. A captura verifica URL antes/depois, rejeita mudança de endereço, tem timeout de 5 segundos por aba e limita fontes/texto/nós visitados. O cancelamento descarta o resultado no painel; a leitura nativa já iniciada pode continuar até seu timeout, sem gravação ou transmissão externa.

`localResearch` seleciona passagens e mantém título, URL e índice da fonte. A localização por pergunta usa palavras; comparação mostra trechos iniciais, não inferência de diferenças; cartões pedem revisão com resposta textual de referência. Ausência de base é declarada. Não existe verificação semântica da verdade da página.

## Persistência

Notas usam o contrato `ProfileDataMutation` e os repositories existentes. Memória usa registros de settings `research:v1:<workspaceId>` dentro do SQLite do perfil. É uma adição compatível: nenhuma migration SQL publicada ou chave de `localStorage` foi reescrita.

O documento de memória tem versão, revisão, categorias permitidas, retenção e itens. Alterações exigem a revisão atual; habilitar categoria e inserir item são operações separadas. Cada item inclui ID, categoria, título, Markdown, URLs e datas. Fontes completas não entram automaticamente no banco. Expiração é aplicada ao carregar; exports e backups antigos têm retenção independente.

Snapshots guardam URLs HTTP/HTTPS não sensíveis do workspace, até 50, com deduplicação. A retomada aceita somente URLs presentes no item selecionado; bloqueia restaurações simultâneas na mesma janela e não duplica URLs já abertas naquele workspace. Não representa ainda snapshots de grupos, scroll, mídia ou estado interno de sites.

## Segurança e limites

- Nenhuma API privilegiada é exposta a páginas remotas; extração não executa instruções encontradas em texto.
- Janelas privadas/convidadas são recusadas antes do acesso ao armazenamento ou à fonte.
- Bloqueios por URL e presença de campos de senha são heurísticos. Não garantem identificação de saúde, bancos ou segredos inseridos em texto normal.
- Memória não criptografada, restrita a material não sensível e gravação manual. Exclusão lógica não significa sanitização forense de backups, SQLite/WAL ou disco.
- Quotas: 5 fontes, 60 mil caracteres/fonte, 20 mil nós visitados/fonte, 100 itens e 2 MB/workspace, 30 mil caracteres/item, 50 URLs/item.
- Provedor generativo, PDFs, recuperação semântica, classificação robusta de dados sensíveis e criptografia não foram implementados. Antes de conectar um provedor, aplicar o ADR 0005 com modelo real, consentimento contextual, chaves seguras, streaming, limites, cancelamento e auditoria.


## Adendo de compatibilidade e recuperação — 0.6.0-alpha.2

Cada `WebContents` recebe user-agent Chromium sanitizado; a `Session` persistente continua sendo a unidade de cookies, redirects, permissões e downloads. Popups reconhecidos como OAuth/SSO abrem em `BrowserWindow` sandboxed na mesma sessão, preservando `window.opener`; navegações comuns mantêm o comportamento de aba. O pipeline de política possui deadline de 1,5 s e falha aberto para não congelar a navegação. `render-process-gone` e `unresponsive` permitem no máximo duas recargas progressivas, evitando loops; erros de rede apresentados no shell são mensagens de produto, não códigos TypeScript/Chromium.

A validação do commit `c0ca1ba` cobriu cookie+302, popup/callback OAuth, crash forçado e sondas reais de Pinterest/TikTok. Login humano, CAPTCHA, macOS e observação prolongada de mídia continuam fora dessa evidência.
