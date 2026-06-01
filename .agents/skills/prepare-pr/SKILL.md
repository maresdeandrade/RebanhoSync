```markdown
---
name: prepare-pr
description: Use after a RebanhoSync patch has passed verification gate to prepare a concise pull request title, body, scope summary, validation section, and risk statement.
---

# Prepare PR

## Mission

Prepare a clear PR narrative for a completed and verified RebanhoSync patch.

This skill should consume the result of `rebanhosync-verification-gate`.

---

## When to use

Use when:
* Patch is complete;
* Verification gate classified it as READY or READY WITH CAVEAT;
* User wants PR title/body;
* User wants final delivery summary;
* A formal review handoff is needed.

---

## Do not use when

Do not use when:
* The patch has not been verified;
* Tests are failing without explanation;
* The scope is unclear;
* Implementation is still ongoing;
* User needs architectural diagnosis, not PR narrative.

### Use instead:
* `rebanhosync-verification-gate` before this skill;
* `repository-context-retrieval` if files are unclear;
* Domain skill if more implementation is needed.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/RESPONSE_FORMATS.md`
4. `.agents/rules/rtk.md`
5. Result from `rebanhosync-verification-gate`

> ⚠️ **Constraint:** Read additional context only if the gate identifies a domain-specific caveat.

---

## Hard constraints

* Do not invent tests.
* Do not claim validations that were not executed.
* Do not hide caveats.
* Do not expand the technical scope.
* Do not rewrite documentation in this step.
* Do not open broad docs unless the gate indicates documentation risk.

---

## PR title rules

Title should be short, action-oriented, scoped, and not overloaded.

### Examples:
* `docs: reorganiza regras de contexto dos agentes`
* `fix: corrige validação de agenda sanitária`
* `refactor: isola montagem de payload sanitário`
* `ui: simplifica painel operacional da Home`

---

## PR body structure

Use this structure:

### Summary
* What changed.
* Why it changed.

### Files changed
* Main files or areas.
* Mention generated/archived files if relevant.

### Domain impact
Explicitly state whether the patch affects:
* Agenda;
* Eventos;
* `state_*`;
* Protocolos;
* Tags/signals/insights;
* Supabase/RLS;
* Sync/offline;
* Migrations.

### Validation
List exactly what was executed:
* Command;
* Result;
* Caveat, if any.

### Scope confirmed
State what was not changed:
* No migrations/RLS/RPC, if true;
* No product code, if true;
* No UI/domain behavior, if true;
* No sync/offline impact, if true.

### Risks / caveats
* Up to 3.

---

## Expected output

Return:
1. **PR title:** [Formated string]
2. **PR body:** [Structured markdown text]
3. **Optional review notes:** [Technical warnings or remarks]
4. **Optional follow-up checklist:** [Immediate post-merge items]

---

## Output rules

* Be concise.
* Do not overstate impact.
* Do not say “all tests passed” without evidence.
* Keep risk section limited to real caveats.

```