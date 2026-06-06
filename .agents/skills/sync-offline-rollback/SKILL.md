```markdown
---
name: sync-offline-rollback
description: Use when a RebanhoSync task touches Dexie, offline-first behavior, sync queue, gestures, rollback, retry, reconcile, partial success, or local-remote conflict handling.
---

# Sync Offline Rollback

## Mission

Protect RebanhoSync offline-first behavior, sync integrity, idempotency, rollback, and local-remote reconciliation.

---

## When to use

Use when task touches:
* Dexie/IndexedDB;
* Local state persistence;
* Sync queue;
* Gestures;
* Optimistic operation;
* Rollback;
* Retry;
* Reconcile;
* Partial success;
* Sync-batch;
* Conflict local/remoto;
* Metadata de sync;
* Table maps;
* Before snapshots.

---

## Do not use when

Do not use when:
* Task is visual only;
* No persistence or sync is involved;
* Task is documentation-only;
* Task is pure UI state without offline impact;
* Issue is only Supabase/RLS without local sync.

### Use instead:
* `migrations-rls-contracts` for DB/RLS/RPC contract;
* `harden-module` for responsibility separation;
* `rebanhosync-verification-gate` after patch.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`
5. `.agents/rules/rtk.md`

### Then read as needed:
* `docs/technical/OFFLINE_SYNC.md`
* `docs/technical/ARCHITECTURE.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* Local `AGENTS.md` in affected paths.

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

* Preserve offline-first.
* Preserve idempotency.
* Preserve rollback determinism.
* Preserve before snapshots when required.
* Preserve `fazenda_id` isolation.
* Preserve sync metadata.
* Do not create duplicate local/remote truth.
* Do not treat agenda as historical fact.
* Do not silently drop failed operations.
* Do not mask partial success.
* Do not bypass RLS through sync.
* Do not alter migrations/RLS/RPC unless explicit.

---

## Domain invariants

* **Agenda:** Intention/future task.
* **Evento:** Executed fact.
* **Agenda closure:** Administrative state of the intention.
* **`state_*`:** Current state/read model.
* **Protocolo:** Rule/configuration.
* **Tags/signals/insights:** Auxiliary only.

## Agenda Sanitária v2 sync cautions

Future offline persistence must treat these as distinct operations:

* `agenda_intent`;
* `event_execution_intent`;
* `agenda_closure_intent`.

Verify:

* retry does not duplicate agenda/event/closure;
* replay preserves `previewGroupId`, `sourceDemandKey` and agenda/event linkage;
* partial success is explicit and not masked;
* rollback restores local state safely after failed agenda/event/closure sync;
* closure without execution does not create event;
* event execution remains the only source of sanitary history;
* inventory movement and withdrawal are not created from agenda or closure.

---

## Procedure

### 1. Identify operation type
Classify:
* Create gesture;
* Update local state;
* Enqueue;
* Push;
* Pull;
* Reconcile;
* Rollback;
* Retry;
* Sync-batch server handling;
* Conflict resolution.

### 2. Verify idempotency
Check:
* Operation ID;
* Dedup key;
* Retry safety;
* Repeated sync behavior;
* Partial success behavior;
* Duplicate event/agenda prevention.

### 3. Verify rollback
Check:
* Before snapshot;
* Affected tables;
* Rollback order;
* Rollback after partial failure;
* Cleanup of queue state;
* User-visible state after failure.

### 4. Verify local-remote boundary
Check:
* Local write source;
* Remote payload;
* Server validation;
* RLS constraints;
* Tenant/fazenda boundary;
* Mapping between local and remote tables.

### 5. Verify source-of-truth semantics
Check that:
* Agenda remains intention;
* Event remains fact;
* `state_*` remains read model;
* Protocol remains rule;
* No UI-only state becomes truth.

### 6. Test edge cases
Consider:
* Offline operation then reconnect;
* Duplicate retry;
* Partial server acceptance;
* Forbidden tenant;
* Stale local state;
* Deleted/archived entity;
* Conflict between local and remote update;
* Rollback after failed sync.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum for sync/offline task:
```bash
git status --short --untracked-files=all

```

* plus the related test command.

### For broader sync change:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

### If `sync-batch`, RLS, RPC, or Supabase contract is touched:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

---

## Expected output

Return:

1. **Operation type:** [Classification]
2. **Affected local and remote layers:** [Layers map]
3. **Idempotency assessment:** [Safety status]
4. **Rollback assessment:** [Determinism status]
5. **Source-of-truth assessment:** [Invariants status]
6. **Edge cases:** [List of critical pathways]
7. **Tests required/executed:** [Scenarios and results]
8. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Separate confirmed facts, inferences, and recommendations.
* Do not approve sync change without idempotency assessment.
* Do not approve rollback change without failure-path test plan.

```

```
