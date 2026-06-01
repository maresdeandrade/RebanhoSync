```markdown
---
name: migrations-rls-contracts
description: Use when a RebanhoSync task touches Supabase migrations, RLS policies, RPCs, functions, composite foreign keys, tenant isolation, RBAC, or database contract changes.
---

# Migrations RLS Contracts

## Mission

Protect RebanhoSync database contracts, RLS, tenant isolation, composite keys, RPC safety, and Supabase baseline integrity.

---

## When to use

Use when task touches:
* `supabase/migrations/**`;
* RLS policies;
* Database functions;
* RPCs;
* Triggers;
* Indexes;
* Composite FKs;
* `fazenda_id`;
* `user_fazendas`;
* RBAC/membership;
* Sync-batch backend contract;
* Database baseline validation;
* Migrations consolidation.

---

## Do not use when

Do not use when:
* Task is UI-only;
* No DB/RLS/RPC/schema contract is involved;
* Task is local documentation only;
* Task only changes client copy or styling.

### Use instead:
* `sync-offline-rollback` if local sync is main risk;
* `rebanhosync-verification-gate` after patch;
* Domain skill for domain rules.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`
5. `.agents/rules/rtk.md`

### Read as needed:
* `docs/technical/SUPABASE_RLS.md`
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`
* `docs/technical/OFFLINE_SYNC.md`
* `docs/technical/ARCHITECTURE.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* Local `AGENTS.md` in `supabase/**`.

---

## Source of truth

In case of conflict, trust:
1. Active migrations;
2. Code using those contracts;
3. `docs/context/PROJECT_STATUS.md`;
4. Active normative docs;
5. Derived docs;
6. Archive/history;
7. This skill.

---

## Hard constraints

* Do not weaken RLS.
* Do not bypass tenant isolation.
* Preserve `fazenda_id` as isolation boundary.
* Prefer composite FKs with `fazenda_id` when applicable.
* Do not grant direct write to membership tables unless explicitly designed.
* Do not expose `service_role` to client.
* RPC with elevated privileges must validate user, role, tenant, and search path.
* Use `search_path = public` or explicit schema where relevant.
* Do not alter migrations or baseline without explicit task.
* Do not use legacy migrations as current truth unless requested.
* Do not introduce cross-tenant references.

---

## Required checks

### RLS
Verify:
* Table has RLS enabled when needed;
* Select/insert/update/delete policies are scoped;
* Policies use membership/role correctly;
* Outsider cannot access tenant data;
* Owner/manager/cowboy roles behave as expected.

### Tenant isolation
Verify:
* `fazenda_id` is included in relevant tables;
* Relationships cannot cross farms;
* Composite FK prevents cross-tenant linkage;
* Client payload cannot spoof tenant access.

### RPC / function safety
Verify:
* Authenticated user is checked;
* Role/membership is checked;
* Tenant is checked;
* `search_path` is controlled;
* Function does not use broad bypass;
* Errors do not leak privileged data.

### Migration safety
Verify:
* Migration is idempotent where possible;
* No destructive data loss without explicit plan;
* Indexes and constraints match usage;
* Backfill is safe;
* Rollback/forward compatibility is considered.

---

## RebanhoSync contracts

* **Agenda:** Intention/future task.
* **Evento:** Executed fact.
* **`state_*`:** Current state/read model.
* **Protocolo:** Rule/configuration.
* **Tags/signals/insights:** Auxiliary only.
* **Métricas:** Critical operational eligibility requires explicit technical source.

---

## Validation

Follow `.agents/rules/rtk.md`.

### For schema/RLS/RPC/sync changes:
```bash
git status --short --untracked-files=all
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

*Note: If a command cannot run, report why.*

---

## Expected output

Return:

1. **DB/RLS contract touched:** [Layers or tables list]
2. **Tenant isolation assessment:** [Security status]
3. **RPC/function safety assessment:** [Privileges and validations status]
4. **Migration safety assessment:** [Idempotency and compatibility status]
5. **Affected files:** [Paths list]
6. **Validation executed:** [Commands output summary]
7. **Blockers:** [If any]
8. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not approve RLS change without outsider/role risk assessment.
* Do not approve RPC change without tenant and role validation assessment.
* Do not claim baseline valid without running or citing validation.

```

```