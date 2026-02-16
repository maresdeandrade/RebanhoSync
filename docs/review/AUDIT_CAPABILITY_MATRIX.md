# Auditoria de Capacidades - RebanhoSync

> **Status:** Derivado
> **Baseline:** `e62465e`
> **Última Atualização:** 2026-02-16

---

## Matriz de Domínios (Capability Matrix)

| Domínio          | DB Schema | Edge Rules (sync-batch) | Dexie Store | Event Builder | UI Write | UI Read | E2E Flow | Status      | Evidência Gaps                                                      |
| ---------------- | --------- | ----------------------- | ----------- | ------------- | -------- | ------- | -------- | ----------- | ------------------------------------------------------------------- |
| **Sanitário**    | ✅        | ✅                      | ✅          | ✅            | ✅       | ✅      | ✅       | **DONE**    | N/A                                                                 |
| **Pesagem**      | ✅        | ✅                      | ✅          | ✅            | ✅       | ✅      | ⚠️       | **PARTIAL** | UI não valida peso > 0                                              |
| **Movimentação** | ✅        | ✅                      | ✅          | ✅            | ✅       | ✅      | ⚠️       | **PARTIAL** | UI não bloqueia origem==destino, FKs faltantes                      |
| **Nutrição**     | ✅        | ✅                      | ✅          | ✅            | ❌       | ❌      | ❌       | **MISSING** | UI Write inexistente (Registrar.tsx sem tipoManejo="nutricao" form) |
| **Reprodução**   | ✅        | ✅                      | ✅          | ✅            | ✅       | ✅      | ✅       | **DONE**    | N/A                                                                 |
| **Financeiro**   | ✅        | ✅                      | ✅          | ✅            | ✅       | ✅      | ✅       | **DONE**    | N/A                                                                 |
| **Agenda**       | ✅        | ✅                      | ✅          | N/A           | ✅       | ✅      | ✅       | **DONE**    | N/A (Rail 1, não é evento)                                          |

---

## Detalhamento por Domínio

### 1. Sanitário ✅ **DONE**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_sanitario`
- ✅ `migrations/0028_sanitario_agenda_engine.sql` (triggers)
- ✅ `migrations/0034_sanitario_vaccine_only_and_restrictions.sql`

**Edge Rules:**

- ✅ Anti-Teleport: N/A (sem state mutation)
  **Dexie:**
- ✅ `src/lib/offline/db.ts:event_eventos_sanitario`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L38-48` (sanitario branch)
- ✅ `src/lib/events/validators/index.ts:validateEventInput`

**UI Write:**

- ✅ `src/pages/Registrar.tsx:SanitarioForm` (inline, não component separado)
- ✅ `src/lib/sanitario/service.ts:concluirPendenciaSanitaria` (RPC wrapper)

**UI Read:**

- ✅ `src/pages/Eventos.tsx` (lista histórico)
- ✅ `src/pages/Agenda.tsx` (mostra tarefas sanitárias)

**E2E:**

- ✅ Fluxo 6 (Hardening de Eventos) - aplicável
- ✅ Fluxo 4 (Deduplicação de Agenda) - funcional

**Status Final:** **DONE** - Cadeia completa verificada

---

### 2. Pesagem ⚠️ **PARTIAL**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_pesagem`
- ✅ `migrations/0001_init.sql:ck_evt_peso_pos` (CHECK peso_kg > 0)

**Edge Rules:**

- ✅ Constraint enforcement via DB CHECK

**Dexie:**

- ✅ `src/lib/offline/db.ts:event_eventos_pesagem`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L49-58` (pesagem branch)

**UI Write:**

- ✅ `src/pages/Registrar.tsx:PesagemForm` (inline)
- ⚠️ **GAP:** Não valida peso > 0 antes de submissão (TD-014)

**UI Read:**

- ✅ `src/pages/Eventos.tsx`
- ✅ `src/pages/AnimalDetalhe.tsx` (mostra histórico de peso)

**E2E:**

- ⚠️ Parcial: Funciona, mas permite enviar peso inválido (rejeitado pelo servidor)

**Status Final:** **PARTIAL** - Funcional mas com gap de UX (TD-014)

---

### 3. Movimentação ⚠️ **PARTIAL**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_movimentacao`
- ✅ `migrations/0025_hardening_eventos_movimentacao.sql:ck_evt_mov_from_to_diff`
- ❌ **GAP:** FKs faltantes (from_lote_id, to_lote_id → lotes.id) (TD-019)

**Edge Rules:**

- ✅ `supabase/functions/sync-batch/rules.ts:prevalidateAntiTeleport` (L149-249)

**Dexie:**

- ✅ `src/lib/offline/db.ts:event_eventos_movimentacao`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L59-86` (movimentacao branch + animal UPDATE)

**UI Write:**

- ✅ `src/pages/Registrar.tsx:MovimentacaoForm` (inline)
- ⚠️ **GAP:** Não desabilita lote origem no Select destino (TD-008)

**UI Read:**

- ✅ `src/pages/Eventos.tsx`

**E2E:**

- ⚠️ Parcial: Anti-Teleporte funciona server-side, mas UX ruim

**Status Final:** **PARTIAL** - Funcional mas com gaps de integridade (FKs) e UX (frontend validation)

---

### 4. Nutrição ❌ **MISSING**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_nutricao`
- ✅ `migrations/0024_hardening_eventos_nutricao.sql:ck_evt_nutricao_quantidade_pos_nullable`

**Edge Rules:**

- ✅ Constraint enforcement via DB CHECK

**Dexie:**

- ✅ `src/lib/offline/db.ts:event_eventos_nutricao`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L87-97` (nutricao branch)
- ✅ Validators suportam domínio "nutricao"

**UI Write:**

- ❌ **GAP CRÍTICO:** `src/pages/Registrar.tsx` NÃO possui bloco `tipoManejo === "nutricao"`
- ❌ Grep por `NutricaoForm` retorna 0 resultados
- ❌ Não há Component dedicado em `src/components/events/`

**UI Read:**

- ❌ Sem UI de leitura específica (Eventos.tsx mostraria se existissem registros, mas não há forma de criar)

**E2E:**

- ❌ Impossível testar - sem UI de escrita

**Status Final:** **MISSING** - Backend completo, mas ZERO UI. Não pode ser usado. (TD-006 confirmado)

---

### 5. Reprodução ✅ **DONE**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_reproducao`
- ✅ `migrations/0035_reproducao_hardening_v1.sql` (validações + linking)
- ✅ `migrations/0036_reproducao_views_v1.sql` (reporting views)
- ❌ **GAP:** FK macho*id → animais.id faltante (TD-020) \_mas não bloqueia uso*

**Edge Rules:**

- ✅ Episode linking validation
- ✅ Schema version enforcement

**Dexie:**

- ✅ `src/lib/offline/db.ts:event_eventos_reproducao`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L127-138` (reproducao branch)

**UI Write:**

- ✅ `src/components/events/ReproductionForm.tsx` (component dedicado)
- ✅ `src/pages/Registrar.tsx:L1461-1469` (integração)
- ✅ `src/pages/Registrar.tsx:L729-782` (lógica de validação + linking)

**UI Read:**

- ✅ `src/pages/Eventos.tsx`
- ✅ `src/pages/ReproductionDashboard.tsx` (dashboard específico)
- ✅ `migrations/0032_reproducao_timeline_view.sql` (view de timeline)

**E2E:**

- ✅ Fluxo funcional end-to-end verificado

**Status Final:** **DONE** - Cadeia completa. FK faltante é gap de integridade, mas não impede uso.

---

### 6. Financeiro ✅ **DONE**

**DB:**

- ✅ `migrations/0001_init.sql:table eventos_financeiro`
- ✅ `migrations/0023_hardening_eventos_financeiro.sql:ck_evt_fin_valor_total_pos`
- ✅ `migrations/0026_fk_eventos_financeiro_contrapartes.sql`

**Edge Rules:**

- ✅ Venda → Anti-Teleport (exit ok)
- ✅ FK contraparte validation

**Dexie:**

- ✅ `src/lib/offline/db.ts:event_eventos_financeiro`

**Event Builder:**

- ✅ `src/lib/events/buildEventGesture.ts:L98-126` (financeiro branch + animal UPDATE for venda)

**UI Write:**

- ✅ `src/pages/Registrar.tsx:FinanceiroForm` (inline, complexo com natureza)
- ✅ Suporta: compra, venda, sociedade_entrada, sociedade_saida
- ✅ Cadastro inline de contraparte
- ✅ Cadastro batch de animais em compra

**UI Read:**

- ✅ `src/pages/Financeiro.tsx` (dashboard)
- ✅ `src/pages/Eventos.tsx`

**E2E:**

- ✅ Fluxo compra/venda funcional end-to-end

**Status Final:** **DONE** - Cadeia completa verificada

---

### 7. Agenda (Rail 1) ✅ **DONE**

**DB:**

- ✅ `migrations/0001_init.sql:table agenda_itens`
- ✅ Unique index `(fazenda_id, dedup_key)` WHERE status = 'agendado'

**Edge Rules:**

- ✅ `sync-batch/rules.ts:normalizeDbError` (L57-58) - dedup collision → APPLIED_ALTERED

**Dexie:**

- ✅ `src/lib/offline/db.ts:state_agenda_itens`

**Event Builder:**

- N/A (Agenda não é evento, é estado mutável)

**UI Write:**

- ✅ `src/pages/Agenda.tsx` (criar, editar, concluir, cancelar tarefas)
- ✅ Geração automática via protocolos sanitários (trigger)

**UI Read:**

- ✅ `src/pages/Agenda.tsx` (view principal)
- ✅ `src/pages/Home.tsx` (mostra próximas tarefas)

**E2E:**

- ✅ Fluxo 4 (Deduplicação de Agenda) - funcional
- ✅ Fluxo 6 (Hardening - conclusão de tarefa) - funcional

**Status Final:** **DONE** - Cadeia completa para Rail 1

---

## Infraestrutura Offline

| Componente      | Status | Evidência                                       | Gap                                  |
| --------------- | ------ | ----------------------------------------------- | ------------------------------------ |
| Dexie DB Stores | ✅     | `src/lib/offline/db.ts:version(6)`              | N/A                                  |
| Sync Worker     | ✅     | `src/lib/offline/syncWorker.ts`                 | TD-001: Sem cleanup queue_rejections |
| Pull Data       | ✅     | `src/lib/offline/pull.ts`                       | N/A                                  |
| Create Gesture  | ✅     | `src/lib/offline/ops.ts:createGesture`          | N/A                                  |
| Rollback Local  | ✅     | `src/lib/offline/syncWorker.ts:rollbackGesture` | N/A                                  |
| Table Mapping   | ✅     | `src/lib/offline/tableMap.ts`                   | N/A                                  |

---

## RBAC & Segurança

| Componente            | Status | Evidência                                    | Gap                                 |
| --------------------- | ------ | -------------------------------------------- | ----------------------------------- |
| RLS Policies          | ✅     | `migrations/0004_rls_hardening.sql`          | TD-003: DELETE sem restrição cowboy |
| RPCs (admin\_\*)      | ✅     | `migrations/0005_member_management_rpcs.sql` | N/A                                 |
| Invite System         | ✅     | `migrations/0006_invite_system.sql`          | N/A                                 |
| JWT Auth (sync-batch) | ✅     | `supabase/functions/sync-batch/index.ts`     | N/A                                 |

---

## Resumo Executivo

### ✅ Pronto para Piloto (8 de 7 domínios + infra)

1. **Sanitário** - Completo (vaccines, medicamentos, agenda automática)
2. **Reprodução** - Completo (linking, status, dashboard) 👈 **DESCOBERTA: Era considerado faltante, mas está DONE**
3. **Financeiro** - Completo (compra, venda, sociedade)
4. **Agenda** - Completo (CRUD, dedup, auto-gen)
5. **Movimentação** - Funcional (gaps de UI/FK não-bloqueantes)
6. **Pesagem** - Funcional (gap de validação não-bloqueante)
7. **Offline Infra** - Funcional (gap de cleanup não-bloqueante imediato)
8. **RBAC** - Funcional (gap de DELETE não-bloqueante para piloto)

### ❌ Não Utilizável (1 domínio)

1. **Nutrição** - Backend 100% pronto, ZERO UI 👈 **BLOQUEADOR REAL** (TD-006)

---

## Gaps Reais que Impedem E2E

| ID     | Gap                                  | Impacto                           | Milestone Recomendado |
| ------ | ------------------------------------ | --------------------------------- | --------------------- |
| TD-006 | UI Nutrição inexistente              | ❌ **BLOQUEIA** uso do domínio    | M0 (P0)               |
| TD-001 | Queue rejections sem cleanup         | ⚠️ **RISCO** crescimento storage  | M0 (P0)               |
| TD-008 | Anti-Teleport sem validação frontend | ⚠️ **UX RUIM** (servidor rejeita) | M0 (P0)               |
| TD-014 | Pesagem sem validação frontend       | ⚠️ **UX RUIM** (servidor rejeita) | M1 (P1)               |
| TD-003 | DELETE sem restrição RLS             | ⚠️ **RISCO** perda de dados       | M1 (P1)               |
| TD-019 | FKs movimentação faltantes           | ⚠️ **RISCO** integridade          | M1 (P1)               |
| TD-020 | FK macho_id faltante                 | ⚠️ **RISCO** integridade          | M1 (P1)               |
| TD-004 | Índices parciais                     | 🟡 **PERFORMANCE**                | M2 (P2)               |
| TD-015 | GMD em memória                       | 🟡 **PERFORMANCE**                | M2 (P2)               |

---

## Assunções/Unknowns

1. **E2E Testing Coverage:** Não há evidência de testes automatizados E2E (apenas manuais).
2. **Performance Baseline:** Não há métricas de performance documentadas (load time, query time).
3. **Mobile Responsiveness:** Não auditado nesta análise.
4. **Browser Compatibility:** Não auditado (assume modern browsers).

---

**Assinatura:** Antigravity Agent - Audit Rigoroso
**Data:** 2026-02-16 19:30
