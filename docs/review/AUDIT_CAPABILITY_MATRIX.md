# Auditoria de Capacidades - RebanhoSync

> **Status:** Derivado (Rev D+ — Pós-Fechamento)
> **Baseline:** `b69d35f`
> **Última Atualização:** 2026-04-07

---

## Capability Score: 100% MVP (7/7 domínios) — 0 gaps abertos

Este documento consolida a auditoria de capacidades funcionais do RebanhoSync no baseline `b69d35f`.
Todos os gaps não-bloqueantes do baseline anterior foram fechados via migrations de março/2026.

---

## Matriz de Capacidades por Domínio

| Domínio          | DB  | Server | Offline | Builder | UI Write | UI Read | E2E | Status   |
| ---------------- | --- | ------ | ------- | ------- | -------- | ------- | --- | -------- |
| **Sanitário**    | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Pesagem**      | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Movimentação** | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Nutrição**     | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Reprodução**   | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Financeiro**   | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |
| **Agenda**       | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO |

**Legenda:**

- ✅ = Completo
- ⚠️ = Funcional com gaps não-bloqueantes
- ❌ = Missing/Bloqueador

---

## Evidências de Implementação

### 1. Sanitário ✅ COMPLETO

**DB:** `migrations/0001_init.sql:eventos_sanitario` (tipo, produto, dose_ml, lote_produto)  
**Server:** `sync-batch` aceita `dominio='sanitario'`  
**Offline:** `db.ts:event_eventos_sanitario`  
**Builder:** `buildEventGesture.ts:L51-62`  
**UI Write:** `Registrar.tsx:tipoManejo==='sanitario'` (L932+)  
**UI Read:** Dashboard sanitário (`/sanitarios`)  
**E2E:** Fluxo 6 (Hardening) - PASS

**Gap Não-Bloqueante:**

- TD-011: Produtos TEXT livre (autocomplete planejado)

---

### 2. Pesagem ✅ COMPLETO

**DB:** `migrations/0001_init.sql:eventos_pesagem` (peso_kg)  
**Server:** `sync-batch` aceita `dominio='pesagem'`  
**Offline:** `db.ts:event_eventos_pesagem`  
**Builder:** `buildEventGesture.ts:L63-71`  
**UI Write:** `Registrar.tsx:tipoManejo==='pesagem'` — valida peso > 0  
**UI Read:** Histórico + `vw_animal_gmd` (GMD server-side)  
**E2E:** Fluxo 6 — PASS

**TD-014:** ✅ CLOSED — validação peso > 0 implementada no frontend  
**TD-015:** ✅ CLOSED — `vw_animal_gmd` substitui cálculo in-memory (`20260308230811_indexes_performance_gmd.sql`)

---

### 3. Movimentação ✅ COMPLETO

**DB:** `migrations/0001_init.sql:eventos_movimentacao` + FKs (`20260308230735`)  
**Server:** `sync-batch` + anti-teleport (rules.ts:prevalidateAntiTeleport)  
**Offline:** `db.ts:event_eventos_movimentacao`  
**Builder:** `buildEventGesture.ts:L72-86` (INSERT evento + UPDATE animal.lote_id)  
**UI Write:** `Registrar.tsx:tipoManejo==='movimentacao'` — desabilita origem==destino  
**UI Read:** Histórico funcional  
**E2E:** Fluxo 3 (Anti-Teleporte) — PASS

**TD-008:** ✅ CLOSED — useEffect desabilita `toLoteId` quando igual à origem (`Registrar.tsx:387-396`)  
**TD-019:** ✅ CLOSED — FKs `from_lote_id` e `to_lote_id` adicionadas com limpeza de órfãos (`20260308230735_foreign_keys_movimentacao_reproducao.sql`)

---

### 4. Nutrição ✅ COMPLETO ✨

**DB:** `migrations/0001_init.sql:eventos_nutricao` (alimento_nome, quantidade_kg)  
**Server:** `sync-batch` aceita `dominio='nutricao'`  
**Offline:** `db.ts:event_eventos_nutricao`  
**Builder:** `buildEventGesture.ts:L87-97`  
**UI Write:** `Registrar.tsx:L674-684, L1113-1143` (Form inline - alimento + quantidade)  
**UI Read:** Histórico funcional (filtro domínio funciona)  
**E2E:** Fluxo 8 (Nutrição) - **PASS**

**Descoberta:** UI inline no `Registrar.tsx` (não component separado).  
**TD-006:** CLOSED (2026-02-16) - Era falso negativo.

**Evidência Detalhada:**

```typescript
// Registrar.tsx:L674-684 (Event Builder Input)
else if (tipoManejo === "nutricao") {
  eventInput = {
    dominio: "nutricao",
    fazendaId: fazenda_id,
    occurredAt: now,
    animalId: animalId ?? null,
    loteId: targetLoteId,
    alimentoNome: nutricaoData.alimentoNome,
    quantidadeKg: parseNumeric(nutricaoData.quantidadeKg),
  };
}

// Registrar.tsx:L1113-1143 (Form UI)
{tipoManejo === "nutricao" && (
  <div className="space-y-4 border-t pt-4">
    <Label>Alimento</Label>
    <Input value={nutricaoData.alimentoNome} ... />
    <Label>Quantidade (kg)</Label>
    <Input type="number" value={nutricaoData.quantidadeKg} ... />
  </div>
)}
```

---

### 5. Reprodução ✅ COMPLETO

**DB:** `migrations/0035_reproducao_hardening_v1.sql` + FK macho_id (`20260308230735`)  
**Server:** `sync-batch` aceita `dominio='reproducao'`; valida taxonomia v1  
**Offline:** `db.ts:event_eventos_reproducao`  
**Builder:** `buildEventGesture.ts:L98-112` (com linking episódios)  
**UI Write:** formulário reprodutivo + `AnimalPosParto.tsx` + `AnimalCriaInicial.tsx`  
**UI Read:** `ReproductionDashboard.tsx` + ficha `AnimalReproducao.tsx`  
**E2E:** Fluxos reprodutivos — PASS

**Recursos avançados:**
- Linking episódios (cobertura/IA → diagnóstico → parto)
- Taxonomia canônica bovina (contrato v1 + paridade TS/SQL)
- Pós-parto neonatal e cria inicial

**TD-020:** ✅ CLOSED — FK `macho_id → animais(id)` adicionada com limpeza de órfãos (`20260308230735_foreign_keys_movimentacao_reproducao.sql`)

---

### 6. Financeiro ✅ COMPLETO

**DB:** `migrations/0001_init.sql:eventos_financeiro` (natureza, categoria, valor, moeda)  
**Server:** `sync-batch` aceita `dominio='financeiro'`  
**Offline:** `db.ts:event_eventos_financeiro`  
**Builder:** `buildEventGesture.ts:L98-112`  
**UI Write:** `Registrar.tsx:tipoManejo==='financeiro'` (L1145+)  
**UI Read:** Histórico funcional  
**E2E:** Fluxo Financeiro - PASS

---

### 7. Agenda (Rail 1) ✅ COMPLETO

**DB:** `migrations/0001_init.sql:agenda_itens` + dedup_key  
**Server:** `sync-batch` + deduplicação server-side  
**Offline:** `db.ts:state_agenda_itens`  
**Builder:** `buildAgendaGesture.ts`  
**UI Write:** Agenda CRUD funcional  
**UI Read:** Lista + filtros  
**E2E:** Fluxo 4 (Dedup) - PASS

**Recursos:**

- Deduplicação via `dedup_key`
- Estado mutável: agendado → concluido / cancelado
- Geração via protocolos sanitários

---

## Matriz RBAC (Personas)

### Owner

| Operação                 | Implementado? | Evidência                                           | Status  |
| ------------------------ | ------------- | --------------------------------------------------- | ------- |
| Gerenciar membros        | ✅            | `admin_set_member_role`, `admin_remove_member`      | OK      |
| CRUD fazenda             | ✅            | RLS policies                                        | OK      |
| DELETE animais           | ✅            | `animais_delete_by_role` (role_in_fazenda)          | TD-003 ✅ CLOSED |
| Todos 7 domínios eventos | ✅            | Sem restrições operacionais                         | OK      |

### Manager

| Operação             | Implementado? | Evidência                                           | Status  |
| -------------------- | ------------- | --------------------------------------------------- | ------- |
| Promover cowboy      | ✅            | RPC funcional                                       | OK      |
| CRUD estrutura       | ✅            | Lotes/Pastos RLS                                    | OK      |
| DELETE animais       | ✅            | `animais_delete_by_role` (owner/manager)            | TD-003 ✅ CLOSED |
| Convites             | ✅            | `create_invite`                                     | OK      |
| Eventos (7 domínios) | ✅            | Sem restrições                                      | OK      |

### Cowboy

| Operação                       | Implementado? | Evidência                                           | Status  |
| ------------------------------ | ------------- | --------------------------------------------------- | ------- |
| Registrar eventos (7 domínios) | ✅            | INSERT/UPDATE em animais, todos os eventos          | OK      |
| DELETE animais                 | ❌ Bloqueado  | `animais_delete_by_role` bloqueia cowboy            | TD-003 ✅ CLOSED |
| CRUD lotes/pastos              | ❌ Bloqueado  | RLS restringe (correto)                             | OK      |

---

## Gaps Consolidados

### Da lista original — todos FECHADOS ✅

| TD     | Descrição                              | Status     | Fechado por                                          |
| ------ | -------------------------------------- | ---------- | ---------------------------------------------------- |
| TD-001 | Queue cleanup (DLQ auto-purge)         | ✅ CLOSED  | `syncWorker.ts` + `rejections.ts` (TTL 7d)           |
| TD-003 | DELETE RLS sem role check              | ✅ CLOSED  | `20260308230748_rbac_delete_hardening_animais.sql`   |
| TD-004 | Índices de performance                 | ✅ CLOSED  | `20260308230811_indexes_performance_gmd.sql`         |
| TD-006 | UI nutrição                            | ✅ CLOSED  | `Registrar.tsx` inline                               |
| TD-008 | Anti-Teleport UI (origem==destino)     | ✅ CLOSED  | `Registrar.tsx:387-396` useEffect                    |
| TD-011 | Produtos sanitários — catálogo DB      | ✅ CLOSED  | `20260308230824_produtos_veterinarios_ui.sql`        |
| TD-014 | Peso validation UI                     | ✅ CLOSED  | `Registrar.tsx`                                      |
| TD-015 | GMD em memória                         | ✅ CLOSED  | `vw_animal_gmd` (`20260308230811`)                   |
| TD-019 | FKs movimentação faltantes             | ✅ CLOSED  | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| TD-020 | FK macho_id faltante                   | ✅ CLOSED  | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |

**Total OPEN (lista original):** 0 ✅  
**Bloqueadores E2E:** 0 ✅

### Gaps residuais pós-auditoria (novos)

Nenhum gap residual permanece aberto nesta revisão.

---

## Assinatura

**Baseline:** `b69d35f`  
**Data:** 2026-04-07  
**Capability Score:** 100% MVP (7/7 domínios operacionais)  
**Gaps originais:** 10 → 0 CLOSED  
**Gaps residuais:** 0
