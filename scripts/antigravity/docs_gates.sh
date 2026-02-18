#!/usr/bin/env bash
set -euo pipefail

# docs_gates.sh
# Validate docs + governance.
# Default: allows dirty working tree (for local dev / PR validation).
# --strict: requires clean tree (use before regen).

if [[ "${1:-}" == "--strict" ]]; then
  scripts/antigravity/check_clean_tree.sh
fi

# Changes must be within allowed docs scope (prevents accidental code edits)
scripts/antigravity/validate_scoped_changes.sh

# Headers + baseline consistency
scripts/antigravity/validate_rev_d_headers.sh

# Derivation consistency (choose what you use today)
# TD-based (current)
scripts/antigravity/validate_derivation_td.sh

# capability_id-based (Catalog track) — enable when present in repo
if [[ -f scripts/antigravity/validate_derivation_rev_d.sh ]]; then
  scripts/antigravity/validate_derivation_rev_d.sh
fi

# Contract / governance audit
scripts/antigravity/data_contract_audit.sh

echo "OK: Antigravity gates passed."
