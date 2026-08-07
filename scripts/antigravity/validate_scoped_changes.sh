#!/usr/bin/env bash
set -euo pipefail

# Compatibility wrapper. New consumers must use validate_docs_scope.sh.
root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a Git repository." >&2
  exit 2
}
exec bash "$root/scripts/antigravity/validate_docs_scope.sh" "$@"
