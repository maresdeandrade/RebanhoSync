#!/usr/bin/env bash
set -euo pipefail

# Validates derivation consistency using TD-### as the join key.
# Rules:
# - TECH_DEBT OPEN TD set must equal IMPLEMENTATION_STATUS "Gaps consolidados" TD set
# - ROADMAP TD set must equal TECH_DEBT OPEN TD set
#
# This matches your current editorial format (no capability_id).

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

impl="docs/IMPLEMENTATION_STATUS.md"
td="docs/TECH_DEBT.md"
rm="docs/ROADMAP.md"

for f in "$impl" "$td" "$rm"; do
  [[ -f "$f" ]] || { echo "ERROR: missing required file: $f" >&2; exit 2; }
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

impl_set="$tmp_dir/impl_tds.txt"
td_set="$tmp_dir/td_open_tds.txt"
rm_set="$tmp_dir/rm_tds.txt"

# --- Extract TDs from IMPLEMENTATION_STATUS
# Prefer a section anchored by "Gaps consolidados" if present; else fallback to whole file.
if rg -n 'Gaps consolidados' "$impl" >/dev/null 2>&1; then
  awk '
    BEGIN{in=0}
    /Gaps consolidados/ {in=1}
    in==1 {print}
  ' "$impl" | rg -o 'TD-[0-9]{3,}' | sort -u > "$impl_set"
else
  rg -o 'TD-[0-9]{3,}' "$impl" | sort -u > "$impl_set"
fi

# --- Extract TDs from TECH_DEBT OPEN block
awk '
  BEGIN{in=0}
  /^##[[:space:]]+OPEN\b/ {in=1; next}
  in==1 && /^##[[:space:]]+/ {exit}
  in==1 {print}
' "$td" | rg -o 'TD-[0-9]{3,}' | sort -u > "$td_set"

# --- Extract TDs from ROADMAP
rg -o 'TD-[0-9]{3,}' "$rm" | sort -u > "$rm_set"

fail=0

diff_sets() {
  local a="$1"; local b="$2"; local label="$3"
  local only_a only_b
  only_a="$(comm -23 "$a" "$b" || true)"
  only_b="$(comm -13 "$a" "$b" || true)"
  if [[ -n "$only_a" || -n "$only_b" ]]; then
    echo "FAIL: set mismatch ($label)" >&2
    [[ -n "$only_a" ]] && { echo "Only in A:" >&2; printf "%s\n" "$only_a" >&2; echo "" >&2; }
    [[ -n "$only_b" ]] && { echo "Only in B:" >&2; printf "%s\n" "$only_b" >&2; echo "" >&2; }
    return 1
  fi
  return 0
}

if ! diff_sets "$td_set" "$impl_set" "TECH_DEBT OPEN vs IMPLEMENTATION_STATUS gaps"; then
  fail=1
fi

if ! diff_sets "$td_set" "$rm_set" "TECH_DEBT OPEN vs ROADMAP"; then
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK: derivation validated via TD IDs."
