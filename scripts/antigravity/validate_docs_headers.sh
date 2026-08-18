#!/usr/bin/env bash
set -euo pipefail

readonly STATUS_DOC="docs/context/PROJECT_STATUS.md"
readonly ROADMAP_DOC="docs/product/ROADMAP.md"
readonly PLAN_DOC="docs/review/ACTIVE_PHASE_PLAN.md"
readonly HANDOFF_DOC="docs/review/CURRENT_PHASE_HANDOFF.md"
readonly FILES=("$STATUS_DOC" "$ROADMAP_DOC" "$PLAN_DOC" "$HANDOFF_DOC")

if [[ "$#" -ne 0 ]]; then
  echo "ERROR: this script does not accept arguments." >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a Git repository." >&2
  exit 2
}
cd "$root"

fail=0
require_header() {
  local file="$1" pattern="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: missing active document: $file" >&2
    fail=1
  elif ! head -n 18 "$file" | tr -d '\r' | rg -q "$pattern"; then
    echo "FAIL: $file missing or invalid $label header." >&2
    fail=1
  fi
}

require_header "$STATUS_DOC" '^# Project Status — RebanhoSync$' "title"
require_header "$ROADMAP_DOC" '^# Roadmap — RebanhoSync$' "title"
require_header "$PLAN_DOC" '^# Plano (ativo|de fechamento) — Fase [0-9]+' "title"
require_header "$HANDOFF_DOC" '^# Handoff atual — Fase [0-9]+' "title"

for file in "${FILES[@]}"; do
  require_header "$file" '^Atualizado em:[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]*$' "updated-date"
done

require_header "$STATUS_DOC" '^Baseline .+: `([0-9a-f]{7,40}|main@[0-9a-f]{7,40})`' "baseline"
require_header "$ROADMAP_DOC" '^Fase atual:[[:space:]]*.+' "current-phase"
require_header "$PLAN_DOC" '^Status:[[:space:]]*.+' "status"
require_header "$PLAN_DOC" '^Próxima fase:[[:space:]]*.+' "next-phase"
require_header "$HANDOFF_DOC" '^Baseline autoritativo de saída .+: `main@[0-9a-f]{7,40}`' "authoritative-baseline"
require_header "$HANDOFF_DOC" '^Status:[[:space:]]*.+' "status"
require_header "$HANDOFF_DOC" '^Próxima fase:[[:space:]]*.+' "next-phase"

while IFS= read -r baseline; do
  if ! git cat-file -e "${baseline}^{commit}" 2>/dev/null; then
    echo "FAIL: documented baseline is not a local Git commit: $baseline" >&2
    fail=1
  fi
done < <(head -n 18 "$STATUS_DOC" "$PLAN_DOC" "$HANDOFF_DOC" \
  | tr -d '\r' \
  | rg -o '(main@)?[0-9a-f]{7,40}' \
  | sed 's/^main@//' \
  | sort -u)

if [[ "$fail" -ne 0 ]]; then
  echo "Active-document header validation FAILED." >&2
  exit 1
fi

echo "OK: active-document headers and documented baselines are valid."
