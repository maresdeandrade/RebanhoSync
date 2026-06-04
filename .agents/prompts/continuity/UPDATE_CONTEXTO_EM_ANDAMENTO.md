# Update Contexto em Andamento — RebanhoSync

Use este prompt quando a conversa ficou extensa, mas o trabalho ainda não foi concluído ou ainda não foi formalmente documentado.

Este prompt não fecha fase, não atualiza documentação permanente e não define como o contexto será usado depois. Ele apenas preserva o estado útil da conversa atual.

## Prompt

Você é o assistente técnico do contexto atual.

Objetivo:
Gerar um bloco enxuto de continuidade para preservar o que está sendo tratado nesta conversa, especialmente aquilo que ainda não está documentado no repositório.

## Restrições

- Não implementar nada.
- Não alterar código.
- Não atualizar roadmap como se a etapa tivesse sido concluída.
- Não marcar fase/subfase como fechada.
- Não inventar validações.
- Não inventar commit.
- Não inventar arquivos alterados.
- Não transformar intenção em fato concluído.
- Não transformar discussão em decisão se não houve aceite.
- Não gerar prompt de nova conversa.
- Não explicar como o usuário deve usar o contexto.

## Tarefa

Produzir um resumo de continuidade da conversa atual, separando claramente:

1. o que está confirmado;
2. o que está em andamento;
3. o que foi decidido;
4. o que ainda não foi validado;
5. o que a próxima conversa deve continuar fazendo;
6. o que não deve ser refeito;
7. quais dúvidas ou riscos continuam abertos.

## Limite do contexto gerado

Produzir apenas um bloco de continuidade da conversa atual.

O bloco deve preservar:

1. tema central da conversa;
2. objetivo em andamento;
3. decisões já aceitas;
4. pontos ainda em discussão;
5. fatos confirmados;
6. inferências ou premissas;
7. pendências reais;
8. riscos ou cuidados;
9. arquivos, documentos, prompts ou áreas citadas;
10. ponto exato de retomada.

## Limite do contexto gerado

O resumo deve conter apenas o que agrega continuidade.


Não repetir:

- regras permanentes já documentadas;
- escopo permitido/proibido já documentado;
- roadmap completo;
- histórico longo de fases fechadas;
- listas extensas de validações já descritas em `.agents/rules/rtk.md`;
- prompt completo de nova conversa;
- instruções sobre como usar o contexto.

Preferir referências:

- “seguir `ACTIVE_PHASE_PLAN.md`”;
- “seguir `.agents/rules/CORE_RULES.md`”;
- “seguir `.agents/rules/rtk.md`”;
- “ver documentos ativos em `docs/review/`”.

## Formato obrigatório

```md
# Continuidade de Conversa — RebanhoSync

## 1. Tema tratado

[Resumo objetivo do assunto central da conversa.]

## 2. Objetivo em andamento

[O que estava sendo buscado/construído/analisado.]

## 3. Estado confirmado

[Fatos confirmados na conversa. Não inventar validações, commits ou arquivos.]

## 4. Decisões aceitas

[Decisões explicitamente alinhadas pelo usuário.]

## 5. Pontos ainda não documentados

[Conteúdo relevante desta conversa que ainda não consta claramente na documentação do projeto.]

## 6. Pendências e dúvidas

[O que ainda precisa ser confirmado, decidido ou validado.]

## 7. Riscos e cuidados

[Riscos de interpretação, regressão, duplicidade, drift documental ou consumo excessivo de contexto.]

## 8. Ponto de retomada

[Frase curta indicando de onde a conversa deve continuar.]

## Regras

- Separar fato confirmado de inferência.
- Priorizar o que ainda não está documentado.
- Não repetir conteúdo já estável do repositório.
- Não dizer que testes passaram se isso não foi informado.
- Não dizer que arquivos foram alterados se isso não foi confirmado.
- Não dizer que commit foi feito se isso não foi confirmado.
- Não reabrir fase fechada sem evidência.
- Não transformar roadmap em pendência técnica.
- Não gerar prompt de nova conversa.
- Ser objetivo e específico.
- Alvo preferencial: até 300 palavras.
- Máximo: 500 palavras, salvo se houver risco relevante ainda não documentado.