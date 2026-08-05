#!/usr/bin/env bash
set -euo pipefail

# Lightweight audit for the current RebanhoSync governance contract. Archived
# documents are deliberately excluded from the operational chain.

readonly REQUIRED_FILES=(
  "README.md"
  "AGENTS.md"
  ".agents/rules/CORE_RULES.md"
  ".agents/rules/CONTEXT_LOADING.md"
  ".agents/rules/no-broad-context.md"
  ".agents/rules/rtk.md"
  ".agents/skills/README.md"
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/context/SOURCE_OF_TRUTH.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/technical/ARCHITECTURE.md"
  "docs/technical/OFFLINE_SYNC.md"
  "docs/technical/SUPABASE_RLS.md"
  "docs/technical/TESTING_GATES.md"
  "docs/domain/SANITARIO.md"
)

readonly ACTIVE_CONTROL_FILES=(
  "README.md"
  "AGENTS.md"
  ".agents/rules"
  ".agents/skills/README.md"
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/context/SOURCE_OF_TRUTH.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/technical/README.md"
  "docs/technical/ARCHITECTURE.md"
  "docs/technical/OFFLINE_SYNC.md"
  "docs/technical/SUPABASE_RLS.md"
  "docs/technical/TESTING_GATES.md"
  "docs/domain/README.md"
  "docs/domain/SANITARIO.md"
)

if [[ "$#" -ne 0 ]]; then
  echo "ERROR: this script does not accept arguments." >&2
  exit 2
fi

if ! root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: not inside a Git repository." >&2
  exit 2
fi
cd "$root"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

fail=0
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "FAIL: missing required active file: $file" >&2
    fail=1
  fi
done

if [[ "$fail" -eq 0 ]]; then
  if ! rg -q 'context/PROJECT_STATUS\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link PROJECT_STATUS.md." >&2
    fail=1
  fi

  if ! rg -q 'product/ROADMAP\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link the active ROADMAP.md." >&2
    fail=1
  fi

  if ! rg -q 'review/ACTIVE_PHASE_PLAN\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link ACTIVE_PHASE_PLAN.md." >&2
    fail=1
  fi

  if ! rg -q 'review/CURRENT_PHASE_HANDOFF\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link CURRENT_PHASE_HANDOFF.md." >&2
    fail=1
  fi

  for term in 'Agenda' 'Evento' 'state_\*' 'Protocolo'; do
    if ! rg -q "$term" docs/context/SOURCE_OF_TRUTH.md .agents/rules/CORE_RULES.md; then
      echo "FAIL: source-of-truth contract missing term: $term" >&2
      fail=1
    fi
  done

  if ! rg -q 'docs/archive/' docs/README.md AGENTS.md .agents/rules/CORE_RULES.md; then
    echo "FAIL: archive separation is not documented in active governance files." >&2
    fail=1
  fi

  readonly LEGACY_PATH_PATTERN='docs/(ARCHITECTURE|OFFLINE|CONTRACTS|RLS|E2E_MVP|PROCESS|IMPLEMENTATION_STATUS|TECH_DEBT)\.md'
  if rg -n "$LEGACY_PATH_PATTERN" "${ACTIVE_CONTROL_FILES[@]}" >/dev/null 2>&1; then
    echo "FAIL: active governance still references a deprecated root-level docs path." >&2
    rg -n "$LEGACY_PATH_PATTERN" "${ACTIVE_CONTROL_FILES[@]}" >&2 || true
    fail=1
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Active data-contract audit FAILED." >&2
  exit 1
fi

echo "OK: active governance data contract is coherent."
