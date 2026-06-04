# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-04
**Baseline Commit:** `3fe7a81`

## 1. Fase atual

Fase 9 — Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo.

Subfase 9A — Inventário Operacional — concluída localmente.

Próximo foco: Subfase 9B — Relatórios Operacionais de Custo Parcial.

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

Referência completa: `docs/review/LAST_PHASE_RESULT.md`.

---

## 3. Validação consolidada da 9A

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

---

## 4. Pendências abertas

Não há pendência aberta conhecida para:

- separação de custo por entrada vs custo unitário/base;
- idempotência local/remota da baixa nutricional;
- índice único parcial remoto de `consumo_nutricao`;
- snapshot econômico como derivado/read-only.

Pendências residuais não bloqueantes:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Revisão futura de avisos de Dialog/act em testes.

---

## 5. Próximo objetivo

Continuar a Fase 9 pela Subfase 9B — Relatórios Operacionais de Custo Parcial.

Objetivo esperado da 9B:

- usar as bases de unidade/custo/snapshot consolidadas na 9A;
- produzir leitura operacional parcial de custo;
- manter snapshot/read model como derivado;
- não antecipar DRE, ROI, venda, abate, custo por arroba ou motor comercial avançado.

---

## 6. Escopo permitido no próximo passo

Permitido para continuidade da Fase 9:

- leitura do plano ativo da Fase 9;
- diagnóstico local antes de patch;
- relatórios operacionais parciais apoiados em fonte primária existente;
- testes proporcionais de custo/read model;
- documentação do contrato implementado.

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

## 8. Áreas relevantes para 9B

Áreas candidatas para leitura inicial:

```txt
src/lib/inventory
src/lib/offline
src/pages/Insumos.tsx
supabase/migrations/20260525000000_insumos_inventory.sql
supabase/migrations/20260604090000_insumo_movimentacoes_consumo_nutricao_idempotency.sql
docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md
```

Áreas protegidas:

```txt
supabase/migrations
supabase/functions
src/lib/sanitario
src/lib/eventos
```

Só tocar áreas protegidas se a tarefa trouxer escopo explícito e validação proporcional.

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
