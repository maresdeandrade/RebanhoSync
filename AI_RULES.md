# RebanhoSync — Offline-First (MVP)

Aplicação **offline-first** para gestão pecuária com **multi-tenant por fazenda**, RBAC (`owner/manager/cowboy`), sincronização por “gestos” (`client_tx_id`) e servidor Supabase com **RLS hardened** + **RPCs security definer**.

## Tech Stack
- React + TypeScript + Vite
- Tailwind + shadcn/ui (Radix UI)
- Supabase (Auth, Postgres, RLS, RPCs, Edge Functions)
- Dexie.js (IndexedDB) para armazenamento local offline
- pnpm

---

## Regras de Ouro (não quebrar o produto)
1) ✅ **Não quebrar build** (`pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm run lint`)
2) ✅ **DDL-first**: nomes e tipos conforme banco (ex.: `protocolo_id`, `intervalo_dias`, `data_prevista = 'YYYY-MM-DD'`)
3) ✅ **Sem strict mode global** (MVP) e **não remover shadcn/radix**
4) ✅ **Sem UPDATE de colunas de negócio em eventos** (append-only). Correções via **contra-lançamento**.
5) ✅ **Multi-tenant**: `fazenda_id` é a fronteira. Nunca permitir cross-farm references.
6) ✅ **Sync sempre autenticado**: Edge Function `sync-batch` exige JWT Bearer.

---

## Arquitetura (visão rápida)

### Two Rails: State + Events
- **State Rails (mutável)**: `animais`, `lotes`, `pastos`, `agenda_itens`, `contrapartes`, `protocolos_*`
- **Events Rails (append-only)**: `eventos` + `eventos_*` (sanitario/pesagem/movimentacao/...).

**Correções de evento**: sempre via contra-lançamento (novo evento com `corrige_evento_id`).

### Offline-first com fila de gestos
1. UI cria um gesto: `createGesture(fazenda_id, ops)`
2. Cliente aplica **otimista** no Dexie (stores `state_*`/`event_*`)
3. Ops ficam em `queue_ops` e `queue_gestures`
4. `syncWorker` envia lote para Edge Function `sync-batch`
5. Servidor retorna `APPLIED` / `APPLIED_ALTERED` / `REJECTED`
6. Se `REJECTED`, cliente faz **rollback determinístico** com `before_snapshot` (ordem reversa)

### Estados do Gesture (queue_gestures)
- `PENDING` → `SYNCING` → `DONE` (tudo aplicado)
- `REJECTED` (rollback aplicado, vai para reconciliação)
- `ERROR` (falha após retries / erro fatal)

---

## Mapeamento de Tabelas (Supabase vs Dexie)
Fonte única: `src/lib/offline/tableMap.ts`

- Remoto (Supabase): `animais`, `agenda_itens`, `eventos`, ...
- Local (Dexie): `state_animais`, `state_agenda_itens`, `event_eventos`, ...

Helpers:
- `getLocalStoreName(remoteTable)`
- `getRemoteTableName(localStore)`

**Regra prática:**
- **UI + ops** devem usar **nome remoto**
- **aplicação no Dexie** traduz para `state_*`/`event_*` via `getLocalStoreName()`

---

## Sync Metadata (P0 / DDL Compliance)
### Obrigatório em records enviados ao servidor
Cada record precisa conter:
- `fazenda_id`
- `client_id`
- `client_op_id`
- `client_tx_id`
- `client_recorded_at`

### Proibido no payload
Não enviar `created_at` / `updated_at` (server-managed), salvo se o DDL explicitamente pedir.

---

## Agenda (DDL + Dedup)
- `data_prevista`: **sempre** `'YYYY-MM-DD'` (string)
- `dominio`: ex. `'sanitario'` (não confundir com `tipo`)
- `status`: `agendado | concluido | cancelado`
- Concluir agenda: **apenas** `status='concluido'` (sem `concluido_at` se não existir no DDL)

### Dedup Key (canônica)
Formato obrigatório:
`${fazenda_id}|animal:${animalId}|piv:${versionId}|dose:${doseNum}`

---

## Segurança (P0)

### JWT obrigatório no sync
Edge Function `sync-batch` exige:
- `Authorization: Bearer <access_token>`
- valida JWT e extrai `user_id`
- valida membership em `user_fazendas`

Erros:
- **401**: sem JWT / JWT inválido
- **403**: usuário sem acesso à fazenda

### RLS Hardened + RPCs
- `user_fazendas` é **SELECT-only** via RLS (sem INSERT/UPDATE/DELETE direto)
- Membership e gestão de membros **somente via RPCs security definer**:
  - `create_fazenda` (cria fazenda + membership owner + active farm)
  - `admin_set_member_role`
  - `admin_remove_member`
  - `create_invite`, `accept_invite`, `reject_invite`, `cancel_invite`, `get_invite_preview`

### Anti-recursão em policies
Evitar policies que consultem a própria tabela via subquery (ex.: `user_fazendas`), pois gera:
`infinite recursion detected in policy`

✅ Preferir helper functions **SECURITY DEFINER** com `set row_security = off` para checks de membership/role.

---

## Onboarding (Invite-first + Multi-farm)
### Regra do produto (atual)
- Signup **não cria fazenda automaticamente**
- Usuário entra por:
  1) Convite aceito (email/phone match), OU
  2) `can_create_farm = true` (bootstrap), OU
  3) já ser owner de outra fazenda (multi-farm)

### Implicações
- `/select-fazenda`: se não houver farms, mostrar estado “Sem fazendas”
- Botão “Criar Fazenda” aparece **somente** quando `can_create_farm()` retornar true
- Aceite de convite valida identidade: email/telefone do usuário logado deve bater com o convite

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
- UI deve ter botões: **Trocar Fazenda** e **Sair**

### Convites
- Owner/manager cria convite (email/telefone)
- Aceitar/rejeitar via token
- Cancelar convite pendente (owner/manager)

### Perfil
- Editar perfil próprio (`user_profiles`) (self-only por RLS)
- UI deve ter opção de logout e navegação para troca de fazenda

---

## Padrões de Código (TS/React)
- `catch (e: unknown)` + `e instanceof Error`
- `setInterval`: usar `ReturnType<typeof setInterval>` (evitar `NodeJS.Timeout` no Vite)
- Evitar libs que causem “Invalid hook call” por peer deps duplicadas (ex.: `@supabase/auth-ui-react`)

---

## Setup do projeto

### Pré-requisitos
- Node.js (LTS recomendado)
- pnpm
- Supabase project configurado (Auth, DB, Edge Functions)

### Instalação
```bash
pnpm install
````

### Verificações

```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm run lint
```
