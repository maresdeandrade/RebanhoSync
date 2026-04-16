---
name: harden-module
description: Use when a module or hotspot mixes normalization, policy, payload, mutation planning, side effects, and reconciliation, and you need an incremental architectural hardening plan or execution.
---

# Harden Module

## Mission
Restore architectural boundaries in a specific hotspot of RebanhoSync incrementally, safely, and reviewably, without big bang rewrite.

## When to use
Use when:
- a module mixes normalization, rule/policy, payload, mutation plan, side effects, and reconciliation
- a flow is hard to test, review, or evolve
- there is architectural drift in a hotspot
- the goal is hardening, not redesigning the whole system

## Do not use when
Do not use for:
- local visual bug
- text tweak
- small operational change without real architectural debt

## Read first
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

Then read only the hotspot and the minimum adjacent files required.

## Hard constraints
- Work with narrow scope
- Attack at most 1 main capability or `infra.*` track per task
- Do not use `docs/archive/**` as operational truth
- Do not do big bang rewrite
- Do not expand into other domains without justification
- Preserve current behavior unless the task explicitly requests a functional correction
- Prefer minimal and reviewable diffs

## Global invariants
- Two Rails:
  - `agenda_itens` = mutable future intention
  - `eventos` + `eventos_*` = append-only past facts
- `fazenda_id` is the isolation boundary
- sync/offline must preserve:
  - idempotence
  - deterministic rollback via `before_snapshot`
  - coherence between `queue_*`, `tableMap`, `pull`, and `sync-batch`
- do not spread retry/replay/idempotence into UI
- do not turn historical facts into destructive business updates

## Target pipeline
Whenever applicable, move the hotspot toward explicit separation between:

1. Normalize
2. Select / Policy
3. Payload
4. Plan
5. Effects
6. Reconcile

## Desired boundaries
- `normalize` -> parsing, defaults, sanitation
- `policy` -> eligibility, selection, invariants
- `payload` -> persisted/business shape
- `plan` -> mutation/operation plan
- `effects` -> IO, Dexie, Supabase, queue, side effects
- `reconcile` -> rollback, dedupe, replay, refresh, merge
- `ui` -> presentation and screen state only

## Procedure

### 1. Delimit hotspot
Define:
- target files
- minimally allowed adjacent files
- files explicitly out of scope

### 2. Diagnose
Map:
- mixed responsibilities
- coupling points
- risk points
- hidden dependencies
- which parts belong to Normalize / Policy / Payload / Plan / Effects / Reconcile

### 3. Baseline before surgery
Before moving code:
- identify critical flows affected
- create characterization tests when appropriate
- document the current behavior that must be preserved
- call out edge cases:
  - retry
  - rejection
  - rollback
  - replay
  - idempotence
  - post-sync refresh

### 4. Choose the first intervention
Pick the most critical and safest hotspot slice.
The first round must:
- reduce mixed responsibilities
- preserve behavior
- generate a small diff
- improve testability
- prepare the next extraction

### 5. Execute pilot refactor
Extract or isolate, when appropriate:
- normalization helpers
- validators / selectors / policy guards
- payload builders
- mutation-plan builders
- adapters / effects
- reconcile handlers

The main hotspot file should move toward orchestrator, not concentrator.

### 6. Validate
Run:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

### 7. Governance
At the end, propose anti-regression mechanisms:
- PR checklist
- import/boundary rule
- folder convention
- architectural definition of done
- ADR, if needed

## Expected output
Return:

### 1. Diagnosis
- hotspots
- mixed responsibilities
- impact
- risks

### 2. Plan
- phases
- order of attack
- target boundaries
- acceptance criteria

### 3. Proposed changes
- what will be isolated or extracted
- what remains explicitly out of scope

### 4. Executed implementation
- first real refactor round
- files touched
- what moved
- what still remains

### 5. Risks / pending
- up to 3 main risks
- remaining debt
- coupling not yet removed

### 6. Recommended next step
- next incremental round
- without unnecessary scope expansion