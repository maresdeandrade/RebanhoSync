# Auditoria de Capacidades - RebanhoSync

> **Status:** Derivado
> **Baseline:** `1f62e4b`
> **Última Atualização:** 2026-02-16

---

## Capability Score: 100% MVP (7/7 domínios)

Este documento consolida a auditoria rigorosa de capacidades funcionais do RebanhoSync no baseline `1f62e4b`.

---

## Matriz de Capacidades por Domínio

| Domínio          | DB  | Server | Offline | Builder | UI Write | UI Read | E2E | Status                           |
| ---------------- | --- | ------ | ------- | ------- | -------- | ------- | --- | -------------------------------- |
| **Sanitário**    | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO                         |
| **Pesagem**      | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ⚠️  | FUNCIONAL (TD-014)               |
| **Movimentação** | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ⚠️  | FUNCIONAL (TD-008, TD-019)       |
| **Nutrição**     | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | **COMPLETO** ✨                  |
| **Reprodução**   | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ⚠️  | COMPLETO (TD-020 não-bloqueante) |
| **Financeiro**   | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO                         |
| **Agenda**       | ✅  | ✅     | ✅      | ✅      | ✅       | ✅      | ✅  | COMPLETO                         |

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

### 2. Pesagem ⚠️ FUNCIONAL

**DB:** `migrations/0001_init.sql:eventos_pesagem` (peso_kg)  
**Server:** `sync-batch` aceita `dominio='pesagem'`  
**Offline:** `db.ts:event_eventos_pesagem`  
**Builder:** `buildEventGesture.ts:L63-71`  
**UI Write:** `Registrar.tsx:tipoManejo==='pesagem'` (L1006+)  
**UI Read:** Histórico funcional  
**E2E:** Fluxo 6 (Hardening) - PARTIAL

**Gap Não-Bloqueante:**

- ❌ TD-014: UI não valida peso > 0 (servidor rejeita, mas UX degradada)

---

### 3. Movimentação ⚠️ FUNCIONAL

**DB:** `migrations/0001_init.sql:eventos_movimentacao` (from_lote_id, to_lote_id)  
**Server:** `sync-batch` + anti-teleport server (rules.ts:prevalidateAntiTeleport)  
**Offline:** `db.ts:event_eventos_movimentacao`  
**Builder:** `buildEventGesture.ts:L72-86` (INSERT evento + UPDATE animal.lote_id)  
**UI Write:** `Registrar.tsx:tipoManejo==='movimentacao'` (L1066+)  
**UI Read:** Histórico funcional  
**E2E:** Fluxo 3 (Anti-Teleporte) - PARTIAL

**Gaps Não-Bloqueantes:**

- ❌ TD-008: UI não desabilita origem==destino (servidor rejeita, UX degradada)
- ❌ TD-019: FKs faltantes (from/to_lote_id sem FOREIGN KEY)

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

### 5. Reprodução ⚠️ COMPLETO

**DB:** `migrations/0035_reproducao_hardening_v1.sql` (tipo, macho_id, episodio_id)  
**Server:** `sync-batch` aceita `dominio='reproducao'`  
**Offline:** `db.ts:event_eventos_reproducao`  
**Builder:** `buildEventGesture.ts:L98-112` (com linking episódios)  
**UI Write:** `components/events/ReproductionForm.tsx`  
**UI Read:** `ReproductionDashboard.tsx` + views (prenhez_stats, tx_ia)  
**E2E:** Fluxo deReproduction - PASS

**Recursos Avançados:**

- Linking episódios (cobertura → diagnóstico → parto)
- Status computation (prenha, vazia, solteira)

**Gap Não-Bloqueante:**

- ❌ TD-020: FK macho_id faltante

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

| Operação                 | Implementado?       | Evidência                                  | Gap    |
| ------------------------ | ------------------- | ------------------------------------------ | ------ |
| Gerenciar membros        | ✅                  | `admin_change_role`, `admin_remove_member` | -      |
| CRUD fazenda             | ✅                  | RLS policies                               | -      |
| DELETE animais           | ⚠️ (permite cowboy) | RLS sem role check                         | TD-003 |
| Todos 7 domínios eventos | ✅                  | Sem restrições                             | -      |

### Manager

| Operação             | Implementado?       | Evidência          | Gap    |
| -------------------- | ------------------- | ------------------ | ------ |
| Promover cowboy      | ✅                  | RPC funcional      | -      |
| CRUD estrutura       | ✅                  | Lotes/Pastos RLS   | -      |
| DELETE animais       | ⚠️ (permite cowboy) | RLS sem role check | TD-003 |
| Convites             | ✅                  | `create_invite`    | -      |
| Eventos (7 domínios) | ✅                  | Sem restrições     | -      |

### Cowboy

| Operação                       | Implementado?      | Evidência              | Gap         |
| ------------------------------ | ------------------ | ---------------------- | ----------- |
| Registrar eventos (7 domínios) | ✅                 | **Incluindo Nutrição** | -           |
| DELETE animais                 | ⚠️ Permitido (bug) | RLS sem role check     | TD-003      |
| CRUD lotes/pastos              | ❌ Bloqueado       | RLS restringe          | - (correto) |

---

## Gaps Consolidados (Não-Bloqueantes)

### P0 (2 items)

- **TD-001:** Queue cleanup missing (risco storage, não bloqueia operação)
- **TD-008:** Anti-Teleport UI missing (servidor valida, UX degradada)

### P1 (5 items)

- **TD-003:** DELETE RLS sem role check (permite cowboy inadvertidamente)
- **TD-011:** Produtos TEXT livre (autocomplete nice-to-have)
- **TD-014:** Peso validation UI (servidor valida, UX degradada)
- **TD-019:** FKs movimentação faltantes (integridade futura)
- **TD-020:** FK macho_id faltante (integridade futura)

### P2 (2 items)

- **TD-004:** Índices performance parciais (escala)
- **TD-015:** GMD em memória (escala)

**Total OPEN:** 9 items  
**Bloqueadores E2E:** 0 ✅

---

## Assinatura

**Baseline:** `1f62e4b`  
**Data:** 2026-02-16  
**Capability Score:** 100% MVP (7/7 domínios operacionais)  
**Gaps:** 9 items não-bloqueantes
