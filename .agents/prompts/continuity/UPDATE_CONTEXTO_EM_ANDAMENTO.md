# Update Contexto em Andamento — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use quando a conversa ficou extensa, mas o trabalho ainda não terminou ou não foi formalmente documentado. Este prompt não fecha fase nem altera o repositório.

## Prompt

Gere um único bloco enxuto de continuidade da conversa atual.

## Regras

- Não implementar, editar arquivos ou atualizar documentação.
- Não marcar fase/subfase como concluída.
- Não inventar commit, baseline, arquivo, decisão, teste ou resultado.
- Não transformar intenção, hipótese ou discussão em fato.
- Separar fatos confirmados, inferências e decisões aceitas.
- Priorizar apenas o que ainda não está estável nos documentos ativos.
- Se não foi verificado se algo está documentado, registrar como “não confirmado”.
- Não repetir rules, escopo, roadmap, histórico de fases fechadas ou listas de comandos.
- Não gerar prompt de nova conversa nem explicar como usar o bloco.
- Alvo: até 300 palavras; máximo de 500 apenas se houver risco relevante.

## Formato

```md
# Continuidade de Conversa — RebanhoSync

## Tema e objetivo em andamento

[Assunto central e resultado buscado.]

## Estado confirmado

[Fatos comprovados, incluindo arquivos e validações somente quando informados.]

## Decisões aceitas

[Decisões explicitamente confirmadas pelo usuário.]

## Inferências e premissas

[Itens ainda não comprovados.]

## Pendências e dúvidas

[O que precisa ser decidido, executado ou validado.]

## Riscos e cuidados

[Até três riscos relevantes.]

## Não refazer

[Trabalho confirmado que não deve ser repetido.]

## Ponto exato de retomada

[Próxima ação mínima.]
```

Quando útil, referencie `ACTIVE_PHASE_PLAN.md`, `CORE_RULES.md`, `rtk.md` ou o documento ativo correspondente, sem reproduzir seu conteúdo.
