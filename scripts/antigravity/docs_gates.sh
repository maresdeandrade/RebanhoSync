#!/usr/bin/env bash
set -euo pipefail

# Validate documentation and governance consistency.
# Default: allows dirty working tree (for local dev / PR validation).
# --strict: requires clean tree (use before a controlled docs regen).

if [[ "${1:-}" == "--strict" ]]; then
  scripts/antigravity/check_clean_tree.sh
fi

# Changes must be within the allowed docs scope for docs-only regens.
scripts/antigravity/validate_scoped_changes.sh

# Header shape and baseline checks for the active derivation chain.
scripts/antigravity/validate_rev_d_headers.sh

# Derivation consistency for the current TD + capability_id model.
scripts/antigravity/validate_derivation_td.sh

# Optional stricter validator, if the repo adds a dedicated script later.
if [[ -f scripts/antigravity/validate_derivation_rev_d.sh ]]; then
  scripts/antigravity/validate_derivation_rev_d.sh
fi

# Contract / governance audit.
scripts/antigravity/data_contract_audit.sh

echo "OK: Antigravity gates passed."
