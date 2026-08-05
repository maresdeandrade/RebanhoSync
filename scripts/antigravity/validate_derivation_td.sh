#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint retained by package.json. Validates consistency of
# the current continuity chain instead of the archived Rev D TD model.

readonly FILES=(
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
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

for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: missing required active document: $file" >&2
    exit 2
  fi
done

normalize_value() {
  sed -E \
    -e 's/^[-*[:space:]]*//' \
    -e 's/^(Próximo incremento( oficial)?|Próximo desenvolvimento):[[:space:]]*//' \
    -e 's/\*\*//g' \
    -e 's/`//g' \
    -e 's/[.;:][[:space:]]*$//' \
    -e 's/[[:space:]]+$//' \
    | tr -s ' '
}

extract_next_increment() {
  local file="$1"
  local line
  line="$(rg --max-count 1 '^(Próximo incremento( oficial)?|[-*][[:space:]]*Próximo incremento):' "$file" || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  printf '%s\n' "$line" | normalize_value
}

reference=""
fail=0
for file in "${FILES[@]}"; do
  value="$(extract_next_increment "$file" || true)"
  if [[ -z "$value" ]]; then
    echo "FAIL: could not extract the next increment from $file" >&2
    fail=1
    continue
  fi

  if [[ -z "$reference" ]]; then
    reference="$value"
  elif [[ "$value" != "$reference" ]]; then
    echo "FAIL: next-increment mismatch in $file" >&2
    echo "  expected: $reference" >&2
    echo "  found:    $value" >&2
    fail=1
  fi
done

for file in "${FILES[@]:1}"; do
  if ! rg -qi 'Fase[[:space:]]+[0-9]+[^\n]*(ativa|em andamento)|Status:[^\n]*(ativa|em andamento)' "$file"; then
    echo "FAIL: active phase is not stated explicitly in $file" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "Active-document derivation validation FAILED." >&2
  exit 1
fi

echo "OK: active docs agree on phase state and next increment: $reference"
