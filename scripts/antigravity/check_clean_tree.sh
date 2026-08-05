#!/usr/bin/env bash
set -euo pipefail

# Fails when the repository has tracked, staged or (by default) untracked
# changes. Ignored files are never considered.

usage() {
  cat <<'EOF'
Usage: scripts/antigravity/check_clean_tree.sh [--allow-untracked]

Options:
  --allow-untracked  Ignore untracked, non-ignored files.
  -h, --help         Show this help.
EOF
}

allow_untracked=0
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --allow-untracked)
      allow_untracked=1
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

# Refresh cached stat information. A non-zero status may simply mean that a
# tracked file changed; the explicit checks below are authoritative.
git update-index -q --refresh >/dev/null 2>&1 || true

fail=0

if ! git diff --quiet --exit-code --; then
  echo "ERROR: working tree has unstaged tracked changes." >&2
  git --no-pager diff --stat -- >&2 || true
  fail=1
fi

if ! git diff --quiet --exit-code --cached --; then
  echo "ERROR: working tree has staged changes." >&2
  git --no-pager diff --cached --stat -- >&2 || true
  fail=1
fi

if [[ "$allow_untracked" -eq 0 ]]; then
  mapfile -d '' -t untracked < <(git ls-files --others --exclude-standard -z)
  if [[ "${#untracked[@]}" -gt 0 ]]; then
    echo "ERROR: working tree has untracked files." >&2
    printf '  %s\n' "${untracked[@]}" >&2
    fail=1
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

if [[ "$allow_untracked" -eq 1 ]]; then
  echo "OK: tracked working tree is clean; untracked files were ignored."
else
  echo "OK: Git working tree is clean."
fi
