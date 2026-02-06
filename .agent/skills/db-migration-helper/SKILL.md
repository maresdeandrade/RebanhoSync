---
name: db-migration-helper
description: Use when creating database migrations, schema changes, or asking "create migration", "migrate", "add column", "schema change", "new table", "modify database".
---

# Database Migration Helper - GestaoAgro

## Mission

Guide developers through creating, applying, and managing Supabase SQL migrations safely, following the project's Two Rails architecture and multi-tenant patterns.

## When to Use

- User asks: "create migration", "add table", "modify schema", "new column"
- Adding new domain entities (e.g., new event type, new state table)
- Modifying existing tables (add/rename columns, change constraints)
- Creating new RPCs or triggers
- Fixing schema drift

## Inputs

- Supabase CLI installed (`pnpm dlx supabase --version`)
- Clear description of schema change needed
- Understanding of affected tables and dependencies

## Procedure

### 1. Create New Migration File

```bash
# Generate timestamped migration file
pnpm dlx supabase migration new <descriptive_name>

# Example: Add procedimentos table
pnpm dlx supabase migration new add_procedimentos_table
```

**Expected**: Creates `supabase/migrations/<timestamp>_<name>.sql`

### 2. Write Migration SQL

#### Follow Project Patterns

**A) State Tables (Mutable)**

```sql
-- Example: Add new state table
CREATE TABLE IF NOT EXISTS public.procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES fazendas(id),
  nome text NOT NULL,
  descricao text,

  -- Multi-tenant composite FK
  FOREIGN KEY (fazenda_id) REFERENCES fazendas(id),
  UNIQUE (id, fazenda_id), -- Required for composite FK from other tables

  -- Offline-first metadata
  client_id text NOT NULL,
  client_op_id uuid NOT NULL,
  client_tx_id uuid,
  client_recorded_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete & audit
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency constraint
CREATE UNIQUE INDEX ux_procedimentos_op
  ON procedimentos(fazenda_id, client_op_id)
  WHERE deleted_at IS NULL;

-- Tenant isolation index
CREATE INDEX idx_procedimentos_fazenda
  ON procedimentos(fazenda_id)
  WHERE deleted_at IS NULL;

-- Auto-update timestamp trigger
CREATE TRIGGER trg_procedimentos_updated_at
  BEFORE UPDATE ON procedimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS policies
ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY procedimentos_select_by_membership
  ON procedimentos FOR SELECT
  USING (has_membership(fazenda_id));

CREATE POLICY procedimentos_write_by_membership
  ON procedimentos FOR INSERT
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY procedimentos_update_by_role
  ON procedimentos FOR UPDATE
  USING (has_membership(fazenda_id) AND role_in_fazenda(fazenda_id) IN ('owner', 'manager'))
  WITH CHECK (has_membership(fazenda_id) AND role_in_fazenda(fazenda_id) IN ('owner', 'manager'));
```

**B) Event Detail Tables (Append-Only)**

```sql
-- Example: Add new event detail table
CREATE TABLE IF NOT EXISTS public.eventos_procedimento (
  evento_id uuid PRIMARY KEY REFERENCES eventos(id),
  fazenda_id uuid NOT NULL,
  procedimento_id uuid NOT NULL,

  -- Composite FK for multi-tenant
  FOREIGN KEY (procedimento_id, fazenda_id)
    REFERENCES procedimentos(id, fazenda_id),

  -- Same metadata as state tables (minus updated_at)
  client_id text NOT NULL,
  client_op_id uuid NOT NULL,
  client_tx_id uuid,
  client_recorded_at timestamptz,
  server_received_at timestamptz NOT NULL DEFAULT now(),

  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only trigger (blocks business column updates)
CREATE TRIGGER trg_eventos_procedimento_append_only
  BEFORE UPDATE ON eventos_procedimento
  FOR EACH ROW EXECUTE FUNCTION prevent_business_update();

-- RLS
ALTER TABLE eventos_procedimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY eventos_procedimento_select
  ON eventos_procedimento FOR SELECT
  USING (has_membership(fazenda_id));

CREATE POLICY eventos_procedimento_insert
  ON eventos_procedimento FOR INSERT
  WITH CHECK (has_membership(fazenda_id));
```

### 3. Test Migration Locally

```bash
# Apply to local database
pnpm dlx supabase db reset  # Resets DB and re-applies all migrations

# OR apply incrementally (if DB already seeded)
pnpm dlx supabase migration up

# Verify
pnpm dlx supabase db diff  # Should show no differences
```

### 4. Update Dexie Schema (if State Table)

Edit `src/lib/offline/db.ts`:

```typescript
export class OfflineDB extends Dexie {
  // Add store
  state_procedimentos!: Table<any, string>;

  constructor() {
    super("PecuariaOfflineDB");
    this.version(2).stores({
      // Increment version!
      // ... existing stores
      state_procedimentos: "id, fazenda_id, [fazenda_id+nome]",
    });
  }
}
```

### 5. Update tableMap.ts

Edit `src/lib/offline/tableMap.ts`:

```typescript
export const TABLE_MAP: Record<string, string> = {
  // ... existing mappings
  procedimentos: "state_procedimentos",
  eventos_procedimento: "event_eventos_procedimento",
};
```

### 6. Update Documentation

Edit `docs/DB.md`:

- Add table to appropriate category (State/Events)
- Document columns, indexes, constraints
- Update total table count

### 7. Apply Migration to Remote

```bash
# Push to remote Supabase project
pnpm dlx supabase db push

# OR link project first if not linked
pnpm dlx supabase link --project-ref <project-id>
pnpm dlx supabase db push
```

### 8. Generate TypeScript Types

```bash
# Update src/integrations/supabase/types.ts
pnpm dlx supabase gen types typescript --local > src/integrations/supabase/types.ts

# OR from remote
pnpm dlx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

## Guardrails

- ❌ **NEVER** apply migrations to production without peer review
- ❌ **NEVER** drop columns with data (use soft delete: `deleted_at`)
- ❌ **NEVER** remove `client_op_id` unique constraints (breaks idempotency)
- ⚠️ Always test migrations locally first (`db reset`)
- ⚠️ Avoid `ALTER TABLE` on large tables during peak hours (use maintenance window)
- ⚠️ Increment Dexie version when adding/removing stores

## Failure Modes & Troubleshooting

### Issue: Migration fails with "relation already exists"

- **Cause**: Running migration twice or table exists but not in migration history
- **Fix**: Use `CREATE TABLE IF NOT EXISTS` or check `supabase_migrations` table

### Issue: "Foreign key constraint violation"

- **Cause**: Composite FK order wrong or referenced table missing unique constraint
- **Fix**: Ensure parent table has `UNIQUE (id, fazenda_id)` constraint

### Issue: Dexie version conflict

- **Cause**: Forgot to increment version in `db.ts`
- **Fix**: Increment version number, clear IndexedDB (`Application -> Storage -> IndexedDB -> Delete`)

### Issue: RLS policy blocks writes

- **Cause**: Policy uses wrong helper function or missing membership
- **Fix**: Test with `SET ROLE authenticated;` and verify `has_membership()` logic

## Examples

### Add Column to Existing Table

```sql
-- supabase/migrations/20260206_add_animal_chip_id.sql
ALTER TABLE animais
  ADD COLUMN chip_id text;

-- Add index if frequently queried
CREATE INDEX idx_animais_chip
  ON animais(chip_id)
  WHERE chip_id IS NOT NULL AND deleted_at IS NULL;
```

### Create RPC (Security Definer)

```sql
-- supabase/migrations/20260206_rpc_archive_old_events.sql
CREATE OR REPLACE FUNCTION archive_old_events(
  _fazenda_id uuid,
  _older_than_days int DEFAULT 365
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archived_count int;
BEGIN
  -- Verify caller is owner
  IF role_in_fazenda(_fazenda_id) != 'owner' THEN
    RAISE EXCEPTION 'Only owners can archive events';
  END IF;

  UPDATE eventos
  SET deleted_at = now()
  WHERE fazenda_id = _fazenda_id
    AND occurred_at < (now() - (_older_than_days || ' days')::interval)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS _archived_count = ROW_COUNT;
  RETURN _archived_count;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_old_events TO authenticated;
```

## Definition of Done

- [ ] Migration file created with descriptive name
- [ ] SQL follows project patterns (composite FKs, RLS, triggers)
- [ ] Migration tested locally (`pnpm dlx supabase db reset`)
- [ ] Dexie schema updated (if state table) with version increment
- [ ] tableMap.ts updated (if new table)
- [ ] docs/DB.md updated with new table/columns
- [ ] TypeScript types regenerated
- [ ] Migration applied to remote successfully
- [ ] No errors in application after migration

## References

- [DB.md](../../../docs/DB.md) - Schema patterns
- [AI_RULES.md](../../../AI_RULES.md) - Multi-tenant, idempotency rules
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [RLS.md](../../../docs/RLS.md) - Policy patterns
