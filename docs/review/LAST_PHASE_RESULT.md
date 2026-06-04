# Last Phase Result — RebanhoSync

Atualizado em: 2026-06-04
**Baseline Commit:** `8cd5534`

## 1. Nome da fase

Fase 9 — Subfase 9A: Inventário Operacional — Unidade, Custo, Baixa e Snapshot.

---

## 2. Fonte de continuidade usada

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`
- `docs/context/PROJECT_STATUS.md`

---

## 3. Objetivo

Consolidar o inventário operacional da Fase 9A com:

- unidade de compra/apresentação separada da unidade base;
- unidade de consumo/evento separada do controle de estoque;
- custo total, custo por entrada e custo unitário/base sem ambiguidade;
- persistência de lote usando custo unitário/base;
- baixa de estoque idempotente;
- snapshot econômico preservado como leitura derivada/read-only.

---

## 4. Resultado consolidado

Subfase 9A concluída localmente no escopo técnico definido.

Entregue:

- separação semântica entre unidade de compra/apresentação, unidade base e unidade de consumo/evento;
- separação entre custo total, custo por entrada e custo unitário/base;
- persistência do lote usando custo unitário/base;
- snapshot econômico mantido como derivado/read-only, sem substituir evento nem inventário como fonte primária;
- baixa nutricional automática testada com `record.id === eventId`, `record.source_evento_id === eventId` e `tipo === "consumo_nutricao"`;
- retry/replay nutricional testado preservando `client_op_id`, `record.id` e `source_evento_id`;
- conflito remoto `23505` em `insumo_movimentacoes` normalizado como `APPLIED`;
- migration `20260604090000_insumo_movimentacoes_consumo_nutricao_idempotency.sql`;
- índice único parcial remoto `ux_insumo_movimentacoes_consumo_nutricao_evento` em `(fazenda_id, source_evento_id)`, filtrado por `tipo = 'consumo_nutricao'`, `source_evento_id is not null` e `deleted_at is null`.

---

## 5. Arquivos principais alterados na 9A

| Arquivo | Motivo |
|---|---|
| `src/lib/inventory/inventoryFormPresets.ts` | Separar semântica de custo por entrada e custo unitário/base. |
| `src/lib/inventory/__tests__/inventoryFormPresets.test.ts` | Cobrir unidade/custo operacional da entrada de inventário. |
| `src/pages/Insumos.tsx` | Ajustar leitura de custo para refletir custo unitário/base persistido. |
| `src/lib/inventory/__tests__/consumoGesture.test.ts` | Tornar explícito o contrato da baixa nutricional por `eventId`. |
| `src/lib/offline/__tests__/sync_insumo_movimentacoes.test.ts` | Validar retry/replay nutricional preservando ids de idempotência. |
| `supabase/functions/sync-batch/rules.test.ts` | Documentar `23505` de movimentação de insumo como `APPLIED`. |
| `supabase/migrations/20260604090000_insumo_movimentacoes_consumo_nutricao_idempotency.sql` | Proteger remotamente a baixa nutricional por evento/source. |
| `src/lib/inventory/__tests__/inventoryMigrations.test.ts` | Testar contrato textual do índice nutricional. |

---

## 6. Validações executadas

| Comando | Resultado |
|---|---|
| `pnpm test -- src/lib/inventory src/lib/offline/__tests__/sync_insumo_movimentacoes.test.ts src/lib/animals/__tests__/classificationSnapshot.test.ts` | Passou. |
| `pnpm test -- src/lib/inventory/__tests__/consumoGesture.test.ts src/lib/offline/__tests__/sync_insumo_movimentacoes.test.ts supabase/functions/sync-batch/rules.test.ts` | Passou. |
| `pnpm test -- src/lib/inventory/__tests__/consumoGesture.test.ts src/lib/offline/__tests__/sync_insumo_movimentacoes.test.ts supabase/functions/sync-batch/rules.test.ts src/lib/inventory/__tests__/inventoryMigrations.test.ts` | Passou (4 arquivos, 28 tests). |
| `pnpm test` | Passou (260 arquivos, 1746 tests). |
| `pnpm run lint` | Passou. |
| `pnpm run build` | Passou com warnings conhecidos de Browserslist/chunks. |
| `supabase db reset` | Passou; migration nutricional aplicada localmente. |
| `node scripts/codex/validate-supabase-baseline-functional.mjs` | Passou após reset. |
| `git diff --check` | Passou. |

---

## 7. Resultado técnico da 9A

Confirmado:

- unidade de compra/apresentação, unidade base e unidade de consumo/evento não são tratadas como o mesmo conceito;
- custo total, custo por entrada e custo unitário/base não ficam ambíguos;
- baixa nutricional automática usa `eventId = source_evento_id = insumo_movimentacoes.id`;
- retry/replay preserva os identificadores necessários para idempotência;
- conflito remoto de PK/unique em `insumo_movimentacoes` segue normalizado como `APPLIED`;
- índice remoto parcial impede duplicidade ativa de `consumo_nutricao` por evento/source;
- snapshot econômico permanece derivado/read-only.

---

## 8. Restrições preservadas

Não houve avanço para:

- venda;
- abate;
- DRE;
- ROI;
- custo por arroba;
- motor comercial avançado;
- aptidão automática para venda;
- aptidão automática para abate;
- carência liberatória;
- financeiro automático.

Contratos preservados:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico append-only.
state_* = estado atual/read model.
Protocolo = regra/configuração, não execução.
Snapshot = evidência histórica congelada/read model derivado.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
Tags/sinais/insights = auxiliares, nunca fonte primária.
```

---

## 9. Pendências remanescentes

Pendências não bloqueantes permanecem em `docs/review/OPEN_REVIEW_ITEMS.md`:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Revisão futura de avisos de Dialog/act em testes.

Não há pendência aberta conhecida para índice único parcial remoto de `consumo_nutricao`.

---

## 10. Próximo passo recomendado

Continuar Fase 9 sem marcar a fase inteira como concluída.

Próximo foco conforme plano:

```txt
Subfase 9B — Relatórios Operacionais de Custo Parcial.
```

Antes de nova implementação:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

---

## 11. Status final

```txt
Fase 9A Inventário Operacional: concluída localmente.
Suite global: verde.
Lint: verde.
Build: verde com warnings conhecidos.
Baseline Supabase funcional: verde após reset local.
Fase 9 completa: ainda em andamento.
Próximo foco: 9B Relatórios Operacionais de Custo Parcial.
```
