---
name: validate-migration-safety
description: Use when validating database migrations, asking "migration safety", "check schema", "validate DDL", "safe to deploy", "migration checklist", "RLS coverage".
---

# Skill: validate-migration-safety

## Mission

Provide a comprehensive checklist to validate database migrations before applying to production, ensuring idempotency, RLS coverage, FK constraints, and offline-first compatibility.

## When to Use

- Before applying new migration to production
- User asks: "is this migration safe?", "validate migration", "migration checklist"
- Code review of `.sql` files in `supabase/migrations/`
- After writing DDL changes

## Validation Checklist

### 1. ✅ File Naming Convention

- [ ] Filename format: `NNNN_description.sql` (e.g., `0008_add_eventos_financeiro.sql`)
- [ ] Sequence number increments from last migration
- [ ] Description is kebab-case and meaningful

### 2. ✅ Idempotency

All DDL must be idempotent (safe to run multiple times):

**Good**:

```sql
CREATE TABLE IF NOT EXISTS public.my_table (...);
ALTER TABLE public.my_table ADD COLUMN IF NOT EXISTS new_col text;
CREATE INDEX IF NOT EXISTS ix_my_index ON public.my_table(col);
```

**Bad**:

```sql
CREATE TABLE public.my_table (...); -- Fails if exists
ALTER TABLE public.my_table ADD COLUMN new_col text; -- Fails if exists
```

### 3. ✅ client_op_id Unique Constraint

Every new table must have idempotency constraint:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_my_table_op
ON public.my_table(client_op_id)
WHERE deleted_at IS NULL;
```

### 4. ✅ Composite FKs (Multi-tenant)

For tenant-scoped tables, use composite FKs:

```sql
-- Add unique index on parent
CREATE UNIQUE INDEX IF NOT EXISTS ux_parent_id_fazenda
ON public.parent(id, fazenda_id);

-- Composite FK on child
ALTER TABLE public.child
  ADD CONSTRAINT fk_child_parent
  FOREIGN KEY (parent_id, fazenda_id)
  REFERENCES public.parent(id, fazenda_id)
  DEFERRABLE INITIALLY DEFERRED;
```

### 5. ✅ Append-Only Triggers (Event Tables)

Event tables must have `prevent_business_update()` trigger:

```sql
CREATE TRIGGER trg_my_events_append_only
BEFORE UPDATE ON public.my_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_business_update();
```

### 6. ✅ RLS Policies

**Every new table** must have RLS enabled + policies:

```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "my_table_select_by_membership"
ON public.my_table FOR SELECT
USING (public.has_membership(fazenda_id));

-- INSERT policy (if writable)
CREATE POLICY "my_table_insert_manager"
ON public.my_table FOR INSERT
WITH CHECK (public.has_membership(fazenda_id) AND public.role_in_fazenda(fazenda_id) IN ('owner','manager'));
```

**⚠️ Exceptions (Tables with restricted RLS)**:

- **`user_fazendas`**: SELECT-only RLS (write operations via RPC only)
- **`user_profiles`**: Self-only policies (`user_id = auth.uid()`)
- **`user_settings`**: Self-only policies (`user_id = auth.uid()`)
- **Event tables**: No UPDATE/DELETE policies (append-only enforced by trigger)

### 7. ✅ Soft Delete Support

- [ ] `deleted_at timestamptz NULL` column exists
- [ ] Unique constraints use `WHERE deleted_at IS NULL`

### 8. ✅ updated_at Trigger

```sql
CREATE TRIGGER trg_my_table_updated_at
BEFORE UPDATE ON public.my_table
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 9. ✅ No Hardcoded UUIDs

- [ ] No `INSERT ... VALUES ('hardcoded-uuid', ...)` unless seed data
- [ ] Use `gen_random_uuid()` or client-generated UUIDs

### 10. ✅ Backwards Compatibility

- [ ] Adding columns: Use `DEFAULT` or `NULL` (don't break existing inserts)
- [ ] Removing columns: Mark deprecated first, remove later
- [ ] Renaming columns: Use views for compatibility layer

---

## Guardrails

- ⚠️ **Test on dev/staging first** - Never test migrations on production
- ⚠️ **Backup before major changes** - Use `pg_dump` or Supabase snapshots
- ❌ **Never DROP TABLE without confirmation** - Consider soft-delete instead

---

## Example: Safe Migration

```sql
-- 0008_add_peso_estimado.sql

-- 1. Add new column (nullable, no DEFAULT if optional)
ALTER TABLE public.animais
  ADD COLUMN IF NOT EXISTS peso_estimado_kg numeric(10,2) NULL;

-- 2. Create index if needed
CREATE INDEX IF NOT EXISTS ix_animais_peso
ON public.animais(peso_estimado_kg)
WHERE peso_estimado_kg IS NOT NULL AND deleted_at IS NULL;

-- 3. No RLS changes needed (animais already has policies)
```

---

## Definition of Done

- [ ] All 10 checklist items verified
- [ ] Migration tested on local Supabase (`supabase db reset`)
- [ ] No errors in SQL Editor (Supabase Dashboard)
- [ ] TypeScript types regenerated (`pnpm exec supabase gen types typescript`)

---

## References

- `docs/DB.md` - Schema conventions
- `supabase/migrations/0001_init.sql` - Reference implementation
- `AI_RULES.md` - Multi-tenant and idempotency rules
