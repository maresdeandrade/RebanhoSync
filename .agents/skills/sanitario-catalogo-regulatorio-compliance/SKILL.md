```markdown
---
name: sanitario-catalogo-regulatorio-compliance
description: Use when a RebanhoSync task touches sanitary regulatory catalog, official rules, state overlays, compliance, feed-ban, suspected clinical cases, notifiable diseases, biosafety, or regulatory/documental checklists.
---

# Sanitário Catálogo Regulatório Compliance

## Mission

Protect the separation between official sanitary regulatory catalog, farm overlay/configuration, compliance, clinical suspicion, biosafety, and operational sanitary execution.

This skill is for regulatory/compliance intelligence, not routine manual sanitary registration.

---

## When to use

Use when task touches:
* Catálogo oficial sanitário;
* Base regulatória oficial;
* Overlay estadual;
* Compliance sanitário;
* Feed-ban;
* Doença notificável;
* Suspeita clínica;
* Checklist documental;
* Biossegurança;
* Alerta regulatório;
* Terapia/protocolo clínico não recorrente;
* Bloqueio regulatório;
* Regulatory read model;
* Farm sanitary configuration.

---

## Do not use when

Do not use when the task is only:
* Manual sanitary event registration;
* Product autocomplete;
* Dose field;
* Stock lot consumption;
* Routine agenda completion;
* UI visual adjustment of a form.

### Use instead:
* `sanitario-registro-operacional` for operational event/agenda/product flows;
* `migrations-rls-contracts` if DB/RLS/RPC is touched;
* `sync-offline-rollback` if offline/sync is touched.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

### Read as needed:
* `docs/domain/SANITARIO.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/SUPABASE_RLS.md` if backend/RLS/RPC is involved;
* Active official/regulatory data files if present;
* Local `AGENTS.md` in affected folders.

---

## Source of truth

In case of conflict, trust:
1. Code + active migrations;
2. Official active regulatory catalog, if present;
3. `docs/context/PROJECT_STATUS.md`;
4. Active normative docs;
5. Derived docs;
6. Archive/history;
7. This skill.

---

## Hard constraints

* Do not mix official regulatory base with farm protocol execution.
* Do not reduce official calendar/rules to only `interval_days`.
* Do not treat regulatory checklist availability as executed sanitary event.
* Do not create event from checklist without real occurrence.
* Do not make compliance warning a universal operational blocker unless explicitly modeled.
* Do not infer carência active/free without explicit technical source.
* Do not infer sale/slaughter readiness.
* Keep regulatory signal separate from operational protocol and event.
* Preserve tenant isolation and auditability.
* Prefer explicit status: `confirmed`, `suspected`, `pending validation`, `blocked`, `not applicable`.

---

## Conceptual separation

* **Official Base:** Represents external/reference rule (disease, notification, rule, document, vaccine/calendar reference, feed-ban reference, biosafety requirement).
* **Farm Overlay/Config:** Represents farm-specific configuration (enabled/disabled, state/region applicability, farm practice, local compliance setting).
* **Operational Protocol:** Represents farm rule/configuration for future tasks.
* **Operational Agenda:** Represents pending/intended task.
* **Event:** Represents real executed occurrence.
* **Compliance Signal/Checklist:** Represents support for decision and documentation, not execution.

---

## Procedure

### 1. Classify regulatory object
Classify as: official catalog, state overlay, farm compliance config, checklist, suspected clinical case, notifiable disease, feed-ban, biosafety, non-recurring clinical protocol, or regulatory read model.

### 2. Check if it creates fact
Ask: is there a real occurrence? Was there execution? Is there evidence? Should it create event? Should it create agenda? Should it only create signal/checklist?  
> **Default:** Checklist/compliance does not create event.

### 3. Check blocking semantics
Classify: informational, warning, requires review, operational block, or regulatory block.  
> **Constraint:** Do not promote warning to block without explicit rule.

### 4. Check source
Verify official source field, version/date, applicability, state/region, farm override, and audit trail.

### 5. Check UI language
Avoid saying: “livre de carência” without source, “apto para abate” without source, “pronto para venda” without source, or “protocolo executado” if only checklist/protocol exists.

---

## Edge cases

Consider:
* Suspected disease without confirmation;
* Notification required but not submitted;
* Checklist available but unchanged;
* Disease rule varies by state;
* Farm overlay disables irrelevant requirement;
* Old regulatory pack vs new pack;
* Feed-ban affects product category but not event history;
* Biosafety occurrence vs routine checklist.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:
```bash
git status --short --untracked-files=all

```

* plus the related tests.

### If DB/RLS/RPC is touched:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

### If UI/domain logic is touched:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

---

## Expected output

Return:

1. **Regulatory/compliance object affected:** [Object identifier]
2. **Source and applicability assessment:** [Context metadata status]
3. **Fact, agenda, signal, or checklist boundary:** [Creation flow check]
4. **Blocking semantics:** [Action constraint level]
5. **Riscos/edge cases:** [List of exception pathways]
6. **Tests required/executed:** [Scenarios covered]
7. **Riscos/pendências:** [Up to 3 points]

---

## Output rules

* Do not convert compliance into event without real occurrence.
* Do not infer carência/venda/abate.
* Separate regulatory rule, farm overlay, operational protocol, agenda, and event.
* Separate confirmed, inferred, and recommendation.

```

```