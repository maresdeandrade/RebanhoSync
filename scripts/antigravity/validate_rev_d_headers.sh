#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint retained by package.json. It validates the headers
# of the current active-document chain; it no longer depends on legacy Rev D
# TECH_DEBT/IMPLEMENTATION_STATUS documents.

readonly STATUS_DOC="docs/context/PROJECT_STATUS.md"
readonly ROADMAP_DOC="docs/product/ROADMAP.md"
readonly PLAN_DOC="docs/review/ACTIVE_PHASE_PLAN.md"
readonly HANDOFF_DOC="docs/review/CURRENT_PHASE_HANDOFF.md"
readonly FILES=("$STATUS_DOC" "$ROADMAP_DOC" "$PLAN_DOC" "$HANDOFF_DOC")

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

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: missing required active document: $file" >&2
    fail=1
    return 1
  fi
}

require_header() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! head -n 15 "$file" | tr -d '\r' | rg -q "$pattern"; then
    echo "FAIL: $file missing or invalid $label header." >&2
    fail=1
  fi
}

extract_baseline() {
  head -n 15 "$1" \
    | tr -d '\r' \
    | rg --max-count 1 '^(>\s*)?(\*\*)?Baseline( funcional atual)?:(\*\*)?\s*`[0-9a-f]{7,40}`\s*$' \
    | sed -E 's/.*`([0-9a-f]{7,40})`.*/\1/' || true
}

for file in "${FILES[@]}"; do
  require_file "$file" || true
done

if [[ "$fail" -eq 0 ]]; then
  require_header "$STATUS_DOC" '^# Project Status — RebanhoSync$' "title"
  require_header "$ROADMAP_DOC" '^# Roadmap — RebanhoSync$' "title"
  require_header "$PLAN_DOC" '^# Plano ativo — Fase [0-9]+' "title"
  require_header "$HANDOFF_DOC" '^# Handoff atual — Fase [0-9]+' "title"

  for file in "${FILES[@]}"; do
    require_header "$file" '^(>\s*)?(\*\*)?Atualizado em:(\*\*)?\s*[0-9]{4}-[0-9]{2}-[0-9]{2}\s*$' "updated-date"
  done

  require_header "$STATUS_DOC" '^(>\s*)?(\*\*)?Baseline funcional atual:(\*\*)?\s*`[0-9a-f]{7,40}`\s*$' "functional-baseline"
  require_header "$HANDOFF_DOC" '^(>\s*)?(\*\*)?Baseline funcional atual:(\*\*)?\s*`[0-9a-f]{7,40}`\s*$' "functional-baseline"
  require_header "$ROADMAP_DOC" '^(>\s*)?(\*\*)?Fase atual:(\*\*)?\s*.+' "current-phase"
  require_header "$PLAN_DOC" '^(>\s*)?(\*\*)?Status:(\*\*)?\s*.+' "status"
  require_header "$HANDOFF_DOC" '^(>\s*)?(\*\*)?Status:(\*\*)?\s*.+' "status"

  status_baseline="$(extract_baseline "$STATUS_DOC")"
  handoff_baseline="$(extract_baseline "$HANDOFF_DOC")"
  if [[ -n "$status_baseline" && -n "$handoff_baseline" && "$status_baseline" != "$handoff_baseline" ]]; then
    echo "FAIL: functional baseline mismatch: $STATUS_DOC=$status_baseline, $HANDOFF_DOC=$handoff_baseline" >&2
    fail=1
  fi

  for baseline in "$status_baseline" "$handoff_baseline"; do
    if [[ -n "$baseline" ]] && ! git cat-file -e "${baseline}^{commit}" 2>/dev/null; then
      if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null || echo false)" == "true" ]]; then
        echo "WARN: baseline commit is unavailable in this shallow clone: $baseline" >&2
      else
        echo "FAIL: documented baseline is not a local Git commit: $baseline" >&2
        fail=1
      fi
    fi
  done
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Active-document header validation FAILED." >&2
  exit 1
fi

echo "OK: active-document headers and functional baselines are valid."
