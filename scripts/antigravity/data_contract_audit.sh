#!/usr/bin/env bash
set -euo pipefail

# Lightweight audit for the governance data contract used by Antigravity.
# Keeps the active document chain coherent and prevents archived material from
# drifting back into the live process.

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

REQUIRED_FILES=(
  "docs/ARCHITECTURE.md"
  "docs/OFFLINE.md"
  "docs/CONTRACTS.md"
  "docs/DB.md"
  "docs/RLS.md"
  "docs/E2E_MVP.md"
  "docs/PROCESS.md"
  "docs/IMPLEMENTATION_STATUS.md"
  "docs/TECH_DEBT.md"
  "docs/ROADMAP.md"
  "docs/review/AUDIT_CAPABILITY_MATRIX.md"
  "docs/review/RECONCILIACAO_REPORT.md"
)

fail=0

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "FAIL: missing required governance file: $f" >&2
    fail=1
  fi
done

if ! rg -q 'IMPLEMENTATION_STATUS\.md.*TECH_DEBT\.md.*ROADMAP\.md.*RECONCILIACAO_REPORT\.md' docs/PROCESS.md; then
  echo "FAIL: docs/PROCESS.md does not declare the active derivation chain." >&2
  fail=1
fi

if ! rg -q 'docs/archive/' docs/README.md docs/PROCESS.md docs/REPO_MAP.md; then
  echo "FAIL: archive separation is not documented in the active docs." >&2
  fail=1
fi

if rg -n 'docs/analysis/|docs/performance/' docs/README.md docs/PROCESS.md docs/REPO_MAP.md >/dev/null 2>&1; then
  echo "FAIL: active governance docs/scripts still reference pre-archive paths docs/analysis/ or docs/performance/." >&2
  rg -n 'docs/analysis/|docs/performance/' docs/README.md docs/PROCESS.md docs/REPO_MAP.md >&2 || true
  fail=1
fi

if ! rg -q 'capability_id' docs/IMPLEMENTATION_STATUS.md docs/TECH_DEBT.md docs/ROADMAP.md docs/review/RECONCILIACAO_REPORT.md; then
  echo "FAIL: one or more derived governance docs are missing capability_id references." >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Data contract audit FAILED." >&2
  exit 1
fi

echo "OK: governance data contract audit passed."
