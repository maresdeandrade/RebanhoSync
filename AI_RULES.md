# RebanhoSync — AI Rules (Beta Interno)

Aplicação **offline-first** para gestão pecuária com **multi-tenant por fazenda**, RBAC (`owner/manager/cowboy`), sincronização por gestos (`client_tx_id`) e servidor Supabase com **RLS hardened** + **RPCs security definer**.

> **Estado:** Beta interno — MVP completo. 7/7 domínios operacionais implementados.

## Tech Stack
- React 19 + TypeScript + Vite 6
- Tailwind CSS + shadcn/ui (Radix UI)
- TanStack React Query ^5.56.2
- Supabase (Auth, Postgres, RLS, RPCs, Edge Functions)
- Dexie.js v4 (IndexedDB) — schema versão 8
- pnpm

---

## Regras de Ouro (não quebrar o produto)
1. ✅ **Não quebrar build** (`pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm run lint`)
2. ✅ **DDL-first**: nomes e tipos conforme banco (ex.: `protocolo_id`, `intervalo_dias`, `data_prevista = 'YYYY-MM-DD'`)
3. ✅ **Sem strict mode global** (MVP) e **não remover shadcn/radix**
4. ✅ **Sem UPDATE de colunas de negócio em eventos** (append-only). Correções via **contra-lançamento** (`corrige_evento_id`).
5. ✅ **Multi-tenant**: `fazenda_id` é a fronteira. Nunca permitir cross-farm references.
6. ✅ **Sync sempre autenticado**: Edge Function `sync-batch` exige JWT Bearer.
7. ✅ **Patches pequenos e revisáveis** com logs/guards defensivos (`unknown + instanceof Error`).

---

## Arquitetura (visão rápida)

### Two Rails: State + Events
- **State Rail (mutável):** `animais`, `lotes`, `pastos`, `agenda_itens`, `contrapartes`, `protocolos_*`
- **Events Rail (append-only):** `eventos` + `eventos_*` (sanitario/pesagem/movimentacao/nutricao/reproducao/financeiro)

Correções de evento: sempre via contra-lançamento (novo evento com `corrige_evento_id`), nunca por UPDATE de coluna de negócio.

### Offline-first com fila de gestos
1. UI cria um gesto: `createGesture(fazenda_id, ops)`
2. Cliente aplica **otimista** no Dexie (stores `state_*`/`event_*`)
3. Ops ficam em `queue_ops` e `queue_gestures`
4. `syncWorker` envia lote para Edge Function `sync-batch`
5. Servidor retorna `APPLIED` / `APPLIED_ALTERED` / `REJECTED`
6. Se `REJECTED`, cliente faz **rollback determinístico** com `before_snapshot` (ordem reversa)
7. Auto-purge de `queue_rejections` com TTL 7 dias (a cada 6h no worker)

### Estados do Gesture (queue_gestures)
- `PENDING` → `SYNCING` → `DONE` (tudo aplicado)
- `REJECTED` (rollback aplicado)
- `ERROR` (falha após retries / erro fatal)

### Dexie v8 — 4 categorias de stores
- `state_*` (9 stores): réplica mutável do estado atual
- `event_*` (7 stores): log append-only de eventos ocorridos
- `queue_*` (3 stores): fila transacional e DLQ
- `metrics_events` (1 store): telemetria local de piloto — **não sincronizado remotamente** (TD-021)

---

## Mapeamento de Tabelas (Supabase vs Dexie)
Fonte única: `src/lib/offline/tableMap.ts`

- Remoto (Supabase): `animais`, `agenda_itens`, `eventos`, ...
- Local (Dexie): `state_animais`, `state_agenda_itens`, `event_eventos`, ...

**Regra prática:**
- **UI + ops** usam **nome remoto**
- **Aplicação no Dexie** traduz via `getLocalStoreName()`

---

## Sync Metadata (P0 / DDL Compliance)

### Obrigatório em records enviados ao servidor
```
fazenda_id, client_id, client_op_id, client_tx_id, client_recorded_at
```

### Proibido no payload
Não enviar `created_at` / `updated_at` (server-managed).

---

## Taxonomia Canônica Bovina

Classificações derivadas de **fatos**, não de labels persistidos.

### Três eixos
- `categoria_zootecnica` (ex: bezerro, novilha, vaca, touro)
- `fase_veterinaria` (ex: amamentando, desmamado)
- `estado_produtivo_reprodutivo` (ex: prenhe, seca, recem_parida, vazia)

### Contrato v1 de `taxonomy_facts`
Campos obrigatórios em `animais.payload.taxonomy_facts`:
- `schema_version = 1` (obrigatório)
- `castrado`, `puberdade_confirmada`, `prenhez_confirmada`
- `data_prevista_parto`, `data_ultimo_parto`
- `em_lactacao`, `secagem_realizada`, `data_secagem`

### Ownership de escrita
- **UI manual:** `castrado`, `puberdade_confirmada`, `secagem_realizada`, `data_secagem`, `em_lactacao`
- **Writer `reproduction_event`:** `prenhez_confirmada`, `data_prevista_parto`, `data_ultimo_parto`
- Campos event-driven **não aceitam override manual** — o cliente valida em `src/lib/offline/ops.ts` e o servidor em `sync-batch/taxonomy.ts`

### Regras
- Nunca persistir labels derivados como fonte primária
- Shape inválido de `taxonomy_facts` → `REJECTED` pelo servidor
- Paridade TS ↔ SQL testada em `src/lib/animals/__tests__/taxonomySqlParity.test.ts`

---

## Agenda (DDL + Dedup)
- `data_prevista`: **sempre** `'YYYY-MM-DD'` (string)
- `dominio`: ex. `'sanitario'` (não confundir com `tipo`)
- `status`: `agendado | concluido | cancelado`
- Dedup key: `${fazenda_id}|animal:${animalId}|piv:${versionId}|dose:${doseNum}`

---

## Segurança (P0)

### JWT obrigatório no sync
Edge Function `sync-batch` exige:
- `Authorization: Bearer <access_token>`
- valida JWT e extrai `user_id`
- valida membership em `user_fazendas`

### RLS Hardened + RPCs
- `user_fazendas` é **SELECT-only** via RLS (sem INSERT/UPDATE/DELETE direto)
- Membership e gestão de membros **somente via RPCs security definer**:
  - `create_fazenda`, `admin_set_member_role`, `admin_remove_member`
  - `create_invite`, `accept_invite`, `reject_invite`, `cancel_invite`, `get_invite_preview`

### RBAC de DELETE — Animais (TD-003 CLOSED)
- DELETE restrito a `owner/manager` via policy `animais_delete_by_role` (`role_in_fazenda()`)
- Migration: `20260308230748_rbac_delete_hardening_animais.sql`

### Anti-recursão em policies
Evitar policies que consultem a própria tabela via subquery — usar helpers `SECURITY DEFINER` com `set row_security = off`.

### Tabela global `produtos_veterinarios`
Exceção ao padrão tenant-scoped. Sem `fazenda_id`. RLS SELECT para qualquer `authenticated`. Sem policy de escrita (seed-only). Ver `docs/ADRs/ADR-0002`.

### FKs Compostas
- **Correto:** `FOREIGN KEY (lote_id, fazenda_id) REFERENCES lotes(id, fazenda_id)`
- **Errado:** `FOREIGN KEY (lote_id) REFERENCES lotes(id)`
- TDs 019 e 020 CLOSED via migration `20260308230735`.

---

## RBAC (Role-Based Access Control)

| Role | Leitura | Escrita Operacional | Escrita Estrutural | DELETE Animais | Membros |
|:---|:---|:---|:---|:---|:---|
| **Cowboy** | ✅ | ✅ Eventos, Agenda, Animais (INSERT/UPDATE) | ❌ | ❌ | ❌ |
| **Manager** | ✅ | ✅ Tudo do Cowboy | ✅ Lotes, Pastos, Protocolos | ✅ | ❌ |
| **Owner** | ✅ | ✅ Tudo do Manager | ✅ | ✅ | ✅ |

---

## Onboarding (Invite-first + Multi-farm)
- Signup **não cria fazenda automaticamente**
- Usuário entra por: convite aceito, `can_create_farm = true`, ou já ser owner
- Aceite de convite valida identidade: email/telefone do usuário logado deve bater com o convite

---

## Funcionalidades MVP Completas

### Core
- Auth + seleção de fazenda ativa (multi-device) + RBAC
- Cache local em `localStorage` + persistência remota em `user_settings.active_fazenda_id`

### Domínios operacionais (7/7)
- Sanitário (vacinas, vermifugação, tratamentos + protocolo automático com dedup_key)
- Pesagem em lote (GMD via `vw_animal_gmd`)
- Movimentação com anti-teleporte
- Nutrição (operacional, sem estoque)
- Reprodução completa (cobertura/IA → diagnóstico → parto → pós-parto → cria inicial)
- Financeiro (lançamentos, sem fluxo de caixa complexo)
- Agenda (gerar, concluir, cancelar, dedup, recálculo)

### Superfície adicional
- Dashboard reprodutivo + relatórios operacionais
- Importação CSV (animais, lotes, pastos)
- Transições do rebanho + ficha completa do animal
- Telemetria local de piloto
- Catálogo `produtos_veterinarios` (seed básico, integração UI pendente — TD-022)

---

## Padrões de Código (TS/React)
- `catch (e: unknown)` + `e instanceof Error` — nunca `catch (e: any)`
- `setInterval`: usar `ReturnType<typeof setInterval>` (evitar `NodeJS.Timeout` no Vite)
- Componentes shadcn/Radix não devem ser removidos

---

## Gaps Residuais (TDs Abertos)

| TD | Descrição |
|---|---|
| TD-021 | `metrics_events` sem envio remoto — telemetria local-only |
| TD-022 | `produtos_veterinarios` sem autocomplete integrado em `Registrar.tsx` |
| TD-023 | Pós-parto + Cria Inicial sem cobertura no pacote `test:e2e` |

---

## Setup do projeto

```bash
pnpm install
pnpm exec tsc --noEmit   # type check
pnpm run lint            # lint
pnpm test                # unitários + integração
pnpm run build           # produção
pnpm run test:e2e        # fluxos guiados
```

Ambiente: copiar `.env.example` → `.env` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL`.
