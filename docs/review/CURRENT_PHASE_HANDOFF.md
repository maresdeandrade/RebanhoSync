# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-04
**Baseline Commit:** `8cd5534`

## 1. Fase atual

Fase 9 — Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo.

Subfase 9A — Inventário Operacional — concluída localmente.

Subfase 9B — Relatórios Operacionais de Custo Parcial — concluída localmente.

Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only — concluída localmente.

Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase — prevista.

---

## 2. Estado consolidado

Fases 1-8 permanecem consolidadas em baseline `3fe7a81`.

Fase 9A consolidou o inventário operacional no escopo técnico autorizado:

- unidade de compra/apresentação separada da unidade base;
- unidade base separada da unidade de consumo/evento;
- custo total, custo por entrada e custo unitário/base separados;
- lote persistido com custo unitário/base;
- snapshot econômico preservado como derivado/read-only;
- baixa nutricional automática testada por `eventId`;
- retry/replay nutricional testado preservando `client_op_id`, `record.id` e `source_evento_id`;
- conflito remoto `23505` em `insumo_movimentacoes` tratado como `APPLIED`;
- índice único parcial remoto `ux_insumo_movimentacoes_consumo_nutricao_evento` criado para `consumo_nutricao`.

Fase 9B fechou documentalmente a leitura operacional parcial de custo:

- `inventory.partialCost` em `src/lib/reports/operationalSummary.ts`;
- cálculo fora da UI;
- apresentação em `src/pages/Relatorios.tsx`;
- custo operacional parcial conhecido;
- entradas com custo conhecido;
- saídas/consumos com custo conhecido;
- saldo econômico parcial conhecido por lote ativo;
- custo ausente separado;
- `0` tratado como custo válido;
- `null`/`undefined` tratados como custo ausente;
- sem inferência de custo quando snapshot está ausente.

Referência completa: `docs/review/LAST_PHASE_RESULT.md`.

---

## 2.1 Realidade de fases para o roadmap

Auditoria documental/local em 2026-06-04:

- Fase 5 — Exceções/Correções/Reconciliação Sanitária: `CONCLUÍDA`; manter apenas hardening residual.
- Fase 6 — Robustez Sanitária em Staging/RLS/sync: `HARDENING_RESIDUAL`; não reabrir como fase de produto sem bug objetivo.
- Fase 7 — Compra/Venda/Sociedade: `PARCIAL`; tratar como hardening e lacunas, não criação do zero.
- Fase 8 — Relatórios/Baseline: `PARCIAL`; usar como base para KPIs operacionais ampliados.
- Fase 9A e 9B: `CONCLUÍDA` localmente.
- Fase 9C: `CONCLUÍDA` localmente; 9D permanece o próximo foco.
- 9D: prevista para fechamento do gate e handoff da próxima fase.

Conduta pós-Fase 9: usar a sequência corrigida do `docs/product/ROADMAP.md`, mantendo sanitário/reconciliação como trilha residual contínua e evitando antecipar DRE, ROI, margem, custo por arroba ou motor comercial.

---

## 3. Validação consolidada

Validações executadas na 9A:

```txt
pnpm test -- testes focados de inventário/sync/sync-batch: passou
pnpm test: passou (260 arquivos, 1746 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos
supabase db reset: passou
node scripts/codex/validate-supabase-baseline-functional.mjs: passou
git diff --check: passou
```

Warnings conhecidos permanecem não bloqueantes e documentados em `docs/review/OPEN_REVIEW_ITEMS.md`.

Validações executadas na 9B:

```txt
git diff --check: passou
pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts: passou
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou
pnpm test: passou (260 arquivos, 1747 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/chunks
```

---

## 4. Pendências abertas

Não há pendência aberta conhecida para:

- separação de custo por entrada vs custo unitário/base;
- idempotência local/remota da baixa nutricional;
- índice único parcial remoto de `consumo_nutricao`;
- snapshot econômico como derivado/read-only;
- leitura parcial de custo operacional da 9B.

Pendências residuais não bloqueantes:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Revisão futura de avisos de Dialog/act em testes.

---

## 5. Próximo objetivo

Continuar a Fase 9 pela Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase.

Resultado da 9C:

- sociedade patrimonial mapeada no modelo local, Dexie, pull/tableMap, migrations/RLS e Registrar;
- isolamento por `fazenda_id` confirmado em stores, FKs compostas, índices e policies RLS;
- `classificationSnapshot` revisado como leitura/snapshot com `source` e `limitations`;
- consumo de classificação confirmado como agregação operacional de categoria predominante;
- teste de contrato adicionado para impedir interpretação de classificação como autorização de venda, abate ou carência;
- nenhuma regra de DRE, ROI, margem, custo por arroba, motor comercial avançado, carência liberatória ou autorização crítica criada.

---

## 6. Escopo permitido no próximo passo

Permitido para continuidade da Fase 9 pela 9D:

- consolidar 9A, 9B e 9C no fechamento do gate;
- revisar validações registradas;
- preparar handoff para a próxima fase;
- manter Fase 9 aberta até o fechamento explícito da 9D.

---

## 7. Escopo proibido permanente para esta transição

Não fazer sem tarefa explícita:

- marcar Fase 9 inteira como concluída;
- criar DRE, ROI, venda, abate ou custo por arroba;
- transformar classificação operacional em autorização;
- transformar snapshot/read model em fonte primária;
- criar nova fonte de verdade paralela;
- alterar contrato Sanitário, Agenda, Evento ou Protocolo fora do escopo autorizado.

---

## 8. Áreas candidatas para 9C

Áreas candidatas para leitura inicial:

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

Só tocar Supabase/migrations/RLS se o diagnóstico da 9C demonstrar lacuna objetiva de isolamento patrimonial e o plano ativo autorizar validação proporcional.

---

## 9. Checklist antes de nova implementação

Executar no início de nova rodada:

```bash
git status --short --untracked-files=all
git diff --check
```

Se houver patch funcional:

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se houver Supabase, RLS, RPC, migration, sync-batch ou baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
