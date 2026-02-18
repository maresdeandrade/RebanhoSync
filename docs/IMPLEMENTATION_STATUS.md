# Implementation Status Matrix

> **Status:** Derivado (Rev D+)
> **Baseline:** `8ae3860`
> **Última Atualização:** 2026-02-17
> **Derivado por:** Antigravity — capability_id Derivation Rev D+

Este documento é a **matriz única de verdade** sobre o que existe efetivamente implementado no RebanhoSync.

> [!NOTE]
> **Duas camadas:**
>
> - **Editorial** (§1–§5): resumo humano por domínio/componente.
> - **Analítica** (§6–§9): Matriz Analítica com `capability_id` — **fonte de derivação** para `TECH_DEBT` e `ROADMAP`.

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

- ✅ Dexie stores: state*\*, event*\_, queue\_\_
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

## 6. Capability Catalog

> **Regra:** somente capabilities já suportadas no repo. Novas capabilities → `NEW (Proposed)` no `RECONCILIACAO_REPORT`, fora do score/derivação.

| Domínio      | `capability_id`                     | Descrição                                       |
| ------------ | ----------------------------------- | ----------------------------------------------- |
| sanitario    | `sanitario.registro`                | Registro de evento sanitário                    |
| sanitario    | `sanitario.historico`               | Histórico/leitura de sanitário                  |
| sanitario    | `sanitario.agenda_link`             | Vínculo/geração de agenda via engine sanitária  |
| pesagem      | `pesagem.registro`                  | Registro de pesagem                             |
| pesagem      | `pesagem.historico`                 | Histórico/leitura de pesagem                    |
| nutricao     | `nutricao.registro`                 | Registro de nutrição (sem estoque)              |
| nutricao     | `nutricao.historico`                | Histórico/leitura de nutrição                   |
| movimentacao | `movimentacao.registro`             | Registro de movimentação                        |
| movimentacao | `movimentacao.historico`            | Histórico/leitura de movimentação               |
| movimentacao | `movimentacao.anti_teleport_client` | Validação client-side origem≠destino            |
| reproducao   | `reproducao.registro`               | Registro de reprodução                          |
| reproducao   | `reproducao.historico`              | Histórico/leitura de reprodução                 |
| reproducao   | `reproducao.episode_linking`        | Linking episódios (cobertura→diagnóstico→parto) |
| financeiro   | `financeiro.registro`               | Registro financeiro                             |
| financeiro   | `financeiro.historico`              | Histórico/leitura financeiro                    |
| agenda       | `agenda.gerar`                      | Geração/criação de agenda items                 |
| agenda       | `agenda.concluir`                   | Conclusão/cancelamento de agenda items          |
| agenda       | `agenda.dedup`                      | Deduplicação via `dedup_key`                    |
| agenda       | `agenda.recalculo`                  | Recalculo automático via engine sanitária       |

**Total: 19 capabilities**

---

## 7. Layer Applicability Map

> A Matriz Analítica define aplicabilidade por célula usando `—` (N/A).
> `—` não exige evidência, não conta como gap, não gera TECH_DEBT.

| Família/Capability                  | DB  | SRV | OFF | UIW | UIR | E2E |
| ----------------------------------- | --- | --- | --- | --- | --- | --- |
| `*.registro`                        | ✓   | ✓   | ✓   | ✓   | ✓¹  | ✓   |
| `*.historico`                       | —   | ✓\* | ✓\* | —   | ✓   | ✓   |
| `sanitario.agenda_link`             | ✓   | ✓   | —   | —   | —   | ✓   |
| `movimentacao.anti_teleport_client` | —   | —   | —   | ✓   | —   | ✓   |
| `reproducao.episode_linking`        | ✓   | ✓   | ✓\* | ✓\* | ✓   | ✓   |
| `agenda.*`                          | ✓   | ✓   | ✓\* | ✓\* | ✓\* | ✓   |

¹ UIR em `*.registro` = readback confirmatório. `✓*` = condicional (se não existir no código, usar `—`, não `❌`).

---

## 8. Matriz Analítica (capability_id)

> **Fonte de derivação** para `TECH_DEBT (OPEN Catalog)` e `ROADMAP`.
> Cada `capability_id` do catálogo aparece **exatamente 1 vez**.

| `capability_id`                     | DB  | SRV | OFF | UIW | UIR | E2E | EIDs                                                 |
| ----------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------- |
| `sanitario.registro` | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | `[E.san.reg.DB]` `[E.san.reg.SRV]` `[E.san.reg.OFF]` `[E.san.reg.UIW]` `[E.san.reg.UIR]` |
| `sanitario.historico` | — | ✅ | ✅ | — | ✅ | ✅ | `[E.san.his.SRV]` `[E.san.his.OFF]` `[E.san.his.UIR]` |
| `sanitario.agenda_link` | ✅ | ✅ | — | — | — | ✅ | `[E.san.agl.DB]` `[E.san.agl.SRV]` `[E.san.agl.E2E]` |
| `pesagem.registro` | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | `[E.pes.reg.DB]` `[E.pes.reg.SRV]` `[E.pes.reg.OFF]` `[E.pes.reg.UIW]` `[E.pes.reg.UIR]` |
| `pesagem.historico` | — | ✅ | ✅ | — | ⚠️ | ✅ | `[E.pes.his.SRV]` `[E.pes.his.OFF]` `[E.pes.his.UIR]` |
| `nutricao.registro` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.nut.reg.DB]` `[E.nut.reg.SRV]` `[E.nut.reg.OFF]` `[E.nut.reg.UIW]` `[E.nut.reg.UIR]` |
| `nutricao.historico` | — | ✅ | ✅ | — | ✅ | ✅ | `[E.nut.his.SRV]` `[E.nut.his.OFF]` `[E.nut.his.UIR]` |
| `movimentacao.registro` | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.mov.reg.DB]` `[E.mov.reg.SRV]` `[E.mov.reg.OFF]` `[E.mov.reg.UIW]` `[E.mov.reg.UIR]` |
| `movimentacao.historico` | — | ✅ | ✅ | — | ✅ | ✅ | `[E.mov.his.SRV]` `[E.mov.his.OFF]` `[E.mov.his.UIR]` |
| `movimentacao.anti_teleport_client` | — | — | — | ❌ | — | ⚠️ | `[E.mov.atc.UIW]` `[E.mov.atc.E2E]` |
| `reproducao.registro` | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.rep.reg.DB]` `[E.rep.reg.SRV]` `[E.rep.reg.OFF]` `[E.rep.reg.UIW]` `[E.rep.reg.UIR]` |
| `reproducao.historico` | — | ✅ | ✅ | — | ✅ | ✅ | `[E.rep.his.SRV]` `[E.rep.his.OFF]` `[E.rep.his.UIR]` |
| `reproducao.episode_linking` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.rep.epl.DB]` `[E.rep.epl.SRV]` `[E.rep.epl.OFF]` `[E.rep.epl.UIW]` `[E.rep.epl.UIR]` |
| `financeiro.registro` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.fin.reg.DB]` `[E.fin.reg.SRV]` `[E.fin.reg.OFF]` `[E.fin.reg.UIW]` `[E.fin.reg.UIR]` |
| `financeiro.historico` | — | ✅ | ✅ | — | ✅ | ✅ | `[E.fin.his.SRV]` `[E.fin.his.OFF]` `[E.fin.his.UIR]` |
| `agenda.gerar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `[E.age.ger.DB]` `[E.age.ger.SRV]` `[E.age.ger.OFF]` `[E.age.ger.UIW]` `[E.age.ger.UIR]` |
| `agenda.concluir` | ✅ | ✅ | ✅ | ✅ | — | ✅ | `[E.age.con.DB]` `[E.age.con.SRV]` `[E.age.con.OFF]` `[E.age.con.UIW]` |
| `agenda.dedup` | ✅ | ✅ | — | — | — | ✅ | `[E.age.ded.DB]` `[E.age.ded.SRV]` `[E.age.ded.E2E]` |
| `agenda.recalculo` | ✅ | ✅ | — | — | — | ✅ | `[E.age.rec.DB]` `[E.age.rec.SRV]` `[E.age.rec.E2E]` |
### Evidence Index

| EID               | Evidência (PM)                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[E.san.reg.DB]`  | PM: `supabase/migrations/0001_init.sql:~L541` — CREATE TABLE eventos_sanitario                                                                                         |
| `[E.san.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L162` — TABLES_WITH_FAZENDA inclui 'eventos_sanitario'                                                                     |
| `[E.san.reg.OFF]` | PM: `src/lib/offline/db.ts:L38` — event_eventos_sanitario store                                                                                                        |
| `[E.san.reg.UIW]` | PM: `src/pages/Registrar.tsx:L932+` — tipoManejo==='sanitario'; ⚠️ TD-011 produto TEXT livre                                                                           |
| `[E.san.reg.UIR]` | PM: `src/pages/Eventos.tsx:L140` — db.event_eventos_sanitario query                                                                                                    |
| `[E.san.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L162` — eventos_sanitario na lista TABLES_WITH_FAZENDA                                                                     |
| `[E.san.his.OFF]` | PM: `src/lib/offline/db.ts:L38` — event_eventos_sanitario (leitura offline)                                                                                            |
| `[E.san.his.UIR]` | PM: `src/pages/Eventos.tsx:L140,L171` — lista + detalhe eventos sanitário                                                                                              |
| `[E.san.agl.DB]`  | PM: `supabase/migrations/0028_sanitario_agenda_engine.sql:L115` — sanitario_recompute_agenda_core                                                                      |
| `[E.san.agl.SRV]` | PM: `supabase/migrations/0028_sanitario_agenda_engine.sql:L471-501` — recompute functions                                                                              |
| `[E.san.agl.E2E]` | PM: Fluxo 4 (Dedup Agenda) — ✅ PASS                                                                                                                                   |
| `[E.pes.reg.DB]`  | PM: `supabase/migrations/0001_init.sql:~L580` — CREATE TABLE eventos_pesagem                                                                                           |
| `[E.pes.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L163` — TABLES_WITH_FAZENDA inclui 'eventos_pesagem'                                                                       |
| `[E.pes.reg.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_pesagem store                                                                                                          |
| `[E.pes.reg.UIW]` | PM: `src/pages/Registrar.tsx:L1006+` — tipoManejo==='pesagem'; ⚠️ TD-014 peso≤0 aceito                                                                                 |
| `[E.pes.reg.UIR]` | PM: `src/pages/Eventos.tsx:L141` — db.event_eventos_pesagem query                                                                                                      |
| `[E.pes.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L163` — eventos_pesagem na lista TABLES_WITH_FAZENDA                                                                       |
| `[E.pes.his.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_pesagem (leitura offline)                                                                                              |
| `[E.pes.his.UIR]` | PM: `src/pages/Dashboard.tsx:L92-104` — GMD calc; ⚠️ TD-015 in-memory                                                                                                  |
| `[E.nut.reg.DB]`  | PM: `supabase/migrations/0001_init.sql:L632` — CREATE TABLE eventos_nutricao                                                                                           |
| `[E.nut.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L163` — TABLES_WITH_FAZENDA inclui 'eventos_nutricao'                                                                      |
| `[E.nut.reg.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_nutricao store                                                                                                         |
| `[E.nut.reg.UIW]` | PM: `src/pages/Registrar.tsx:L674-684,L1113-1143` — form inline                                                                                                        |
| `[E.nut.reg.UIR]` | PM: `src/pages/Eventos.tsx:L142` — db.event_eventos_nutricao query                                                                                                     |
| `[E.nut.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L163` — eventos_nutricao na lista TABLES_WITH_FAZENDA                                                                      |
| `[E.nut.his.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_nutricao (leitura offline)                                                                                             |
| `[E.nut.his.UIR]` | PM: `src/pages/Eventos.tsx:L142` — histórico nutrição                                                                                                                  |
| `[E.mov.reg.DB]`  | PM: `supabase/migrations/0001_init.sql:~L650` — eventos_movimentacao; ⚠️ TD-019 FKs faltantes                                                                          |
| `[E.mov.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L164` + `rules.ts:L149` — anti-teleport server                                                                             |
| `[E.mov.reg.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_movimentacao store                                                                                                     |
| `[E.mov.reg.UIW]` | PM: `src/pages/Registrar.tsx:L1066+` — tipoManejo==='movimentacao'                                                                                                     |
| `[E.mov.reg.UIR]` | PM: `src/pages/Eventos.tsx:L143` — db.event_eventos_movimentacao query                                                                                                 |
| `[E.mov.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L164` — eventos_movimentacao na lista TABLES_WITH_FAZENDA                                                                  |
| `[E.mov.his.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_movimentacao (leitura offline)                                                                                         |
| `[E.mov.his.UIR]` | PM: `src/pages/Eventos.tsx:L143` — histórico movimentação                                                                                                              |
| `[E.mov.atc.UIW]` | ❌ PM: `src/pages/Registrar.tsx:L1066+` — NÃO desabilita origem==destino. P: `rg -n "from_lote_id.*disabled\|toLote.*disabled" src/pages/Registrar.tsx` → 0 resultados |
| `[E.mov.atc.E2E]` | ⚠️ PM: `supabase/functions/sync-batch/rules.ts:L149-249` — `prevalidateAntiTeleport` rejeita origem==destino; UI não bloqueia (ver `[E.mov.atc.UIW]`). Resultado: fluxo existe, mas UX depende de rejeição server-side (PARTIAL). |
| `[E.rep.reg.DB]`  | PM: `supabase/migrations/0035_reproducao_hardening_v1.sql`; ⚠️ TD-020 FK macho_id ausente                                                                              |
| `[E.rep.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L191` — validação reprodução server-side                                                                                   |
| `[E.rep.reg.OFF]` | PM: `src/lib/offline/db.ts:L156` — event_eventos_reproducao store                                                                                                      |
| `[E.rep.reg.UIW]` | PM: `src/components/events/ReproductionForm.tsx` — form dedicado                                                                                                       |
| `[E.rep.reg.UIR]` | PM: `src/pages/ReproductionDashboard.tsx:L20` — dashboard                                                                                                              |
| `[E.rep.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L164` — eventos_reproducao na lista TABLES_WITH_FAZENDA                                                                    |
| `[E.rep.his.OFF]` | PM: `src/lib/offline/db.ts:L156` — event_eventos_reproducao (leitura offline)                                                                                          |
| `[E.rep.his.UIR]` | PM: `src/pages/ReproductionDashboard.tsx:L37-43` — query events + details                                                                                              |
| `[E.rep.epl.DB]`  | PM: `supabase/migrations/0035_reproducao_hardening_v1.sql:L43-121` — episode_evento_id column                                                                          |
| `[E.rep.epl.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L217-295` — episode linking validation                                                                                     |
| `[E.rep.epl.OFF]` | PM: `src/lib/reproduction/linking.ts:L52-77` — linking logic client-side                                                                                               |
| `[E.rep.epl.UIW]` | PM: `src/components/events/ReproductionForm.tsx` — episode selection UI                                                                                                |
| `[E.rep.epl.UIR]` | PM: `src/pages/ReproductionDashboard.tsx` — episode display                                                                                                            |
| `[E.fin.reg.DB]`  | PM: `supabase/migrations/0001_init.sql:~L700` — CREATE TABLE eventos_financeiro                                                                                        |
| `[E.fin.reg.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L164` — TABLES_WITH_FAZENDA inclui 'eventos_financeiro'                                                                    |
| `[E.fin.reg.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_financeiro store                                                                                                       |
| `[E.fin.reg.UIW]` | PM: `src/pages/Registrar.tsx:L1145+` — tipoManejo==='financeiro'                                                                                                       |
| `[E.fin.reg.UIR]` | PM: `src/pages/Financeiro.tsx:L68-77` — query eventosBase + detalhes                                                                                                   |
| `[E.fin.his.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L164` — eventos_financeiro na lista TABLES_WITH_FAZENDA                                                                    |
| `[E.fin.his.OFF]` | PM: `src/lib/offline/db.ts:L67` — event_eventos_financeiro (leitura offline)                                                                                           |
| `[E.fin.his.UIR]` | PM: `src/pages/Financeiro.tsx:L68-77` — lista lançamentos                                                                                                              |
| `[E.age.ger.DB]`  | PM: `supabase/migrations/0001_init.sql:~L476` — CREATE TABLE agenda_itens                                                                                              |
| `[E.age.ger.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L161` — TABLES_WITH_FAZENDA inclui 'agenda_itens'                                                                          |
| `[E.age.ger.OFF]` | PM: `src/lib/offline/db.ts` — state_agenda_itens store                                                                                                                 |
| `[E.age.ger.UIW]` | PM: `src/pages/Agenda.tsx` — CRUD agenda                                                                                                                               |
| `[E.age.ger.UIR]` | PM: `src/pages/Agenda.tsx:L418` — lista + filtros + dedup_key display                                                                                                  |
| `[E.age.con.DB]`  | PM: `supabase/migrations/0001_init.sql:~L476` — agenda_itens.status column                                                                                             |
| `[E.age.con.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L161` — agenda_itens processável via sync                                                                                  |
| `[E.age.con.OFF]` | PM: `src/lib/offline/db.ts` — state_agenda_itens (UPDATE via gesture)                                                                                                  |
| `[E.age.con.UIW]` | PM: `src/pages/Agenda.tsx` — botão concluir/cancelar                                                                                                                   |
| `[E.age.ded.DB]`  | PM: `supabase/migrations/0001_init.sql:L522-524` — UNIQUE(dedup_key)                                                                                                   |
| `[E.age.ded.SRV]` | PM: `supabase/functions/sync-batch/index.ts:L161` — INSERT agenda_itens com dedup server                                                                               |
| `[E.age.ded.E2E]` | PM: Fluxo 4 (Dedup Agenda) — ✅ PASS                                                                                                                                   |
| `[E.age.rec.DB]`  | PM: `supabase/migrations/0028_sanitario_agenda_engine.sql:L115` — sanitario_recompute_agenda_core                                                                      |
| `[E.age.rec.SRV]` | PM: `supabase/migrations/0028_sanitario_agenda_engine.sql:L509-538` — triggers server-side                                                                             |
| `[E.age.rec.E2E]` | PM: Engine automática funcional (trigger-driven)                                                                                                                       |

---

## 9. Gap Analysis

> `gap(capability_id) = (E2E ≠ PASS) OR (qualquer camada aplicável ∈ {⚠️, ❌})`

| `capability_id`                     | Layer(s) com gap | TD     | Tipo               |
| ----------------------------------- | ---------------- | ------ | ------------------ |
| `sanitario.registro`                | UIW ⚠️           | TD-011 | Produto TEXT livre |
| `pesagem.registro`                  | UIW ⚠️           | TD-014 | Peso validation    |
| `pesagem.historico`                 | UIR ⚠️           | TD-015 | GMD in-memory      |
| `movimentacao.registro`             | DB ⚠️            | TD-019 | FKs faltantes      |
| `movimentacao.anti_teleport_client` | UIW ❌, E2E ⚠️   | TD-008 | UI não bloqueia    |
| `reproducao.registro`               | DB ⚠️            | TD-020 | FK macho_id        |

**Gap count:** 6 / 19 capabilities

**Capability Score (Analítico):** 13/19 = **68.4%** (capabilities com todas as camadas aplicáveis PASS)

> [!NOTE]
> O score editorial "100% MVP (7/7 domínios)" mede cobertura por **domínio**. O Capability Score Analítico mede por **capability individual**, incluindo qualidade (validações, FKs, UX).

**Consistência (hard check):**

- `gap_set` = {sanitario.registro, pesagem.registro, pesagem.historico, movimentacao.registro, movimentacao.anti_teleport_client, reproducao.registro}
- `TECH_DEBT OPEN (Catalog) capability_set` = {TD-011→sanitario.registro, TD-014→pesagem.registro, TD-015→pesagem.historico, TD-019→movimentacao.registro, TD-008→movimentacao.anti_teleport_client, TD-020→reproducao.registro}
- **Match:** ✅

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Gaps detalhados (com `capability_id`)
- [**ROADMAP.md**](./ROADMAP.md) - Planejamento 6 semanas (derivado de TECH_DEBT OPEN)
- [**E2E_MVP.md**](./E2E_MVP.md) - Fluxos de validação