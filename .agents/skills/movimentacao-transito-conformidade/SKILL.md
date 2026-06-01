```markdown
---
name: movimentacao-transito-conformidade
description: Use when a RebanhoSync task touches animal movement, lote/pasto movement, origin/destination, transit, GTA/documentation, or compliance associated with movement.
---

# Movimentação Trânsito Conformidade

## Mission

Protect movement and transit flows in RebanhoSync, including lote/pasto movement, origin/destination, animal transfer, documentation, and movement-related compliance.

---

## When to use

Use when task touches:
* Movimentação de animal;
* Movimentação entre lotes;
* Movimentação entre pastos;
* Origem/destino;
* Entrada/saída por movimentação;
* Trânsito animal;
* GTA or transport documentation;
* Compliance related to movement;
* Movement event;
* Current lote/pasto state;
* Historical movement report.

---

## Do not use when

Do not use when:
* Task is simple visual adjustment in lote/pasto screen;
* Task is only financial KPI without movement;
* Task is sanitary compliance without movement/transit;
* Task is generic animal registration without movement;
* Task is only pasture visual card/copy.

### Use instead:
* `animal-cadastro-origem-destino` for base animal registration;
* `sanitario-catalogo-regulatorio-compliance` for pure sanitary compliance;
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
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/domain/LOTES_PASTOS.md`
* `docs/domain/COMPRA_VENDA.md` if sale/exit is involved;
* `docs/domain/SANITARIO.md` if sanitary block/check is involved;
* `docs/technical/OFFLINE_SYNC.md` if gesture/sync/rollback is involved;
* `docs/technical/SUPABASE_RLS.md` if backend/RLS/RPC is involved.

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

* **Evento:** Movement event is historical fact.
* **`state_*`:** Current lote/pasto belongs in current state/read model.
* **Garantia:** Agenda is not movement history.
* **Limitação:** Tags/signals are not movement truth.
* **Métricas:** Do not infer transit compliance if documentation/source is missing.
* **Métricas:** Do not infer sanitary clearance unless explicit technical source exists.
* Preserve `fazenda_id` isolation.
* Preserve offline-first and rollback.
* Movement must not create cross-tenant relation.
* Avoid duplicating movement fact and current state as competing truths.

---

## Conceptual separation

* **Historical Movement:** Event-backed fact (animal/lote moved, origin, destination, date, responsible user, reason, documentation if applicable).
* **Current State:** Read model (current lote, current pasto, current status, current occupancy).
* **Transit / Compliance:** Documental or regulatory support (GTA, transport info, destination documentation, compliance flags); not proof of movement unless event exists.

---

## Procedure

### 1. Classify movement
Classify as: internal lote movement, internal pasto movement, farm entry, farm exit, sale-related exit, transfer, transport/transit, compliance/documentation, historical report, or current state display.

### 2. Verify source-of-truth
Check: event for history, `state_*` or equivalent for current state, document/checklist as support only, and ensure no agenda-as-history behavior.

### 3. Verify origin/destination
Check if origin exists, destination exists, same farm/tenant when required, external destination is represented correctly, no cross-tenant FK bypass is present, and animal/lote active status is compatible.

### 4. Verify consistency
Check that current lote/pasto is updated/recomputed, occupancy period closed/opened correctly, movement history preserved, no duplicate movement on retry occurs, rollback restores previous current state, and partial success is reconcilable.

### 5. Verify compliance
Check that GTA/document is required only when applicable, absence of document becomes pending/exception (not false compliance), compliance signal does not create movement fact, and sanitary block is not inferred without explicit source.

---

## Edge cases

Consider:
* Animal already sold/dead;
* Movement to same lote/pasto;
* Missing destination;
* External destination;
* Multiple animals partially moved;
* Offline retry;
* Duplicate submit;
* Rollback after current state update;
* Document missing;
* Sanitary pending item conflicting with movement.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:
```bash
git status --short --untracked-files=all

```

* plus the related movement tests.

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

1. **Movement type affected:** [Flow identifier]
2. **Source-of-truth assessment:** [Invariants status]
3. **Origin/destination assessment:** [Mapping logic verification]
4. **Current state vs history assessment:** [Read model sync check]
5. **Transit / compliance assessment:** [Documentation linkage check]
6. **Sync / rollback risk:** [Idempotency status]
7. **Tests required/executed:** [Scenarios covered]
8. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not treat document/checklist as movement fact.
* Do not infer sanitary clearance.
* Do not use agenda as movement history.
* Separate confirmed behavior, inference, and recommendation.

```

```