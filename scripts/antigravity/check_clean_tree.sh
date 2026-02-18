#!/usr/bin/env bash
set -euo pipefail

# scripts/antigravity/check_clean_tree.sh
# Fails if the git working tree is dirty (tracked changes, staged changes, or untracked files).
# Usage:
#   scripts/antigravity/check_clean_tree.sh
#   scripts/antigravity/check_clean_tree.sh --allow-untracked   # ignore untracked files

ALLOW_UNTRACKED=0
if [[ "${1:-}" == "--allow-untracked" ]]; then
  ALLOW_UNTRACKED=1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not inside a git repository." >&2
  exit 2
fi

# Refresh index to avoid false positives.
git update-index -q --refresh || true

# Check staged/unstaged tracked changes
if ! git diff --quiet --exit-code; then
  echo "ERROR: Working tree has unstaged tracked changes." >&2
  git --no-pager diff --stat >&2 || true
  exit 1
fi

if ! git diff --quiet --exit-code --cached; then
  echo "ERROR: Working tree has staged changes." >&2
  git --no-pager diff --cached --stat >&2 || true
  exit 1
fi

if [[ "$ALLOW_UNTRACKED" -eq 0 ]]; then
  # Check untracked files (excluding ignored)
  if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    echo "ERROR: Working tree has untracked files." >&2
    git ls-files --others --exclude-standard >&2
    echo "" >&2
    echo "Tip: add files to git, or rerun with --allow-untracked if intentional." >&2
    exit 1
  fi
fi

echo "OK: git working tree is clean."
