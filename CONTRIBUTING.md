# Contribuindo com o Moon Browser

Obrigado por considerar uma contribuição ao Moon Browser. O projeto ainda está em fase experimental, então mudanças pequenas, bem descritas e fáceis de revisar são especialmente úteis.

## Antes de começar

- Use **Node.js 22+** e **npm 10+**.
- Procure por uma issue existente antes de abrir trabalho duplicado.
- Para mudanças maiores, descreva primeiro a proposta em uma issue.
- Evite misturar correções não relacionadas no mesmo pull request.

## Fluxo recomendado

1. Crie uma branch a partir da `main`.
2. Instale as dependências com `npm ci`.
3. Faça uma alteração pequena e focada.
4. Execute pelo menos `npm run typecheck`, `npm run lint` e os testes relacionados à área alterada.
5. Quando o ambiente permitir, execute `npm run quality` antes de abrir o PR.
6. Abra um pull request explicando o problema, a solução e como a alteração foi validada.

## Commits

Prefira mensagens objetivas, por exemplo:

- `fix: corrige restauração de abas`
- `feat: adiciona opção de layout`
- `docs: esclarece instalação no Linux`
- `test: cobre fluxo de memória local`

## Pull requests

Um bom PR deve informar:

- **O que mudou**
- **Por que a mudança é necessária**
- **Como foi testada**
- Screenshots ou gravações quando houver alteração visual
- Limitações conhecidas ou pontos que ainda precisam de validação

## Bugs e segurança

Bugs comuns podem ser reportados pelas Issues do GitHub. Problemas que possam expor dados, credenciais ou criar risco de segurança não devem ser publicados com detalhes exploráveis em uma issue pública; use o canal privado indicado pela política de segurança do projeto quando disponível.

## Escopo do projeto

O Moon prioriza ergonomia, personalização, privacidade e controle do usuário. Contribuições devem evitar prometer recursos que ainda não estejam implementados ou apresentar funcionalidades experimentais como estáveis.
