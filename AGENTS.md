# Moon Browser — integração com o AI Brain

Este arquivo rege todo o repositório `/home/heitgh/Moon-browser`.

## Fontes de verdade

- O repositório `/home/heitgh/Moon-browser` é a fonte de verdade da implementação atual: código, configuração, testes e documentação versionada.
- O AI Brain em `/home/heitgh/Documents/AI-Brain` é memória persistente e contextual; ele não substitui a inspeção do repositório.
- A memória específica do projeto fica em `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser`.
- Antes de confiar em memória antiga, verifique sempre o código e o estado reais do repositório.
- Se houver divergência entre Brain e repositório, o repositório vence. Corrija a memória seletivamente quando isso for apropriado e estiver no escopo da tarefa.

## Recuperação de contexto

Para tarefas relevantes no Moon Browser, comece por:

`/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/STATE.md`

Depois, consulte somente o arquivo necessário para a dúvida concreta:

- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/ARCHITECTURE.md` para arquitetura, componentes, integrações e restrições;
- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/DECISIONS.md` para decisões vigentes e seus motivos;
- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/BUGS.md` para bugs relevantes, diagnósticos e estado;
- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/ROADMAP.md` para prioridades e direção futura;
- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/IDEAS.md` para hipóteses ainda não comprometidas;
- `/home/heitgh/Documents/AI-Brain/02_PROJECTS/Moon-Browser/MEMORY.md` para aprendizados duráveis que não cabem melhor nos demais arquivos.

Nunca carregue todos esses arquivos automaticamente. Amplie o contexto progressivamente e pare assim que houver informação suficiente. Sempre minimize o uso de tokens e contexto.

Quando políticas gerais forem realmente necessárias, use somente os documentos pertinentes:

- `/home/heitgh/Documents/AI-Brain/00_SYSTEM/BRAIN.md`;
- `/home/heitgh/Documents/AI-Brain/00_SYSTEM/CONTEXT_POLICY.md`;
- `/home/heitgh/Documents/AI-Brain/00_SYSTEM/MEMORY_POLICY.md`.

Não leia o Brain inteiro por conveniência.

## Fluxo de trabalho

- Para mudanças pequenas, inspecione o ponto afetado, implemente e valide sem planejamento excessivo.
- Para mudanças grandes, siga: `Understand -> Inspect -> Retrieve Memory -> Plan -> Implement -> Test -> Review -> Update Memory`.
- A etapa `Retrieve Memory` continua seletiva: comece em `STATE.md` e abra apenas a memória relacionada à tarefa.
- Em qualquer escala, preserve alterações existentes e use evidência do código e dos testes para concluir o trabalho.

## Escrita de memória

- Após mudanças significativas, considere atualizar seletivamente o Brain, somente quando isso estiver autorizado e dentro do escopo da tarefa.
- Não atualize memória por alterações triviais, cosméticas ou facilmente reconstruíveis pelo Git.
- `STATE.md` deve refletir o estado operacional atual do projeto: situação real, trabalho em progresso, bloqueios, riscos e próximos passos relevantes.
- Registre decisões importantes com contexto, motivo e consequência. Prefira entradas curtas, factuais e acionáveis.
- Nunca registre no Brain secrets, tokens, cookies, chaves, arquivos `.env`, credenciais ou qualquer material sensível.
- Nunca copie código-fonte inteiro para o Brain; aponte para arquivos e caminhos canônicos do repositório.
- Não registre logs extensos, conversas completas, raciocínio intermediário ou conteúdo duplicado.
