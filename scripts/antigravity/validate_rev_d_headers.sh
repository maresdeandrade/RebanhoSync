#!/usr/bin/env bash
set -euo pipefail

# Validates derived-doc headers against the current repository format.
# Accepted header forms:
#   > **Status:** ...
#   > **Baseline:** `abcdef0`
#   > **Ultima Atualizacao:** YYYY-MM-DD
#   > **Derivado por:** ...
#
# Legacy review docs may omit "Derivado por", so that field is only required
# for the active derivation chain.

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

CORE_FILES=(
  "docs/IMPLEMENTATION_STATUS.md"
  "docs/TECH_DEBT.md"
  "docs/ROADMAP.md"
  "docs/review/RECONCILIACAO_REPORT.md"
)

AUX_FILES=(
  "docs/review/AUDIT_CAPABILITY_MATRIX.md"
)

header_block() {
  head -n 20 "$1" | tr -d '\r' || true
}

has_status() {
  printf "%s\n" "$1" | rg -q '^>?\s*\*\*Status:\*\*\s*.+$'
}

has_baseline() {
  printf "%s\n" "$1" | rg -q '^>?\s*\*\*Baseline:\*\*\s*`[0-9a-f]{7,40}`$'
}

has_date() {
  printf "%s\n" "$1" | rg -q '^>?\s*\*\*.*Atualiza.*:\*\*\s*[0-9]{4}-[0-9]{2}-[0-9]{2}$'
}

has_derived_by() {
  printf "%s\n" "$1" | rg -q '^>?\s*\*\*Derivado por:\*\*\s*.+$'
}

extract_baseline() {
  tr -d '\r' < "$1" | rg -n --max-count 1 '^>?\s*\*\*Baseline:\*\*\s*`[0-9a-f]{7,40}`$' \
    | sed -E 's/.*`([0-9a-f]{7,40})`.*/\1/' || true
}

collect_changed_core_files() {
  local changed changed_cached
  changed="$(git diff --name-only --diff-filter=ACMRT 2>/dev/null || true)"
  changed_cached="$(git diff --name-only --cached --diff-filter=ACMRT 2>/dev/null || true)"

  printf "%s\n%s\n" "$changed" "$changed_cached" \
    | rg -v '^\s*$' \
    | sort -u \
    | while IFS= read -r file; do
        for managed in "${CORE_FILES[@]}"; do
          [[ "$file" == "$managed" ]] && printf "%s\n" "$file"
        done
      done \
    | sort -u
}

fail=0

for f in "${CORE_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "FAIL: missing required file: $f" >&2
    fail=1
    continue
  fi

  block="$(header_block "$f")"

  has_status "$block" || { echo "FAIL: $f missing Status header." >&2; fail=1; }
  has_baseline "$block" || { echo "FAIL: $f missing Baseline header." >&2; fail=1; }
  has_date "$block" || { echo "FAIL: $f missing Ultima Atualizacao header." >&2; fail=1; }
  has_derived_by "$block" || { echo "FAIL: $f missing Derivado por header." >&2; fail=1; }
done

for f in "${AUX_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  block="$(header_block "$f")"

  has_status "$block" || { echo "FAIL: $f missing Status header." >&2; fail=1; }
  has_baseline "$block" || { echo "FAIL: $f missing Baseline header." >&2; fail=1; }
  has_date "$block" || { echo "FAIL: $f missing Ultima Atualizacao header." >&2; fail=1; }
done

mapfile -t changed_core_files < <(collect_changed_core_files)
if [[ "${#changed_core_files[@]}" -gt 1 ]]; then
  baseline_seen=""
  for f in "${changed_core_files[@]}"; do
    baseline="$(extract_baseline "$f")"
    if [[ -z "$baseline" ]]; then
      echo "FAIL: could not extract baseline from $f" >&2
      fail=1
      continue
    fi
    if [[ -z "$baseline_seen" ]]; then
      baseline_seen="$baseline"
    elif [[ "$baseline_seen" != "$baseline" ]]; then
      echo "FAIL: baseline mismatch among changed derived docs. $f has $baseline but expected $baseline_seen" >&2
      fail=1
    fi
  done
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Rev D header validation FAILED." >&2
  exit 1
fi

if [[ "${#changed_core_files[@]}" -gt 1 ]]; then
  echo "OK: headers validated and changed derived docs share a consistent baseline."
else
  echo "OK: headers validated."
fi
