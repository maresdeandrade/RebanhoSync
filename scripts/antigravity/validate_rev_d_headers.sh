#!/usr/bin/env bash
set -euo pipefail

# Validates Rev D-style bullet headers and baseline consistency across derived docs.

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

FILES=(
  "docs/IMPLEMENTATION_STATUS.md"
  "docs/TECH_DEBT.md"
  "docs/ROADMAP.md"
  "docs/review/AUDIT_CAPABILITY_MATRIX.md"
  "docs/review/RECONCILIACAO_REPORT.md"
)

fail=0
baseline_seen=""

extract_status() {
  rg -n --max-count 1 '^- Status:\s*(Derivado|Normativo)\s*$' "$1" \
    | sed -E 's/.*- Status:\s*(Derivado|Normativo).*/\1/' || true
}

extract_baseline() {
  rg -n --max-count 1 '^- Baseline:\s*[0-9a-f]{7,40}\s*$' "$1" \
    | sed -E 's/.*- Baseline:\s*([0-9a-f]{7,40}).*/\1/' || true
}

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "FAIL: missing required file: $f" >&2
    fail=1
    continue
  fi

  head_block="$(head -n 40 "$f" || true)"

  if ! printf "%s\n" "$head_block" | rg -q '^- Status:\s*(Derivado|Normativo)\s*$'; then
    echo "FAIL: $f missing/invalid '- Status: Derivado|Normativo' in first 40 lines." >&2
    fail=1
  fi

  if ! printf "%s\n" "$head_block" | rg -q '^- Baseline:\s*[0-9a-f]{7,40}\s*$'; then
    echo "FAIL: $f missing/invalid '- Baseline: <sha>' in first 40 lines." >&2
    fail=1
  fi

  if ! printf "%s\n" "$head_block" | rg -q '^- Última Atualização:\s*\d{4}-\d{2}-\d{2}\s*$'; then
    echo "FAIL: $f missing/invalid '- Última Atualização: YYYY-MM-DD' in first 40 lines." >&2
    fail=1
  fi

  if ! printf "%s\n" "$head_block" | rg -q '^- Derivado por:\s*.+$'; then
    echo "FAIL: $f missing '- Derivado por: ...' in first 40 lines." >&2
    fail=1
  fi

  # Baseline consistency across DERIVADO docs
  status="$(extract_status "$f")"
  b="$(extract_baseline "$f")"

  if [[ "$status" == "Derivado" && -n "$b" ]]; then
    if [[ -z "$baseline_seen" ]]; then
      baseline_seen="$b"
    elif [[ "$baseline_seen" != "$b" ]]; then
      echo "FAIL: baseline mismatch. $f has $b but expected $baseline_seen" >&2
      fail=1
    fi
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "Rev D header validation FAILED." >&2
  exit 1
fi

echo "OK: Rev D headers validated (baseline=${baseline_seen:-n/a})."
