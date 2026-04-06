# Roadmap do Produto

> **Status:** Derivado (Rev D+)
> **Baseline:** `f78dbb4`
> **Ultima Atualizacao:** 2026-03-31
> **Derivado por:** Atualizacao manual derivada de `TECH_DEBT.md OPEN`
> **Fonte:** `TECH_DEBT.md`, `IMPLEMENTATION_STATUS.md`

Este roadmap foi reorientado para o estado atual do repositorio: base funcional, produto mais simples para pequeno e medio produtor e backlog concentrado em hardening e consistencia.

## Principio

O core operacional ja existe. O roadmap atual nao e de expansao ampla de escopo; ele e de consolidacao da base e eliminacao dos gaps abertos.

## Milestone 1: Hardening de integridade e seguranca

**Objetivo:** remover os riscos mais diretos de integridade e permissao.

### Escopo

- TD-003 (`infra.rbac_hardening`)
- TD-019 (`movimentacao.registro`)
- TD-020 (`reproducao.registro`)

### Entregaveis

- endurecer DELETE por role em `animais`
- adicionar FKs em movimentacao
- adicionar FK de `macho_id` em reproducao
- validar essas mudancas nos fluxos operacionais e RBAC

## Milestone 2: Consistencia de dados de operacao

**Objetivo:** reduzir ruido e divergencia na captura de dados do campo.

### Escopo

- TD-011 (`sanitario.registro`)

### Entregaveis

- autocomplete ou catalogo simples de produtos sanitarios
- reducao de typos e duplicidades sem quebrar o fluxo rapido de registro

## Milestone 3: Escala de leitura e agregacao

**Objetivo:** melhorar a performance das leituras analiticas e historicas.

### Escopo

- TD-015 (`pesagem.historico`)
- TD-004 (`infra.indexes`)

### Entregaveis

- estrategia de GMD/historico sem agregacao pesada no cliente
- indices compostos para consultas de dashboard, historico e relatorios
- benchmarks em base volumosa

## Derivacao

| TD | capability_id | Track | Milestone |
| --- | --- | --- | --- |
| TD-003 | `infra.rbac_hardening` | Infra | Milestone 1 |
| TD-004 | `infra.indexes` | Infra | Milestone 3 |
| TD-011 | `sanitario.registro` | Catalog | Milestone 2 |
| TD-015 | `pesagem.historico` | Catalog | Milestone 3 |
| TD-019 | `movimentacao.registro` | Catalog | Milestone 1 |
| TD-020 | `reproducao.registro` | Catalog | Milestone 1 |

## Resultado esperado

Ao final dessas tres frentes, o repositorio fica mais coerente com o momento do produto: um MVP operacional confiavel, com menos risco de integridade, menos ruido de captura e melhor comportamento em escala.

## Veja Tambem

<<<<<<< HEAD
- [TECH_DEBT.md](./TECH_DEBT.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
=======
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
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5
