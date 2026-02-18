# Roadmap do Produto (6 Semanas)

> **Status:** Derivado
> **Baseline:** `1f62e4b`
> **Última Atualização:** 2026-02-16
> **Fonte:** `TECH_DEBT.md` (OPEN)

Este roadmap define as etapas para estabilização e hardening do RebanhoSync, priorizando a resolução de dívidas técnicas **OPEN**.

---

## Milestone 0: Estabilização Crítica (Semanas 1-2)

**Objetivo:** Resolver gaps P0 que afetam UX e operação diária.

**Scope (Tech Debt P0 - OPEN):**

- **TD-001 (offline.sync_resilience):** Limpeza de Queue Rejections (Offline)
- **TD-008 (movimentacao.anti_teleport_client):** Validação Anti-Teleport no Frontend

### Semana 1: Offline Resilience

**Entregáveis:**

- [ ] Rotina de cleanup automático em `syncWorker`.
- [ ] UI de visualização/exportação de `queue_rejections`.

### Semana 2: UX Hardening

**Entregáveis:**

- [ ] Validação frontend: Movimentação (origem != destino).

---

## Milestone 1: Consistência Operacional (Semanas 3-4)

**Objetivo:** Refinar integridade de dados e RBAC.

**Scope (Tech Debt P1 - OPEN):**

- **TD-003 (security.rbac):** RLS DELETE sem Restrição de Role
- **TD-011 (sanitario.registro):** Produtos Sanitários TEXT Livre
- **TD-014 (pesagem.registro):** Validação de Peso no Frontend
- **TD-019 (movimentacao.registro):** Foreign Keys Faltantes (Movimentação)
- **TD-020 (reproducao.registro):** Foreign Key macho_id Faltante (Reprodução)

### Semana 3: RBAC + Validações

**Entregáveis:**

- [ ] Patch RLS policy: `DELETE animais` com role check.
- [ ] Validação frontend: Peso > 0.
- [ ] Catálogo básico `produtos_veterinarios` (Nice-to-have).

### Semana 4: Integridade Referencial

**Entregáveis:**

- [ ] Migration: FKs `eventos_movimentacao` (from/to_lote_id).
- [ ] Migration: FK `eventos_reproducao` (macho_id).

---

## Milestone 2: Performance e Hardening Final (Semanas 5-6)

**Objetivo:** Otimizar queries e preparar para escala.

**Scope (Tech Debt P2 - OPEN):**

- **TD-004 (db.performance):** Índices de Performance Faltantes
- **TD-015 (pesagem.historico):** Cálculo de GMD em Memória

### Semana 5: Índices e Medição

**Entregáveis:**

- [ ] Migration: Índices compostos.

### Semana 6: Otimização GMD

**Entregáveis:**

- [ ] View materializada para GMD.

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Gaps detalhados
- [**IMPLEMENTATION_STATUS.md**](./IMPLEMENTATION_STATUS.md) - Estado atual
