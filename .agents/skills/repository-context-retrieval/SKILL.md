```markdown
---
name: repository-context-retrieval
description: Use when the correct intervention point is unclear and you need to locate the minimal relevant files, flows, docs, or tests in RebanhoSync without reading the whole repository.
---

# Repository Context Retrieval

## Mission

Find the minimum necessary repository context for a RebanhoSync task without broad reading, unnecessary grep, or loading unrelated docs.

This skill is for discovery only. It should identify where to work, not implement the patch.

---

## When to use

Use when:
* The affected files are not clear;
* The user asks to map a flow or capability;
* There may be cross-module impact;
* Documentation and code may diverge;
* The task needs repository orientation before planning;
* There is risk of touching the wrong layer.

---

## Do not use when

Do not use when:
* The file or module is already known;
* The task is a simple copy/microcopy change;
* The task is a local visual adjustment;
* The patch is already complete and needs verification;
* The goal is PR preparation.

### Use instead:
* `rebanhosync-verification-gate` for final patch validation;
* `prepare-pr` for PR narrative;
* Domain-specific skill if the area is already known.

---

## Read first

1. `AGENTS.md`
2. `.agents/rules/CORE_RULES.md`
3. `.agents/rules/CONTEXT_LOADING.md`
4. `.agents/rules/no-broad-context.md`

> ⚙️ **Execution Rule:** For commands and validation, follow `.agents/rules/rtk.md`.

---

## Hard constraints

* Do not read the whole repository.
* Do not open all docs.
* Do not open all skills.
* Do not use `docs/archive/**` as operational truth.
* Do not propose implementation before locating the correct source.
* Do not treat documentation as stronger than code or active migrations.
* Prefer file-specific search over broad search.

---

## Source of truth

In case of conflict, trust:
1. Code + active migrations;
2. `docs/context/PROJECT_STATUS.md`;
3. Active normative docs;
4. Derived docs;
5. Archive/history;
6. This skill.

---

## Procedure

### 1. Classify the task
Classify as one of:
* UI/local component;
* Domain flow;
* Sync/offline;
* Supabase/RLS/migration;
* Documentation;
* Test/validation;
* Architecture/cross-module.

### 2. Choose the minimal search path
Start from one of:
* File path given by user;
* Feature name;
* Route/screen name;
* Domain term;
* Test name;
* Migration/RPC/function name.

### 3. Inspect only likely targets
Prefer:
* Local `AGENTS.md`;
* Nearby source files;
* Directly related tests;
* Relevant domain doc;
* Relevant technical doc.

> ⚠️ **Constraint:** Do not expand unless needed.

### 4. Identify source-of-truth layer
Determine whether the task relates to:
* **Agenda:** Intenção/future task;
* **Evento:** Executed fact;
* **`state_*`:** Current state/read model;
* **Protocolo:** Rule/configuration;
* **Tags/signals/insights:** Auxiliary UX/query layer;
* **Supabase/RLS/migrations:** Backend contract;
* **Dexie/sync:** Offline contract.

### 5. Report minimal context map
Return likely files, why they matter, docs needed, tests likely affected, risks, and recommended next skill, if any.

---

## Expected output

Return:
1. **Task classification:** [Type of task]
2. **Files or directories to inspect:** [List of paths]
3. **Relevant docs:** [Only if strictly needed]
4. **Tests likely related:** [Associated test files]
5. **Source-of-truth layer involved:** [Domain layer identifier]
6. **Riscos of wrong-context expansion:** [Potential context bloating pitfalls]
7. **Recommended next action:** [Next step or skill to invoke]

---

## Output rules

* Separate confirmed facts, inferences, and recommendations.
* Do not implement patch.
* Do not suggest reading the whole repo.
* Limit risks to 3.

```