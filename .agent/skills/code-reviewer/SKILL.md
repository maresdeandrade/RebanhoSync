---
name: code-reviewer
description: Use when reviewing code, code review, check code, or asking "review this", "validate code quality", "check for issues".
---

# Code Reviewer - GestaoAgro

## Mission

Systematically review code changes against GestaoAgro architecture rules (Two Rails, offline-first, multi-tenant), security best practices, and maintainability standards.

## When to Use

- Reviewing someone else's PR
- User asks: "review this code", "check my PR", "code quality check"
- Self-review before pushing changes
- Debugging architecture violations

## Inputs

- Git diff or file(s) to review
- Context of what the code is trying to accomplish
- PR description (if available)

## Procedure

### 1. Architecture Compliance Check

#### Two Rails Pattern

```typescript
// ✅ GOOD: State tables mutable, Events append-only
await db.state_animais.put({ id, lote_id: newLote });
await db.event_eventos.add({ id, dominio, animal_id });

// ❌ BAD: Mutating event record
await db.event_eventos.update(id, { peso_kg: newWeight }); // WRONG!
```

**Check**:

- [ ] State tables (`animais`, `lotes`, `pastos`) use `.put()` for updates
- [ ] Event tables (`eventos`, `eventos_*`) use `.add()` only (no`.update()`)
- [ ] Event corrections via new event with `corrige_evento_id`

#### Offline-First / Gesture Pattern

```typescript
// ✅ GOOD: Using createGesture for atomic operations
const client_tx_id = await createGesture(fazenda_id, [
  { table: "eventos", action: "INSERT", record: evento },
  { table: "eventos_sanitario", action: "INSERT", record: detalhe },
]);

// ❌ BAD: Direct Supabase write (bypasses offline queue)
await supabase.from("eventos").insert(evento); // WRONG!
```

**Check**:

- [ ] All writes go through `createGesture()` (no direct Supabase writes)
- [ ] Operations include `before_snapshot` for rollback
- [ ] JWT included in sync-batch requests

#### Multi-Tenant Isolation

```sql
-- ✅ GOOD: Composite FK prevents cross-farm references
ALTER TABLE animais
  ADD FOREIGN KEY (lote_id, fazenda_id)
  REFERENCES lotes(id, fazenda_id);

-- ❌ BAD: Simple FK allows cross-farm attacks
ALTER TABLE animais
  ADD FOREIGN KEY (lote_id) REFERENCES lotes(id); -- WRONG!
```

**Check**:

- [ ] All tenant-scoped tables have `fazenda_id` column
- [ ] Foreign keys use composite `(id, fazenda_id)` pattern
- [ ] RLS policies check `has_membership(fazenda_id)`
- [ ] No hardcoded `fazenda_id` in frontend (use `useAuth().activeFarmId`)

#### Idempotency

```typescript
// ✅ GOOD: Each operation has unique client_op_id
const op = {
  client_op_id: crypto.randomUUID(), // Unique per op
  table: "animais",
  action: "INSERT",
  record: { id, identificacao },
};

// ❌ BAD: Reusing op_id or missing it
const op = {
  client_op_id: "static-id", // WRONG! Must be unique
  // ...
};
```

**Check**:

- [ ] Every operation generates unique `client_op_id` (UUID)
- [ ] Migrations include unique constraint: `(fazenda_id, client_op_id) WHERE deleted_at IS NULL`
- [ ] Sync handler checks for `23505` (unique violation) and treats as idempotent success

### 2. Security Review

#### RLS Policies

```sql
-- ✅ GOOD: Policy checks membership
CREATE POLICY animais_select
  ON animais FOR SELECT
  USING (has_membership(fazenda_id));

-- ❌ BAD: Policy allows all authenticated users
CREATE POLICY animais_select
  ON animais FOR SELECT
  USING (auth.uid() IS NOT NULL); -- WRONG! No tenant check
```

**Check**:

- [ ] All tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] SELECT policies use `has_membership(fazenda_id)`
- [ ] WRITE policies check role via `role_in_fazenda(fazenda_id) IN ('owner', 'manager')`
- [ ] Sensitive tables (`user_fazendas`) are SELECT-only (writes via RPC)

#### RPC Security Definer

```sql
-- ✅ GOOD: RPC validates caller permissions
CREATE FUNCTION admin_remove_member(...)
SECURITY DEFINER SET row_security = off
AS $$
BEGIN
  IF role_in_fazenda(_fazenda_id) != 'owner' THEN
    RAISE EXCEPTION 'Only owners can remove members';
  END IF;
  -- ...
END;
$$;

-- ❌ BAD: RPC trusts client input
CREATE FUNCTION delete_animal(_animal_id uuid)
AS $$
BEGIN
  DELETE FROM animais WHERE id = _animal_id; -- WRONG! No auth check
END;
$$;
```

**Check**:

- [ ] RPCs with `SECURITY DEFINER` validate caller permissions
- [ ] RPCs set `search_path = public` (prevent schema injection)
- [ ] RPCs use `SET row_security = off` only when necessary
- [ ] No SQL injection via string concatenation (`EXECUTE format()` instead)

#### API Keys / Secrets

```typescript
// ✅ GOOD: Using env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// ❌ BAD: Hardcoded secrets
const apiKey = "sk_live_abc123..."; // WRONG! Never commit secrets
```

**Check**:

- [ ] No hardcoded API keys, tokens, passwords
- [ ] Secrets in `.env` (not `.env.example` or committed)
- [ ] Service role key only in Edge Functions (never in frontend)

### 3. Performance & Maintainability

#### Query Optimization

```typescript
// ✅ GOOD: Using compound index
const animais = await db.state_animais
  .where("[fazenda_id+lote_id]")
  .equals([fazenda_id, lote_id])
  .toArray();

// ❌ BAD: Filtering after fetching all
const animais = (await db.state_animais.toArray()).filter(
  (a) => a.fazenda_id === fazenda_id && a.lote_id === lote_id,
);
```

**Check**:

- [ ] Dexie queries use indexes (not `.toArray()` → `.filter()`)
- [ ] SQL queries have supporting indexes
- [ ] Large lists paginated (not fetching thousands of rows)

#### Error Handling

```typescript
// ✅ GOOD: Specific error handling
try {
  await createGesture(...);
} catch (e) {
  if (e instanceof DexieError) {
    console.error('Dexie error:', e.message);
  } else {
    toast.error('Failed to save. Please try again.');
  }
}

// ❌ BAD: Silent failures
try {
  await createGesture(...);
} catch (e) {} // WRONG! User doesn't know it failed
```

**Check**:

- [ ] Errors logged (console or monitoring service)
- [ ] User-facing errors show actionable messages
- [ ] No silent `catch` blocks

### 4. Code Quality

#### Type Safety

```typescript
// ✅ GOOD: Typed interfaces
interface Animal {
  id: string;
  identificacao: string;
  sexo: 'M' | 'F';
  lote_id: string;
}

// ❌ BAD: Using `any`
const animal: any = { id: '123', ... }; // WRONG!
```

**Check**:

- [ ] No `any` types (use specific types or `unknown`)
- [ ] Zod schemas for form validation
- [ ] Database types match `src/integrations/supabase/types.ts`

## Guardrails

- ❌ Auto-approve changes touching RLS policies (requires manual review)
- ❌ Auto-approve migration files (peer review required)
- ⚠️ Flag direct Supabase writes (should use gesture queue)
- ⚠️ Flag missing `before_snapshot` in UPDATE/DELETE operations

## Definition of Done

- [ ] Checked all items in Architecture Compliance
- [ ] Reviewed all security concerns
- [ ] No hardcoded secrets or PII in code
- [ ] Type safety validated (no `any`)
- [ ] Error handling appropriate
- [ ] PR approved or feedback provided

## References

- [AI_RULES.md](../../../AI_RULES.md) - Architecture rules
- [RLS.md](../../../docs/RLS.md) - Security policies
- [OFFLINE.md](../../../docs/OFFLINE.md) - Offline patterns
