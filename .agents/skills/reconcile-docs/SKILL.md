```markdown
---
name: reconcile-docs
description: Use when you need to reconcile RebanhoSync documentation with the real state of code and migrations, updating only the documents truly impacted and avoiding drift.
---

# Reconcile Docs

## Mission

Reconcile RebanhoSync documentation against the real state of code and migrations, updating only truly impacted docs and avoiding drift.

---

## When to use

Use when:
* There was a relevant functional change;
* There is suspected drift between code and docs;
* Documentation references outdated behavior;
* A snapshot, normative doc, derived doc, manual, prompt, or skill needs alignment;
* The user asks for current project-stage analysis based on repo state.

---

## Do not use when

Do not use if the change is only:
* Visual without functional/documentation impact;
* Cleanup/refactor without behavior or architecture impact;
* Isolated wording tweak;
* PR body preparation;
* Technical verification gate.

### Use instead:
* `prepare-pr` for PR narrative;
* `rebanhosync-verification-gate` for final validation;
* `repository-context-retrieval` if the affected docs/code are not clear.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚠️ **Constraint:** Then read only what the task requires.

---

## Context by need

### Project status
* `docs/context/PROJECT_STATUS.md`
* `docs/context/KNOWN_GAPS.md`

### Source of truth / domain contracts
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/domain/TAGS_SIGNALS_CONTRACT.md`

### Technical contracts
* `docs/technical/ARCHITECTURE.md`
* `docs/technical/OFFLINE_SYNC.md`
* `docs/technical/SUPABASE_RLS.md`
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`
* `docs/technical/TESTING_GATES.md`

### Product / roadmap
* `docs/product/CAPABILITY_MATRIX.md`
* `docs/product/MVP_PRIORITIES.md`
* `docs/product/ROADMAP.md`

### Derived docs
Open only if there is real functional delta:
* `docs/IMPLEMENTATION_STATUS.md`
* `docs/TECH_DEBT.md`
* `docs/ROADMAP.md`
* `docs/review/ACTIVE_REVIEW_INDEX.md`

### Archive
> ⚠️ **Constraint:** Do not use `docs/archive/**` as operational truth.  
* Use archive only to preserve replaced documents, compare historical context when explicitly requested, or move superseded docs after extracting active content.

---

## Hard constraints

* Do not use `docs/archive/**` as operational truth.
* Do not update derived docs without real functional delta.
* Do not duplicate contracts already present in `CORE_RULES.md` or `SOURCE_OF_TRUTH.md`.
* Do not rewrite stable docs unnecessarily.
* Do not update docs only to match assumptions.
* If code and docs conflict, trust code + active migrations.
* If docs are obsolete, either update or move to archive after extracting active content.

---

## Source of truth in conflict

1. Code + active migrations.
2. `docs/context/PROJECT_STATUS.md`.
3. Active normative docs.
4. Derived docs.
5. Historical archive.

---

## Procedure

### 1. Identify scope
Register:
* Affected capability or `infra.*` track;
* Changed files/modules;
* Migrations/RPC/RLS involved, if any;
* Tests or validation evidence;
* Docs likely affected.

### 2. Classify doc impact
Classify each affected doc as:
* `snapshot`
* `normative`
* `derived`
* `manual/support`
* `prompt/skill`
* `no doc impact`

### 3. Validate real state
Check only the needed source: code, active migrations, tests, local AGENTS, or relevant docs.  
> ⚠️ **Constraint:** Do not expand to broad repository reading unless justified.

### 4. Measure delta
For each doc, identify:
* What changed;
* What remains valid;
* What is in drift;
* What must not be touched;
* Whether the doc should be updated, split, or archived.

### 5. Update in the correct layer
Update only affected layers:
1. **Normative docs:** If contract/architecture/source-of-truth changed.
2. **Project status:** If current state changed.
3. **Derived docs:** If implementation status/roadmap/debt changed.
4. **Manuals:** If user-facing behavior changed.
5. **Prompts/skills:** If agent behavior changed.

### 6. Archive when needed
Move superseded docs to: `docs/archive/2026-05-ai-context-optimization/`  
Use appropriate subfolder:
* `old-prompts/`
* `old-audits/`
* `old-reviews/`
* `superseded-docs/`

*Note: Do not delete historical material unless explicitly requested.*

### 7. Evaluate ADR need
Suggest ADR only if the change alters:
* Sync contract;
* Ordering/dedup/status codes;
* Canonical data model;
* RLS/RBAC/RPC invariants;
* Offline-first architecture;
* Two Rails;
* Source-of-truth contract;
* Normative rule that will guide future product decisions.

---

## Validation

Follow `.agents/rules/rtk.md`.

### Minimum check:
```bash
git status --short --untracked-files=all

```

### For duplicate invariants:

```bash
rg -n "Agenda = intenção|Evento = fato|state_\\*|Protocolo = regra|Tags, sinais e insights|fonte primária" AGENTS.md docs .agents -g "!docs/archive/**"

```

### For active large markdown files:

```powershell
Get-ChildItem -Recurse -File AGENTS.md,*.md |
  Where-Object { $_.FullName -notmatch "docs\\archive|node_modules" } |
  Select-Object FullName, Length |
  Sort-Object Length -Descending

```

---

## Expected output

Return:

* Iteration summary;
* Documents updated;
* Documents deliberately left unchanged;
* Documents moved to archive;
* Content extracted before archiving;
* Current project phase, if requested;
* Risks/debts/divergences, up to 3;
* ADRs suggested, if any.

---

## Output rules

* Use minimal diff per document.
* Do not rewrite whole files unnecessarily.
* Separate clearly: `snapshot`, `normative`, `derived`, and `archive`.
* Do not claim docs are reconciled without checking real files.

```

```