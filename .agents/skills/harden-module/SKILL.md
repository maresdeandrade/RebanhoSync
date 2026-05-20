---
name: harden-module
description: Use when a module or hotspot mixes normalization, policy, payload, mutation planning, side effects, and reconciliation, and you need an incremental architectural hardening plan or execution.
---

# Harden Module

## Mission
Restore architectural boundaries in a specific hotspot of RebanhoSync incrementally, safely, and reviewably, without big bang rewrite.

This skill assumes the hotspot is already reasonably identified.  
If the task still requires discovering the correct intervention point, mapping cross-module impact, or narrowing the relevant files, use `repository-context-retrieval` first.
---

## When to use
Use when:
- a module mixes normalization, rule/policy, payload, mutation plan, side effects, and reconciliation;
- a flow is hard to test, review, or evolve;
- there is architectural drift in a known hotspot;
- the goal is incremental hardening, not redesigning the whole system.
---

## Do not use when
Do not use for:
- discovering where the problem lives;
- broad repository analysis;
- local visual bug;
- text tweak;
- small operational change without real architectural debt.

Use instead:
- `repository-context-retrieval` when the hotspot is not yet clear;
- a domain-specific skill when the change is operational and bounded;
- `prepare-pr` only after implementation and technical gate are complete.
---

## Read first

1. `AGENTS.md`
2. `README.md`
3. `docs/CURRENT_STATE.md`
4. `docs/PROCESS.md`

Then read:
- the local `AGENTS.md` for the affected path, when present;
- only the hotspot and the minimum adjacent files required.
---

## Hard constraints
- Work with narrow scope.
- Attack at most 1 main capability or `infra.*` track per task.
- Do not use `docs/archive/**` as operational truth.
- Do not do big bang rewrite.
- Do not expand into other domains without justification.
- Preserve current behavior unless the task explicitly requests a functional correction.
- Prefer minimal and reviewable diffs.
- Do not convert a hardening task into opportunistic cleanup.
---

## Global invariants
- Two Rails:
  - `agenda_itens` = mutable future intention;
  - `eventos` + `eventos_*` = append-only past facts.
- `fazenda_id` is the isolation boundary.
- sync/offline must preserve:
  - idempotence;
  - deterministic rollback via `before_snapshot`;
  - coherence between `queue_*`, `tableMap`, `pull`, and `sync-batch`.
- do not spread retry/replay/idempotence into UI;
- do not turn historical facts into destructive business updates.
---

## Target pipeline
Whenever applicable, move the hotspot toward explicit separation between:
1. Normalize
2. Select / Policy
3. Payload
4. Plan
5. Effects
6. Reconcile
---

## Desired boundaries
- `normalize` -> parsing, defaults, sanitation;
- `policy` -> eligibility, selection, invariants;
- `payload` -> persisted/business shape;
- `plan` -> mutation/operation plan;
- `effects` -> IO, Dexie, Supabase, queue, side effects;
- `reconcile` -> rollback, dedupe, replay, refresh, merge;
- `ui` -> presentation and screen state only.
---

## Procedure

### 1. Delimit hotspot
Define:
- target files;
- minimally allowed adjacent files;
- files explicitly out of scope;
- capability or `infra.*` track being attacked.
---

### 2. Diagnose
Map:
- mixed responsibilities;
- coupling points;
- risk points;
- hidden dependencies;
- which parts belong to:
  - Normalize;
  - Policy;
  - Payload;
  - Plan;
  - Effects;
  - Reconcile.
---

### 3. Baseline before surgery
Before moving code:
- identify critical flows affected;
- create characterization tests when appropriate;
- document the current behavior that must be preserved;
- call out edge cases:
  - retry;
  - rejection;
  - rollback;
  - replay;
  - idempotence;
  - post-sync refresh.
---

### 4. Choose the first intervention
Pick the most critical and safest hotspot slice.

The first round must:
- reduce mixed responsibilities;
- preserve behavior;
- generate a small diff;
- improve testability;
- prepare the next extraction.
---

### 5. Execute pilot refactor
Extract or isolate, when appropriate:
- normalization helpers;
- validators / selectors / policy guards;
- payload builders;
- mutation-plan builders;
- adapters / effects;
- reconcile handlers.

The main hotspot file should move toward **orchestrator**, not concentrator.
---

### 6. Validate the hardening round
For an implemented change, run the validation required by the task and then close with:
- `repository-verification-gate`

The gate must confirm:
- diff scope;
- modified and untracked files;
- validations executed;
- remaining warnings or caveats;
- READY / READY WITH CAVEAT / NOT READY.

Do not skip the gate when the task produced a reviewable code change.
---

### 7. Governance
At the end, propose anti-regression mechanisms when justified:
- PR checklist;
- import/boundary rule;
- folder convention;
- architectural definition of done;
- ADR, if needed.

Avoid inventing governance artifacts without a real regression risk.
---

## Escalation
Escalate to:
- `repository-context-retrieval` if the hotspot stops being clear;
- a domain skill if the work narrows into an operational flow;
- `sync-offline-rollback` if the hardening touches queue, rollback, retry or Dexie;
- `migrations-rls-contracts` if it reaches schema, RLS or RPC;
- `repository-verification-gate` after implementation;
- `prepare-pr` only after the gate is complete.
---

## Expected output
Return:

### 1. Diagnosis
- hotspot;
- mixed responsibilities;
- impact;
- risks.

### 2. Plan
- phases;
- order of attack;
- target boundaries;
- acceptance criteria.

### 3. Proposed changes
- what will be isolated or extracted;
- what remains explicitly out of scope.

### 4. Executed implementation
- first real refactor round, if executed;
- files touched;
- what moved;
- what still remains.

### 5. Verification handoff
- whether `repository-verification-gate` is required now;
- key validation focus;
- caveats already known.

### 6. Risks / pending
- up to 3 main risks;
- remaining debt;
- coupling not yet removed.

### 7. Recommended next step
- next incremental round;
- without unnecessary scope expansion.