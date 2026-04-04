#!/usr/bin/env bash
set -euo pipefail

# Validates derivation consistency using the current Rev D+ docs model.
# Rules:
# - TECH_DEBT OPEN TD set must equal IMPLEMENTATION_STATUS "Gaps consolidados" TD set
# - ROADMAP TD set must equal TECH_DEBT OPEN TD set
# - capability_id sets must also match across IMPLEMENTATION_STATUS, TECH_DEBT OPEN and ROADMAP

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
impl_cap_set="$tmp_dir/impl_caps.txt"
td_set="$tmp_dir/td_open_tds.txt"
td_cap_set="$tmp_dir/td_open_caps.txt"
rm_set="$tmp_dir/rm_tds.txt"
rm_cap_set="$tmp_dir/rm_caps.txt"

# Extract open TDs and capability_ids from IMPLEMENTATION_STATUS.
if rg -n 'Gaps consolidados' "$impl" >/dev/null 2>&1; then
  awk '
    BEGIN{in_section=0}
    /Gaps consolidados/ {in_section=1}
    in_section==1 {print}
  ' "$impl" | rg -o 'TD-[0-9]{3,}' | sort -u > "$impl_set"
else
  rg -o 'TD-[0-9]{3,}' "$impl" | sort -u > "$impl_set"
fi

rg -n '^\| TD-[0-9]{3,} \| `[^`]+` \| .* \| OPEN \|$' "$impl" \
  | sed -E 's/.*\| `([^`]+)` \|.*/\1/' \
  | sort -u > "$impl_cap_set"

# Extract TDs and capability_ids from TECH_DEBT OPEN blocks.
awk '
  BEGIN{in_section=0}
  /^##[[:space:]]+OPEN($|[[:space:](])/ {in_section=1; next}
  in_section==1 && /^##[[:space:]]+/ {exit}
  in_section==1 {print}
' "$td" | rg -o 'TD-[0-9]{3,}' | sort -u > "$td_set"

awk '
  BEGIN{in_section=0}
  /^##[[:space:]]+OPEN($|[[:space:](])/ {in_section=1; next}
  in_section==1 && /^##[[:space:]]+/ {exit}
  in_section==1 {print}
' "$td" | rg -o '\*\*capability_id:\*\*[[:space:]]*`[^`]+`' \
  | sed -E 's/.*`([^`]+)`.*/\1/' \
  | sort -u > "$td_cap_set"

# Extract TDs and capability_ids from ROADMAP derivation table.
rg -o 'TD-[0-9]{3,}' "$rm" | sort -u > "$rm_set"

rg -n '^\| TD-[0-9]{3,} \| `[^`]+` \| ' "$rm" \
  | sed -E 's/.*\| `([^`]+)` \|.*/\1/' \
  | sort -u > "$rm_cap_set"

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

if ! diff_sets "$td_cap_set" "$impl_cap_set" "TECH_DEBT OPEN capability_id set vs IMPLEMENTATION_STATUS"; then
  fail=1
fi

if ! diff_sets "$td_cap_set" "$rm_cap_set" "TECH_DEBT OPEN capability_id set vs ROADMAP"; then
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "OK: derivation validated via TD IDs and capability_id sets."
