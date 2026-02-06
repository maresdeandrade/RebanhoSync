````md
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
````

### Rodar dev

```bash
pnpm run dev
```

### Build

```bash
pnpm run build
```

### Typecheck / lint

```bash
pnpm exec tsc --noEmit
pnpm run lint
```

---

## Variáveis de ambiente

Defina em `.env` (exemplo, ajuste para seu projeto):

* `VITE_SUPABASE_URL=...`
* `VITE_SUPABASE_ANON_KEY=...`
* `VITE_SUPABASE_FUNCTIONS_URL=...` (ex: https://<project>.functions.supabase.co)

---

## Migrações (Supabase)

A pasta `supabase/migrations/` contém as migrations versionadas (ex: triggers, RLS, RPCs, invites, members).

**Observação importante:** Postgres não permite alterar return type de function via `create or replace`. Para isso, criamos migrations de correção com `DROP FUNCTION ...` antes.

---

## Convenções de Código (essenciais)

### Try/Catch

Sempre:

```ts
} catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));
  // ...
}
```

### setInterval no browser (Vite)

Use:

```ts
let intervalId: ReturnType<typeof setInterval> | null = null;
```

(Não use `NodeJS.Timeout`.)

### Evitar “Invalid Hook Call”

Não usar `@supabase/auth-ui-react` (problema comum com peer deps no pnpm).
Login deve ser custom com `supabase.auth.signInWithPassword`.

---

## Rotas (alto nível)

* `/login`
* `/signup`
* `/select-fazenda`
* `/home`
* `/animais`, `/lotes`, `/pastos`, `/agenda`
* `/registrar`
* `/dashboard`
* `/admin/membros` (owner/manager conforme UI + guards)
* `/invites/:token`
* `/perfil`

Guards recomendados:

* `RequireAuth` (sessão)
* `RequireFarm` (fazenda ativa)

---

## Pendências (Backlog P0/P1)

### P0 — UX/Fluxo (bloqueios atuais)

* **Menu/Topbar**

  * Adicionar botão **“Trocar fazenda”** (voltar para `/select-fazenda`)
  * Adicionar botão **“Sair”** (logout)
* **Seleção de fazenda**

  * Em `/select-fazenda`, adicionar CTA **“Criar nova fazenda”**
  * Criar fazenda deve usar RPC `create_fazenda` e ao concluir:

    * setar `user_settings.active_fazenda_id`
    * atualizar `localStorage`
    * redirecionar para `/home`

### P0 — Admin/Membros (funcionalidade incompleta)

* **Adicionar membros**

  * Em `/admin/membros`, implementar botão **“Convidar membro”**
  * Fluxo: `create_invite` → exibir link/token → listar convites pendentes → permitir `cancel_invite`
* **Permissões**

  * Garantir UI:

    * owner: alterar role + remover
    * manager: alterar role (exceto promover owner) + **não remove**
    * cowboy: não acessa página

### P0 — Perfil (funcionalidade incompleta)

* **Editar perfil próprio**

  * Criar/ajustar página `/perfil` para editar `user_profiles` (display_name, phone, avatar_url opcional)
  * Corrigir bloqueios atuais onde não é possível editar nem o próprio perfil
* **Editar perfil de outro usuário**

  * **Não é MVP** (por segurança e RLS self-only). Se necessário, deve ser via RPC admin específica e escopo bem definido.

### P1 — Convites (completar E2E)

* Página `/invites/:token`

  * Preview via `get_invite_preview`
  * Aceitar via `accept_invite` (validar identidade por email/phone)
  * Rejeitar via `reject_invite`
  * Após aceitar: redirecionar para `/home` e setar fazenda ativa se necessário
* Tratar cenários:

  * token expirado
  * token cancelado
  * usuário não autenticado (pedir login e voltar)

### P1 — Robustez/Observabilidade

* Centralizar logger (substituir `console.*`)
* Estados de sync visíveis na UI (ex: indicador “Pendências”)
* Telas de reconciliação com ações claras para `REJECTED`

---

## Troubleshooting

### Página branca + “Invalid hook call”

Causas comuns:

* duas versões de React instaladas
* lib com peer deps conflitantes (ex: auth-ui)

Checklist:

```bash
pnpm why react
pnpm why react-dom
```

Remova libs suspeitas e rode `pnpm install` novamente.

### “Infinite recursion detected in policy … user_fazendas”

RLS com subquery recursiva na própria tabela.
Solução: policies devem usar helpers `security definer` (ex: `role_in_fazenda`, `has_membership`) sem recursão.

---

## Status do Projeto

* ✅ Offline-first com Dexie + fila de gestos
* ✅ `sync-batch` com JWT + membership enforcement
* ✅ RBAC hardened via RPCs security definer
* ✅ Table mapping centralizado (`tableMap.ts`)
* 🟡 Pendências P0/P1 listadas acima

```
::contentReference[oaicite:0]{index=0}
```
