#!/usr/bin/env bash
set -euo pipefail

# Runs the explicit active-document gates.
# Scope and clean-tree checks are opt-in because they inspect the whole worktree.

usage() {
  cat <<'EOF'
Usage: scripts/antigravity/docs_gates.sh [--strict] [--check-scope]

Options:
  --strict     Require a completely clean Git working tree first.
  --check-scope  Require all changes to stay in the active docs allowlist.
  -h, --help  Show this help.
EOF
}

strict=0
check_scope=0
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=1
      ;;
    --check-scope)
      check_scope=1
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
  "validate_docs_scope.sh"
  "validate_docs_headers.sh"
  "validate_docs_continuity.sh"
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

if [[ "$check_scope" -eq 1 ]]; then
  run_gate validate_docs_scope.sh
fi
run_gate validate_docs_headers.sh
run_gate validate_docs_continuity.sh
run_gate data_contract_audit.sh

echo "OK: Antigravity active-document gates passed."
