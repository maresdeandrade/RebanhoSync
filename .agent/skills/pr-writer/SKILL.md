---
name: pr-writer
description: Use when creating PR, pull request description, write PR, or asking "generate PR description", "create pull request", "summarize changes".
---

# PR Writer - GestaoAgro

## Mission

Generate comprehensive pull request descriptions from git changes and task context, following GestaoAgro conventions and ensuring reviewers have all necessary information.

## When to Use

- Creating new pull request
- User asks: "write PR", "create PR description", "summarize my changes"
- Before pushing feature branch
- Improving existing PR description

## Inputs

- Branch with committed changes
- Understanding of what was changed and why (from task/issue)
- Target branch (usually `main` or `develop`)

## Procedure

### 1. Gather Change Context

```bash
# View commits in this branch
git log origin/main..HEAD --oneline

# View file changes
git diff origin/main...HEAD --stat

# View detailed changes
git diff origin/main...HEAD
```

### 2. Write PR Description (Template)

```markdown
## Objective

[1-2 sentences: What problem does this solve? Link to issue/task if exists]

## Changes Made

### Database

- [ ] Added migration: `<migration_name>` - [describe schema change]
- [ ] Updated RLS policies for `<table>`
- [ ] New RPC: `<rpc_name>` - [describe purpose]

### Backend (Edge Functions / Sync Logic)

- [ ] Modified `sync-batch`: [describe validation/logic change]
- [ ] Updated anti-teleport logic for `<domain>`
- [ ] Fixed gesture rollback issue in `syncWorker.ts`

### Frontend

- [ ] New page: `/new-route` - [describe purpose]
- [ ] Updated component: `<ComponentName>` - [describe change]
- [ ] Fixed UI bug in `<PageName>`

### Offline/Sync

- [ ] Added Dexie store: `state_<table>` / `event_<table>`
- [ ] Updated tableMap for `<table>`
- [ ] Modified gesture creation in `ops.ts`

### Documentation

- [ ] Updated `docs/<file>.md`
- [ ] Added comments to complex logic
- [ ] Updated AI_RULES.md (if architecture change)

## Verification

### Manual Testing

- [ ] Tested offline → online sync flow
- [ ] Verified data appears in Supabase
- [ ] Checked Dexie stores via DevTools
- [ ] No console errors in browser
- [ ] Hot reload works after changes

### Automated Tests (if applicable)

- [ ] All tests pass: `pnpm test`
- [ ] No linting errors: `pnpm run lint`
- [ ] No format issues: `pnpm run format`

### Cross-Domain Checks

- [ ] Follows Two Rails architecture (State + Events)
- [ ] Maintains idempotency (`client_op_id` constraints)
- [ ] Respects multi-tenant isolation (`fazenda_id` composite FKs)
- [ ] RLS policies added/updated correctly
- [ ] No hardcoded credentials or secrets

## Screenshots / Recordings

[If UI change, add screenshots or Loom video]

## Breaking Changes

[List any breaking changes, migration steps for existing data, or deployment notes]

## Dependencies

[List any new npm packages, Supabase features, or external services]

## Rollback Plan

[How to rollback if this causes issues in production]
```

### 3. Customize Based on Change Type

#### Database Migration PR

```markdown
## Database Migration: Add Procedimentos Table

### Schema Changes

- New table: `procedimentos` (State Rail)
- New detail table: `eventos_procedimento` (Event Rail)
- Composite FK: `(procedimento_id, fazenda_id)`
- RLS policies: SELECT by membership, WRITE by owner/manager

### Affected Files

- `supabase/migrations/0007_add_procedimentos.sql`
- `src/lib/offline/db.ts` (added `state_procedimentos`)
- `src/lib/offline/tableMap.ts` (added mapping)
- `docs/DB.md` (documented new tables)

### Migration Safety

- [x] Tested locally with `pnpm dlx supabase db reset`
- [x] No data loss (new tables only)
- [x] Rollback: Drop tables via reverse migration

### Deployment

1Apply migration: `pnpm dlx supabase db push` 2. Clear IndexedDB on client devices (version bump forces clear) 3. Monitor Supabase logs for errors
```

#### Bug Fix PR

```markdown
## Fix: Sync Worker Infinite Retry Loop

### Problem

Gestures with status `ERROR` were being retried indefinitely, causing performance issues.

### Root Cause

`syncWorker.ts` checked `retry_count < 3` but never persisted count after failure.

### Solution

- Persist `retry_count` to `queue_gestures` after each retry
- Stop retrying when `retry_count >= 3`
- Set status to `ERROR` on max retries

### Affected Files

- `src/lib/offline/syncWorker.ts` (lines 85-102)

### Testing

- [x] Simulated network failure→ gesture retries 3x → ERROR
- [x] Verified `queue_gestures` shows correct `retry_count`
- [x] No infinite loops in console logs
```

## Guardrails

- ❌ Never include sensitive data in PR description (API keys, passwords, PII)
- ⚠️ Flag breaking changes prominently
- ⚠️ Add rollback instructions for risky changes
- ✅ Link related issues/tasks when available

## Examples

### Feature PR Title

```
feat: Add animal weighing event registration
```

### Bug Fix PR Title

```
fix: Prevent duplicate agenda items with same dedup_key
```

### Chore PR Title

```
chore: Update Supabase client to v2.45.0
```

## Definition of Done

- [ ] PR description follows template
- [ ] All checkboxes filled (or removed if N/A)
- [ ] Screenshots/videos added (if UI change)
- [ ] Breaking changes documented
- [ ] Rollback plan included (if risky)
- [ ] Linked to relevant issue/task
- [ ] PR title follows convention (`feat:`, `fix:`, `chore:`)

## References

- [AI_RULES.md](../../../AI_RULES.md) - Architecture principles to verify
- [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) - System design
- [Conventional Commits](https://www.conventionalcommits.org/)
