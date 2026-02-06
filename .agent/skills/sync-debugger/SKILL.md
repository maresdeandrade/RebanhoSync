---
name: sync-debugger
description: Use when sync not working, debug sync, queue stuck, gesture rejected, or asking "sync issues", "data not syncing", "PENDING gestures", "REJECTED status".
---

# Sync Debugger - GestaoAgro

## Mission

Diagnose and troubleshoot sync issues between local Dexie database and Supabase, including stuck gestures, rejected operations, JWT auth failures, and data inconsistencies.

## When to Use

- User reports: "sync not working", "data not appearing", "gestures stuck"
- Gestures remain in PENDING status for too long
- Gestures fail with REJ ECTED or ERROR status
- Operations succeed locally but fail on server
- Data visible in Dexie but missing in Supabase

## Inputs

- Access to browser DevTools (Application → IndexedDB, Console)
- Knowledge of expected behavior (what action user performed)
- Supabase Dashboard access (for server-side verification)

## Procedure

### 1. Inspect Local Sync Queue

#### Check Gesture Status

```javascript
// In browser console
const { db } = await import("./src/lib/offline/db.ts");

// View all gestures by status
const pending = await db.queue_gestures
  .where("status")
  .equals("PENDING")
  .toArray();
const syncing = await db.queue_gestures
  .where("status")
  .equals("SYNCING")
  .toArray();
const rejected = await db.queue_gestures
  .where("status")
  .equals("REJECTED")
  .toArray();
const error = await db.queue_gestures.where("status").equals("ERROR").toArray();

console.log({ pending, syncing, rejected, error });
```

**Normal**: PENDING → SYNCING → DONE (cleared from queue)  
**Problem Signs**:

- Multiple PENDING gestures > 30s old (sync worker not running?)
- Gestures stuck in SYNCING (network failure mid-request?)
- REJECTED gestures (validation failure, rollback occurred)
- ERROR gestures (max retries exceeded)

#### Check Operations for Specific Gesture

```javascript
const client_tx_id = "<client_tx_id_from_queue_gestures>";
const ops = await db.queue_ops
  .where("client_tx_id")
  .equals(client_tx_id)
  .toArray();
console.log("Operations for gesture:", ops);
```

**Check**:

- Do ops have `before_snapshot`? (required for UPDATE/DELETE rollback)
- Are tables mapped correctly? (check tableMap.ts)
- Any obvious data validation issues? (missing required fields)

#### Check Rejections

```javascript
const rejections = await db.queue_rejections.toArray();
console.log("Rejected operations:", rejections);
```

**Common Reason Codes**:

- `ANTI_TELEPORTE`: UPDATE animais.lote_id without evento_movimentacao
- `BLOCKED_TABLE`: Attempted write to user_fazendas or user_profiles
- `23505`: Unique constraint violation (dedup collision or idempotency)

### 2. Verify Sync Worker Status

#### Check if Worker is Running

```javascript
// In console, look for periodic logs
// syncWorker.ts logs every 5 seconds when processing

// Force a sync cycle
const { runSyncCycle } = await import("./src/lib/offline/syncWorker.ts");
await runSyncCycle();
```

**Expected**: Console logs showing `[sync-worker]` prefix  
**Problem**: No logs = worker not initialized (check App.tsx)

#### Check JWT Token

```javascript
const { supabase } = await import("./src/integrations/supabase/client.ts");
const {
  data: { session },
  error,
} = await supabase.auth.getSession();

if (!session) {
  console.error("No session - user needs to re-login");
} else {
  console.log("JWT valid, expires at:", new Date(session.expires_at * 1000));
}
```

**Problem Signs**:

- `session` is null → user logged out or session expired
- `expires_at` in past → token expired, refresh needed
- **Fix**: Re-login or force refresh: `await supabase.auth.refreshSession()`

### 3. Test Sync Endpoint Manually

```javascript
// Get session token
const {
  data: { session },
} = await supabase.auth.getSession();
const jwt = session.access_token;

// Test sync-batch endpoint
const response = await fetch(
  "https://xxxxx.supabase.co/functions/v1/sync-batch",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      client_id: "test",
      fazenda_id: "<active_fazenda_id>",
      client_tx_id: crypto.randomUUID(),
      ops: [
        {
          client_op_id: crypto.randomUUID(),
          table: "animais",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            identificacao: "TEST-999",
            sexo: "M",
            lote_id: "<valid_lote_id>",
          },
        },
      ],
    }),
  },
);

const result = await response.json();
console.log("Sync response:", result);
```

**Expected**:

- Status 200
- `results[0].status === 'APPLIED'`

**Problem Responses**:

- 401: JWT invalid or missing
- 403: User not member of `fazenda_id`
- 500: Server error (check Edge Function logs)

### 4. Check Server-Side Data

#### Supabase Dashboard

1. Go to Table Editor
2. Check `animais`, `eventos`, etc. for expected data
3. Verify `client_op_id` matches local queue

#### SQL Editor Query

```sql
-- Find operations by client_tx_id
SELECT * FROM animais
WHERE client_tx_id = '<client_tx_id>'
ORDER BY created_at DESC;

-- Check for duplicates (idempotency)
SELECT client_op_id, COUNT(*)
FROM animais
WHERE fazenda_id = '<fazenda_id>'
  AND deleted_at IS NULL
GROUP BY client_op_id
HAVING COUNT(*) > 1;
```

### 5. Common Issues & Fixes

#### Issue: Gestures Stuck in PENDING

**Cause**: Sync worker not running or network offline  
**Fix**:

1. Check browser console for worker logs
2. Verify internet connectivity
3. Force sync: `await runSyncCycle()`
4. Check if `activeFarmId` is set: `localStorage.getItem('gestao_agro_active_farm_id')`

#### Issue: All Operations REJECTED with Anti-Teleport

**Cause**: Forgot evento_movimentacao in batch  
**Fix**:

```typescript
// Correct order: evento base → detalhe → UPDATE animal
const ops = [
  {
    table: "eventos",
    action: "INSERT",
    record: { id: evt_id, dominio: "movimentacao", animal_id },
  },
  {
    table: "eventos_movimentacao",
    action: "INSERT",
    record: { evento_id: evt_id, from_lote_id, to_lote_id },
  },
  {
    table: "animais",
    action: "UPDATE",
    record: { id: animal_id, lote_id: to_lote_id },
  },
];
```

#### Issue: 403 Forbidden

**Cause**: User not member of `fazenda_id` or membership soft-deleted  
**Fix**:

```sql
-- Check membership
SELECT * FROM user_fazendas
WHERE user_id = auth.uid()
  AND fazenda_id = '<fazenda_id>';

-- If deleted_at IS NOT NULL, restore:
UPDATE user_fazendas
SET deleted_at = NULL
WHERE user_id = auth.uid()
  AND fazenda_id = '<fazenda_id>';
```

#### Issue: Gestures Stuck in SYNCING

**Cause**: Network failure mid-request, worker never got response  
**Fix**:

```javascript
// Manually reset to PENDING to retry
await db.queue_gestures.update("<client_tx_id>", {
  status: "PENDING",
  retry_count: 0,
});
```

#### Issue: Data in Dexie but Not in Supabase

**Cause**: Gesture succeeded locally but never synced (still in queue)  
**Fix**:

1. Check `queue_gestures` for the gesture
2. If PENDING, wait for sync cycle
3. If REJECTED, check `queue_rejections` for reason
4. If ERROR, check `last_error` field

### 6. Nuclear Options (Last Resort)

#### Clear Local Queue (Lose Pending Changes!)

```javascript
// ⚠️ WARNING: This deletes all pending gestures
await db.queue_gestures.clear();
await db.queue_ops.clear();
await db.queue_rejections.clear();
```

#### Reset Dexie Database (Full Wipe!)

```javascript
// ⚠️ WARNING: Deletes ALL local data
await db.delete();
await db.open();
// User must re-fetch all data from server
```

## Guardrails

- ❌ Never clear queue without user confirmation (data loss!)
- ❌ Never apply rejected gestures manually to Supabase (bypasses validation)
- ⚠️ Always backup Dexie before nuclear options
- ⚠️ Check Edge Function logs before assuming client-side issue

## Definition of Done

- [ ] Root cause identified (JWT, network, validation, worker not running)
- [ ] Gestures either synced successfully or cleared intentionally
- [ ] User understands what went wrong and how to avoid next time
- [ ] No gestures stuck in PENDING/SYNCING for > 1 minute
- [ ] Data consistency verified (Dexie ↔ Supabase)

## References

- [OFFLINE.md](../../../docs/OFFLINE.md) - Sync architecture
- [CONTRACTS.md](../../../docs/CONTRACTS.md) - Sync API contract
- [syncWorker.ts](../../../src/lib/offline/syncWorker.ts) - Worker implementation
