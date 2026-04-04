# System Map & Risk Assessment

**Status:** Derivado (Generated from code analysis)  
**Baseline:** `0bb8829`  
**Data:** 2025-02-17

## 1. System Overview

RebanhoSync is an **Offline-First**, **Multi-Tenant** Livestock Management System. It uses a **Two-Rails Architecture** (State vs. Events) to handle local data mutations optimistically while ensuring server-side consistency via a synchronization queue.

- **Frontend:** React 19 + Vite 6 (Single Page App).
- **Offline Strategy:** IndexedDB (Dexie.js) stores all data locally.
- **Sync Strategy:** "Gestures" (Queued Operations) -> Background Worker -> Edge Function (`sync-batch`).
- **Backend:** Supabase (Postgres + Auth + Edge Functions).
- **Security:** RLS (Row Level Security) + Custom RPCs for sensitive operations.

### Architecture Diagram

```mermaid
graph TD
    subgraph Client [Browser / App]
        UI[React UI Components]
        Dexie[(Dexie.js IndexedDB)]
        Worker[Sync Worker]
        
        UI -->|Reads (useLiveQuery)| Dexie
        UI -->|Writes (createGesture)| Dexie
        Dexie -->|Queue (Pending)| Worker
    end

    subgraph Cloud [Supabase]
        Edge[Edge Function: sync-batch]
        Auth[GoTrue Auth]
        DB[(Postgres DB)]
        
        Worker -->|Push (POST /sync-batch)| Edge
        Worker -->|Pull (GET Tables)| DB
        Edge -->|Validate & Apply| DB
        Edge -->|Auth Check| Auth
    end

    Dexie -- Replaces Local Store --> Worker
```

## 2. Stack & Repo Map

| Component | Technology | Path | Responsibility |
|-----------|------------|------|----------------|
| **Frontend** | React 19, Vite 6, Tailwind, Shadcn/UI | `src/` | UI, Routing, Local Logic |
| **State Mgmt** | React Context + Dexie Hooks | `src/hooks/` | Global State (Auth, Theme) |
| **Offline DB** | Dexie.js (IndexedDB wrapper) | `src/lib/offline/db.ts` | Local persistence (Schema v6) |
| **Sync Engine** | Custom "Gesture" Queue | `src/lib/offline/syncWorker.ts` | Push/Pull logic, Retry, Error handling |
| **Backend API** | Supabase Edge Functions | `supabase/functions/` | Server-side logic (`sync-batch`) |
| **Database** | Postgres (Supabase) | `supabase/migrations/` | Schema, RLS, Triggers, RPCs |

## 3. Offline Layer

The local database (`OfflineDB`) uses a **Schema Versioning** strategy (currently v6). Stores are categorized into:

1.  **State Stores (`state_*`)**: Mutable snapshots of entities (e.g., `state_animais`, `state_lotes`). Used for UI reading.
2.  **Event Stores (`event_*`)**: Immutable append-only logs of domain events (e.g., `event_eventos_sanitario`).
3.  **Queue Stores (`queue_*`)**: Outbox for synchronization.
    - `queue_gestures`: Tracks transaction groups (`client_tx_id`).
    - `queue_ops`: Individual operations within a gesture.

**Key File:** `src/lib/offline/db.ts`

## 4. Sync Model

The synchronization model follows a **"Push-Pull"** strategy with **Optimistic UI**.

-   **Push (Outbox):**
    -   User actions create a `Gesture` containing multiple `Operations`.
    -   Gestures are queued in `queue_gestures` with status `PENDING`.
    -   `syncWorker` runs every 5s, picks pending gestures, and sends them to `sync-batch`.
    -   **Idempotency:** Enforced via `client_tx_id` and `client_op_id`.
    -   **Ordering:** Serial processing of gestures by `created_at`.

-   **Pull (Reconciliation):**
    -   Triggered after successful sync or manual refresh.
    -   **Strategy:** `replace` (Clear Store -> Write All).
    -   **Risk:** Clears local store, potentially wiping pending optimistic updates if not carefully managed.

**Key Files:** `src/lib/offline/syncWorker.ts`, `src/lib/offline/pull.ts`

## 5. Supabase & Security

-   **RLS (Row Level Security):** Strict isolation by `fazenda_id`.
    -   `user_fazendas` is SELECT-only (membership managed via RPCs).
    -   Most tables use `public.has_membership(fazenda_id)`.
-   **Edge Functions:**
    -   `sync-batch`: Authoritative endpoint for processing offline operations.
    -   Validates JWT, checks membership, enforces "Anti-Teleport" rules, and applies changes.
-   **RPCs:** Used for complex logic (e.g., `get_user_emails`, `create_fazenda`).

**Key Files:** `supabase/migrations/0004_rls_hardening.sql`, `supabase/functions/sync-batch/index.ts`

## 6. Main Flows

### 1. Register Offline Event
1.  User submits form.
2.  `createGesture` is called with `fazenda_id` and operations.
3.  `queue_gestures` + `queue_ops` records created.
4.  `applyOpLocal` updates `state_*` / `event_*` immediately (Optimistic).

### 2. Synchronization (Push)
1.  `syncWorker` wakes up, finds `PENDING` gesture.
2.  Reads ops, resolves table names (local -> remote).
3.  POSTs to `/sync-batch` with JWT.
4.  Server validates, applies (or rejects), returns status.
5.  Worker updates gesture to `DONE` or `REJECTED` (triggers rollback).

### 3. Readback (Pull)
1.  Worker calls `pullDataForFarm` for affected tables.
2.  Fetches data from Supabase (`select *`).
3.  **Clears local store** (`store.clear()`).
4.  Inserts fresh data (`store.bulkPut()`).

## 7. Top 10 Technical Risks

| Priority | Category | Risk | Impact | Evidence | Suggestion |
|----------|----------|------|--------|----------|------------|
| **P0** | **Security** | **PII Enumeration via RPC** | Any user can list emails of any other user ID via `get_user_emails`. | `supabase/migrations/0015_get_user_emails_rpc.sql` | Restrict RPC to only return emails of members in the same farm. |
| **P0** | **Data Loss** | **Sync Race Condition** | `pullDataForFarm` clears local store (`mode='replace'`). If pending optimistic updates exist, they are wiped before being synced. | `src/lib/offline/pull.ts:54` (`store.clear()`) | Change default to `merge` or ensure `pull` never runs if `queue_gestures` is not empty. |
| **P1** | **Privacy** | **Local Data Leak** | `useLotes` and `Animais.tsx` query all local data without `fazenda_id` filter. Switching farms or multi-farm users see mixed data. | `src/hooks/useLotes.ts:15`, `src/pages/Animais.tsx:63` | Update `useLiveQuery` to always filter `.where('fazenda_id').equals(currentFarmId)`. |
| **P1** | **UX/Data** | **Soft Deleted Items Visible** | UI (`Animais.tsx`) and `pull.ts` do not filter `deleted_at`. Deleted items persist in lists. | `src/pages/Animais.tsx` (no filter), `src/lib/offline/pull.ts` (select *) | Add `deleted_at IS NULL` filter in RLS/Pull or in Dexie hooks. |
| **P2** | **Consistency** | **Partial Sync Failure** | `sync-batch` applies ops sequentially. If Op 2 fails, Op 1 remains committed. Client rolls back *all*, causing desync. | `supabase/functions/sync-batch/index.ts` (loop) | Implement transactional batching in Edge Function or server-side rollback. |
| **P2** | **Performance** | **Inefficient Local Querying** | `useLiveQuery` loads full collections (`toArray`) into memory before filtering. Slows down with large datasets. | `src/pages/Animais.tsx:63` | Use Dexie indices: `db.state_animais.where('fazenda_id').equals(fid).and(...)`. |
| **P3** | **Security** | **Cowboy Write Access** | RLS policy `animais_write_by_membership` allows Cowboys to delete/edit animals. Might violate business rules. | `supabase/migrations/0004_rls_hardening.sql:109` | Restrict `DELETE/UPDATE` to Owner/Manager in RLS if strictly required. |
| **P3** | **Observability** | **Silent Sync Failures** | Sync errors are logged to console/DB but not surfaced to user. Stuck `ERROR` gestures block queue indefinitely. | `src/lib/offline/syncWorker.ts:52` | Add UI indicator for Sync Status (Error/Retry) and manual retry button. |
| **P4** | **Code Quality** | **Type Safety Gaps** | `any` usage in some catch blocks and lack of strict null checks in `useLotes` return. | `src/hooks/useLotes.ts` | Improve typing and error handling patterns. |
| **P4** | **Tech Debt** | **Hardcoded Sync Interval** | `WORKER_INTERVAL_MS = 5000` is hardcoded. Drains battery on mobile if no changes. | `src/lib/offline/syncWorker.ts:13` | Use adaptive interval or `navigator.onLine` / visibility events. |

## 8. Reproducible Commands
Used to generate this report:

```bash
# Baseline
git rev-parse --short HEAD

# Verify Offline DB Schema
rg "class .* extends Dexie" src/lib/offline/db.ts

# Check Pull Strategy (Risk P0)
rg "store.clear" src/lib/offline/pull.ts

# Check Local Query Filtering (Risk P1)
rg "state_lotes.toArray" src/hooks/useLotes.ts

# Check RPC Security (Risk P0)
rg "create or replace function public.get_user_emails" supabase/migrations/
```
