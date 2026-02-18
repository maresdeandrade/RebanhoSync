#!/usr/bin/env bash
set -euo pipefail

# Orchestrates the Rev D gates for REBANHOSYNC docs + governance.

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

scripts/antigravity/check_clean_tree.sh
scripts/antigravity/validate_rev_d_headers.sh
scripts/antigravity/validate_derivation_td.sh
scripts/antigravity/data_contract_audit.sh

echo "OK: Antigravity gates passed."
