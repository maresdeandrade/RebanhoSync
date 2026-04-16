---
name: prepare-pr
description: Use when implementation is done and you need to review the patch, validate scope, check invariants, and draft a clean pull request body.
---

# Prepare PR

## Mission
Prepare a change for review with clear scope, explicit risks, objective validation, and a clean PR body.

## When to use
Use when:
- implementation is already done
- you need to review the patch before opening a PR
- you want a small, reviewable PR
- the task touched a critical area of the repository

## Read first
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

## Additional reading by change type

### Offline / sync
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`

### Schema / RLS
- `docs/DB.md`
- `docs/RLS.md`

### Architecture
- `docs/ARCHITECTURE.md`

### Derived docs
- only if the change has real functional impact

## Hard constraints
- Do not widen scope at the end
- Do not include opportunistic refactor outside the main goal
- Do not mix structural fix, cleanup, and new feature without making it explicit
- Prefer small PRs aligned to one capability/theme

## Procedure
1. Identify PR target:
   - main capability or `infra.*`
   - problem solved
   - central files affected

2. Review the patch:
   - is the diff minimal?
   - is any file out of scope?
   - is there any hidden structural change?
   - is there avoidable duplication?

3. Review invariants by area:
   - Two Rails
   - append-only
   - `fazenda_id`
   - composite FKs
   - rollback / idempotence
   - global catalog vs tenant-scoped
   - sanitary operational vs regulatory separation
   - parto -> pós-parto -> cria inicial
   - anti-teleport / transit / compliance

4. Review docs:
   - does the change require normative updates?
   - does it require derived updates?
   - or should docs deliberately remain unchanged?

5. Validate locally:
   - `pnpm run lint`
   - `pnpm test`
   - `pnpm run build`

6. Draft PR summary:
   - problem
   - solution
   - key files
   - risks
   - tests
   - docs changed

## PR body template

### Context
- what problem was open
- what capability / theme was attacked

### What changed
- list up to 5 main changes
- cite key files

### What did NOT change
- make out-of-scope explicit

### Risks
- up to 3 real risks

### Validation
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- focused tests, if any

### Docs
- updated documents
- or justification for not updating docs

## Expected output
Return:
1. suggested PR title
2. PR body ready to paste
3. list of central files
4. list of risks
5. final checklist before opening