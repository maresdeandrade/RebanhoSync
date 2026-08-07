#!/usr/bin/env bash
set -euo pipefail

# Compatibility wrapper. Rev D is no longer an active contract.
root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a Git repository." >&2
  exit 2
}
exec bash "$root/scripts/antigravity/validate_docs_headers.sh" "$@"
