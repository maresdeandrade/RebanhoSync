---
name: reproducao-parto-posparto-cria
description: Use para parto, pós-parto, criação de cria, vínculo determinístico mãe-evento-cria, fluxo reprodutivo factual ou agenda derivada do nascimento. Não usar para cadastro animal genérico, IATF amplo não implementado, sanitário geral ou ajuste visual/copy.
role: domain
---

# Reprodução Parto Pós-parto Cria

## Mission

Protect RebanhoSync reproductive flows involving birth, post-partum, calf creation, deterministic linking, event integrity, and derived agenda.

---

## When to use

Use when task touches:
* Parto;
* Pós-parto;
* Cria;
* Nascimento;
* Vínculo mãe → cria;
* Reproductive event;
* Agenda da cria;
* Umbigo/D7/D30/desmame;
* Episode linking;
* Event-driven animal creation;
* Cria initial state;
* Reproductive follow-up after birth.

---

## Do not use when

Do not use when:
* Task is generic animal UI with no reproduction;
* Task is generic IATF planning not tied to implemented flow;
* Task is visual/copy only;
* Task is only sanitary agenda unrelated to birth/calf flow.

### Use instead:
* `animal-cadastro-origem-destino` for generic animal registration;
* `sanitario-registro-operacional` for sanitary execution;
* `sync-offline-rollback` if offline/sync is main risk.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

### Read as needed:
* `docs/domain/REPRODUCAO.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/OFFLINE_SYNC.md` if sync/gesture is involved;
* Local `AGENTS.md` in affected folders.

---

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Esta skill não substitui código, migrations ou documentos normativos ativos.

---

## Hard constraints

* **Evento:** Evento reprodutivo is the historical fact.
* **Garantia:** Do not treat agenda as birth history.
* **Integridade:** Do not overwrite manually curated event-driven critical facts without explicit correction flow.
* **Vínculos:** Preserve deterministic linking mãe → parto → cria → pós-parto.
* **Integridade:** Do not create orphan calf records.
* **Idempotência:** Do not create duplicate calf records on retry.
* **Limitação:** Do not infer broad IATF engine unless implemented.
* Preserve offline-first/idempotency.
* Preserve tenant isolation.

---

## Flow contracts

### Parto
Should represent real occurrence: mother, date/time, result, calf/cria data when applicable, responsible user, event link, and farm/tenant.

### Cria
Should be linked deterministically: mother ID, birth event ID, farm ID, initial status, initial taxonomic facts (if applicable), and lote/pasto if explicitly provided or properly derived.

### Pós-parto
Should be linked to mother, birth episode/event, calf when applicable, and follow-up agenda if generated.

### Agenda da cria
Can represent future tasks (umbigo, D7, D30, desmame, or other configured follow-ups), but agenda is never proof of execution.

---

## Procedure

### 1. Classify reproduction action
Classify as: birth event, calf creation, post-partum follow-up, agenda generation, correction, UI display, or read model update.

### 2. Verify linking
Check if mother exists and belongs to farm, calf belongs to same farm, event links are deterministic, duplicate retry cannot create duplicate cria, and post-partum links to correct episode.

### 3. Verify source-of-truth
Check if historical fact is event, current state is `state_*`, future task is agenda, and protocol/config is not execution.

### 4. Verify sync/offline
Check that one user action creates exactly one idempotent gesture, rollback can undo partial creation, retry does not duplicate event/cria/agenda, and failure leaves system reconcilable.

### 5. Verify tests
Cover scenarios: happy path parto + cria, duplicate retry, missing mother, calf already linked, rollback/partial failure, agenda creation after birth, and ensure no agenda-as-history behavior.

---

## Validation

Seguir `.agents/rules/rtk.md`, com `rtk` opcional. Definir a validação pelo escopo e risco efetivamente afetados, não pela simples menção a Evento ou sync.

Verificações locais mínimas:
```bash
git status --short --untracked-files=all
git diff --check
```

| Escopo observado | Validação |
|---|---|
| Mudança localizada, sem alteração de contrato compartilhado | Testes focados do fluxo reprodutivo e verificações locais pertinentes. |
| Mudança em writers, vínculos ou interfaces compartilhadas | Testes das áreas e consumidores impactados; lint/build conforme o risco e `rtk.md`. |
| Mudança ampla ou crítica | Ampliar a validação com justificativa pelo contrato afetado; domínio crítico exige testes focados, lint e build conforme `rtk.md`. Suíte global/E2E somente quando escopo, risco e autorização justificarem. |

Preservar cobertura pertinente de vínculo mãe–parto–cria, isolamento, idempotência, retry, rollback e falha parcial. Tocar criação de Evento ou sync não exige suíte completa automaticamente.

Quando o contrato remoto Supabase/RLS/RPC/migration/sync-batch for afetado, executar a validação funcional de baseline pertinente, conforme `rtk.md`:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Registrar comandos, resultados observados e validações não executadas com motivo. Não declarar validação sem evidência.

---

## Expected output

Return:

1. **Reproduction flow affected:** [Flow identifier]
2. **Source-of-truth assessment:** [Invariants status]
3. **Linking assessment:** [Mother-calf deterministic mapping check]
4. **Duplicate / idempotency risk:** [Retry safety status]
5. **Agenda / event separation check:** [Contracts separation verification]
6. **Tests required/executed:** [Scenarios covered]
7. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not infer broad IATF support.
* Do not treat agenda as execution.
* Do not allow orphan cria.
* Separate confirmed behavior, inference, and recommendation.
