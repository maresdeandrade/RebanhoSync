#!/usr/bin/env bash
set -euo pipefail

# Validates the exact repository closeout surface authorized for F24.1.
# Staged, unstaged and untracked files are all considered.

readonly ALLOWED=(
  "docs/context/KNOWN_GAPS.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/review/F24_1B_ENVIRONMENT_ISOLATION_TOPOLOGY.md"
  "docs/review/F24_1C_STAGING_PROVISIONING_CONTRACT.md"
  "docs/review/F24_1D_REMOTE_ACL_REHEARSAL.md"
  "docs/review/F24_1_PRODUCTION_MIGRATION_DELTA.md"
  "docs/review/F24_RELEASE_READINESS_BASELINE.md"
  "docs/review/OPEN_REVIEW_ITEMS.md"
  "docs/technical/OFFLINE_SYNC.md"
  "package.json"
  "scripts/README.md"
  "scripts/antigravity/validate_f24_1_scope.sh"
  "scripts/codex/validate-sanitario-reconcile-auth-contract.mjs"
  "scripts/codex/validate-security-definer-exposure.mjs"
  "supabase/functions/sanitario-reconcile/index.test.ts"
  "supabase/functions/sanitario-reconcile/index.ts"
  "supabase/migrations/20260913232253_f24_acl_forward_only_reconciliation.sql"
  "supabase/migrations/20260914014309_f24_1a1_sanitario_reconcile_backend_wrapper.sql"
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

declare -A changed=()

collect_paths() {
  local mode="$1"
  local path_name

  case "$mode" in
    unstaged)
      while IFS= read -r -d '' path_name; do
        changed["$path_name"]=1
      done < <(git diff --name-only --diff-filter=ACDMRTUXB -z --)
      ;;
    staged)
      while IFS= read -r -d '' path_name; do
        changed["$path_name"]=1
      done < <(git diff --cached --name-only --diff-filter=ACDMRTUXB -z --)
      ;;
    untracked)
      while IFS= read -r -d '' path_name; do
        changed["$path_name"]=1
      done < <(git ls-files --others --exclude-standard -z)
      ;;
  esac
}

collect_paths unstaged
collect_paths staged
collect_paths untracked

if [[ "${#changed[@]}" -eq 0 ]]; then
  echo "OK: no file changes detected."
  exit 0
fi

is_allowed() {
  local candidate="$1"
  local allowed
  for allowed in "${ALLOWED[@]}"; do
    [[ "$candidate" == "$allowed" ]] && return 0
  done
  return 1
}

fail=0
mapfile -t ordered_paths < <(printf '%s\n' "${!changed[@]}" | LC_ALL=C sort)
for path_name in "${ordered_paths[@]}"; do
  if ! is_allowed "$path_name"; then
    echo "FAIL: out-of-F24.1-scope change detected: $path_name" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo >&2
  echo "Allowed F24.1 closeout files are:" >&2
  printf '  - %s\n' "${ALLOWED[@]}" >&2
  exit 1
fi

echo "OK: staged, unstaged and untracked changes are within the explicit F24.1 closeout scope."
