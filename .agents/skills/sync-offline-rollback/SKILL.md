---
name: sync-offline-rollback
description: Usar quando a tarefa afetar concretamente persistência local/Dexie, gestures, fila, retry, replay, rollback, reconciliação, sucesso parcial ou conflito local-remoto do RebanhoSync. Não usar por simples menção a offline/sync, para mudanças visuais sem persistência ou RLS exclusivamente remoto.
role: engineering
---

# Sync Offline Rollback

## Mission

Protect RebanhoSync offline-first behavior, sync integrity, idempotency, rollback, and local-remote reconciliation.

---

## When to use

Use when task touches:
* Dexie/IndexedDB;
* Local state persistence;
* Sync queue;
* Gestures;
* Optimistic operation;
* Rollback;
* Retry;
* Reconcile;
* Partial success;
* Sync-batch;
* Conflict local/remoto;
* Metadata de sync;
* Table maps;
* Before snapshots.

---

## Do not use when

Do not use when:
* Task is visual only;
* No persistence or sync is involved;
* Task is documentation-only;
* Task is pure UI state without offline impact;
* Issue is only Supabase/RLS without local sync.

### Use instead:
* `migrations-rls-contracts` for DB/RLS/RPC contract;
* `harden-module` for responsibility separation;
* `rebanhosync-verification-gate` after patch.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`
5. `.agents/rules/rtk.md`

### Then read as needed:
* `docs/technical/OFFLINE_SYNC.md`
* `docs/technical/ARCHITECTURE.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* Local `AGENTS.md` in affected paths.

---

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Esta skill não substitui contratos ativos de sync ou domínio.

---

## Hard constraints

* Preserve offline-first.
* Preserve idempotency.
* Preserve rollback determinism.
* Preserve before snapshots when required.
* Preserve `fazenda_id` isolation.
* Preserve sync metadata.
* Do not create duplicate local/remote truth.
* Do not treat agenda as historical fact.
* Do not silently drop failed operations.
* Do not mask partial success.
* Do not bypass RLS through sync.
* Do not alter migrations/RLS/RPC unless explicit.

---

## Domain invariants

* **Agenda:** Intention/future task.
* **Evento:** Executed fact.
* **Agenda closure:** Administrative state of the intention.
* **`state_*`:** Current state/read model.
* **Protocolo:** Rule/configuration.
* **Tags/signals/insights:** Auxiliary only.

## Contratos específicos de domínio

Não duplicar nesta skill contratos detalhados de Sanitário, Reprodução, Movimento ou Cadastro. Quando o fluxo de domínio for o risco dominante, usar a skill de domínio como principal e esta como única skill de apoio; quando sync for o risco dominante, inverter os papéis. Carregar o documento normativo específico somente para os invariantes realmente afetados.

---

## Procedure

### 1. Identify operation type
Classify:
* Create gesture;
* Update local state;
* Enqueue;
* Push;
* Pull;
* Reconcile;
* Rollback;
* Retry;
* Sync-batch server handling;
* Conflict resolution.

### 2. Verify idempotency
Check:
* Operation ID;
* Dedup key;
* Retry safety;
* Repeated sync behavior;
* Partial success behavior;
* Duplicate event/agenda prevention.

### 3. Verify rollback
Check:
* Before snapshot;
* Affected tables;
* Rollback order;
* Rollback after partial failure;
* Cleanup of queue state;
* User-visible state after failure.

### 4. Verify local-remote boundary
Check:
* Local write source;
* Remote payload;
* Server validation;
* RLS constraints;
* Tenant/fazenda boundary;
* Mapping between local and remote tables.

### 5. Verify source-of-truth semantics
Check that:
* Agenda remains intention;
* Event remains fact;
* `state_*` remains read model;
* Protocol remains rule;
* No UI-only state becomes truth.

### 6. Test edge cases
Consider:
* Offline operation then reconnect;
* Duplicate retry;
* Partial server acceptance;
* Forbidden tenant;
* Stale local state;
* Deleted/archived entity;
* Conflict between local and remote update;
* Rollback after failed sync.

---

## Validation

Seguir `.agents/rules/rtk.md`, com `rtk` opcional. Selecionar checks pelo contrato e pelas camadas efetivamente alteradas.

Verificações locais mínimas:
```bash
git status --short --untracked-files=all
git diff --check
```

| Escopo observado | Validação |
|---|---|
| Operação local delimitada, sem mudança de contrato compartilhado | Testes focados da operação e de seus caminhos de falha; verificações locais pertinentes. |
| Fila, mapeamento, payload, retry ou reconcile compartilhado entre fluxos | Testes das áreas e consumidores impactados; lint/build conforme risco e `rtk.md`. |
| Contrato crítico ou alteração ampla entre camadas local/remota | Validação ampliada justificada pelos contratos afetados; domínio crítico exige testes focados, lint e build conforme `rtk.md`. Suíte global/E2E somente quando escopo, risco e autorização justificarem. |

Nos caminhos afetados, preservar testes de idempotência, concorrência, duplicidade/replay, crash/restart, reconnect, farm-switch com operações pendentes, falha parcial, auth expirada e compatibilidade local-remota. Registrar o motivo quando um cenário não se aplicar; a redução de escopo não permite omitir risco pertinente.

Quando o contrato remoto Supabase/RLS/RPC/migration/sync-batch for afetado, executar a validação funcional de baseline pertinente, conforme `rtk.md`:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Registrar comandos, resultados observados e validações não executadas com motivo. Não declarar validação sem evidência.

---

## Expected output

Return:

1. **Operation type:** [Classification]
2. **Affected local and remote layers:** [Layers map]
3. **Idempotency assessment:** [Safety status]
4. **Rollback assessment:** [Determinism status]
5. **Source-of-truth assessment:** [Invariants status]
6. **Edge cases:** [List of critical pathways]
7. **Tests required/executed:** [Scenarios and results]
8. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Separate confirmed facts, inferences, and recommendations.
* Do not approve sync change without idempotency assessment.
* Do not approve rollback change without failure-path test plan.
