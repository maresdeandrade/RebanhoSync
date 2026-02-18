# Relatório de Reconciliação — Documentos de Governança de Eventos

**Status:** Derivado  
**Baseline:** 3c304ad
**Última Atualização:** 2026-02-16
**Derivado por:** Antigravity Docs Update — Rev D+ (capability_id)

---

## 1. Baseline Integrity

**Status:** CLEAN  
**Baseline Commit:** 3c304ad
**Data de Execução:** 2026-02-16

Working tree verificado limpo via `git status --porcelain` (sem modificações pendentes).

---

## 2. Summary

### Documentos Atualizados

Este relatório documenta as atualizações de governança realizadas em **baseline 3c304ad**:

1. `docs/review/RECONCILIACAO_REPORT.md` (DERIVADO)
2. `docs/IMPLEMENTATION_STATUS.md` (NORMATIVO - Matriz Analítica)
3. `docs/TECH_DEBT.md` (DERIVADO - capability_id mapping)
4. `docs/ROADMAP.md` (DERIVADO - capability_id items)

### Deltas Relevantes Identificados

| Item                                                                 | Tipo             | Evidência                                         |
| -------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| `eventos_financeiro.valor_total` agora tem `check > 0`               | Schema hardening | PM: `0023_hardening_eventos_financeiro.sql:13`    |
| `eventos_nutricao.quantidade_kg` agora tem `check > 0 when not null` | Schema hardening | PM: `0024_hardening_eventos_nutricao.sql:12`      |
| Agenda engine sanitária implementada                                 | New capability   | PM: `0028_sanitario_agenda_engine.sql`            |
| Reprodução hardening v1 concluído                                    | New capability   | PM: `0035_reproducao_hardening_v1.sql`            |
| FKs compostas para contrapartes adicionados                          | Schema hardening | PM: `0026_fk_eventos_financeiro_contrapartes.sql` |

### Riscos/Itens Abertos

1. **Transitional Inconsistency**: Capabilities propostas (`offline.sync_resilience`, `security.rbac`, `db.performance`) foram usadas em TECH_DEBT mas ainda não estão formalizadas na Matriz Analítica principal (apenas no Report).

---

## 3. Mudanças Aplicadas

### 3.1 RECONCILIACAO_REPORT.md

- **O que mudou**:
  - Atualizado para Rev D+ (capability_id).
  - Adicionada seção de migração de capability_id.

### 3.2 IMPLEMENTATION_STATUS.md

- **O que mudou**:
  - Adicionada **Matriz Analítica (capability_id)**.
  - Adicionado **Evidence Index**.
  - Mantido conteúdo editorial existente.

### 3.3 TECH_DEBT.md

- **O que mudou**:
  - Adicionado campo `capability_id` em todos os itens.
  - Mapeamento determinístico de TDs para capabilities.

### 3.4 ROADMAP.md

- **O que mudou**:
  - Reescrito para conter **apenas** itens de TECH_DEBT OPEN.
  - Formato `TD-### (capability_id)` adotado.

---

## 4. Deltas vs Normativos

(Seção mantida do relatório anterior para histórico)

### 4.1 Delta: Decisões P0 Parcialmente Implementadas

**Claim normativo (PLANO Seção 13):**

> "Adicionar checks de negócio faltantes: `eventos_financeiro.valor_total > 0`, `eventos_nutricao.quantidade_kg > 0` (quando preenchido)."

**Evidência no código:**

- PM: `supabase/migrations/0023_hardening_eventos_financeiro.sql:13`
  ```sql
  check (valor_total > 0)
  ```
- PM: `supabase/migrations/0024_hardening_eventos_nutricao.sql:12`
  ```sql
  check (quantidade_kg is null or quantidade_kg > 0)
  ```

---

## capability_id Migration

**Baseline:** `3c304ad`
**Data:** 2026-02-16

### Status da Migração

- **Docs atualizados:** 4/4 (STATUS, TECH_DEBT, ROADMAP, REPORT)
- **TDs com capability_id:** 100% (Todos OPEN/CLOSED)
- **Roadmap derivado:** 100% (Somente itens de TECH_DEBT OPEN)

### Mapping TD -> capability_id

| TD | capability_id | Status | Notas |
|---|---|---|---|
| TD-001 | `offline.sync_resilience` | OPEN | **NEW (Proposed)** - Não está no catálogo base. |
| TD-008 | `movimentacao.anti_teleport_client` | OPEN | Catálogo base. |
| TD-003 | `security.rbac` | OPEN | **NEW (Proposed)** - Não está no catálogo base. |
| TD-011 | `sanitario.registro` | OPEN | Catálogo base. |
| TD-014 | `pesagem.registro` | OPEN | Catálogo base. |
| TD-019 | `movimentacao.registro` | OPEN | Catálogo base. |
| TD-020 | `reproducao.registro` | OPEN | Catálogo base. |
| TD-004 | `db.performance` | OPEN | **NEW (Proposed)** - Não está no catálogo base. |
| TD-015 | `pesagem.historico` | OPEN | Catálogo base. |
| TD-006 | `nutricao.registro` | CLOSED | Catálogo base. |

### New (Proposed) Capabilities

Capabilities identificadas durante o mapping que não constavam no catálogo inicial sugerido:

1. `offline.sync_resilience` (Infra / Queue management)
2. `security.rbac` (Security / Access Control)
3. `db.performance` (Infra / Database)

### Comandos usados

```bash
# Verificar arquivos
ls -F src/lib/domain/ src/components/ src/lib/offline/ supabase/migrations/

# Verificar UI Write
grep -r "Registrar" src/pages/

# Verificar TD IDs
grep "^### TD-" docs/TECH_DEBT.md
```
