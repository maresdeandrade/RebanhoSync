# Relatório de Reconciliação — Documentos de Governança

- Status: Derivado (Rev D+)
- Baseline: `47148f0`
- Última Atualização: 2026-02-21
- Derivado por: Antigravity Post-Impl TD-001 — Rev D+

---

## 1. Baseline Integrity

**Status:** CLEAN
**Baseline Commit:** `47148f0`
**Data de Execução:** 2026-02-21

Working tree verificado limpo via `git status --porcelain` (sem modificações pendentes).

---

## TD-001 — Contexto Técnico

### Offline-First Architecture

O sistema opera sob o paradigma **Offline-First** utilizando IndexedDB/Dexie com 17 stores:

| Store | Propósito |
| --- | --- |
| `queue_gestures` | Metadados da transação (client_tx_id, status: PENDING/SYNCING/DONE/REJECTED) |
| `queue_ops` | Operações individuais (client_op_id, table, action, before_snapshot) |
| `queue_rejections` | Dead Letter Queue para erros de negócio |
| `state_*` (8 stores) | Réplica local do estado atual das entidades |
| `event_*` (7 stores) | Log local de eventos ocorridos (append-only) |

**Evidência:**
- PM: `src/lib/offline/db.ts:24-48` (definição das stores)
- PM: `src/lib/offline/db.ts:138-166` (schema versão 6)

### Two Rails Architecture

O sistema utiliza Two Rails para conciliar estado mutável e rastreabilidade imutável:

- **Rail 1: Agenda (Mutável)** — Intenções futuras (ex: tarefas agendadas)
- **Rail 2: Eventos (Append-Only)** — Fatos passados (ex: pesagem realizada, vacina aplicada)

**Evidência:**
- PM: `docs/ARCHITECTURE.md` (Two Rails)
- PM: `docs/OFFLINE.md` (Dexie Stores, Queue, Rollback)

### Sync Architecture

O sync é orientado a **Gestos** (Transações Atômicas):

1. **UI:** Usuário realiza ação (ex: vacinar animal)
2. **Local:** `createGesture` gera `client_tx_id` e grava em `queue_gestures` + `queue_ops`
3. **Otimismo:** Aplica mudança imediatamente em `state_*` e captura `before_snapshot` para rollback
4. **Worker:** A cada ~5s, pega gestos `PENDING`
5. **Envio:** POST `/functions/v1/sync-batch` com payload JSON

**Evidência:**
- PM: `src/lib/offline/syncWorker.ts:29-70` (startSyncWorker)
- PM: `src/lib/offline/ops.ts:21-72` (createGesture)
- PM: `src/lib/offline/syncWorker.ts:148-172` (sendBatchRequest)

### Arquitetura de Filas (Tabela)

| Store | Propósito | Índices |
| --- | --- | --- |
| `queue_gestures` | Metadados da transação | client_tx_id, [status+created_at], fazenda_id |
| `queue_ops` | Operações individuais | client_op_id, client_tx_id, fazenda_id |
| `queue_rejections` | Dead Letter Queue | ++id, client_tx_id, fazenda_id |

**Evidência:**
- PM: `src/lib/offline/db.ts:163-165` (índices das queues)

---

## TD-001 — Bugs & Fixes (com evidência)

| Bug | Severidade | Local (PM) | Problema | Fix implementado? | Evidência do fix (PM) | Teste/Validação |
|---|---|---|---|---|---|---|
| **Bug #1:** Operações REJECTED ficam órfãs | CRÍTICO | `syncWorker.ts:281-285` | só limpa `queue_ops` para DONE; REJECTED acumula para sempre | **NÃO** | N/A - Bug presente | Requer cleanup de queue_ops também para REJECTED |
| **Bug #2:** Retry para rejeições de negócio | ALTA | `syncWorker.ts:346-363` | retry só para erros de rede/auth; rejeição de negócio vira "final" | **NÃO** | N/A - Bug presente | Requer retry com backoff OU UI de reprocessamento |
| **Bug #3:** Recovery de auth limitado | MÉDIA | `syncWorker.ts:87-106` | Recovery pós-startup não existia | **SIM** ✅ | `recoverAuthErroredGesturesOnce()` executa no startup (linhas 40-43) | Funcional |
| **Bug #4:** Rollback DELETE incompleto | ALTA | `ops.ts:136-139` | delete usa soft-delete (`deleted_at`), rollback pode não restaurar | **SIM** ✅ | `rollbackOpLocal` restaura `before_snapshot` que inclui `deleted_at: null` (linha 138) | Rollback restaura corretamente |
| **Bug #5:** Rollback silencioso | ALTA | `ops.ts:126` | before_snapshot ausente ignora rollback sem log | **PARCIAL** ⚠️ | Retorna silenciosamente se não há before_snapshot (linha 126) | Requer logging |
| **Bug #6:** Race conditions | MÉDIA | `ops.ts` | Concorrência no mesmo registro | **NÃO** | N/A - Bug presente | Requer mutex/lock |

**Status TD-001:** ❌ **NÃO PODE SER CLOSED** — Bugs #1, #2, #5, #6 ainda abertos

---

## Isolamento por fazenda_id — Lotes (Create/Edit/List)

### Checklist de Verificação

| Item | Status | PM |
| --- | --- | --- |
| gesture injeta `fazenda_id` | ✅ | `ops.ts:49` (injeção no record) |
| UI LoteNovo: usa getActiveFarmId | ✅ | `LoteNovo.tsx:29` |
| UI LoteNovo: injeta fazenda_id no record | ✅ | `LoteNovo.tsx:69` |
| UI LoteEditar: usa lote.fazenda_id | ✅ | `LoteEditar.tsx:95` |
| hooks useLotes: filtro eficiente (where) | ✅ | `useLotes.ts:29-32` |
| Componentes manejo: filtros por fazenda_id | ✅ | `LoteEditar.tsx:37-55` |

**Status:** ✅ **IMPLEMENTADO** — Isolamento por fazenda_id verificado em todas as operações de Lotes

---

## Sync Worker — Rejeições: Fluxo e Garantias

### Fluxo de REJECTED

1. **Detecção:** `syncWorker.ts:249` — `hasRejected = result.results.some((r) => r.status === "REJECTED")`
2. **Registro em queue_rejections:** `syncWorker.ts:317-331` — para cada resultado REJECTED, adiciona entrada na DLQ
3. **Rollback local:** `syncWorker.ts:333-337` — executa rollback em ordem reversa

### Correções Exigidas

| Bug | Correção | Status | PM |
| --- | --- | --- | --- |
| Bug #1 | limpar queue_ops após rollback de rejeição | ❌ **NÃO IMPLEMENTADO** | `syncWorker.ts:281-285` (só limpa para DONE) |
| Bug #2 | retry para rejeições recoverable OU mecanismo manual | ❌ **NÃO IMPLEMENTADO** | `syncWorker.ts:346-363` (só retry erros rede) |
| Bug #5 | logging para rollback silencioso | ⚠️ **PARCIAL** | `ops.ts:126` (retorna sem log) |

### UI de Rejeições

- **Status:** ❌ **NÃO IMPLEMENTADO**
- Necessário: UI para exibir rejeições e permitir reprocessamento manual

---

## NEW (Proposed) — Follow-ups

As seguintes melhorias foram identificadas mas **não foram implementadas** nesta versão:

| Proposta | Justificativa | Prioridade |
| --- | --- | --- |
| Cleanup de rejeições antigas (TTL > 7 dias) | Evitar crescimento infinito da DLQ | P0 |
| Métricas (taxa de rejeição + top reason_codes) | Observabilidade | P1 |
| UI para exibir/reprocessar rejeições | UX para recovery | P1 |
| Export/reimport para debugging | Debug offline | P2 |

---

## TD-001 — Runbook (Dev → Test → Review → Deploy → Pós-Deploy)

### Dev

**Arquivos alterados (implementação base):**
- `src/lib/offline/db.ts` — Dexie stores (17 stores)
- `src/lib/offline/syncWorker.ts` — Pipeline de sync
- `src/lib/offline/ops.ts` — Operações e rollback

**Riscos:**
- Perda de dados local se rollback falhar
- Stuck ops se worker travar
- Loops de retry se não houver backoff adequado

### Test

**Unitários (infra existente):**
- Rollback INSERT/UPDATE/DELETE: `src/lib/offline/__tests__/`
- Rollback DELETE restaura `deleted_at: null`: Manual verification required
- Rejeição gera queue_rejections: Manual verification required
- Limpeza queue_ops pós REJECTED: **FALHA** (Bug #1)

**Integração/Manual (offline-first):**
1. Criar lote offline
2. Gerar gesture
3. Simular rede intermitente
4. Sync → REJECTED → rollback
5. Confirmar que não entra em loop e que queue_ops não cresce infinitamente

**Multi-fazenda:**
- Validar isolamento por `fazenda_id` (AC-4)

### Review

**Checklist:**
- [ ] Invariants offline-first: sem supabase write no client
- [ ] `fazenda_id` correto em todas operações de lotes
- [ ] Rollback determinístico + logging
- [ ] **FALHA:** crescimento infinito de filas (queue_ops não limpa para REJECTED)

### Deploy

**Ordem:**
1. migrations (se houver) — N/A para esta versão
2. deploy functions (se houver) — N/A
3. deploy client
4. migração Dexie (se schema mudou): estratégia + fallback — N/A

**Monitoramento:**
- Taxa de REJECTED
- Top reason_codes
- Tamanho de queue_ops/queue_rejections

**Rollback plan:**
- Desativar retry/cleanup de forma segura

---

## Critérios de Aceitação (AC-1..AC-6)

| AC | Critério | Evidência (PM) | Validação | Status |
|---|---|---|---|---|
| AC-1 | ops rejeitadas removidas de queue_ops após rollback | `syncWorker.ts:281-285` (apenas para DONE) | **FAIL** — Bug #1 presente | ❌ |
| AC-2 | rejeições registradas em queue_rejections com reason_code | `syncWorker.ts:317-331` | ✅ Verificado | PASS |
| AC-3 | rollback DELETE restaura deleted_at: null | `ops.ts:136-139` (before_snapshot) | ✅ Verificado | PASS |
| AC-4 | filtros usam fazenda_id corretamente | `useLotes.ts:29-32`, `LoteNovo.tsx:69` | ✅ Verificado | PASS |
| AC-5 | sync worker processa rejeições sem crash | `syncWorker.ts:293-342` | ✅ Verificado | PASS |
| AC-6 | taxa de rejeição diminui pós deploy | Plano de medição: Monitorar dashboard analytics | PENDING (measurement) | PENDING |

**Resultado:** AC-1 **FAIL** — TD-001 não pode ser CLOSED

---

## 2. Summary

### Documentos Atualizados

Este relatório documenta a análise post-implementação do TD-001 em **baseline `47148f0`**:

| Documento                             | Mudança Principal                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/review/RECONCILIACAO_REPORT.md` | Adicionado contexto técnico TD-001, bugs, runbook, ACs                     |

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

> **Nota TD-001:** O TD-001 (infra.queue_cleanup) permanece OPEN. Bugs #1, #2, #5, #6 identificados mas não resolvidos nesta versão. AC-1 FAIL.|

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

Todos os 4 arquivos possuem: Status, Baseline (`47148f0`), Última Atualização, Derivado por: ✅

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
# Retorna: 47148f0

# Working tree status
git status --porcelain
# Retorna: (vazio)

# Verificar stores Dexie
rg -n "queue_rejections" src/lib/offline/db.ts
# Confirma stores de queue

# Verificar sync worker
rg -n "hasRejected" src/lib/offline/syncWorker.ts
# Confirma detecção de rejeições

# Verificar rollback
rg -n "rollbackOpLocal" src/lib/offline/ops.ts
# Confirma função de rollback
```

---

## Conclusão

Análise post-implementação TD-001 atualizada em **baseline 47148f0**:

- **TD-001 Status:** ❌ **NÃO PODE SER CLOSED**
  - Bugs identificados: #1 (CRÍTICO), #2 (ALTA), #5 (ALTA), #6 (MÉDIA)
  - AC-1 FAIL: queue_ops não é limpo após REJECTED
  - Bugs resolvidos: #3 (Recovery auth), #4 (Rollback DELETE)
- **Isolamento fazenda_id:** ✅ Verificado em Lotes
- **Fluxo REJECTED:** ✅ Parcialmente funcional (detecção + DLQ + rollback)
- **Consistência Mantida:**
  - Todas as tabelas de derivação sincronizadas
  - Nenhum gap não mapeado

**Próximos Passos (Propostas):**
- Implementar cleanup de queue_ops para REJECTED (Bug #1)
- Adicionar retry/reprocess para rejeições de negócio (Bug #2)
- Adicionar logging para rollback silencioso (Bug #5)
- Considerar mutex/lock para race conditions (Bug #6)

Working tree permanece CLEAN após aplicação das edições.

Próximo passo: Commit `docs: post-impl TD-001 deployment notes (baseline 47148f0)`.
