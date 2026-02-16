# Reconciliação e Delta Report

> **Status:** Derivado
> **Baseline:** `e62465e`
> **Última Atualização:** 2026-02-16
> **Fonte:** Normativos (E2E_MVP, CONTRACTS, ARCHITECTURE) vs Código Real

Este documento registra deltas entre o que os normativos exigem e o que está efetivamente implementado no baseline `e62465e`.

---

## Metodologia de Reconciliação

1. **Leitura dos Normativos:** E2E_MVP.md, CONTRACTS.md, EVENTOS_AGENDA_SPEC.md,RLS.md
2. **Auditoria do Código:** Migrations, Edge Functions, Client (src/\*)
3. **Detecção de Gaps:** Requisitos vs Implementação
4. **Evidência Verificável:** Paths, greps, line numbers

---

## Delta 1: Normativos vs Implementação

### ✅ Conformidade Total (7 domínios)

1. **Two Rails (ARCHITECTURE.md)** - ✅ Implementado
   - Rail 1 (Agenda): `state_agenda_itens` + dedup_key
   - Rail 2 (Eventos): `event_eventos` + satélites append-only
   - Evidência: `src/lib/offline/db.ts`, `migrations/0001_init.sql`

2. **Multi-Tenancy (ARCHITECTURE.md)** - ✅ Implementado
   - Todas tabelas com `fazenda_id`
   - RLS enforcement via `has_membership()`
   - Evidência: `migrations/0004_rls_hardening.sql`

3. **Offline-First (OFFLINE.md)** - ✅ Implementado
   - Dexie stores (state*\*, event*_, queue\__)
   - Sync pipeline (createGesture → syncWorker → rollback)
   - Evidência: `src/lib/offline/*`

4. **Sync Contracts (CONTRACTS.md)** - ✅ Implementado
   - Request/Response payloads conformes
   - Status codes (APPLIED, REJECTED, etc)
   - Evidência: `supabase/functions/sync-batch/index.ts`

5. **Anti-Teleport (EVENTOS_AGENDA_SPEC.md)** - ⚠️ Parcial
   - ✅ Server: `sync-batch/rules.ts:prevalidateAntiTeleport`
   - ❌ Frontend: Não bloqueia na UI (TD-008)

6. **Imutabilidade Eventos (EVENTOS_AGENDA_SPEC.md)** - ✅ Implementado
   - Trigger `prevent_business_update`
   - Correção via `corrige_evento_id`
   - Evidência: `migrations/0001_init.sql`

7. **RBAC (RLS.md)** - ⚠️ Parcial
   - ✅ Roles: owner/manager/cowboy
   - ✅ Policies implementadas
   - ❌ DELETE animais sem restrição cowboy (TD-003)

### ❌ Gaps Identificados (3 itens)

| Gap ID    | Normativo           | Requisito                             | Implementado? | TD Link |
| --------- | ------------------- | ------------------------------------- | ------------- | ------- |
| **GAP-1** | E2E_MVP Fluxo 6     | UI Nutrição (registro eventos)        | ❌ Missing    | TD-006  |
| **GAP-2** | EVENTOS_AGENDA_SPEC | Anti-Teleport validação frontend      | ❌ Missing    | TD-008  |
| **GAP-3** | RLS.md              | DELETE animais restrito owner/manager | ❌ Missing    | TD-003  |

---

## Delta 2: E2E_MVP Flows vs Testes Reais

### Fluxos Validáveis (6 de 7)

| Fluxo E2E                      | Status     | Evidência                      | Bloqueador? |
| ------------------------------ | ---------- | ------------------------------ | ----------- |
| **Fluxo 0:** Auth + Fazenda    | ✅ PASS    | Login, fazenda ativa persist   | Não         |
| **Fluxo 1:** RBAC              | ⚠️ PARTIAL | Roles OK, DELETE bug (TD-003)  | Não         |
| **Fluxo 2:** Offline→Sync      | ⚠️ PARTIAL | Funciona, sem cleanup (TD-001) | Não         |
| **Fluxo 3:** Anti-Teleport     | ⚠️ PARTIAL | Server OK, UI missing (TD-008) | Não         |
| **Fluxo 4:** Dedup Agenda      | ✅ PASS    | dedup_key funcional            | Não         |
| **Fluxo 5:** Setup Fazenda     | ✅ PASS    | Bootstrap automático           | Não         |
| **Fluxo 6:** Hardening Eventos | ❌ FAIL    | Nutrição UI missing (TD-006)   | **SIM**     |

**Capability Score:** 6 de 7 validáveis (86%)  
**Bloqueadores:** 1 (TD-006 Nutrição UI)

---

## Delta 3: Capability Matrix (Personas)

### Owner

| Operação          | Implementado?                   | Evidência                                  |
| ----------------- | ------------------------------- | ------------------------------------------ |
| Gerenciar membros | ✅                              | `admin_change_role`, `admin_remove_member` |
| CRUD fazenda      | ✅                              | RLS policies                               |
| DELETE animais    | ✅ (sem restrição - bug TD-003) | RLS permite qualquer role                  |
| Todos eventos     | ✅                              | Sem restrições                             |

### Manager

| Operação                      | Implementado?                   | Evidência                 |
| ----------------------------- | ------------------------------- | ------------------------- |
| Promover cowboy               | ✅                              | RPC `admin_change_role`   |
| CRUD estrutura (lotes/pastos) | ✅                              | RLS policies              |
| DELETE animais                | ✅ (sem restrição - bug TD-003) | RLS permite qualquer role |
| Convites                      | ✅                              | `create_invite`           |

### Cowboy

| Operação          | Implementado?             | Evidência                               |
| ----------------- | ------------------------- | --------------------------------------- |
| Registrar eventos | ✅                        | Todos domínios exceto Nutrição (TD-006) |
| DELETE animais    | ⚠️ Permitido (bug TD-003) | RLS não restringe                       |
| CRUD lotes/pastos | ❌                        | RLS restringe a owner/manager           |

---

## Delta 4: Patches Normativos Aplicados

Durante reconciliação, 1 patch foi aplicado aos normativos para corrigir contradição factual:

| Normativo | Linha | Antes                             | Depois                    | Commit  |
| --------- | ----- | --------------------------------- | ------------------------- | ------- |
| RLS.md    | 30    | "DELETE planejado para restrição" | "**Gap Aberto (TD-003)**" | e62465e |

**Justificativa:** TD-003 confirma que DELETE sem restrição é um **bug atual**, não uma feature planejada.

---

## Capability Score Consolidado

### Domínios Implementados (E2E)

- ✅ **86% Funcional** (6 de 7 domínios)
  - Sanitário, Reprodução, Financeiro, Agenda: 100%
  - Movimentação, Pesagem: Funcional (gaps não-bloqueantes)

- ❌ **14% Bloqueado** (1 de 7 domínios)
  - Nutrição: UI inexistente (TD-006)

### Gaps por Severidade

- 🔴 **P0:** 3 items (TD-001, TD-006, TD-008)
- 🟠 **P1:** 5 items (TD-003, TD-011, TD-014, TD-019, TD-020)
- 🟡 **P2:** 2 items (TD-004, TD-015)

**Total OPEN:** 10 items

---

## Evidências de Gaps (Reproduzíveis)

### TD-006: UI Nutrição (Bloqueador)

```bash
# Backend exists:
grep "eventos_nutricao" migrations/0001_init.sql  # ✅ Table exists
grep "event_eventos_nutricao" src/lib/offline/db.ts  # ✅ Store exists
grep "nutricao" src/lib/events/buildEventGesture.ts  # ✅ Builder exists (L87-97)

# Frontend missing:
grep "NutricaoForm" src/  # ❌ 0 results
grep 'tipoManejo === "nutricao"' src/pages/Registrar.tsx  # ❌ 0 results
```

### TD-003: DELETE sem restrição (RLS Gap)

```bash
# Policy check:
grep "DELETE" migrations/0004_rls_hardening.sql  # Policy genérica, sem role check
# Esperado: WHERE role IN ('owner', 'manager')
# Real: Sem restrição
```

### TD-008: Anti-Teleport UI (UX Gap)

```bash
# Server validation exists:
grep "prevalidateAntiTeleport" supabase/functions/sync-batch/rules.ts  # ✅ L149-249

# Frontend validation missing:
grep "from.*to.*disable" src/pages/Registrar.tsx  # ❌ Não desabilita Select
```

---

## Recomendações de Ação

### Prioridade Máxima (Desbloqueador)

1. **TD-006: Implementar UI Nutrição**
   - Escopo: `NutricaoForm.tsx` + integração `Registrar.tsx`
   - Effort: ~4h
   - Impacto: Desbloqueia 100% MVP (7/7 domínios)

### Prioridade Alta (Integridade)

2. **TD-003: Restringir DELETE RLS**
   - Escopo: Patch migration RLS policy
   - Effort: ~1h
   - Impacto: Evita perda de dados acidental

3. **TD-008: Validação Anti-Teleport Frontend**
   - Escopo: Disable lote origem no Select destino
   - Effort: ~2h
   - Impacto: Melhora UX (evita envio rejeitado)

---

## Assinatura

**Baseline:** `e62465e`  
**Data:** 2026-02-16  
**Método:** Auditoria rigorosa com evidência verificável  
**Conformidade:** 86% funcional, 1 bloqueador identificado
