# Implementation Status Matrix

> **Status:** Derivado (Reconciliação)
> **Fonte de Verdade:** Código Fonte (DB migrations, Edge Functions, Client code)
> **As-of Commit:** `59b594d1f90e246196643dba3964232363551d`
> **Data:** 2026-02-16

Este documento é a **matriz única de verdade** sobre o que existe efetivamente implementado no RebanhoSync. Cada claim possui evidência verificável.

---

## Legenda

- ✅ **DONE** - Implementado e funcional
- ⚠️ **PARTIAL** - Implementado mas incompleto/limitado
- ❌ **MISSING** - Não implementado
- **DB** - Schema de banco de dados
- **Server** - Edge Functions / RPCs
- **Offline** - Stores Dexie + Sync
- **UI** - Interface do usuário
- **E2E** - Fluxo end-to-end funcional

---

## 1. Autenticação e Tenant Management

| Feature                           | DB  | Server | Offline | UI  | E2E | Evidência                                                                     | Notas                               |
| --------------------------------- | --- | ------ | ------- | --- | --- | ----------------------------------------------------------------------------- | ----------------------------------- |
| Login/SignUp                      | ✅  | ✅     | N/A     | ✅  | ✅  | `src/pages/Login.tsx`, `src/pages/SignUp.tsx`                                 | Auth via Supabase Auth              |
| User Profiles                     | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_profiles`, `src/pages/Perfil.tsx`        |                                     |
| User Settings (active_fazenda_id) | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_settings`, `src/hooks/useAuth.tsx`       | localStorage + remote sync          |
| Create Farm (RPC)                 | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0017_update_create_fazenda_rpc.sql`, `src/pages/CriarFazenda.tsx` |                                     |
| Multi-Farm Selection              | ✅  | ✅     | N/A     | ✅  | ✅  | `src/pages/SelectFazenda.tsx`                                                 |                                     |
| Farm Fields (extended)            | ✅  | ⚠️     | N/A     | ✅  | ✅  | `migrations/0016_add_farm_location_area_production.sql`                       | Server: RPC não valida todos campos |
| Avatars (Storage Bucket)          | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0014_create_avatars_bucket.sql`, `src/pages/Perfil.tsx`           |                                     |

---

## 2. RBAC (Role-Based Access Control)

| Feature                       | DB  | Server | Offline | UI  | E2E | Evidência                                                                    | Notas                                      |
| ----------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| User-Fazenda Membership       | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table user_fazendas`, `src/pages/AdminMembros.tsx` |                                            |
| Roles (owner/manager/cowboy)  | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:type user_role_enum`                               |                                            |
| RLS Policies (has_membership) | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0004_rls_hardening.sql`                                          |                                            |
| Admin RPCs                    | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0005_member_management_rpcs.sql`                                 | `admin_change_role`, `admin_remove_member` |
| Invite System                 | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0006_invite_system.sql`, `src/pages/AcceptInvite.tsx`            |                                            |
| DELETE Animal (owner-only)    | ⚠️  | ⚠️     | N/A     | ❌  | ❌  | RLS permite DELETE para cowboy                                               | **TD-003: RLS não restringe DELETE**       |
| Can Create Farm Gating        | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0010_add_can_create_farm.sql`                                    |                                            |

---

## 3. Offline-First Infrastructure

| Feature                       | DB  | Server | Offline | UI  | E2E | Evidência                                                           | Notas                             |
| ----------------------------- | --- | ------ | ------- | --- | --- | ------------------------------------------------------------------- | --------------------------------- |
| Dexie DB (state\_\*)          | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/db.ts:version(6)`                                  | 9 state tables                    |
| Dexie DB (event\_\*)          | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/db.ts:version(6)`                                  | 7 event tables                    |
| Queue Stores                  | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/db.ts:queue_gestures, queue_ops, queue_rejections` |                                   |
| Sync Worker                   | N/A | ✅     | ✅      | N/A | ✅  | `src/lib/offline/syncWorker.ts`, `supabase/functions/sync-batch`    |                                   |
| Pull Data (server→client)     | N/A | ✅     | ✅      | N/A | ✅  | `src/lib/offline/pull.ts`                                           | Supabase REST API                 |
| Create Gesture (client write) | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/ops.ts:createGesture`                              |                                   |
| Rollback Local (REJECTED)     | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/syncWorker.ts:rollbackGesture`                     | Uses before_snapshot              |
| Queue Cleanup (>7 days)       | N/A | N/A    | ❌      | ❌  | ❌  | Não existe                                                          | **TD-001: Sem rotina de limpeza** |
| Table Mapping                 | N/A | N/A    | ✅      | N/A | ✅  | `src/lib/offline/tableMap.ts`                                       |                                   |

---

## 4. Sync-Batch (Edge Function)

| Feature                       | DB  | Server | Offline | UI  | E2E | Evidência                                                        | Notas                   |
| ----------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------- | ----------------------- |
| JWT Auth Guard                | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/index.ts`                         |                         |
| Tenant Isolation (fazenda_id) | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/index.ts:enforcement`             | Server força fazenda_id |
| Idempotency (duplicate ops)   | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:normalizeDbError`        | 23505 → APPLIED         |
| Dedup Collision (agenda)      | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:L57-58`                  | APPLIED_ALTERED         |
| Anti-Teleport Validation      | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:prevalidateAntiTeleport` |                         |
| Constraint Reason Mapping     | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:CHECK_CONSTRAINT_REASON` | 4 reason codes          |
| FK Reason Mapping             | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:FK_CONSTRAINT_REASON`    | 1 reason code           |

---

## 5. Domínio: Entidades Operacionais

| Feature                | DB  | Server | Offline | UI  | E2E | Evidência                                                                                       | Notas                        |
| ---------------------- | --- | ------ | ------- | --- | --- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| Fazendas (CRUD)        | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0001_init.sql:table fazendas`, `src/pages/EditarFazenda.tsx`                        |                              |
| Pastos (CRUD)          | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table pastos`, `src/pages/Pastos.tsx`                                 | +tipo_pasto (0022)           |
| Lotes (CRUD)           | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table lotes`, `src/pages/Lotes.tsx`                                   |                              |
| Animais (CRUD)         | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table animais`, `src/pages/Animais.tsx`, `src/pages/AnimalNovo.tsx`   | +origem/raca (0021)          |
| Animais Sociedade      | ✅  | N/A    | ✅      | ❌  | ❌  | `migrations/0019_create_animais_sociedade.sql`, `src/lib/offline/db.ts:state_animais_sociedade` | **Sem UI**                   |
| Contrapartes (CRUD)    | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table contrapartes`, `src/pages/Contrapartes.tsx`                     |                              |
| Categorias Zootécnicas | ✅  | N/A    | ✅      | ⚠️  | ⚠️  | `migrations/0020_create_categorias_zootecnicas.sql`, `src/pages/Categorias.tsx`                 | UI básica, sem auto-classify |

---

## 6. Domínio: Agenda (Rail 1)

| Feature                  | DB  | Server | Offline | UI  | E2E | Evidência                                                                                        | Notas                     |
| ------------------------ | --- | ------ | ------- | --- | --- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| Agenda Itens (Table)     | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table agenda_itens`, `src/pages/Agenda.tsx`                            |                           |
| Dedup Key (unique index) | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0001_init.sql:idx_agenda_unique_dedup`, `sync-batch/rules.ts`                        |                           |
| Status Transitions       | ✅  | N/A    | ✅      | ✅  | ✅  | agendado → concluido/cancelado                                                                   |                           |
| Protocolo Sanitário      | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0027_seed_protocolos_sanitarios_mapa_sbmv.sql`, `src/pages/ProtocolosSanitarios.tsx` | MAPA + SBMV seeds         |
| Protocolo Itens          | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table protocolos_sanitarios_itens`                                     |                           |
| Agenda Auto-Generation   | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0028_sanitario_agenda_engine.sql:trigger on eventos_sanitario`                       |                           |
| Dedup Template           | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0028:compute_dedup_key`                                                              | protocolo_item_version_id |

---

## 7. Domínio: Eventos Sanitários

| Feature                      | DB  | Server | Offline | UI  | E2E | Evidência                                                                      | Notas                              |
| ---------------------------- | --- | ------ | ------- | --- | --- | ------------------------------------------------------------------------------ | ---------------------------------- |
| Eventos (Header)             | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos`                                       |                                    |
| Eventos Sanitário (Detail)   | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos_sanitario`                             |                                    |
| Tipos (enum)                 | ✅  | N/A    | N/A     | ✅  | ✅  | `migrations/0001_init.sql:type sanitario_tipo_enum`                            | vacinacao/vermifugacao/medicamento |
| Prevent Updates (trigger)    | ✅  | N/A    | N/A     | N/A | ✅  | `migrations/0001_init.sql:prevent_business_update`                             | Imutabilidade                      |
| Produto (text field)         | ✅  | N/A    | ✅      | ✅  | ✅  | eventos_sanitario.produto                                                      | **TD-011: Texto livre**            |
| Correção (corrige_evento_id) | ✅  | N/A    | ✅      | ❌  | ❌  | `migrations/0001_init.sql:eventos.corrige_evento_id`                           | **Sem UI de correção**             |
| UI de Registro               | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:SanitarioForm`                                        | Inline no Registrar                |
| Concluir Pendência (RPC)     | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0028:concluir_pendencia_sanitaria`, `src/lib/sanitario/service.ts` |                                    |
| Recompute Logic              | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0033_hotfix_sanitario_recompute_core_hard_replace.sql`             | D1 idade calc                      |
| Vaccine-Only Restrictions    | ✅  | ✅     | N/A     | N/A | ✅  | `migrations/0034_sanitario_vaccine_only_and_restrictions.sql`                  | brinco/castracao                   |

---

## 8. Domínio: Eventos Pesagem

| Feature                  | DB  | Server | Offline | UI  | E2E | Evidência                                        | Notas                           |
| ------------------------ | --- | ------ | ------- | --- | --- | ------------------------------------------------ | ------------------------------- |
| Eventos Pesagem (Detail) | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos_pesagem` |                                 |
| peso_kg (CHECK > 0)      | ✅  | ✅     | N/A     | ⚠️  | ⚠️  | `migrations/0001_init.sql:ck_evt_peso_pos`       | **TD-014: Frontend não valida** |
| UI de Registro           | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:PesagemForm`            | Inline no Registrar             |
| GMD Dashboard            | ❌  | ❌     | ❌      | ⚠️  | ⚠️  | `src/pages/Dashboard.tsx`                        | **TD-015: Cálculo in-memory**   |

---

## 9. Domínio: Eventos Nutrição

| Feature                   | DB  | Server | Offline | UI  | E2E | Evidência                                                                                         | Notas                  |
| ------------------------- | --- | ------ | ------- | --- | --- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| Eventos Nutrição (Detail) | ✅  | N/A    | ✅      | ❌  | ❌  | `migrations/0001_init.sql:table eventos_nutricao`, `src/lib/offline/db.ts:event_eventos_nutricao` | **TD-006: Sem UI**     |
| quantidade_kg (CHECK)     | ✅  | ✅     | N/A     | N/A | N/A | `migrations/0024_hardening_eventos_nutricao.sql:ck_evt_nutricao_quantidade_pos_nullable`          |                        |
| UI de Registro            | ❌  | N/A    | ⚠️      | ❌  | ❌  | Não existe em `src/pages/Registrar.tsx`                                                           | **TD-006**             |
| Event Builder Support     | ✅  | N/A    | ✅      | N/A | N/A | `src/lib/events/buildEventGesture.ts:nutricao` (L674-684)                                         | Logic exists but no UI |

---

## 10. Domínio: Eventos Movimentação

| Feature                       | DB  | Server | Offline | UI  | E2E | Evidência                                                                    | Notas                             |
| ----------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------------------- | --------------------------------- |
| Eventos Movimentação (Detail) | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos_movimentacao`                        |                                   |
| from_lote_id, to_lote_id      | ✅  | N/A    | ✅      | ✅  | ✅  | eventos_movimentacao columns                                                 |                                   |
| CHECK (from != to)            | ✅  | ✅     | ⚠️      | ⚠️  | ⚠️  | `migrations/0025_hardening_eventos_movimentacao.sql:ck_evt_mov_from_to_diff` | **TD-008: Frontend não bloqueia** |
| FK Constraints                | ❌  | N/A    | N/A     | N/A | N/A | Não existem                                                                  | **TD-019: FKs faltantes**         |
| UI de Registro                | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:MovimentacaoForm`                                   | Inline no Registrar               |
| Anti-Teleport (Server)        | N/A | ✅     | N/A     | N/A | ✅  | `supabase/functions/sync-batch/rules.ts:prevalidateAntiTeleport`             |                                   |

---

## 11. Domínio: Eventos Reprodução

| Feature                     | DB  | Server | Offline | UI  | E2E | Evidência                                                                                | Notas                              |
| --------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Eventos Reprodução (Detail) | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos_reproducao`                                      |                                    |
| Tipos (enum)                | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:type repro_tipo_enum`                                          | cobertura/IA/diagnostico/parto     |
| macho_id                    | ✅  | N/A    | ✅      | ✅  | ✅  | eventos_reproducao.macho_id                                                              |                                    |
| FK macho_id → animais       | ❌  | N/A    | N/A     | N/A | N/A | Não existe                                                                               | **TD-020: FK faltante**            |
| UI de Registro              | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:ReproductionForm`, `src/components/events/ReproductionForm.tsx` |                                    |
| Episode Linking             | ✅  | ✅     | ✅      | ✅  | ✅  | `src/lib/reproduction/linking.ts`, `migrations/0035_reproducao_hardening_v1.sql`         |                                    |
| Status Computation          | ✅  | ✅     | N/A     | ✅  | ✅  | `src/lib/reproduction/status.ts`, `migrations/0035:compute_status_repro`                 |                                    |
| Dashboard                   | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/ReproductionDashboard.tsx`                                                    |                                    |
| Timeline View               | ✅  | N/A    | N/A     | ⚠️  | ⚠️  | `migrations/0032_reproducao_timeline_view.sql`                                           | View exists, UI partial            |
| Reporting Views             | ✅  | N/A    | N/A     | ❌  | ❌  | `migrations/0036_reproducao_views_v1.sql`                                                | prenhez_stats_report, tx_ia_report |

---

## 12. Domínio: Eventos Financeiro

| Feature                     | DB  | Server | Offline | UI  | E2E | Evidência                                                                     | Notas                 |
| --------------------------- | --- | ------ | ------- | --- | --- | ----------------------------------------------------------------------------- | --------------------- |
| Eventos Financeiro (Detail) | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:table eventos_financeiro`                           |                       |
| Tipos (enum)                | ✅  | N/A    | ✅      | ✅  | ✅  | `migrations/0001_init.sql:type financeiro_tipo_enum`                          | compra/venda          |
| valor_total (CHECK > 0)     | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0023_hardening_eventos_financeiro.sql:ck_evt_fin_valor_total_pos` |                       |
| contraparte_id (FK)         | ✅  | ✅     | N/A     | ✅  | ✅  | `migrations/0026_fk_eventos_financeiro_contrapartes.sql`                      |                       |
| UI de Registro              | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:FinanceiroForm`                                      | Inline no Registrar   |
| Compra com Cadastro Animais | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:L586-618`                                            | Batch animal creation |
| Sociedade (entrada/saida)   | ✅  | N/A    | ✅      | ✅  | ✅  | `src/pages/Registrar.tsx:financeiroData.natureza`                             | Payload-based         |
| Venda (Animal State Update) | ✅  | N/A    | ✅      | ✅  | ✅  | `src/lib/events/buildEventGesture.ts:applyAnimalStateUpdate`                  | status→vendido        |
| Dashboard                   | ✅  | N/A    | N/A     | ✅  | ✅  | `src/pages/Financeiro.tsx`                                                    |                       |

---

## 13. UI: Rotas e Navegação

| Feature                    | DB  | Server | Offline | UI  | E2E | Evidência                                                        | Notas                |
| -------------------------- | --- | ------ | ------- | --- | --- | ---------------------------------------------------------------- | -------------------- |
| Routing (react-router)     | N/A | N/A    | N/A     | ✅  | ✅  | `src/App.tsx`                                                    |                      |
| Protected Routes           | N/A | N/A    | N/A     | ✅  | ✅  | `src/components/auth/ProtectedRoute.tsx`                         |                      |
| Top Bar (Farm Display)     | N/A | N/A    | N/A     | ✅  | ✅  | `src/components/layout/TopBar.tsx`                               |                      |
| Dashboard                  | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Dashboard.tsx`                                        |                      |
| Home                       | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Home.tsx`                                             |                      |
| Registrar (Multi-Domain)   | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Registrar.tsx`                                        |                      |
| Eventos (History)          | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Eventos.tsx`                                          |                      |
| Agenda                     | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Agenda.tsx`                                           |                      |
| Animais (List/Detail/Edit) | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Animais.tsx`, `AnimalDetalhe.tsx`, `AnimalEditar.tsx` |                      |
| Lotes/Pastos CRUD          | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Lotes.tsx`, `Pastos.tsx`                              |                      |
| Protocolos Sanitários      | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/ProtocolosSanitarios.tsx`                             |                      |
| Membros (RBAC)             | N/A | N/A    | N/A     | ✅  | ✅  | `src/pages/Membros.tsx`, `AdminMembros.tsx`                      |                      |
| Sync Debug                 | N/A | N/A    | N/A     | ⚠️  | ⚠️  | `src/pages/Reconciliacao.tsx`                                    | Não lista rejections |

---

## 14. Performance e Índices

| Feature                           | DB  | Server | Offline | UI  | E2E | Evidência                                             | Notas                        |
| --------------------------------- | --- | ------ | ------- | --- | --- | ----------------------------------------------------- | ---------------------------- |
| Índices (fazenda_id, occurred_at) | ⚠️  | N/A    | N/A     | N/A | N/A | `migrations/0018_add_rebanho_performance_indexes.sql` | **TD-004: Índices parciais** |
| Índice (animal_id, occurred_at)   | ⚠️  | N/A    | N/A     | N/A | N/A | `migrations/0018`                                     | Faltam índices compostos     |

---

## 15. Segurança

| Feature                 | DB  | Server | Offline | UI  | E2E | Evidência                                              | Notas               |
| ----------------------- | --- | ------ | ------- | --- | --- | ------------------------------------------------------ | ------------------- |
| RLS Enable (All Tables) | ✅  | N/A    | N/A     | N/A | ✅  | `migrations/0001_init.sql:alter table ... enable rls`  |                     |
| has_membership Helper   | ✅  | N/A    | N/A     | N/A | ✅  | `migrations/0004_rls_hardening.sql`                    | SECURITY DEFINER    |
| RLS Recursion Fix       | ✅  | N/A    | N/A     | N/A | ✅  | `migrations/0005b_fix_user_fazendas_rls_recursion.sql` |                     |
| Security Review         | ✅  | N/A    | N/A     | N/A | ✅  | `migrations/0037_security_hardening_review.sql`        | Audit + search_path |

---

## Resumo de Gaps (Cross-Reference com TECH_DEBT.md)

### P0 (Crítico)

1. **TD-001** - Queue Rejections: Sem limpeza automática
   - **Evidência**: Grep em `syncWorker.ts` não encontra `delete.*queue_rejections`
2. **TD-006** - UI de Nutrição: Tabela existe, Dexie existe, buildEventGesture existe, mas sem formulário em Registrar.tsx
   - **Evidência**: `grep NutricaoForm src/pages` → Nenhum resultado
3. **TD-007** - UI de Reprodução: **IMPLEMENTADO** ✅
   - **Evidência**: `src/components/events/ReproductionForm.tsx`, `src/pages/Registrar.tsx:L1461-1469`, `src/lib/reproduction/*`
   - **Status**: DONE (marcar no TECH_DEBT)
4. **TD-008** - Anti-Teleport Local: Server valida, mas UI não bloqueia origem == destino
   - **Evidência**: `Registrar.tsx:MovimentacaoForm` não desabilita opções

### P1 (Importante)

5. **TD-003** - Hard Delete por Cowboy: RLS atual não restringe DELETE
   - **Evidência**: Revisão de policies em `migrations/0004_rls_hardening.sql`
6. **TD-011** - Produto Sanitário: Campo `text` livre
   - **Evidência**: `migrations/0001_init.sql:eventos_sanitario.produto TEXT`
7. **TD-014** - Validação Frontend Pesagem: banco tem CHECK, frontend não valida
   - **Evidência**: `Registrar.tsx:PesagemForm` não valida > 0
8. **TD-019** - FKs Movimentação: from_lote_id/to_lote_id sem FK
   - **Evidência**: Grep em migrations não encontra FK para esses campos
9. **TD-020** - FK Macho: eventos_reproducao.macho_id sem FK
   - **Evidência**: Não existe constraint em migrations

### P2 (Melhoria)

10. **TD-004** - Índices: Parcialmente implementado
    - **Evidência**: `migrations/0018` cria alguns, mas faltam compostos otimizados
11. **TD-015** - GMD em Memória: Dashboard calcula client-side
    - **Evidência**: `src/pages/Dashboard.tsx` sem view materializada

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Lista consolidada de débitos técnicos
- [**ROADMAP.md**](./ROADMAP.md) - Planejamento de 6 semanas
- [**E2E_MVP.md**](./E2E_MVP.md) - Roteiro de testes End-to-End
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - Arquitetura sistêmica
- [**DB.md**](./DB.md) - Schema de banco de dados
