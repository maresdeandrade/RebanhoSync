---
name: reconcile-docs
description: Use when you need to reconcile RebanhoSync documentation with the real state of code and migrations, updating only the documents truly impacted and avoiding drift.
---

# Reconcile Docs

## Mission
Reconcile RebanhoSync documentation against the real state of code and migrations, updating only the truly impacted docs and avoiding drift.

## When to use
Use when:
- there was a relevant functional change
- there is suspected drift between code and docs
- the goal is to update snapshot, normative, or derived docs
- the user asks for current project-stage analysis

## Do not use when
Do not use if the change is only:
- visual
- cleanup/refactor without functional impact
- isolated wording tweak without reconciliation need

## Read first
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

## Additional reading by need

### Snapshot
- `docs/STACK.md`
- `docs/ROUTES.md`
- `docs/REPO_MAP.md`

### Normative
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`
- `docs/RLS.md`

### Derived
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

## Hard constraints
- Do not use `docs/archive/**` as operational truth
- Do not update derived docs without real functional delta
- In case of conflict, trust:
  1. code + migrations
  2. `docs/CURRENT_STATE.md`
  3. normative docs
  4. derived docs
- Do not rewrite stable docs unnecessarily

## Procedure
1. Identify iteration scope:
   - affected capabilities
   - changed files/modules
   - migrations involved
   - relevant tests

2. Classify impact:
   - snapshot
   - normative
   - derived
   - no real doc impact

3. Validate real state in code:
   - changed UI surfaces
   - affected domain(s)
   - sync/offline
   - schema/RLS/contracts
   - test evidence

4. Measure doc delta:
   - what truly changed
   - what remains valid
   - what is in drift
   - what must not be touched

5. Update docs in the proper order, when applicable:
   1. `docs/IMPLEMENTATION_STATUS.md`
   2. `docs/TECH_DEBT.md`
   3. `docs/ROADMAP.md`
   4. `docs/review/RECONCILIACAO_REPORT.md`

6. Update normative docs only if there was real change in:
   - contract
   - architecture
   - RLS/RBAC/RPC
   - offline/sync
   - canonical model

7. Evaluate ADR:
   - sync contract
   - ordering / deduplication / status codes
   - canonical model
   - offline-first / Two Rails
   - new normative rule that now guides the product

## Expected output
Return:
1. iteration summary
2. advances, pending items, regressions
3. current phase of the project
4. documents updated
5. documents deliberately left unchanged
6. risks / debts / divergences
7. ADRs suggested, if any

## Output format
- minimal diff per document
- do not rewrite whole files unnecessarily
- up to 3 main risks
- separate clearly:
  - snapshot
  - normative
  - derived