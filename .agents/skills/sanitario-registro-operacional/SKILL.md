```markdown
---
name: sanitario-registro-operacional
description: Use when a RebanhoSync task touches operational sanitary registration, sanitary agenda completion, veterinary products, doses, stock lot consumption, or sanitary event creation.
---

# Sanitário Registro Operacional

## Mission

Protect the operational sanitary flow of RebanhoSync: sanitary agenda, sanitary event registration, veterinary products, stock lots, doses, costs, and execution records.

This skill is for operational sanitary execution, not regulatory catalog/compliance design.

---

## When to use

Use when task touches:
* Registro de evento sanitário;
* Vacinação;
* Vermifugação;
* Tratamento;
* Exame sanitário;
* Conclusão de agenda sanitária;
* Vínculo agenda sanitária → evento;
* Produtos veterinários;
* Dose/quantidade/unidade;
* Lote de estoque;
* Baixa de estoque por evento sanitário;
* Snapshot econômico do consumo sanitário;
* UI operacional de registrar sanitário.

---

## Do not use when

Do not use when task is mainly about:
* Catálogo oficial regulatório;
* Overlay estadual;
* Feed-ban;
* Doença notificável;
* Suspeita clínica ampla;
* Checklist de biossegurança;
* Bloqueio regulatório;
* Compliance documental.

### Use instead:
* `sanitario-catalogo-regulatorio-compliance` for regulatory/compliance work;
* `sync-offline-rollback` if sync/rollback is main risk;
* `migrations-rls-contracts` if DB/RLS/RPC is touched.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

### Read as needed:
* `docs/domain/SANITARIO.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/OFFLINE_SYNC.md` if sync/gesture is involved;
* `docs/technical/SUPABASE_RLS.md` if backend/RPC/RLS is involved;
* Local `AGENTS.md` in affected folders.

---

## Source of truth

In case of conflict, trust:
1. Code + active migrations;
2. `docs/context/PROJECT_STATUS.md`;
3. Active normative docs;
4. Derived docs;
5. Archive/history;
6. This skill.

---

## Hard constraints

* **Agenda:** Agenda sanitária remains intention/future task until event execution.
* **Evento:** Evento sanitário is the executed fact.
* **Protocolo:** Protocolo sanitário is rule/configuration, not execution.
* **Garantia:** Do not treat checklist/regulatory availability as executed event.
* **Limitação:** Do not use tags/signals as source of sanitary truth.
* **Métricas:** Do not infer carência as active/free without explicit technical source.
* **Métricas:** Do not infer animal is ready for sale/slaughter from sanitary markers.
* Preserve stock lot consumption idempotency.
* Preserve offline-first and rollback.
* Preserve tenant isolation.

---

## Operational flow checks

### Agenda completion
Verify:
* Agenda item is linked only when execution really occurs;
* Direct completion without event is not treated as historical fact;
* Sanitary RPC or flow creates/vinculates event when required;
* Dedup prevents duplicate active agenda;
* Canceled agenda is not event history.

### Event creation
Verify:
* `eventos` base record exists when historical fact is created;
* Sanitary detail table is populated when applicable;
* Product, dose, unit, animal/lote, date, and responsible info are validated;
* Correction uses proper correction/contra-launch pattern when applicable.

### Product / stock
Verify:
* Veterinary product is structured reference;
* Stock lot reference is explicit when consumed;
* Quantity and unit are coherent;
* Cost snapshot is captured when relevant;
* Automatic stock decrease is idempotent;
* Missing cost/product/lote becomes exception, not silent truth.

### Offline/sync
Verify:
* Gesture is idempotent;
* Rollback has enough data;
* Retry does not duplicate event/stock decrease;
* Partial success is reconciled.

---

## Edge cases

Consider:
* Agenda item already concluded;
* Product without stock lot;
* Missing dose;
* Animal sold/dead/inactive;
* Lote with mixed animals;
* Retry after offline failure;
* Duplicate tap/submit;
* Stock insufficient;
* Cost absent;
* Event correction or reversal.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:
```bash
git status --short --untracked-files=all

```

* plus the related tests.

### If sync/stock/event flow is touched:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

### If Supabase/RPC/RLS is touched:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

---

## Expected output

Return:

1. **Sanitary operation affected:** [Flow identifier]
2. **Source-of-truth assessment:** [Invariants status]
3. **Agenda/event/protocol separation check:** [Contracts separation verification]
4. **Stock/product/cost impact:** [Inventory adjustments status]
5. **Sync/rollback risk:** [Idempotency status]
6. **Tests required/executed:** [Scenarios covered]
7. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not treat agenda as historical fact.
* Do not convert checklist into execution.
* Do not infer carência/venda/abate.
* Separate confirmed behavior, inference, and recommendation.

```

```