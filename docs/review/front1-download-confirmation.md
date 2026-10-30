# Moon Browser — confirmação de executáveis antes da abertura

Nexus Inc. · 30/10/2026 · alteração experimental, **não publicada**.

Ao clicar em **Abrir** na barra de downloads, o processo principal verifica o estado concluído, escopo do perfil e indícios de arquivos executáveis. Extensões de instaladores, scripts e atalhos perigosos exigem uma confirmação nativa específica, com nome, origem e caminho; o botão padrão é **Cancelar**. O método `shell.openPath` somente é chamado depois da decisão positiva. O reconhecimento adicional de assinaturas MZ/PE, ELF, Mach-O, Java class e shebang permite detectar algumas tentativas de renomear executáveis para extensões inofensivas.

O detector **não é antivírus** e não garante identificação de todos os formatos ou scripts. Ainda são necessários testes de diálogo real em Windows e Linux e verificação de que o arquivo não mudou durante a decisão. A autorização nunca é enviada pelo renderer como uma promessa de consentimento.

Testes previstos: `tests/unit/download-manager.test.ts` e conjunto `Quality` Windows/Linux.

Esta entrega está num PR encadeado sobre `fix/stage1-shutdown-recovery` e não deve ser mesclada antes de validar a recuperação do perfil.
