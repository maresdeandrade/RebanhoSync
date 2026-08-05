#!/usr/bin/env bash
set -euo pipefail

# Runs the active documentation/governance gates.
# Default: validates a docs-only reconciliation in the current worktree.
# --strict: additionally requires a fully clean repository.

usage() {
  cat <<'EOF'
Usage: scripts/antigravity/docs_gates.sh [--strict]

Options:
  --strict     Require a completely clean Git working tree first.
  -h, --help  Show this help.
EOF
}

strict=0
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if ! root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "ERROR: not inside a Git repository." >&2
  exit 2
fi
cd "$root"

readonly SCRIPT_DIR="$root/scripts/antigravity"
readonly REQUIRED_SCRIPTS=(
  "check_clean_tree.sh"
  "validate_scoped_changes.sh"
  "validate_rev_d_headers.sh"
  "validate_derivation_td.sh"
  "data_contract_audit.sh"
)

for script_name in "${REQUIRED_SCRIPTS[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$script_name" ]]; then
    echo "ERROR: missing gate script: scripts/antigravity/$script_name" >&2
    exit 2
  fi
done

run_gate() {
  local script_name="$1"
  echo "==> $script_name"
  bash "$SCRIPT_DIR/$script_name"
}

if [[ "$strict" -eq 1 ]]; then
  run_gate check_clean_tree.sh
fi

run_gate validate_scoped_changes.sh
run_gate validate_rev_d_headers.sh
run_gate validate_derivation_td.sh

if [[ -f "$SCRIPT_DIR/validate_derivation_active.sh" ]]; then
  run_gate validate_derivation_active.sh
fi

run_gate data_contract_audit.sh

echo "OK: Antigravity active-document gates passed."
