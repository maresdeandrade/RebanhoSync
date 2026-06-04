# ACTIVE_PHASE_PLAN - Fase 9 Subfase 9C

**Status:** Subfase 9C a iniciar; Fase 9 em andamento
**Commit Baseline:** `8cd5534`
**Criado:** 2026-06-04
**Atualizado:** 2026-06-04

---

## Objetivo em 1 parágrafo

Iniciar a Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only, usando as bases consolidadas na 9A e 9B. A etapa deve começar por diagnóstico local antes de qualquer patch, confirmar o estado real de sociedade/participação patrimonial e revisar a classificação operacional como leitura derivada/snapshot, sem transformar classificação, snapshot, relatório, tag, insight ou sinal em autorização operacional/comercial.

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

## Resultado esperado

Subfase 9C iniciada com trilho claro: diagnóstico primeiro, patch somente se houver evidência objetiva, mantendo sociedade patrimonial e classificação operacional como leitura/contrato seguro, sem fechar a Fase 9 inteira.
