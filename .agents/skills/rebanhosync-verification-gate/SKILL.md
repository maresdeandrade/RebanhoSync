```markdown
---
name: rebanhosync-verification-gate
description: Use to validate a completed RebanhoSync patch, inspect actual diff including untracked files, classify readiness, and identify blockers before PR or merge.
---

# RebanhoSync Verification Gate

## Mission

Verify a completed patch against RebanhoSync contracts, scope, files changed, tests, and operational risks.

This skill classifies the delivery as:
* 🟢 **READY**
* 🟡 **READY WITH CAVEAT**
* 🔴 **NOT READY**

---

## When to use

Use when:
* A patch is complete;
* The user asks to validate a phase;
* Tests were executed and need interpretation;
* There are modified or untracked files;
* A PR is almost ready;
* The task touches critical domain, sync, RLS, migrations, or documentation.

---

## Do not use when

Do not use when:
* The task is still planning;
* The implementation has not started;
* The correct files are still unknown;
* The goal is only to write a PR body.

### Use instead:
* `repository-context-retrieval` for discovery;
* `prepare-pr` after this gate passes;
* Domain-specific skill for implementation guidance.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/rtk.md`

*Note: If the task touched a critical path, read the local `AGENTS.md` for that path.*

---

## Required commands

Always inspect repository state:
```bash
git status --short --untracked-files=all

```

Then inspect tracked diff:

```bash
git diff --name-only
git diff --stat

```

> ⚠️ **Aviso:** `git diff` does not show new untracked files. Always use `git status --short --untracked-files=all`.

---

## Scope checks

Verify:

* Intended scope vs actual files changed;
* Modified files;
* Untracked files;
* Deleted files;
* Generated artifacts;
* Accidental broad refactors;
* Docs changed without functional delta;
* Tests changed without justification.

---

## Domain checks

Confirm that the patch did not violate:

* **Agenda:** Intenção/future task, not history;
* **Evento:** Executed fact;
* **`state_*`:** Current state/read model;
* **Protocolo:** Rule/configuration, not execution;
* **Tags/signals/insights:** Auxiliary, not source of truth;
* **Métricas:** Carência, reliable current weight, sale/slaughter readiness require explicit technical source;
* **Arquitetura:** UI must not contain critical business rules;
* **Garantia:** No parallel source of truth.

---

## Technical checks

Verify impact on:

* Offline-first;
* Dexie/local state;
* Gestures;
* Sync queue;
* Rollback;
* Retry;
* Partial success;
* Supabase/RLS;
* `fazenda_id` isolation;
* Migrations/RPC/policies;
* Tests and build.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:

```bash
git status --short --untracked-files=all

```

### For local patch:

* Related test command if available.

### For broader patch:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

### For Supabase/RLS/sync-batch:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

> ⚠️ **Restrição:** Do not claim validation passed unless command output confirms it.

---

## Readiness classification

### 🟢 READY

Use when:

* Scope is clean;
* Tests/validation proportional to risk passed;
* No domain contract violation;
* No critical untracked file missed;
* No migration/RLS/sync risk remains.

### 🟡 READY WITH CAVEAT

Use when:

* Patch is likely safe;
* Validation was partial but justified;
* Only non-blocking warnings remain;
* Risks are explicit and acceptable.

### 🔴 NOT READY

Use when:

* Tests fail;
* Files are missing/untracked unexpectedly;
* Scope expanded without justification;
* Domain contract is violated;
* RLS/sync/migration risk is unresolved;
* Build/lint critical failure remains;
* Docs claim behavior not implemented.

---

## Escalation

* Use `reconcile-docs` if documentation needs formal alignment;
* Use `prepare-pr` only after READY or READY WITH CAVEAT;
* Use domain skill if a blocker requires implementation guidance.

---

## Expected output

Return:

1. **Classification:** [READY | READY WITH CAVEAT | NOT READY]
2. **Summary of actual diff:** [Brief analysis]
3. **Files changed and untracked:** [Paths list]
4. **Scope confirmation:** [Scope matching verification]
5. **Domain contract check:** [Invariants matching verification]
6. **Validation commands and results:** [Output summary]
7. **Blockers:** [If any]
8. **Riscos/pendências:** [Up to 3 points]
9. **Final recommendation:** [Next strategic action]

---

## Output rules

* Separate confirmed facts, inferences, and recommendations.
* Do not hide failed tests.
* Do not treat old warnings as new failures without evidence.
* Do not approve patch with unknown untracked files.

```

```