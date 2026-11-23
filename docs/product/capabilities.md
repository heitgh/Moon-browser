# Capacidades e limites da alpha.8

O Moon integra páginas selecionadas, trechos citados, notas locais e sessões por workspace para quem pesquisa em várias abas sem exigir uma conta ou nuvem. Esse fluxo é o problema concreto que o projeto procura resolver melhor que o fluxo padrão dos navegadores comparados; ainda faltam testes de usuários para medir o ganho.

| Capacidade | Moon atual | Firefox, Brave e Chromium puro |
| --- | --- | --- |
| Pesquisa local com fontes → nota → retomada por workspace | Experimental e integrada na UI | Não é um fluxo nativo equivalente em todos os três; extensões/serviços podem preencher a lacuna |
| Atualizações e assinatura | Código de gate preparado; nenhuma alpha.8 assinada/homologada publicada | Canais e assinaturas de produção maduros |
| Extensões | Desativadas no produto; subconjunto MV3 planejado | Ecossistemas amplos, com diferenças entre Firefox e Chromium |
| DRM e sites bancários | Sem homologação | Compatibilidade muito mais ampla, ainda sujeita a cada site |
| Sync, senhas e autofill | Não operacionais | Recursos maduros nos três, com modelos de privacidade distintos |
| Privacidade local | Partições privadas e bloqueio de rastreadores; DB não criptografado | Recursos e limites variam por navegador e SO |

## Funções verificadas e planejadas

| Função | Estado no código | Próximo critério de aceite |
| --- | --- | --- |
| Downloads | Lista, progresso, pausa/retomada/cancelamento e abertura; inspeciona executáveis antes de **abrir** e pede confirmação | Reputação/quarentena antes de salvar, MIME real e testes por SO; download privado escolhido fica no disco |
| Impressão | Comando no menu de contexto | E2E com destino PDF e impressora real |
| DevTools | Menu do aplicativo | Validar acessibilidade e fluxo de diagnóstico em build assinado |
| Tradução | Comando abre Google Translate para a URL após clique | UI deve explicar que a URL vai a terceiro; tradução local não existe |
| PDF | Extração/visualizador próprio não implementados | Definir tratamento do PDF no Chromium e testes de impressão/download; não prometer visualizador avançado |
| Sync, cofre de senhas e autofill | Contratos/flags, sem integração operacional | Criptografia, modelo de ameaça, recuperação e testes entre dispositivos |
| IA generativa | Flag desativada | Caso de uso, fornecedor/modelo, consentimento e avaliação de privacidade antes de implementar |
| Acessibilidade | `lang=pt-BR`, foco visível e alguns ARIA; não houve auditoria completa com leitor de tela | Teste de teclado, NVDA/Orca/VoiceOver, zoom e contraste em SOs reais |

A UI principal está em português brasileiro. Há documentação técnica histórica em inglês; novos guias de produto devem usar português e a migração de textos existentes deve preservar links e exemplos de código.
