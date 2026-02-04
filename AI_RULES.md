# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.

---

# Product Context: Gestão Pecuária (MVP)

- App is a PWA mobile-first and also serves as a desktop Web Console (responsive layout).
- Roles (RBAC): ONLY 3 roles: `cowboy`, `manager`, `owner`.
- Glossary: "IA" means **Inseminação Artificial** (Reprodução). Do NOT use "IA" as "Information Architecture".

## Core modules (MVP screens/routes)
- Animais, Lotes, Pastos, Agenda, Registrar (wizard), Eventos (auditoria), Financeiro, Dashboard, Perfil, Reconciliação, Admin/Membros (owner only).

---

# Domain Architecture Rules (Non-Negotiable)

## Two Rails (State + Events)
- Agenda (future tasks) is MUTABLE:
  - status changes: `agendado -> concluido/cancelado`
  - can be rescheduled/cancelled
  - functional dedup ONLY for active pending tasks (status = `agendado`) via `dedup_key`
- Events (past facts) are APPEND-ONLY:
  - Never update business columns on `eventos` or `eventos_*` tables.
  - Corrections happen ONLY via contra-lançamento:
    - create a NEW event referencing `corrige_evento_id` (original event id).

## Offline-first behavior (client)
- User sees immediate local results (optimistic local apply).
- Sync happens later when online.
- Server returns per-operation status:
  - `APPLIED` | `REJECTED` | `APPLIED_ALTERED`
- `REJECTED` MUST trigger deterministic local rollback:
  - INSERT: remove local record (or mark reverted)
  - UPDATE: restore `before_snapshot` stored in the queue

## Atomic gesture = unit of UX + DB transaction
- Every user action creates a `client_tx_id`.
- All rows created by the same gesture share that `client_tx_id`.
- Server processes ONE transaction per `client_tx_id` (SAVEPOINT per op when needed).

## Idempotency (per row)
- Every operational synced table has `client_op_id`.
- Database enforces:
  - `UNIQUE(fazenda_id, client_op_id) WHERE deleted_at IS NULL` (or user-scoped equivalent)
- UUID PK does NOT replace `client_op_id`.

## Agenda dedup (only where appropriate)
- Only `agenda_itens` uses dedup via `dedup_key`.
- Enforce partial unique:
  - `UNIQUE(fazenda_id, dedup_key) WHERE status='agendado' AND deleted_at IS NULL AND dedup_key IS NOT NULL`
- Automatic tasks must provide `dedup_key` (manual tasks may omit).

## Movement anti-teleport invariant
- `animais.lote_id` can only change within a gesture that also includes a correlated movement event (`dominio='movimentacao'` + `eventos_movimentacao`) in the SAME `client_tx_id`.
- If violated, server must `REJECT` that operation.

---

# Data & Security Rules (Supabase/Postgres)

## Multi-tenant
- Tenant boundary is `fazenda_id`.
- Use composite FKs `(id, fazenda_id)` where applicable to avoid cross-farm references.
- Tombstones (`deleted_at`) must sync. Do NOT sync views.

## RLS
- RLS is for security (membership/roles), not for "active-only" scoping.
- "Active-only" = UI views (`vw_*_active`) or query conventions.
- Membership is defined by `user_fazendas` with `deleted_at IS NULL`.

## Membership management
- Users must NOT be able to self-assign into any farm.
- Membership writes must happen through owner-only RPC / secure server function.

---

# Frontend Conventions

## Routing & Structure
- Routes remain in `src/App.tsx`.
- Pages in `src/pages/`.
- Components in `src/components/`.
- Always wire new pages/components into `src/pages/Index.tsx` when relevant so user can see them.

## Responsive layout
- Mobile-first:
  - Home hub with module cards
  - Primary "Registrar" entrypoint
- Desktop:
  - Side navigation for management/auditing
- Provide global status in top bar:
  - Online/Offline indicator
  - Pending gestures count
  - Reconciliation shortcut when there are rejections

## UI Components
- Prefer shadcn/ui components.
- Do not edit shadcn/ui source files; wrap/compose new components instead.

---

# Code Quality & Safety

- No hardcoded secrets in frontend.
- Validate inputs (client and server), avoid SQL injection.
- Keep business rules centralized:
  - DB constraints/triggers + server write-path rules.
  - Avoid duplicating domain invariants across multiple places.
- Provide correlated logs/telemetry by `client_tx_id` where applicable.

---

# Scope Guardrails (DO NOT DO)

- Do NOT implement inventory/stock/insumos in MVP.
- Do NOT implement PostGIS polygons / advanced grazing rotation in MVP.
- Do NOT implement RFID/scale integrations in MVP.
- Do NOT implement GTA/document integrations in MVP.
- Do NOT implement advanced push notifications; MVP can use local reminders only.
- Do NOT allow editing past events; only contra-lançamento.
