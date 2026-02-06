---
name: offline-architecture-guide
description: Use when explaining offline-first architecture, asking "como funciona offline", "Dexie", "sync worker", "Two Rails", "gesture queue", "IndexedDB", "rollback local", "optimistic UI", or "offline strategy".
---

# Skill: offline-architecture-guide

## Mission

Explain the offline-first architecture of Gestão Agro to developers, covering IndexedDB storage (Dexie), gesture-based sync queue, optimistic UI updates, and deterministic rollback on server rejection.

## When to Use

- Onboarding new developers to offline architecture
- User asks: "como funciona offline?", "Dexie", "sync worker", "IndexedDB"
- Debugging sync issues (use with `sync-debugger` skill)
- Designing new offline-capable features
- Understanding Two Rails in context of sync

## Context

**Goal**: Users can work 100% offline and sync later seamlessly.  
**Stack**: Dexie.js (IndexedDB wrapper) + Custom sync worker + Supabase Edge Function.  
**Key Concepts**: Gesture queue, optimistic UI, rollback snapshots, idempotency.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     USER ACTION                         │
│  (e.g., "Registrar Vacinação de 50 animais")           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   createGesture()    │
          │  - Generate client_tx_id (UUID)
          │  - Save ops to queue_ops
          │  - Apply to state_* (Optimistic)
          │  - Save before_snapshot (Rollback)
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Dexie IndexedDB     │
          │  - queue_gestures (PENDING)
          │  - queue_ops (ops + snapshots)
          │  - state_animais (optimistic update)
          └──────────┬───────────┘
                     │
      ┌──────────────┴──────────────┐
      │   SyncWorker (background)   │
      │   Polls every 5s            │
      └──────────────┬──────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ POST /functions/v1/sync-batch
        │ - Send ops to server
        │ - Server validates + applies
        │ - Returns: APPLIED | REJECTED
        └────────────┬───────────────┘
                     │
      ┌──────────────┴──────────────┐
      │         SUCCESS             │          REJECTION
      ▼                             ▼
┌─────────────┐            ┌─────────────────┐
│ Mark DONE   │            │ Mark REJECTED   │
│ Delete ops  │            │ Rollback local  │
│             │            │ (use snapshots) │
└─────────────┘            └─────────────────┘
```

---

## Dexie Database Schema

### Tables

#### 1. `state_*` (State Tables - Local Replica)

Mirrors Supabase tables for instant reads:

- `state_fazendas`
- `state_pastos`
- `state_lotes`
- `state_animais`
- `state_contrapartes`
- `state_protocolos_sanitarios`
- `state_protocolos_sanitarios_itens`
- `state_agenda_itens`

**Updated by**:

- Pull sync (from Supabase)
- Optimistic apply (from createGesture)
- Rollback (on REJECTED)

#### 2. **event\_\*** (7 stores) - Log local de eventos ocorridos

Replica eventos append-only para visualização offline (timeline, histórico).

- **`event_eventos`**: Eventos base
  - Índices: `id`, `[fazenda_id+animal_id+occurred_at]`, `fazenda_id`
- **`event_eventos_sanitario`**: Detalhe 1:1 (vacinação/vermifugação/medicamento)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_pesagem`**: Detalhe 1:1 (peso em kg)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_nutricao`**: Detalhe 1:1 (alimento, quantidade)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_movimentacao`**: Detalhe 1:1 (origem/destino lote/pasto)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_reproducao`**: Detalhe 1:1 (cobertura, IA, diagnóstico, parto)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_financeiro`**: Detalhe 1:1 (compra, venda, valor)
  - Índices: `evento_id`, `fazenda_id`

#### 3. `queue_gestures` (Sync Queue Metadata)

```typescript
interface Gesture {
  client_tx_id: string; // UUID (primary key)
  fazenda_id: string;
  client_id: string; // e.g., "browser-client"
  status: "PENDING" | "SYNCING" | "DONE" | "REJECTED" | "ERROR";
  retry_count: number;
  last_error?: string;
  created_at: string; // ISO timestamp
}
```

#### 4. `queue_ops` (Individual Operations)

```typescript
interface QueueOp {
  client_op_id: string; // UUID (primary key)
  client_tx_id: string; // FK to queue_gestures
  table: string; // e.g., "state_animais"
  action: "INSERT" | "UPDATE" | "DELETE";
  record: any; // The record to apply
  before_snapshot?: any; // For rollback (UPDATE/DELETE only)
}
```

#### 5. `queue_rejections` (Rejected Operations Log)

```typescript
interface QueueRejection {
  id?: number;
  client_tx_id: string;
  client_op_id: string;
  fazenda_id: string;
  table: string;
  action: string;
  reason_code: string; // e.g., "ANTI_TELEPORTE", "INVALID_LOTE"
  reason_message: string;
  created_at: string;
}
```

---

## Key Flows

### Flow 1: Create + Sync (Success)

**Step 1: User Action**

```typescript
// User clicks "Registrar Vacinação"
await createGesture({
  fazenda_id: 'f1',
  client_id: 'browser',
  ops: [
    {
      client_op_id: uuid(),
      table: 'events_eventos',
      action: 'INSERT',
      record: { id: 'e1', fazenda_id: 'f1', dominio: 'sanitario', ... },
    },
    {
      client_op_id: uuid(),
      table: 'events_eventos_sanitario',
      action: 'INSERT',
      record: { evento_id: 'e1', fazenda_id: 'f1', tipo: 'vacinacao', produto: 'Febre Aftosa' },
    },
  ],
});
```

**Step 2: Optimistic Apply**

```typescript
// Inside createGesture:
await db.transaction('rw', [db.queue_gestures, db.queue_ops, db.events_eventos, db.events_eventos_sanitario], async () => {
  // 1. Save gesture
  await db.queue_gestures.add({ client_tx_id, status: 'PENDING', ... });

  // 2. Save ops
  for (const op of ops) {
    await db.queue_ops.add(op);
  }

  // 3. Apply ops to local stores (optimistic)
  for (const op of ops) {
    if (op.action === 'INSERT') {
      await db[op.table].add(op.record);
    } else if (op.action === 'UPDATE') {
      await db[op.table].update(op.record.id, op.record);
    } else if (op.action === 'DELETE') {
      await db[op.table].delete(op.record.id);
    }
  }
});
```

**Step 3: Sync Worker Processes**

```typescript
// syncWorker.ts - every 5s
const pending = await db.queue_gestures
  .where("status")
  .equals("PENDING")
  .toArray();

for (const gesture of pending) {
  await db.queue_gestures.update(gesture.client_tx_id, { status: "SYNCING" });

  const response = await fetch("/functions/v1/sync-batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ client_tx_id, fazenda_id, ops }),
  });

  const result = await response.json();

  if (result.results.every((r) => r.status === "APPLIED")) {
    // SUCCESS
    await db.queue_gestures.update(client_tx_id, { status: "DONE" });
    await db.queue_ops.where("client_tx_id").equals(client_tx_id).delete();
  }
}
```

**Step 4: UI Update**

- TopBar shows "Pendentes: 0" (gesture marked DONE)
- User sees event in animal timeline

---

### Flow 2: Create + Sync (Rejection + Rollback)

**Scenario**: User moves animal from Lote A → B, but server rejects (anti-teleporte).

**Step 1: Optimistic Apply**

```typescript
await createGesture({
  fazenda_id: 'f1',
  ops: [
    {
      client_op_id: uuid(),
      table: 'state_animais',
      action: 'UPDATE',
      record: { id: 'a1', lote_id: 'lote-b' },
      before_snapshot: { id: 'a1', lote_id: 'lote-a', identificacao: 'BR-001', ... }, // Full snapshot
    },
  ],
});

// Animal now shows in Lote B locally (optimistic)
```

**Step 2: Server Rejects**

```json
{
  "results": [
    {
      "op_id": "op1",
      "status": "REJECTED",
      "reason_code": "ANTI_TELEPORTE",
      "reason_message": "Animal is in Lote C on server, not Lote A"
    }
  ]
}
```

**Step 3: Rollback**

```typescript
// syncWorker.ts
if (hasRejected) {
  await db.queue_gestures.update(client_tx_id, { status: "REJECTED" });

  // Save rejection for user review
  await db.queue_rejections.add({
    client_op_id: "op1",
    reason_code: "ANTI_TELEPORTE",
    reason_message: "...",
  });

  // ROLLBACK: Revert local state to before_snapshot
  for (const op of ops.reverse()) {
    if (op.action === "UPDATE" && op.before_snapshot) {
      await db.state_animais.put(op.before_snapshot); // Restore full record
    } else if (op.action === "INSERT") {
      await db[op.table].delete(op.record.id); // Remove inserted record
    } else if (op.action === "DELETE" && op.before_snapshot) {
      await db[op.table].add(op.before_snapshot); // Restore deleted record
    }
  }
}
```

**Step 4: UI Update**

- Animal reverts to Lote A (rollback applied)
- User sees notification: "Movimentação falhou - animal não está no lote origem"

---

## Two Rails in Offline Context

### Agenda (Mutável)

- **Table**: `state_agenda_itens`
- **Actions**: INSERT (create task), UPDATE (complete/cancel)
- **Sync**: Bidirectional (client ← → server)
- **Conflicts**: Dedup via `dedup_key` index

### Eventos (Append-Only)

- **Tables**: `events_eventos`, `events_eventos_sanitario`, etc.
- **Actions**: INSERT only (no UPDATE/DELETE)
- **Sync**: Client → Server (append-only)
- **Conflicts**: Idempotency via `client_op_id`

---

## Guardrails

### Optimistic UI

- ✅ Always save `before_snapshot` for UPDATE/DELETE (enables rollback)
- ✅ Apply changes locally **before** sync (instant UX)
- ⚠️ Never skip rollback on REJECTED (data integrity)

### Sync Worker

- ✅ Process gestures in order (FIFO by `created_at`)
- ✅ Retry on network errors (max 3 times)
- ❌ Don't retry on REJECTED (business rule failure, not transient)

### Dexie Transactions

- ✅ Use `.transaction('rw', [...stores], async () => ...)` for atomicity
- ⚠️ Include all affected stores in transaction (e.g., `state_animais`, `events_eventos`)

---

## Examples

### Example 1: Offline → Online Transition

1. User registers 10 vaccinations offline
2. `queue_gestures` has 10 PENDING entries
3. TopBar shows "Pendentes: 10"
4. User goes online
5. SyncWorker processes all 10 gestures in 50s (5s interval)
6. All 10 marked DONE
7. TopBar shows "Pendentes: 0"

### Example 2: Debugging Stuck Sync

**Symptom**: "Pendentes: 5" never decreases.

**Diagnosis**:

```typescript
// Check gesture status
const pending = await db.queue_gestures
  .where("status")
  .equals("PENDING")
  .toArray();
console.log(pending); // Should be empty if stuck

const errors = await db.queue_gestures
  .where("status")
  .equals("ERROR")
  .toArray();
console.log(errors); // Check last_error field
```

**Solution**: Check `last_error`, likely network issue or expired JWT.

---

## Definition of Done

- [ ] Understand Dexie schema (`state_*`, `events_*`, `queue_*`)
- [ ] Can explain optimistic UI vs rollback
- [ ] Can trace a gesture from creation → PENDING → SYNCING → DONE/REJECTED
- [ ] Understand `before_snapshot` purpose (rollback)
- [ ] Know when to use `createGesture()` vs direct Dexie writes

---

## References

- `docs/OFFLINE.md` - High-level offline strategy
- `docs/ARCHITECTURE.md` - Two Rails explanation
- `src/lib/offline/db.ts` - Dexie schema definition
- `src/lib/offline/syncWorker.ts` - Sync worker implementation
- `src/lib/offline/ops.ts` - createGesture, rollbackOpLocal
