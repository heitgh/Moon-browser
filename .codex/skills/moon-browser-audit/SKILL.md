---
name: moon-browser-audit
description: Audita segurança, atualização, privacidade, desempenho e compatibilidade do Moon Browser antes de alterar código.
---

# Moon Browser Audit

Use esta skill antes de modificar o Moon Browser.

1. Inventarie os arquivos, dependências, scripts, configurações de build e CI relevantes.
2. Registre cada achado com arquivo, linha, trecho e consequência observável.
3. Separe bug confirmado, risco de segurança, melhoria, dívida técnica e hipótese a validar.
4. Classifique P0, P1 ou P2; priorize atualização assinada, isolamento, IPC e dados sensíveis.
5. Proponha a menor correção revisável e um teste que possa refutar o achado.
6. Depois da mudança, compare o diff com o diagnóstico e execute os testes relevantes.
7. Informe arquivos alterados, testes executados, limitações e riscos residuais.

Não afirme que um recurso existe apenas porque há um contrato, flag ou documento sobre ele.
