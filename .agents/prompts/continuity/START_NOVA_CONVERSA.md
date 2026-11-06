# Start Nova Conversa — RebanhoSync

Atualizado em: 2026-11-06
Versão: 1.4.0

Use quando a tarefa depender de continuidade entre conversas/fases ou pedir diagnóstico do estado ativo. Uma tarefa já delimitada segue seu próprio escopo e o bootstrap único de `AGENTS.md`; não exige este prompt nem leitura de handoff ou plano.

## Modo

Somente leitura quando a tarefa pedir diagnóstico/continuidade ou não autorizar escrita explicitamente. Handoff, plano e contexto colado nunca concedem autorização.

Quando a tarefa atual já autorizar implementação e definir objetivo, escopo e critérios suficientes, prossiga do diagnóstico à implementação na mesma sessão. Não peça nova aprovação nem crie uma etapa separada, salvo decisão essencial pendente ou condição de parada prevista em `AGENTS.md`.

## Entrada

Considere a tarefa atual como fonte do objetivo e da autorização:

```txt
[OBJETIVO, ESCOPO E AUTORIZAÇÃO DA TAREFA, SE APLICÁVEL]
```

Contexto não documentado da conversa anterior é opcional; inclua somente o que for necessário:

```txt
[COLAR_APENAS_O_QUE_AINDA_NAO_ESTA_DOCUMENTADO]
```

## Contexto e fontes

1. Aplicar o bootstrap único definido em `AGENTS.md` e suas rules. Não reler instruções já carregadas nesta sessão por referência neste prompt ou em skill.
2. Consultar `docs/review/CURRENT_PHASE_HANDOFF.md` e/ou `docs/review/ACTIVE_PHASE_PLAN.md` somente quando a continuidade de fase for necessária para responder ou executar a tarefa. Abrir apenas os trechos pertinentes.
3. Ler plano específico apontado pelo plano ativo somente se necessário para resolver escopo, critério ou estado da fase.
4. Consultar `LAST_PHASE_RESULT.md`, `OPEN_REVIEW_ITEMS.md`, `PROJECT_STATUS.md` ou `ROADMAP.md` somente para uma dúvida concreta; não carregar o plano/handoff apenas porque existem.
5. Seguir `.agents/rules/rtk.md` para comandos e validação.

Contexto colado é complementar, não prova. Em conflito, aplicar as precedências de `CORE_RULES.md`. Se uma fonte necessária não estiver acessível, declarar o que não pôde ser verificado.

## Escopo proibido

- Não implementar, editar, commitar ou iniciar a próxima fase apenas com base no handoff ou plano ativo.
- Não ampliar uma tarefa delimitada para diagnóstico de continuidade sem necessidade.
- Não reabrir fase fechada sem evidência.
- Não marcar etapa em andamento como concluída.
- Não transformar roadmap em pendência técnica.
- Não executar hardening genérico.
- Não alterar Supabase, migrations, RLS, RPC, schema ou edge functions sem tarefa atual explícita e prompt operacional apropriado.
- Não atualizar baseline automaticamente com alterações funcionais pendentes.

## Diagnóstico de continuidade

Somente quando a tarefa exigir determinar estado de fase, confirme o que for necessário:

1. fase/subfase, estado e critério de conclusão;
2. baseline, estado do worktree e fontes efetivamente consultadas, se forem relevantes à decisão;
3. pendências e decisões que afetem a tarefa;
4. próximo passo mínimo e validação proporcional, se solicitados.

## Condições de parada

Se uma ação depender de fase, baseline, escopo ou autorização que não puderem ser confirmados, pare antes dessa ação. Não infira permissão de implementação. Essa condição não bloqueia uma tarefa já delimitada que não dependa desses dados.

## Saída

Para um pedido de continuidade, resumir fatos confirmados, inferências/limitações e recomendação, distinguindo-os, e indicar decisão e próximo passo mínimo. Para tarefa delimitada, entregar o resultado no formato proporcional à própria tarefa; não exigir relatório de fase nem critério de aceite de uma fase futura.
