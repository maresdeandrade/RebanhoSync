#!/usr/bin/env bash
set -euo pipefail

# scripts/antigravity/validate_scoped_changes.sh
# Fails if there are changes outside the allowed docs scope.
# Usage:
#   scripts/antigravity/validate_scoped_changes.sh

ALLOWED=(
  "docs/IMPLEMENTATION_STATUS.md"
  "docs/TECH_DEBT.md"
  "docs/ROADMAP.md"
  "docs/review/AUDIT_CAPABILITY_MATRIX.md"
  "docs/review/RECONCILIACAO_REPORT.md"
)

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

changed="$(git diff --name-only --diff-filter=ACMRT 2>/dev/null || true)"
changed_cached="$(git diff --name-only --cached --diff-filter=ACMRT 2>/dev/null || true)"
all_changed="$(printf "%s\n%s\n" "$changed" "$changed_cached" | rg -v '^\s*$' | sort -u || true)"

if [[ -z "$all_changed" ]]; then
  echo "OK: no file changes detected."
  exit 0
fi

fail=0
while IFS= read -r f; do
  ok=0
  for a in "${ALLOWED[@]}"; do
    [[ "$f" == "$a" ]] && ok=1 && break
  done
  if [[ "$ok" -eq 0 ]]; then
    echo "FAIL: out-of-scope change detected: $f" >&2
    fail=1
  fi
done <<< "$all_changed"

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "Allowed files are:" >&2
  printf " - %s\n" "${ALLOWED[@]}" >&2
  exit 1
fi

echo "OK: changes are within allowed scope."
