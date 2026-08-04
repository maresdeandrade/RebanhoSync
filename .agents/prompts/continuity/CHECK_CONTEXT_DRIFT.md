# Check Context Drift — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para diagnosticar incoerência entre documentos ativos antes de iniciar ou continuar uma fase. Não autoriza patch documental.

## Prompt

Verifique se a documentação ativa do RebanhoSync permite continuar o trabalho sem reabrir fase concluída, perder pendência real ou seguir baseline incorreto.

## Contexto

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Comece por:
   - `docs/review/CURRENT_PHASE_HANDOFF.md`;
   - `docs/review/ACTIVE_PHASE_PLAN.md`;
   - plano específico apontado pelo plano ativo, se houver;
   - `docs/context/PROJECT_STATUS.md`.
4. Leia `LAST_PHASE_RESULT.md`, `OPEN_REVIEW_ITEMS.md` e `ROADMAP.md` somente para responder dúvidas concretas de resultado, pendência ou sequência macro.
5. Não carregar archive como fonte ativa.
6. Para comandos, siga `.agents/rules/rtk.md`.

## Restrições

- Não alterar arquivos, implementar feature ou iniciar fase.
- Não transformar roadmap em backlog.
- Não tratar contexto colado ou relatório histórico como superior ao código e às migrations ativas.
- Não afirmar baseline, worktree ou documento lido sem confirmação local.
- Se for necessário corrigir o drift, apenas recomendar o patch; a execução deve usar `reconcile-docs` em tarefa separada ou após autorização explícita.

## Verificar

1. Fase/subfase atual e próxima etapa.
2. Coerência entre handoff, plano ativo, plano específico e `PROJECT_STATUS.md`.
3. Baseline documentado versus `HEAD` local e estado do worktree.
4. Pendências abertas reais versus itens já fechados.
5. Escopo permitido/proibido e critérios de aceite.
6. Validações exigidas versus validações efetivamente comprovadas.
7. Uso indevido de roadmap, archive, prompts arquivados ou auditorias antigas.
8. Permanência dos documentos ativos de continuidade.
9. Referências quebradas, duplicadas ou apontando para fonte de menor precedência.
10. Risco de o próximo agente repetir trabalho ou reabrir fase concluída.

## Classificação

- **Coerente:** sem contradição material; trabalho pode continuar.
- **Parcialmente coerente:** drift não bloqueante, claramente delimitado.
- **Incoerente:** divergência material de fase, baseline, escopo, pendência ou fonte de verdade.

## Entrega

1. **Coerência geral**
2. **Fatos confirmados**
3. **Inferências/itens não confirmados**
4. **Inconsistências**, por prioridade
5. **Risco prático**
6. **Patch documental mínimo recomendado**
7. **Pode continuar?** Sim ou não, com condição
8. **Validação recomendada**

Responder **Não** se a fase atual, o baseline relevante ou o documento ativo indispensável não puder ser determinado com segurança.
