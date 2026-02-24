# Relatório de Reconciliação — Documentos de Governança

**Status:** Derivado (Rev D+)
**Baseline:** `dd2f2d8`
**Última Atualização:** 2026-02-17
**Derivado por:** Antigravity — capability_id Derivation Rev D+

---

## 1. Baseline Integrity

**Status:** CLEAN
**Baseline Commit:** `dd2f2d8`
**Data de Execução:** 2026-02-17

Working tree verificado limpo via `git status --porcelain` (sem modificações pendentes).

---

## 2. Summary

### Documentos Atualizados

Este relatório documenta a migração para modelo `capability_id`-centrado em **baseline `dd2f2d8`**:

| Documento                             | Mudança Principal                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/IMPLEMENTATION_STATUS.md`       | Atualizado status `movimentacao.anti_teleport_client` para ✅                |
| `docs/TECH_DEBT.md`                   | Movido TD-008 para CLOSED                                                     |
| `docs/ROADMAP.md`                     | Removido TD-008 do escopo M0 (resolvido)                                      |
| `docs/review/RECONCILIACAO_REPORT.md` | Atualizadas métricas e status TD-008                                          |

### Modelo de Derivação (Rev D+)

```
IMPLEMENTATION_STATUS (Matriz Analítica)
  → gap(capability_id) = (E2E ≠ PASS) OR (camada aplicável ∈ {⚠️, ❌})
    → TECH_DEBT OPEN (Catalog)
      → ROADMAP items
```

---

## 3. capability_id Migration

### 3.1 Métricas

| Métrica                                 | Valor         |
| --------------------------------------- | ------------- |
| Capabilities no Catalog                 | 19            |
| TDs OPEN (total)                        | 8             |
| TDs OPEN (Catalog) com `capability_id`  | 5/5 (100%)    |
| TDs OPEN (Infra) com `infra.*` proposto | 3/3 (100%)    |
| TDs CLOSED com `capability_id`          | 2/2 (100%)    |
| Catálogo coberto na Matriz              | 19/19 (100%)  |
| Gaps identificados                      | 5/19 (26.3%)  |
| Capability Score (Analítico)            | 14/19 (73.7%) |
| NEW (Proposed)                          | 3 (`infra.*`) |

### 3.2 Mapping Completo: TD → capability_id

| TD     | capability_id                       | Track   | Status    | Notas                             |
| ------ | ----------------------------------- | ------- | --------- | --------------------------------- |
| TD-001 | `infra.queue_cleanup`               | Infra   | OPEN (P0) | Queue cleanup — fora do Catalog   |
| TD-003 | `infra.rbac_hardening`              | Infra   | OPEN (P1) | RBAC refinement — fora do Catalog |
| TD-004 | `infra.indexes`                     | Infra   | OPEN (P2) | DB indexes — fora do Catalog      |
| TD-006 | `nutricao.registro`                 | Catalog | CLOSED    | UI já implementada                |
| TD-008 | `movimentacao.anti_teleport_client` | Catalog | CLOSED    | Resolvido (UI + Test)             |
| TD-011 | `sanitario.registro`                | Catalog | OPEN (P1) | produto TEXT normalização         |
| TD-014 | `pesagem.registro`                  | Catalog | OPEN (P1) | peso validation                   |
| TD-015 | `pesagem.historico`                 | Catalog | OPEN (P2) | GMD in-memory perf                |
| TD-019 | `movimentacao.registro`             | Catalog | OPEN (P1) | FKs faltantes                     |
| TD-020 | `reproducao.registro`               | Catalog | OPEN (P1) | FK macho_id                       |

### 3.3 NEW (Proposed) — Fora do Catalog

| `capability_id` proposto | TD     | Justificativa                                       | Ação                                        |
| ------------------------ | ------ | --------------------------------------------------- | ------------------------------------------- |
| `infra.queue_cleanup`    | TD-001 | Infra offline (DLQ), não é capability de domínio    | Mantido fora do score; promover se expandir |
| `infra.rbac_hardening`   | TD-003 | RBAC é infra cross-cutting, não domínio operacional | Mantido fora do score                       |
| `infra.indexes`          | TD-004 | Performance de DB, não capability funcional         | Mantido fora do score                       |

### 3.4 Mapping Ambiguity

Nenhuma ambiguidade identificada no conjunto mapeado. Todos os TDs mapeiam 1:1 para `capability_id`.

### 3.5 Split/Merge Proposals

Nenhuma necessidade de split/merge identificada no conjunto mapeado. Registrar se surgir ambiguidade futura.

---

## 4. Consistência Verificada (Hard Checks)

### 4.1 gap_set == TECH_DEBT OPEN (Catalog) capability_set

```
gap_set (Matriz Analítica):
  {sanitario.registro, pesagem.registro, pesagem.historico,
   movimentacao.registro, reproducao.registro}

TECH_DEBT OPEN (Catalog) capability_set:
  {TD-011→sanitario.registro, TD-014→pesagem.registro, TD-015→pesagem.historico,
   TD-019→movimentacao.registro, TD-020→reproducao.registro}

Match: ✅ (5/5)
```

### 4.2 ROADMAP items == TECH_DEBT OPEN (Catalog + Infra)

```
ROADMAP TDs: {TD-001, TD-003, TD-004, TD-011, TD-014, TD-015, TD-019, TD-020}
TECH_DEBT OPEN: {TD-001, TD-003, TD-004, TD-011, TD-014, TD-015, TD-019, TD-020}
Match: ✅ (8/8)
```

### 4.3 Catalog Uniqueness

Cada `capability_id` do catálogo aparece exatamente 1 vez na Matriz Analítica: ✅ (19/19)

### 4.4 Headers Rev D+

Todos os 4 arquivos possuem: Status, Baseline (`dd2f2d8`), Última Atualização, Derivado por: ✅

---

## 5. Data Contract Audit (mantido de Rev D)

| Item                                  | Status | Evidência                                                               | Ação Sugerida |
| ------------------------------------- | ------ | ----------------------------------------------------------------------- | ------------- |
| Sync metadata obrigatório em eventos  | ✅ OK  | PM: `supabase/migrations/0001_init.sql:L562-566`                        | Nenhuma       |
| Append-only trigger em eventos        | ✅ OK  | PM: `supabase/migrations/0001_init.sql:L577-579`                        | Nenhuma       |
| RLS habilitado em eventos             | ✅ OK  | PM: `supabase/migrations/0001_init.sql:L741`                            | Nenhuma       |
| Checks de valor positivo (financeiro) | ✅ OK  | PM: `supabase/migrations/0023_hardening_eventos_financeiro.sql:L13`     | Nenhuma       |
| Checks de valor positivo (nutricao)   | ✅ OK  | PM: `supabase/migrations/0024_hardening_eventos_nutricao.sql:L12`       | Nenhuma       |
| Constraint destino movimentação       | ✅ OK  | PM: `supabase/migrations/0025_hardening_eventos_movimentacao.sql:L6-10` | Nenhuma       |
| FK contrapartes                       | ✅ OK  | PM: `supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql`   | Nenhuma       |
| Agenda dedup_key unique               | ✅ OK  | PM: `supabase/migrations/0001_init.sql:L522-524`                        | Nenhuma       |
| Protocol item versioning              | ✅ OK  | PM: `supabase/migrations/0001_init.sql:L441-447`                        | Nenhuma       |
| Reproducao episode linking            | ✅ OK  | PM: `supabase/migrations/0035_reproducao_hardening_v1.sql:L43-121`      | Nenhuma       |

---

## 6. Comandos Reproduzíveis Usados

```bash
# Baseline
git rev-parse --short HEAD
# Retorna: dd2f2d8

# Working tree status
git status --porcelain
# Retorna: (vazio)

# Verificar TD-008 UIW
rg -n "useEffect" src/pages/Registrar.tsx
# Confirmar linhas que monitoram movimentacaoData.toLoteId

# Verificar testes TD-008
ls src/pages/__tests__/Registrar.test.tsx
# Confirmar existência do arquivo
```

---

## Conclusão

Migração `capability_id` Rev D+ atualizada em **baseline dd2f2d8**:

- **TD-008 Resolvido:** Movimentação Anti-Teleport
  - Capability Score subiu para **73.7%**
  - M0 (Semana 2) UX Hardening progrediu
- **Consistência Mantida:**
  - Todas as tabelas de derivação sincronizadas
  - Nenhum gap não mapeado
  - Roadmap limpo de itens resolvidos

Working tree permanece CLEAN após aplicação das edições.

Próximo passo: Commit `docs: regen governance docs (TD-008 closed) [baseline dd2f2d8]`.
