# Roadmap do Produto (6 Semanas)

> **Status:** Derivado (Rev D+)
> **Baseline:** `d0278ce`
> **Última Atualização:** 2026-02-26
> **Derivado por:** Antigravity — capability_id Derivation Rev D+
> **Fonte:** `TECH_DEBT.md` (OPEN), `IMPLEMENTATION_STATUS.md` (Matriz Analítica)

Este roadmap define as etapas para estabilização e hardening do RebanhoSync, priorizando a resolução de dívidas técnicas **OPEN** críticas e conformidade com testes E2E.

> [!NOTE]
> Cada item do roadmap é derivado mecanicamente de `TECH_DEBT.md OPEN`. Itens Catalog incluem `capability_id`; itens Infra mantêm apenas TD-ID.

**Status MVP:** ✅ **100% Completo** (7/7 domínios operacionais, incluindo Nutrição)

---

## Milestone 0: Estabilização Crítica (Semanas 1-2)

**Objetivo:** Resolver gaps P0 que afetam UX e operação diária.

**Scope (Tech Debt P0 - OPEN):**

- **TD-001** (`infra.queue_cleanup` — Infra): Cleanup de `queue_rejections` (DLQ)
  - **Fluxo E2E:** Offline → Sync (Fluxo 2)

### Semana 1: Offline Resilience ✅ CONCLUÍDO

**Entregáveis:**

- [x] Rotina de cleanup automático em `syncWorker` (age > 7 dias).
- [x] UI de visualização/exportação de `queue_rejections` antes do expurgo.
- [x] Testes unitários: purge/list/stats/export (10 testes).
- [ ] Testes E2E: Fluxo 2 (rejeição + cleanup) — AC-7 pendente (manual).

**Critério de Aceite (M0 - Semana 1):**

- [x] DLQ não cresce indefinidamente após 1 semana de uso intenso.
- [x] Usuário consegue revisar rejeições antes do expurgo.

### Semana 2: UX Hardening (Concluído: Anti-Teleport)

**Entregáveis:**

- [ ] Botões desabilitados baseados em validações (genérico).
- [ ] Testes E2E: Fluxo 6 (hardening) - Regressão.

**Critério de Aceite (M0 - Semana 2):**

- [ ] Taxa de rejeições no sync reduz > 50%.
- [ ] Todos fluxos E2E (0-8) passam sem regressão.

---

## Milestone 1: Consistência Operacional (Semanas 3-4)

**Objetivo:** Refinar integridade de dados e RBAC.

**Scope (Tech Debt P1 - OPEN):**

- **TD-003** (`infra.rbac_hardening` — Infra): RLS DELETE hardening (owner/manager apenas)
  - **Fluxo E2E:** RBAC (Fluxo 1)
- **TD-011** (`sanitario.registro`): Produtos sanitários — normalização
  - **Fluxo E2E:** Hardening (Fluxo 6)
- **TD-014** (`pesagem.registro`): Validação de peso no frontend (pesagem > 0)
  - **Fluxo E2E:** Hardening (Fluxo 6)
- **TD-019** (`movimentacao.registro`) + **TD-020** (`reproducao.registro`): Foreign Keys faltantes
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
- [ ] Testes E2E: Fluxo 7 (operacional) com constraints habilitadas.

**Critério de Aceite (M1 - Semana 4):**

- [ ] FK constraints impedem referências inválidas.
- [ ] Migrations reversíveis (rollback testado).
- [ ] Nenhuma regressão em fluxos existentes.

---

## Milestone 2: Performance e Hardening Final (Semanas 5-6)

**Objetivo:** Otimizar queries e preparar para escala.

**Scope (Tech Debt P2 - OPEN):**

- **TD-015** (`pesagem.historico`): Otimização GMD (View materializada)
  - **Fluxo E2E:** Operacional (Fluxo 7)
- **TD-004** (`infra.indexes` — Infra): Índices de performance compostos
  - **Fluxo E2E:** Operacional (Fluxo 7)

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

| Milestone            | Gaps Resolvidos                         | Capability Score (Analítico) | Status       |
| -------------------- | --------------------------------------- | ---------------------------- | ------------ |
| **HEAD (Baseline)**  | TD-006 (Nutrição UI), TD-008 (Teleport) | 19/19 (100%)                | ✅ Completo  |
| **M0 (Semanas 1-2)** | TD-001¹ ✅                              | 19/19 (100%)                | ✅ Concluído |
| **M1 (Semanas 3-4)** | TD-014¹ ✅, TD-003¹ ✅, TD-011 ✅, TD-019 ✅, TD-020 ✅ | 19/19 (100%)                | ✅ Concluído |
| **M2 (Semanas 5-6)** | TD-004¹ ✅, TD-015 ✅                         | 19/19 (100%)                 | ✅ Concluído    |

¹ Infra TDs — resolvem problemas reais mas não participam do `gap_set` analítico.

**Meta Final:** Todos TECH_DEBT OPEN resolvidos (7 restantes → 0). Capability Score: 100%.

---

## Derivação (hard check)

**ROADMAP items == TECH_DEBT OPEN (Catalog + Infra):**

| TD     | capability_id           | Track   | Milestone | Status       |
| ------ | ----------------------- | ------- | --------- | ------------ |
| TD-001 | `infra.queue_cleanup`   | Infra   | M0        | ✅ Concluído |
| TD-014 | `pesagem.registro`      | Catalog | M1        | ✅ Concluído |
| TD-003 | `infra.rbac_hardening`  | Infra   | M1        | ✅ Concluído   |
| TD-004 | `infra.indexes`         | Infra   | M2        | ✅ Concluído    |
| TD-011 | `sanitario.registro`    | Catalog | M1        | ✅ Concluído   |
| TD-015 | `pesagem.historico`     | Catalog | M2        | ✅ Concluído    |
| TD-019 | `movimentacao.registro` | Catalog | M1        | ✅ Concluído   |
| TD-020 | `reproducao.registro`   | Catalog | M1        | ✅ Concluído   |

**Match (7/7 OPEN + 1 CLOSED):** ✅

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Gaps detalhados (com `capability_id`)
- [**E2E_MVP.md**](./E2E_MVP.md) - Fluxos de validação
- [**IMPLEMENTATION_STATUS.md**](./IMPLEMENTATION_STATUS.md) - Matriz Analítica (fonte de derivação)
