```markdown
---
name: animal-cadastro-origem-destino
description: Use when a RebanhoSync task touches animal registration, editing, identification, origin, destination, entry, exit, purchase, sale, death status, or animal base data integrity.
---

# Animal Cadastro Origem Destino

## Mission

Protect animal base registration, identity, origin/destination, entry/exit, and current state integrity in RebanhoSync.

---

## When to use

Use when task touches:
* Cadastro de animal;
* Edição de animal;
* Identificação;
* Origem;
* Destino;
* Entrada;
* Saída;
* Compra;
* Venda;
* Óbito;
* Status atual;
* Lote atual;
* Animal base data;
* Taxonomic/category fields;
* Origem/destino provenance.

---

## Do not use when

Do not use when:
* Task is only visual/copy;
* Animal appears only as a filter in an unrelated flow;
* Task is strictly sanitary execution;
* Task is strictly reproductive birth/calf flow;
* Task is only a financial KPI.

### Use instead:
* `reproducao-parto-posparto-cria` for birth/calf flow;
* `sanitario-registro-operacional` for sanitary events;
* `movimentacao-transito-conformidade` for movement/transit;
* `sync-offline-rollback` if sync/rollback is main risk.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

### Read as needed:
* `docs/domain/ANIMAIS_TAXONOMIA.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/domain/COMPRA_VENDA.md` if purchase/sale is involved;
* `docs/domain/LOTES_PASTOS.md` if lote/pasto is involved;
* `docs/technical/OFFLINE_SYNC.md` if sync is involved.

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

* **Identidade:** Animal identity must remain stable and never be duplicated.
* **Isolamento:** Do not break `fazenda_id` isolation.
* **Métricas:** Do not infer current weight reliability without an explicit source.
* **Métricas:** Do not infer sale/slaughter readiness.
* **Limitação:** Do not treat tags/signals as a source of animal truth.
* **Garantia:** Do not treat agenda as animal history.
* **`state_*`:** Current state belongs in `state_*` or an equivalent read model.
* **Evento:** Historical changes must be event-backed when factual.
* Preserve offline-first and idempotency.

---

## Conceptual separation

* **Animal Base:** Stable identity and descriptive data.
* **Current State:** Current status/read model (active, sold, dead, current lote, current category/stage if modeled).
* **Historical Fact:** Events (purchase, sale, movement, death, weighing, reproduction, sanitary event).
* **Future Intention:** Agenda item.

---

## Procedure

### 1. Classify animal operation
Classify as: create animal, edit base data, entry/purchase, sale/exit, death, origin/destination update, current state read, taxonomic/category adjustment, or UI display.

### 2. Verify source-of-truth
Check base table vs read model, event-backed history, and current state source. Ensure no agenda-as-history or tag-as-truth behaviors are introduced.

### 3. Verify identity
Check unique identifiers, farm isolation, duplicate creation risk, offline retry behavior, and the link to a purchase/birth event if applicable.

### 4. Verify status transitions
Check active → sold, active → dead, lote change, sale/exit, correction/rollback, and pending agenda cleanup if relevant and explicitly modeled.

### 5. Verify edge cases
Consider: duplicate animal, missing identifier, animal moved between farms, animal sold but still in active lote, animal dead but with active agenda, offline create then retry, and imported animal with incomplete origin.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:
```bash
git status --short --untracked-files=all

```

* plus the related animal tests.

### For broader changes:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

### If Supabase/RLS/RPC is touched:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

---

## Expected output

Return:

1. **Animal operation affected:** [Flow identifier]
2. **Source-of-truth assessment:** [Invariants status]
3. **Identity / duplication risk:** [Uniqueness verification status]
4. **Current state vs history assessment:** [Read model sync check]
5. **Sync / rollback risk:** [Idempotency status]
6. **Tests required/executed:** [Scenarios covered]
7. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not infer weight reliability.
* Do not infer sale/slaughter readiness.
* Do not use tags/signals as truth.
* Separate confirmed behavior, inference, and recommendation.

```

```