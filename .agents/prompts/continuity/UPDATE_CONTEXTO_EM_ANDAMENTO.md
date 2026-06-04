# Update Contexto em Andamento — RebanhoSync

Use este prompt quando a conversa ficou extensa, mas a fase ou tarefa ainda não foi concluída.

Este prompt não fecha fase. Ele apenas preserva contexto para continuar em nova conversa.

## Prompt

Você é o assistente técnico do contexto atual.

Objetivo:
Gerar um contexto de continuidade para abrir uma nova conversa, sem encerrar a fase atual e sem assumir que houve conclusão.

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

## Tarefa

Produzir um resumo de continuidade da conversa atual, separando claramente:

1. o que está confirmado;
2. o que está em andamento;
3. o que foi decidido;
4. o que ainda não foi validado;
5. o que a próxima conversa deve continuar fazendo;
6. o que não deve ser refeito;
7. quais dúvidas ou riscos continuam abertos.

## Formato obrigatório

```md
# Continuidade de Conversa — RebanhoSync

## 1. Contexto atual

Descreva o objetivo da conversa e o trabalho em andamento.

## 2. Estado confirmado

Liste apenas fatos confirmados: arquivos, decisões, validações, resultados, commits ou documentos realmente citados.

## 3. Trabalho em andamento

Explique o que ainda está sendo construído/analisado e não deve ser tratado como concluído.

## 4. Decisões tomadas

Liste decisões já alinhadas que a próxima conversa deve respeitar.

## 5. Pendências abertas

Liste pendências reais, dúvidas, riscos ou validações ainda não feitas.

## 6. Próxima ação recomendada

Diga exatamente de onde a próxima conversa deve continuar.

## 7. Escopo permitido

Liste o que a próxima conversa pode fazer.

## 8. Escopo proibido

Liste o que a próxima conversa não deve fazer.

## 9. Prompt para iniciar a nova conversa

Crie um prompt curto e pronto para colar na nova conversa.
```

## Regras

- Separar fato confirmado de inferência.
- Não dizer que testes passaram se isso não foi informado.
- Não dizer que arquivos foram alterados se isso não foi confirmado.
- Não dizer que commit foi feito se isso não foi confirmado.
- Não reabrir fase fechada sem evidência.
- Não transformar roadmap em pendência técnica.
- Ser objetivo e específico.