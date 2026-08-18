#!/usr/bin/env bash
set -euo pipefail

readonly STATUS_DOC="docs/context/PROJECT_STATUS.md"
readonly ROADMAP_DOC="docs/product/ROADMAP.md"
readonly PLAN_DOC="docs/review/ACTIVE_PHASE_PLAN.md"
readonly HANDOFF_DOC="docs/review/CURRENT_PHASE_HANDOFF.md"

if [[ "$#" -ne 0 ]]; then
  echo "ERROR: this script does not accept arguments." >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a Git repository." >&2
  exit 2
}
cd "$root"

extract_phase() {
  local file="$1" pattern="$2"
  head -n 24 "$file" \
    | tr -d '\r' \
    | rg --max-count 1 "$pattern" \
    | sed -E 's/.*Fase[[:space:]]+([0-9]+).*/\1/' || true
}

roadmap_phase="$(extract_phase "$ROADMAP_DOC" '^Fase atual:')"
status_phase="$(extract_phase "$STATUS_DOC" '^Próxima fase de desenvolvimento:')"
plan_phase="$(extract_phase "$PLAN_DOC" '^Próxima fase:')"
handoff_phase="$(extract_phase "$HANDOFF_DOC" '^Próxima fase:')"

fail=0
for pair in \
  "$ROADMAP_DOC:$roadmap_phase" \
  "$STATUS_DOC:$status_phase" \
  "$PLAN_DOC:$plan_phase" \
  "$HANDOFF_DOC:$handoff_phase"; do
  file="${pair%%:*}"
  phase="${pair##*:}"
  if [[ -z "$phase" ]]; then
    echo "FAIL: could not extract current/next phase from $file" >&2
    fail=1
  elif [[ -n "$roadmap_phase" && "$phase" != "$roadmap_phase" ]]; then
    echo "FAIL: phase mismatch in $file: expected Fase $roadmap_phase, found Fase $phase" >&2
    fail=1
  fi
done

if ! head -n 18 "$PLAN_DOC" | rg -qi '^Status:.*(encerrada|fechada|ativa|em andamento)'; then
  echo "FAIL: plan status is not explicit." >&2
  fail=1
fi
if ! head -n 18 "$HANDOFF_DOC" | rg -qi '^Status:.*(encerrada|fechada|ativa|em andamento)'; then
  echo "FAIL: handoff status is not explicit." >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Active-document continuity validation FAILED." >&2
  exit 1
fi

echo "OK: active docs agree on the transition to Fase $roadmap_phase."
