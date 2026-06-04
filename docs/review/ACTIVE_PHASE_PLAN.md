# ACTIVE_PHASE_PLAN - Fase 9 Subfase 9C

**Status:** Subfase 9C concluída localmente; Fase 9 em andamento
**Commit Baseline:** `8cd5534`
**Criado:** 2026-06-04
**Atualizado:** 2026-06-04
**Próxima subfase prevista:** 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase

---

## Objetivo em 1 parágrafo

Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only concluída localmente, usando as bases consolidadas na 9A e 9B. A etapa confirmou o estado real de sociedade/participação patrimonial e revisou a classificação operacional como leitura derivada/snapshot, sem transformar classificação, snapshot, relatório, tag, insight ou sinal em autorização operacional/comercial.

---

## Realidade validada para planejamento pós-Fase 9

Auditoria documental/local em 2026-06-04 confirmou que a sequência futura não deve reabrir como fase nova o que já foi executado:

- Fase 5 — Exceções/Correções/Reconciliação Sanitária: `CONCLUÍDA`, com hardening residual apenas.
- Fase 6 — Robustez Sanitária em Staging/RLS/sync: `HARDENING_RESIDUAL`, não nova fase de produto.
- Fase 7 — Compra/Venda/Sociedade: `PARCIAL`, deve virar hardening/lacunas, não criação do zero.
- Fase 8 — Relatórios/Baseline: `PARCIAL`, base para KPIs operacionais ampliados.
- Fase 9A e 9B: `CONCLUÍDA` localmente.
- Fase 9C: `CONCLUÍDA` localmente; próxima subfase prevista é 9D.
- Financeiro/DRE/Margem: `PARCIAL`; ledger existe, mas DRE/ROI/margem/custo por arroba seguem fora do escopo atual.

Conduta: manter a Fase 9 em andamento, executar 9D como fechamento previsto e deixar a nomeação final da próxima fase para 9D, usando a sequência corrigida do `docs/product/ROADMAP.md` como referência preliminar.

---

## Escopo permitido

- Diagnóstico local de sociedade patrimonial existente.
- Diagnóstico local de isolamento por `fazenda_id` e eventual participação/sociedade.
- Diagnóstico local de classificação operacional e `classificationSnapshot`.
- Revisão de usos de classificação em relatórios, insights, telas e read models.
- Testes de contrato read-only, se houver lacuna objetiva.
- Pequena integração de leitura derivada, se o diagnóstico justificar.
- Documentação de contrato da 9C ou registro de lacuna real.

---

## Escopo proibido

- Marcar a Fase 9 inteira como concluída.
- Criar autorização automática de venda, abate, comercialização ou decisão crítica.
- Transformar classificação operacional em regra crítica.
- Transformar snapshot/read model em fonte primária.
- Criar nova fonte de verdade paralela.
- Criar DRE, ROI, margem, custo por arroba ou motor comercial avançado.
- Alterar Supabase, migrations, RLS, RPC, edge functions ou seed sem diagnóstico objetivo e validação proporcional.

---

## Diagnóstico obrigatório antes de patch

Antes de alterar qualquer arquivo, entregar diagnóstico contendo:

1. status local da Fase 9 e confirmação de 9A/9B concluídas;
2. baseline/commit local atual;
3. documentos ativos lidos;
4. onde sociedade patrimonial aparece no modelo, se aparecer;
5. se há isolamento real por `fazenda_id` e se existe participação/sociedade implementada;
6. onde `classificationSnapshot` é calculado, testado e consumido;
7. se classificação é apenas leitura/snapshot ou se há risco de virar autorização;
8. lacunas reais;
9. patch mínimo recomendado ou justificativa para não alterar;
10. validação proporcional conforme `.agents/rules/rtk.md`.

Formato recomendado:

```txt
achado → arquivo → evidência → risco → recomendação mínima
```

---

## Áreas candidatas para leitura inicial

```txt
src/lib/animals/classificationSnapshot.ts
src/lib/animals/__tests__/classificationSnapshot.test.ts
src/features/occupancy/classification.ts
src/lib/reports/operationalSummary.ts
src/pages/Relatorios.tsx
src/lib/insights/herdStageSummary.ts
src/lib/insights/tagSignals.ts
supabase/migrations
docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md
```

Áreas protegidas:

```txt
supabase/migrations
supabase/functions
src/lib/sanitario
src/lib/eventos
```

Só tocar áreas protegidas se a tarefa trouxer evidência objetiva, escopo explícito e validação proporcional.

---

## Validação obrigatória

Antes de qualquer patch:

1. `git status --short --untracked-files=all`
2. `git diff --check`

Se houver patch funcional:

1. `pnpm test`
2. `pnpm run lint`
3. `pnpm run build`

Se houver Supabase, migrations, RLS, RPC, edge functions, sync-batch ou baseline:

1. `node scripts/codex/validate-supabase-baseline-functional.mjs`

---

## Critério de aceite - diagnóstico 9C

1. Estado atual de sociedade patrimonial mapeado.
2. Estado atual de classificação operacional mapeado.
3. Fontes primárias e read models identificados.
4. Riscos de autorização indevida documentados.
5. Patch mínimo proposto apenas com evidência objetiva.
6. Nenhuma decisão comercial crítica criada.
7. Nenhuma regra de venda, abate, carência liberatória, ROI, DRE, margem ou custo por arroba antecipada.
8. Validação proporcional definida antes de edição.

---

## Resultado local

Subfase 9C concluída localmente: sociedade patrimonial e classificação operacional foram mapeadas com evidência local; foi adicionado teste mínimo de contrato para garantir que `classificationSnapshot` não exponha autorização de venda, abate ou carência; Fase 9 permanece em andamento.
