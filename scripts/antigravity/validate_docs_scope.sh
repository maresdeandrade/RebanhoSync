#!/usr/bin/env bash
set -euo pipefail

# Validates the narrow active-document chain used by a controlled docs
# reconciliation. Staged, unstaged and untracked files are all considered.

readonly ALLOWED=(
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/review/LAST_PHASE_RESULT.md"
  "docs/review/OPEN_REVIEW_ITEMS.md"
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
    echo "FAIL: out-of-docs-scope change detected: $path_name" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo >&2
  echo "Allowed documentation files are:" >&2
  printf '  - %s\n' "${ALLOWED[@]}" >&2
  exit 1
fi

echo "OK: staged, unstaged and untracked changes are within the active docs scope."
