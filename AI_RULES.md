# Gestão Agro — Offline-First (MVP)

Aplicação **offline-first** para gestão pecuária com **multi-tenant por fazenda**, RBAC (`owner/manager/cowboy`), sincronização por “gestos” (`client_tx_id`) e servidor Supabase com **RLS hardened** + RPCs security definer.

## Tech Stack
- React + TypeScript + Vite
- Tailwind + shadcn/ui (Radix UI)
- Supabase (Auth, Postgres, RLS, RPCs, Edge Functions)
- Dexie.js (IndexedDB) para armazenamento local offline
- pnpm

---

## Arquitetura (visão rápida)

### Two Rails: State + Events
- **State Rails (mutável)**: `animais`, `lotes`, `pastos`, `agenda_itens`, `contrapartes`, `protocolos_*`
- **Events Rails (append-only)**: `eventos` + `eventos_*` (sanitario/pesagem/movimentacao/...)

**Correções de evento**: sempre via contra-lançamento (novo evento com `corrige_evento_id`).

### Offline-first com fila de gestos
1. UI cria um gesto: `createGesture(fazenda_id, ops)`
2. Cliente aplica otimista no Dexie (stores `state_*`/`event_*`)
3. Ops ficam em `queue_ops` e `queue_gestures`
4. `syncWorker` envia lote para Edge Function `sync-batch`
5. Servidor retorna `APPLIED` / `APPLIED_ALTERED` / `REJECTED`
6. Se `REJECTED`, cliente faz rollback determinístico com `before_snapshot`

### Mapeamento de Tabelas (Supabase vs Dexie)
Fonte única: `src/lib/offline/tableMap.ts`

- Remoto (Supabase): `animais`, `agenda_itens`, `eventos`, ...
- Local (Dexie): `state_animais`, `state_agenda_itens`, `event_eventos`, ...

Helpers:
- `getLocalStoreName(remoteTable)`
- `getRemoteTableName(localStore)`

---

## Segurança (P0)

### JWT obrigatório no sync
A Edge Function `sync-batch` exige:
- `Authorization: Bearer <access_token>`
- valida JWT e extrai `user_id`
- valida membership em `user_fazendas`

Erros:
- **401**: sem JWT / JWT inválido
- **403**: usuário sem acesso à fazenda

### RLS Hardened + RPCs
- `user_fazendas` é **SELECT-only** por RLS (sem INSERT/UPDATE/DELETE direto)
- membership e gestão de membros **somente via RPCs security definer**:
  - `create_fazenda` (bootstrap owner + active farm)
  - `admin_set_member_role`
  - `admin_remove_member`
  - `create_invite`, `accept_invite`, `reject_invite`, `cancel_invite`, `get_invite_preview`

---

## Funcionalidades MVP

### Core
- Login/logout
- Seleção de fazenda ativa (multi-device):
  - cache local em `localStorage`
  - persistência remota em `user_settings.active_fazenda_id` (quando online)
- RBAC client-side (UI) + RLS server-side (verdade)

### Fluxos E2E Offline → Sync
- Sanitário (com protocolo opcional e agenda automática via dedup_key)
- Pesagem em lote (50+)
- Movimentação com anti-teleporte (validação server-side)

### Admin (membros)
- Lista membros
- Alterar role (owner/manager com restrições)
- Remover membro (owner only, não remove último owner)

### Convites
- Owner/manager cria convite (email/telefone)
- Aceitar/rejeitar via token
- Cancelar convite pendente (owner/manager)

### Perfil
- Editar perfil próprio (`user_profiles`) (self-only por RLS)

---

## Setup do projeto

### Pré-requisitos
- Node.js (LTS recomendado)
- pnpm
- Supabase project configurado (Auth, DB, Edge Functions)

### Instalação
```bash
pnpm install
