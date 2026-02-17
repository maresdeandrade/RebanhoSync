# Implementation Status Matrix

> **Status:** Derivado
> **Baseline:** `1f62e4b`
> **Última Atualização:** 2026-02-16
> **Critério RIGOROSO:** Implementado = (DB + Server + Dexie + Event Builder + UI Write + Sync passa)

Este documento é a **matriz única de verdade** sobre o que existe efetivamente implementado no RebanhoSync.

---

## Resumo Executivo

**Capability Score:** **100% MVP** (7 de 7 domínios operacionais)

- ✅ **Sanitário**: Completo
- ✅ **Pesagem**: Completo
- ✅ **Movimentação**: Completo
- ✅ **Nutrição**: Completo ✨ (TD-006 CLOSED)
- ✅ **Reprodução**: Completo
- ✅ **Financeiro**: Completo
- ✅ **Agenda**: Completo

**Gaps Não-Bloqueantes:** 9 items (UX/RLS/Performance)

---

## 1. Infraestrutura Core

### Auth & Multi-Tenancy ✅ COMPLETO

**DB:**

- `migrations/0001_init.sql`: users, user_profiles, fazendas, user_fazendas
- `migrations/0027_user_settings.sql`: user_settings

**Evidência:**

- Todas tabelas com `fazenda_id` (tenant isolation)
- RLS policies ativas
- `create_fazenda` RPC funcional

---

### RBAC ⚠️ PARTIAL

**Roles:** owner / manager / cowboy

**Implementado:**

- ✅ Membership management (`admin_change_role`, `admin_remove_member`)
- ✅ Policies diferenciam roles (estrutura vs operação)
- ❌ **Gap (TD-003):** DELETE animais permite cowboy (deveria ser owner/manager)

**Evidência:**

- `migrations/0004_rls_hardening.sql`: Policies por tabela
- `migrations/0024_rbac_rpcs.sql`: RPCs administrativas

---

### Offline-First Architecture ⚠️ PARTIAL

**Implementado:**

- ✅ Dexie stores: state*\*, event*_, queue\__
- ✅ Sync pipeline: createGesture → syncWorker → rollback
- ✅ Two Rails (Agenda mutável + Eventos append-only)
- ❌ **Gap (TD-001):** Sem rotina de cleanup `queue_rejections`

**Evidência:**

- `src/lib/offline/db.ts`: 20+ stores Dexie
- `src/lib/offline/syncWorker.ts`: Pipeline completo
- `src/lib/offline/pull.ts`: Reconciliação remota

---

## 2. Domínios Operacionais (E2E Completo)

### 2.1 Sanitário ✅ COMPLETO

| Componente   | Status | Evidência                                        |
| ------------ | ------ | ------------------------------------------------ |
| **DB**       | ✅     | `migrations/0001_init.sql:eventos_sanitario`     |
| **Server**   | ✅     | `sync-batch` aceita dominio='sanitario'          |
| **Dexie**    | ✅     | `db.ts:event_eventos_sanitario`                  |
| **Builder**  | ✅     | `buildEventGesture.ts:L51-62`                    |
| **UI Write** | ✅     | `Registrar.tsx:tipoManejo==='sanitario'` (L932+) |
| **UI Read**  | ✅     | Dashboard sanitário funcional                    |
| **Sync**     | ✅     | Passa E2E                                        |

---

### 2.2 Pesagem ⚠️ FUNCIONAL

| Componente   | Status | Evidência                                       |
| ------------ | ------ | ----------------------------------------------- |
| **DB**       | ✅     | `migrations/0001_init.sql:eventos_pesagem`      |
| **Server**   | ✅     | `sync-batch` aceita dominio='pesagem'           |
| **Dexie**    | ✅     | `db.ts:event_eventos_pesagem`                   |
| **Builder**  | ✅     | `buildEventGesture.ts:L63-71`                   |
| **UI Write** | ✅     | `Registrar.tsx:tipoManejo==='pesagem'` (L1006+) |
| **UI Read**  | ✅     | Histórico funcional                             |
| **Sync**     | ✅     | Passa E2E                                       |

**Gaps Não-Bloqueantes:**

- ❌ (TD-014): UI não valida peso > 0 (servidor rejeita, mas UX ruim)

---

### 2.3 Movimentação ⚠️ FUNCIONAL

| Componente   | Status | Evidência                                            |
| ------------ | ------ | ---------------------------------------------------- |
| **DB**       | ✅     | `migrations/0001_init.sql:eventos_movimentacao`      |
| **Server**   | ✅     | `sync-batch` + anti-teleport server-side             |
| **Dexie**    | ✅     | `db.ts:event_eventos_movimentacao`                   |
| **Builder**  | ✅     | `buildEventGesture.ts:L72-86` (com UPDATE animal)    |
| **UI Write** | ✅     | `Registrar.tsx:tipoManejo==='movimentacao'` (L1066+) |
| **UI Read**  | ✅     | Histórico funcional                                  |
| **Sync**     | ✅     | Passa E2E (com anti-teleport server)                 |

**Gaps Não-Bloqueantes:**

- ❌ (TD-008): UI não bloqueia origem==destino (servidor rejeita, UX ruim)
- ❌ (TD-019): FKs faltantes (from/to_lote_id sem FOREIGN KEY)

---

### 2.4 Nutrição ✅ COMPLETO ✨

| Componente   | Status | Evidência                                          |
| ------------ | ------ | -------------------------------------------------- |
| **DB**       | ✅     | `migrations/0001_init.sql:eventos_nutricao`        |
| **Server**   | ✅     | `sync-batch` aceita dominio='nutricao'             |
| **Dexie**    | ✅     | `db.ts:event_eventos_nutricao`                     |
| **Builder**  | ✅     | `buildEventGesture.ts:L87-97`                      |
| **UI Write** | ✅     | `Registrar.tsx:L674-684, L1113-1143` (Form inline) |
| **UI Read**  | ✅     | Histórico funcional (filtro domínio)               |
| **Sync**     | ✅     | Passa E2E (Fluxo 8)                                |

**Escopo MVP:** Registro operacional (alimento_nome, quantidade_kg) sem gestão de estoque.

**Evidência Detalhada:**

```bash
# UI Write:
Registrar.tsx:674-684 - Event builder input
Registrar.tsx:1113-1143 - Form fields (alimentoNome, quantidadeKg)

# Builder:
buildEventGesture.ts:87-97 - eventos_nutricao INSERT

# DB:
migrations/0001_init.sql:632 - CREATE TABLE eventos_nutricao
```

**Status:** ✅ **TD-006 CLOSED** (UI implementada, E2E validado)

---

### 2.5 Reprodução ✅ COMPLETO

| Componente   | Status | Evidência                                     |
| ------------ | ------ | --------------------------------------------- |
| **DB**       | ✅     | `migrations/0035_reproducao_hardening_v1.sql` |
| **Server**   | ✅     | `sync-batch` aceita dominio='reproducao'      |
| **Dexie**    | ✅     | `db.ts:event_eventos_reproducao`              |
| **Builder**  | ✅     | `buildEventGesture.ts:L98-112`                |
| **UI Write** | ✅     | `components/events/ReproductionForm.tsx`      |
| **UI Read**  | ✅     | `ReproductionDashboard.tsx` + views           |
| **Sync**     | ✅     | Passa E2E                                     |

**Recursos Avançados:**

- Linking episódios (cobertura → diagnóstico → parto)
- Status computation (prenha, vazia, etc)
- Reporting views (prenhez_stats, tx_ia)

**Gap Não-Bloqueante:**

- ❌ (TD-020): FK macho_id faltante

---

### 2.6 Financeiro ✅ COMPLETO

| Componente   | Status | Evidência                                          |
| ------------ | ------ | -------------------------------------------------- |
| **DB**       | ✅     | `migrations/0001_init.sql:eventos_financeiro`      |
| **Server**   | ✅     | `sync-batch` aceita dominio='financeiro'           |
| **Dexie**    | ✅     | `db.ts:event_eventos_financeiro`                   |
| **Builder**  | ✅     | `buildEventGesture.ts:L98-112`                     |
| **UI Write** | ✅     | `Registrar.tsx:tipoManejo==='financeiro'` (L1145+) |
| **UI Read**  | ✅     | Histórico funcional                                |
| **Sync**     | ✅     | Passa E2E                                          |

---

### 2.7 Agenda (Rail 1) ✅ COMPLETO

| Componente   | Status | Evidência                                       |
| ------------ | ------ | ----------------------------------------------- |
| **DB**       | ✅     | `migrations/0001_init.sql:agenda_itens` + dedup |
| **Server**   | ✅     | `sync-batch` + deduplicação server              |
| **Dexie**    | ✅     | `db.ts:state_agenda_itens`                      |
| **Builder**  | ✅     | `buildAgendaGesture.ts`                         |
| **UI Write** | ✅     | Agenda CRUD funcional                           |
| **UI Read**  | ✅     | Lista + filtros                                 |
| **Sync**     | ✅     | Passa E2E (Fluxo 4 dedup)                       |

**Recursos:**

- Deduplicação via `dedup_key`
- Estado: agendado → concluido / cancelado
- Geração automática via protocolos sanitários

**Gap Não-Bloqueante:**

- ❌ (TD-011): Produtos TEXT livre (normalização planejada)

---

## 3. Entidades Administrativas

### 3.1 Animais ✅ COMPLETO

| Componente   | Status | Evidência                             |
| ------------ | ------ | ------------------------------------- |
| **DB**       | ✅     | `migrations/0021_animais_columns.sql` |
| **Dexie**    | ✅     | `db.ts:state_animais`                 |
| **UI Write** | ✅     | CRUD animais completo                 |
| **Sync**     | ✅     | Funcional                             |

**Gap Não-Bloqueante:**

- ❌ (TD-003): DELETE permite cowboy (deveria restringir)

---

### 3.2 Lotes e Pastos ✅ COMPLETO

| Componente | Status | Evidência                                            |
| ---------- | ------ | ---------------------------------------------------- |
| **DB**     | ✅     | `migrations/0001_init.sql + 0022_pastos_columns.sql` |
| **Dexie**  | ✅     | `db.ts:state_lotes, state_pastos`                    |
| **UI**     | ✅     | CRUD completo                                        |
| **RLS**    | ✅     | Owner/Manager apenas                                 |

---

## 4. Validações Server-Side

### 4.1 Anti-Teleport ⚠️ PARTIAL

**Server:** ✅ `sync-batch/rules.ts:prevalidateAntiTeleport` (L149-249)  
**Frontend:** ❌ UI não desabilita origem==destino (TD-008)

---

### 4.2 Imutabilidade Eventos ✅ COMPLETO

**Trigger:** `prevent_business_update` impede UPDATE de campos semânticos  
**Correção:** Via `corrige_evento_id` (contra-lançamento)

**Evidência:** `migrations/0001_init.sql:trigger prevent_business_update`

---

## 5. Gaps Consolidados (Não-Bloqueantes)

| TD     | Domínio      | Tipo                         | Bloqueia E2E?           |
| ------ | ------------ | ---------------------------- | ----------------------- |
| TD-001 | Offline      | Queue cleanup missing        | Não (risco storage)     |
| TD-003 | RBAC         | DELETE animais sem restrição | Não (risco perda dados) |
| TD-004 | Performance  | Índices parciais             | Não (escala)            |
| TD-008 | Movimentação | Anti-Teleport UI missing     | Não (UX ruim)           |
| TD-011 | Sanitário    | Produtos TEXT livre          | Não (normalização)      |
| TD-014 | Pesagem      | Peso validation UI           | Não (UX ruim)           |
| TD-015 | Performance  | GMD em memória               | Não (escala)            |
| TD-019 | Movimentação | FKs faltantes                | Não (integridade)       |
| TD-020 | Reprodução   | FK macho_id faltante         | Não (integridade)       |

**Total OPEN:** 9 items  
**Bloqueadores:** 0 ✅

---

## Capability Score Final

**MVP Completo:** 7 de 7 domínios (100%) ✅

**Desbloqueio:** TD-006 (Nutrição UI) foi RESOLVIDO - UI já estava implementada em `Registrar.tsx`.

**Próxima Fase:** Resolver gaps P1/P2 (RLS, validações frontend, performance)

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Gaps detalhados
- [**ROADMAP.md**](./ROADMAP.md) - Planejamento 6 semanas
- [**E2E_MVP.md**](./E2E_MVP.md) - Fluxos de validação
