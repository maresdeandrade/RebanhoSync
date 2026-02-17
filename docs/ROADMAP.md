# Roadmap do Produto (6 Semanas)

> **Status:** Derivado
> **Baseline:** `1f62e4b`
> **Última Atualização:** 2026-02-16
> **Fonte:** `TECH_DEBT.md` (OPEN), `E2E_MVP.md`, `IMPLEMENTATION_STATUS.md`

Este roadmap define as etapas para estabilização e hardening do RebanhoSync, priorizando a resolução de dívidas técnicas **OPEN** críticas e conformidade com testes E2E.

**Status MVP:** ✅ **100% Completo** (7/7 domínios operacionais, incluindo Nutrição)

---

## Milestone 0: Estabilização Crítica (Semanas 1-2)

**Objetivo:** Resolver gaps P0 que afetam UX e operação diária.

**Scope (Tech Debt P0 - OPEN):**

- **TD-001:** Cleanup de `queue_rejections` (DLQ)
  - **Fluxo E2E:** Offline → Sync (Fluxo 2)
- **TD-008:** Validação Anti-Teleport no Frontend
  - **Fluxo E2E:** Anti-Teleporte (Fluxo 3), Hardening (Fluxo 6)

### Semana 1: Offline Resilience

**Entregáveis:**

- [ ] Rotina de cleanup automático em `syncWorker` (age > 7 dias).
- [ ] UI de visualização/exportação de `queue_rejections` antes do expurgo.
- [ ] Testes E2E: Fluxo 2 (rejeição + cleanup).

**Critério de Aceite (M0 - Semana 1):**

- [ ] DLQ não cresce indefinidamente após 1 semana de uso intenso.
- [ ] Usuário consegue revisar rejeições antes do expurgo.

### Semana 2: UX Hardening

**Entregáveis:**

- [ ] Validação frontend: Movimentação (origem != destino).
- [ ] Botões desabilitados baseados em validações.
- [ ] Testes E2E: Fluxo 3 (anti-teleport) + Fluxo 6 (hardening).

**Critério de Aceite (M0 - Semana 2):**

- [ ] UI impede envio de movimentações inválidas (origem==destino).
- [ ] Taxa de rejeições no sync reduz > 50%.
- [ ] Todos fluxos E2E (0-8) passam sem regressão.

---

## Milestone 1: Consistência Operacional (Semanas 3-4)

**Objetivo:** Refinar integridade de dados e RBAC.

**Scope (Tech Debt P1 - OPEN):**

- **TD-003:** RLS DELETE hardening (owner/manager apenas)
  - **Fluxo E2E:** RBAC (Fluxo 1)
- **TD-014:** Validação de peso no frontend (pesagem > 0)
  - **Fluxo E2E:** Hardening (Fluxo 6)
- **TD-019 + TD-020:** Foreign Keys faltantes (movimentação + reprodução)
  - **Fluxo E2E:** Operacional (Fluxo 7)

### Semana 3: RBAC + Validações

**Entregáveis:**

- [ ] Patch RLS policy: `DELETE animais` com role check.
- [ ] Validação frontend: Peso > 0 (pesagem).
- [ ] Testes E2E: Fluxo 1 (RBAC) + Fluxo 6 (hardening pesagem).

**Critério de Aceite (M1 - Semana 3):**

- [ ] Cowboy recebe 403 ao tentar DELETE animal.
- [ ] Owner/Manager conseguem DELETE normalmente.
- [ ] UI impede envio de peso <= 0.

### Semana 4: Integridade Referencial

**Entregáveis:**

- [ ] Migration: FKs `eventos_movimentacao` (from/to_lote_id).
- [ ] Migration: FK `eventos_reproducao` (macho_id).
- [Testes E2E: Fluxo 7 (operacional) com constraints habilitadas.

**Critério de Aceite (M1 - Semana 4):**

- [ ] FK constraints impedem referências inválidas.
- [ ] Migrations reversíveis (rollback testado).
- [ ] Nenhuma regressão em fluxos existentes.

---

## Milestone 2: Performance e Hardening Final (Semanas 5-6)

**Objetivo:** Otimizar queries e preparar para escala.

**Scope (Tech Debt P2 - OPEN + P1 Opcional):**

- **TD-004:** Índices de performance compostos
  - **Fluxo E2E:** Operacional (Fluxo 7)
- **TD-015:** Otimização GMD (View materializada)
  - **Fluxo E2E:** Operacional (Fluxo 7)
- **TD-011:** _(Opcional)_ Catálogo de produtos veterinários
  - **Fluxo E2E:** Hardening (Fluxo 6)

### Semana 5: Índices e Medição

**Entregáveis:**

- [ ] Migration: Índices `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)`.
- [ ] Benchmarks: Dashboard com 5000 animais.
- [ ] Testes E2E: Fluxo 7 (carga).

**Critério de Aceite (M2 - Semana 5):**

- [ ] Dashboard carrega em < 2s com 5000 animais.
- [ ] Queries lentas (> 1s) eliminadas.

### Semana 6: Otimização GMD + Nice-to-Have

**Entregáveis:**

- [ ] View materializada ou coluna computada para GMD.
- [ ] _(Opcional)_ Catálogo básico `produtos_veterinarios` (autocomplete UI).
- [ ] Testes E2E: Fluxo 7 (GMD otimizado).

**Critério de Aceite (M2 - Semana 6):**

- [ ] GMD calculado sem carregar histórico completo.
- [ ] Dashboard permanece < 2s com 10k animais.
- [ ] (Opcional) Autocomplete produtos reduz typos.

---

## Capability Scorecard (Pós-Roadmap)

| Milestone            | Gaps Resolvidos                     | Capability Score    | Status    |
| -------------------- | ----------------------------------- | ------------------- | --------- |
| **HEAD (Baseline)**  | TD-006 (Nutrição UI)                | 100% MVP (7/7)      | ✅ ATUAL  |
| **M0 (Semanas 1-2)** | TD-001, TD-008 (P0)                 | 100% + UX melhorada | Planejado |
| **M1 (Semanas 3-4)** | TD-003, TD-014, TD-019, TD-020 (P1) | 100% + Integridade  | Planejado |
| **M2 (Semanas 5-6)** | TD-004, TD-015 (P2)                 | 100% + Escala       | Planejado |

**Meta Final:** Todos TECH_DEBT OPEN resolvidos (9 → 0).

---

## E2E Flows Coverage (Pós-Roadmap)

| Fluxo                          | Milestone       | Status Atual                     | Status Pós-Roadmap |
| ------------------------------ | --------------- | -------------------------------- | ------------------ |
| **Fluxo 0:** Auth + Fazenda    | HEAD            | ✅ PASS                          | ✅ PASS            |
| **Fluxo 1:** RBAC              | M1 (Sem.3)      | ⚠️ PARTIAL (TD-003)              | ✅ PASS            |
| **Fluxo 2:** Offline → Sync    | M0 (Sem.1)      | ⚠️ PARTIAL (TD-001)              | ✅ PASS            |
| **Fluxo 3:** Anti-Teleporte    | M0 (Sem.2)      | ⚠️ PARTIAL (TD-008)              | ✅ PASS            |
| **Fluxo 4:** Dedup Agenda      | HEAD            | ✅ PASS                          | ✅ PASS            |
| **Fluxo 5:** Setup Fazenda     | HEAD            | ✅ PASS                          | ✅ PASS            |
| **Fluxo 6:** Hardening Eventos | M0-M1 (Sem.2-3) | ⚠️ PARTIAL (TD-008, TD-014)      | ✅ PASS            |
| **Fluxo 7:** Operacional       | M1-M2 (Sem.4-6) | ⚠️ PARTIAL (TD-004, TD-015, FKs) | ✅ PASS            |
| **Fluxo 8:** Nutrição          | HEAD            | ✅ PASS (**MVP Completo**)       | ✅ PASS            |

**Cobertura Atual:** 4/9 fluxos PASS (44%)  
**Cobertura Pós-M2:** 9/9 fluxos PASS (100%)

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Gaps detalhados
- [**E2E_MVP.md**](./E2E_MVP.md) - Fluxos de validação
- [**IMPLEMENTATION_STATUS.md**](./IMPLEMENTATION_STATUS.md) - Estado atual
