# Implementation Status Matrix (Baseline Unificado)

> **Status:** Derivado
> **Baseline:** `e62465e`
> **Última Atualização:** 2026-02-16
> **Critério RIGOROSO:** Implementado = (DB + Edge Rules + Dexie + Event Builder + UI Write + Sync passa)

Este documento é a **matriz única de verdade** sobre o que existe efetivamente implementado no RebanhoSync. **Critério mais rigoroso que v1**: não basta existir schema de DB, é preciso toda a cadeia funcional end-to-end.

**Fonte Completa da Audit:** `docs/review/AUDIT_CAPABILITY_MATRIX.md`

---

## Resumo Executivo (Audit Rigoroso)

###✅ Pronto para Piloto (6 domínios + infra)

1. **Sanitário** - ✅ COMPLETO (vaccines, agenda automática, RPC concluir_pendencia)
2. **Reprodução** - ✅ COMPLETO (linking, status, dashboard, views, component dedicado)
3. **Financeiro** - ✅ COMPLETO (compra/venda/sociedade, batch animal creation)
4. **Agenda (Rail 1)** - ✅ COMPLETO (CRUD, dedup, protocolos, auto-gen)
5. **Movimentação** - ⚠️ FUNCIONAL (gaps UI validation + FKs não-bloqueantes)
6. **Pesagem** - ⚠️ FUNCIONAL (gap validação frontend não-bloqueante)

**Offline Infra** - ⚠️ FUNCIONAL (queue cleanup missing, rollback OK)
**RBAC** - ⚠️ FUNCIONAL (DELETE sem restrição cowboy)

### ❌ Bloqueadores Reais

1. **Nutrição** - ❌ **ZERO UI** (Backend 100% pronto: DB, Dexie, Event Builder, mas sem formulário)
   - **Impacto**: Impossível registrar eventos de nutrição
   - **Evidência**: `grep "tipoManejo === \"nutricao\"" src/pages/Registrar.tsx` → 0 resultados
   - **Tech Debt**: TD-006 (P0)

### 📊 Capability Score (Rigoroso)

- **Domínios Completos (E2E)**: 4 de 7 (57%)
- **Domínios Funcionais**: 6 de 7 (86%)
- **Domínios Bloqueados**: 1 de 7 (14%) 👈 Nutrição

---

## Legenda

- ✅ **DONE** - Implementado e funcional (cadeia completa verificada)
- ⚠️ **PARTIAL** - Implementado mas com gaps (funciona mas degradado)
- ❌ **MISSING** - Componente crítico ausente (impossível usar)
- **DB** - Schema + migrations aplicadas
- **Server** - Edge Functions / RPCs / RLS / Triggers
- **Offline** - Dexie stores + Sync Worker + Rollback
- **UI** - Interface (Write + Read) verificada em código
- **E2E** - Fluxo end-to-end funcional (cadeia completa)

---

## Matriz por Domínio (Capability Matrix)

| Domínio             | DB  | Server | Offline | Event Builder | UI Write | UI Read | E2E | Status      | Gap Crítico                                                       |
| ------------------- | --- | ------ | ------- | ------------- | -------- | ------- | --- | ----------- | ----------------------------------------------------------------- |
| **Sanitário**       | ✅  | ✅     | ✅      | ✅            | ✅       | ✅      | ✅  | **DONE**    | N/A                                                               |
| **Pesagem**         | ✅  | ✅     | ✅      | ✅            | ✅       | ✅      | ⚠️  | **PARTIAL** | TD-014: UI não valida peso > 0                                    |
| **Movimentação**    | ✅  | ✅     | ✅      | ✅            | ✅       | ✅      | ⚠️  | **PARTIAL** | TD-008: UI não bloqueia origem==destino<br/>TD-019: FKs faltantes |
| **Nutrição**        | ✅  | ✅     | ✅      | ✅            | ❌       | ❌      | ❌  | **MISSING** | 👈 **TD-006: UI Write inexistente**                               |
| **Reprodução**      | ✅  | ✅     | ✅      | ✅            | ✅       | ✅      | ✅  | **DONE**    | TD-020: FK macho_id (não-bloqueante)                              |
| **Financeiro**      | ✅  | ✅     | ✅      | ✅            | ✅       | ✅      | ✅  | **DONE**    | N/A                                                               |
| **Agenda (Rail 1)** | ✅  | ✅     | ✅      | N/A           | ✅       | ✅      | ✅  | **DONE**    | N/A (estado mutável, não evento)                                  |

**Evidência Detalhada:** Ver `docs/review/AUDIT_CAPABILITY_MATRIX.md`

---

## Detalhamento de Evidências (Por Domínio com Gaps)

### ❌ Nutrição (MISSING - Bloqueador)

**O que existe:**

- ✅ DB: `migrations/0001_init.sql:L632` - `create table eventos_nutricao`
- ✅ CHECK: `migrations/0024_hardening_eventos_nutricao.sql:ck_evt_nutricao_quantidade_pos_nullable`
- ✅ Dexie: `src/lib/offline/db.ts:event_eventos_nutricao`
- ✅ Event Builder: `src/lib/events/buildEventGesture.ts:L87-97` (nutricao branch)

**O que NÃO existe (BLOQUEADOR):**

- ❌ UI Write: Nenhum bloco `tipoManejo === "nutricao"` em `Registrar.tsx`
- ❌ Component: `grep NutricaoForm src/components` → 0 resultados
- ❌ UI Read: Sem visualização específica (Eventos.tsx genérico mostraria se existissem registros)

**Conclusão**: Backend 100% pronto, ZERO UI. Impossível usar o domínio.

---

### ⚠️ Movimentação (PARTIAL - Funcional)

**Gaps Não-Bloqueantes:**

1. **TD-008** - Frontend não valida origem != destino
   - **Evidência**: `src/pages/Registrar.tsx:MovimentacaoForm` não desabilita lote origem no Select destino
   - **Impacto**: UX ruim (servidor rejeita, mas permite seleção)

2. **TD-019** - FKs faltantes (from_lote_id, to_lote_id)
   - **Evidência**: Não existe constraint FK em migrations
   - **Impacto**: Risco integridade (IDs inválidos não bloqueados)

**O que funciona:**

- ✅ Anti-Teleport Server: `supabase/functions/sync-batch/rules.ts:prevalidateAntiTeleport` (L149-249)
- ✅ CHECK Constraint: `migrations/0025:ck_evt_mov_from_to_diff`
- ✅ UI Write: `Registrar.tsx:MovimentacaoForm` (inline)
- ✅ E2E: Funcional end-to-end (com UX degradado)

---

### ⚠️ Pesagem (PARTIAL - Funcional)

**Gap Não-Bloqueante:**

- **TD-014** - Frontend não valida peso > 0
  - **Evidência**: `src/pages/Registrar.tsx:PesagemForm` não valida antes de submit
  - **Impacto**: UX ruim (servidor rejeita com CHECK constraint)

**O que funciona:**

- ✅ DB CHECK: `migrations/0001_init.sql:ck_evt_peso_pos`
- ✅ UI Write: `Registrar.tsx:PesagemForm`
- ✅ UI Read: `AnimalDetalhe.tsx` (histórico peso), `Eventos.tsx`
- ✅ E2E: Funcional (servidor bloqueia peso inválido)

---

## Infraestrutura (Offline-First)

| Componente                     | Status | Evidência                                       | Gap                                  |
| ------------------------------ | ------ | ----------------------------------------------- | ------------------------------------ |
| Dexie DB (state*\* + event*\*) | ✅     | `src/lib/offline/db.ts:version(6)` - 16 tabelas | N/A                                  |
| Sync Worker                    | ✅     | `src/lib/offline/syncWorker.ts:syncGesture`     | TD-001: Sem cleanup queue_rejections |
| Pull Data                      | ✅     | `src/lib/offline/pull.ts:pullDataForFarm`       | N/A                                  |
| Create Gesture                 | ✅     | `src/lib/offline/ops.ts:createGesture`          | N/A                                  |
| Rollback Local                 | ✅     | `src/lib/offline/syncWorker.ts:rollbackGesture` | N/A (funcional com before_snapshot)  |
| Table Mapping                  | ✅     | `src/lib/offline/tableMap.ts`                   | N/A                                  |

**Gap Crítico**: TD-001 (Queue Cleanup) - Sem rotina automática de limpeza

---

## RBAC & Segurança

| Componente            | Status | Gap                                      |
| --------------------- | ------ | ---------------------------------------- |
| RLS Policies          | ✅     | TD-003: DELETE sem restrição para cowboy |
| Admin RPCs            | ✅     | N/A                                      |
| Invite System         | ✅     | N/A                                      |
| JWT Auth (sync-batch) | ✅     | N/A                                      |
| Tenant Isolation      | ✅     | N/A                                      |

**Gap Não-Bloqueante**: TD-003 (RLS DELETE) - Cowboy pode deletar animais

---

## Gaps Reais que Impedem E2E (Priorizado)

| ID         | Gap                            | Impacto                              | Bloqueia E2E? | Milestone |
| ---------- | ------------------------------ | ------------------------------------ | ------------- | --------- |
| **TD-006** | UI Nutrição inexistente        | ❌ **SIM** - Impossível usar domínio | ✅ SIM        | M0 (P0)   |
| TD-001     | Queue rejections sem cleanup   | ⚠️ Risco crescimento storage         | ❌ Não        | M0 (P0)   |
| TD-008     | Anti-Teleport sem validação UI | ⚠️ UX degradada (servidor rejeita)   | ❌ Não        | M0 (P0)   |
| TD-014     | Pesagem sem validação UI       | ⚠️ UX degradada                      | ❌ Não        | M1 (P1)   |
| TD-003     | DELETE sem restrição RLS       | ⚠️ Risco perda dados                 | ❌ Não        | M1 (P1)   |
| TD-019     | FKs movimentação faltantes     | ⚠️ Risco integridade                 | ❌ Não        | M1 (P1)   |
| TD-020     | FK macho_id faltante           | ⚠️ Risco integridade                 | ❌ Não        | M1 (P1)   |
| TD-004     | Índices parciais               | 🟡 Performance                       | ❌ Não        | M2 (P2)   |
| TD-015     | GMD em memória                 | 🟡 Performance                       | ❌ Não        | M2 (P2)   |

**Único Bloqueador Real**: TD-006 (Nutrição UI)

---

## Tabelas Detalhadas (Consolidado de v1)

<details>
<summary>📋 Clique para expandir tabelas completas por seção</summary>

### 1. Autenticação e Tenant Management

| Feature                           | DB  | Server | Offline | UI  | E2E | Evidência                                                                     | Notas                               |
| --------------------------------- | --- | ------ | ------- | --- | --- | ----------------------------------------------------------------------------- | ----------------------------------- |
| Login/SignUp                      | ✅  | ✅     | N/A     | ✅  | ✅  | `src/pages/Login.tsx`, `src/pages/SignUp.tsx`                                 | Auth via Supabase Auth              |
| User Profiles                     | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_profiles`, `src/pages/Perfil.tsx`        |                                     |
| User Settings (active_fazenda_id) | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_settings`, `src/hooks/useAuth.tsx`       | localStorage + remote sync          |
| Create Farm (RPC)                 | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0017_update_create_fazenda_rpc.sql`, `src/pages/CriarFazenda.tsx` |                                     |
| Multi-Farm Selection              | ✅  | ✅     | N/A     | ✅  | ✅  | `src/pages/SelectFazenda.tsx`                                                 |                                     |
| Farm Fields (extended)            | ✅  | ⚠️     | N/A     | ✅  | ✅  | `migrations/0016_add_farm_location_area_production.sql`                       | Server: RPC não valida todos campos |
| Avatars (Storage Bucket)          | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0014_create_avatars_bucket.sql`, `src/pages/Perfil.tsx`           |                                     |

### 2. RBAC

| Feature                       | DB  | Server | Offline | UI  | E2E | Evidência                                                                    | Notas                                      |
| ----------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| User-Fazenda Membership       | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_fazendas`, `src/pages/AdminMembros.tsx` |                                            |
| Roles (owner/manager/cowboy)  | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:type user_role_enum`                               |                                            |
| RLS Policies (has_membership) | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0004_rls_hardening.sql`                                          |                                            |
| Admin RPCs                    | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0005_member_management_rpcs.sql`                                 | `admin_change_role`, `admin_remove_member` |
| Invite System                 | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0006_invite_system.sql`, `src/pages/AcceptInvite.tsx`            |                                            |
| DELETE Animal (owner-only)    | ⚠️  | ⚠️     | N/A     | ❌  | ❌  | RLS permite DELETE para cowboy                                               | **TD-003: RLS não restringe DELETE**       |
| Can Create Farm Gating        | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0010_add_can_create_farm.sql`                                    |                                            |

### 3. Entidades Operacionais

| Feature             | DB  | Server | Offline | UI  | E2E | Evidência                                                                   | Notas               |
| ------------------- | --- | ------ | ------- | --- | --- | --------------------------------------------------------------------------- | ------------------- |
| Fazendas (CRUD)     | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table fazendas`, `src/pages/EditarFazenda.tsx`    |                     |
| Pastos (CRUD)       | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table pastos`, `src/pages/Pastos.tsx`             | +tipo_pasto (0022)  |
| Lotes (CRUD)        | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table lotes`, `src/pages/Lotes.tsx`               |                     |
| Animais (CRUD)      | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table animais`, `src/pages/AnimalNovo.tsx`        | +origem/raca (0021) |
| Contrapartes (CRUD) | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table contrapartes`, `src/pages/Contrapartes.tsx` |                     |

### 4-12. Domínios de Eventos (Ver Capability Matrix acima)

</details>

---

## Veja Também

- [**AUDIT_CAPABILITY_MATRIX.md**](./review/AUDIT_CAPABILITY_MATRIX.md) - Auditoria completa rigorosa
- [**TECH_DEBT.md**](./TECH_DEBT.md) - Lista consolidada de débitos OPEN
- [**ROADMAP.md**](./ROADMAP.md) - Planejamento 6 semanas (derivado de TECH_DEBT)
- [**E2E_MVP.md**](./E2E_MVP.md) - Roteiro de testes End-to-End
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - Arquitetura sistêmica
- [**DB.md**](./DB.md) - Schema de banco de dados
