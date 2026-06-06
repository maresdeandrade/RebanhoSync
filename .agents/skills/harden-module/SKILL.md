```markdown
---
name: harden-module
description: Use when a RebanhoSync module or hotspot needs incremental hardening, responsibility separation, safer flow boundaries, or reduction of architectural risk without broad rewrite.
---

# Harden Module

## Mission

Harden a RebanhoSync module with small, safe, testable changes.

The goal is to reduce operational risk without big-bang refactor.

---

## When to use

Use when:
* A module mixes UI and business rule;
* A hotspot has too many responsibilities;
* A flow needs clearer boundaries;
* Logic should be extracted to pure helpers;
* Existing behavior must be preserved while reducing risk;
* There is duplication in payload/plan/effects;
* Sync/offline or domain contracts are at risk.

---

## Do not use when

Do not use when:
* The task is simple copy/microcopy;
* Only visual spacing/color is involved;
* The correct intervention point is unknown;
* The patch is complete and needs validation;
* There is no architectural or operational risk.

### Use instead:
* `repository-context-retrieval` when target is unclear;
* `rebanhosync-verification-gate` after patch;
* Specific domain skill if the issue is domain-specific.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

### Then read:
* Local `AGENTS.md`, if present;
* Hotspot files;
* Tests directly related to the hotspot.

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

---

## Preferred pipeline

Use this decomposition when applicable:
1. Normalize
2. Select/Policy
3. Payload
4. Plan
5. Effects
6. Reconcile

*Note: Do not force the pipeline where it does not fit.*

---

## Hard constraints

* Preserve current behavior unless change is explicit.
* Do not move critical domain rule into React component.
* Do not create parallel source of truth.
* Do not broaden scope.
* Do not alter migrations/RLS/RPC/seed unless explicit.
* Preserve offline-first and idempotency.
* Preserve `fazenda_id` boundary.
* Avoid large renames or folder moves unless required.

---

## Domain invariants

Do not violate:
* **Agenda:** Intention/future task;
* **Evento:** Executed fact;
* **Agenda closure:** Administrative state of the intention;
* **`state_*`:** Current state/read model;
* **Protocolo:** Rule/configuration;
* **Tags/signals/insights:** Auxiliary;
* **Critical Decisions:** Require explicit technical source.

### Sanitário Agenda v2 hardening checklist

When hardening sanitary agenda/execution modules, verify:

* agenda does not become history;
* compatible event is required for executed/partially executed closure;
* closure without execution, cancellation and dismissal require reason;
* partial execution requires reason for planned animals not executed;
* `productName` and `loteName` are display-only and not identity;
* `productId` and `productClass` remain separate in dedup;
* pure core does not use `Date.now()`;
* pure core does not import Supabase, Dexie, React UI or storage;
* agenda/preview/demand/closure do not create stock movement or active withdrawal.

---

## Procedure

### 1. Identify responsibility leak
Classify the issue:
* UI contains rule;
* Service contains UI concern;
* Payload construction duplicated;
* Effect and validation mixed;
* Sync/reconcile mixed with domain selection;
* Tests only validate happy path.

### 2. Choose smallest extraction
Prefer:
* Pure helper;
* Adapter;
* Validator;
* Builder;
* Mapper;
* Local domain function;
* Test around extracted rule.

### 3. Keep integration stable
Preserve:
* Function signatures when possible;
* Existing UI behavior;
* Existing data shape;
* Existing test fixtures unless wrong.

### 4. Add tests
Focus on:
* Edge cases;
* Invalid input;
* Idempotency;
* Source-of-truth contract;
* No UI-only rule.

### 5. Validate proportionally
Use `.agents/rules/rtk.md`.

---

## Expected output

Return:
1. **Decision:** [Hardening approach chosen]
2. **Confirmed facts:** [Validated technical observations]
3. **Risk in current design:** [Architectural and operational flaws]
4. **Minimal hardening proposal:** [Step-by-step containment layout]
5. **Files affected:** [Paths list]
6. **Tests required:** [Scenarios to cover]
7. **Validation commands:** [Testing execution strings]
8. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not propose broad rewrite first.
* Prefer incremental patch.
* Separate fact, inference, recommendation.
* If scope expands, stop and report.

```
