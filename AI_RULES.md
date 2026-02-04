# Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Auth, DB, RLS)
- React Router (Rotas em src/App.tsx)

# Product Context: Gestão Pecuária (MVP)
- PWA Mobile-first + Desktop Web Console.
- Roles: `cowboy`, `manager`, `owner`.
- Glossary: "IA" = Inseminação Artificial.

# Domain Architecture Rules
## Two Rails (State + Events)
- **Agenda (Mutable):** Status `agendado -> concluido/cancelado`. Dedup via `dedup_key`.
- **Events (Append-Only):** Fatos passados. Nunca atualizar colunas de negócio. Correções via contra-lançamento.

## Offline-first
- Optimistic UI local.
- Sync posterior com tratamento de `REJECTED` (rollback determinístico).

## Atomic Gesture
- Cada ação do usuário gera um `client_tx_id`.
- Transações no banco agrupadas por este ID.

## Idempotency
- Cada linha tem `client_op_id`.
- Unique constraint: `(fazenda_id, client_op_id) WHERE deleted_at IS NULL`.

## Multi-tenant
- Fronteira: `fazenda_id`.
- FKs compostas `(id, fazenda_id)` para evitar cross-farm references.

# Scope Guardrails
- Sem estoque/insumos no MVP.
- Sem PostGIS/polígonos no MVP.
- Sem integrações RFID/Balança no MVP.
- Sem edição de eventos passados.