#!/usr/bin/env bash
set -euo pipefail

# Lightweight audit for the current RebanhoSync governance contract. Archived
# documents are deliberately excluded from the operational chain.

readonly REQUIRED_FILES=(
  "README.md"
  "AGENTS.md"
  ".agents/rules/CORE_RULES.md"
  ".agents/rules/CONTEXT_LOADING.md"
  ".agents/rules/no-broad-context.md"
  ".agents/rules/rtk.md"
  ".agents/rules/GRAPHIFY_USAGE.md"
  ".agents/rules/RESPONSE_FORMATS.md"
  ".agents/skills/README.md"
  ".agents/prompts/README.md"
  "scripts/README.md"
  "scripts/codex/README.md"
  "scripts/codex/bootstrap.ps1"
  "scripts/codex/validate.ps1"
  "scripts/antigravity/docs_gates.sh"
  "scripts/antigravity/validate_docs_scope.sh"
  "scripts/antigravity/validate_docs_headers.sh"
  "scripts/antigravity/validate_docs_continuity.sh"
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/context/SOURCE_OF_TRUTH.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/technical/ARCHITECTURE.md"
  "docs/technical/OFFLINE_SYNC.md"
  "docs/technical/SUPABASE_RLS.md"
  "docs/technical/TESTING_GATES.md"
  "docs/domain/SANITARIO.md"
)

readonly ACTIVE_CONTROL_FILES=(
  "README.md"
  "AGENTS.md"
  ".agents/rules"
  ".agents/skills"
  ".agents/prompts"
  "docs/README.md"
  "docs/context/PROJECT_STATUS.md"
  "docs/context/SOURCE_OF_TRUTH.md"
  "docs/product/ROADMAP.md"
  "docs/review/ACTIVE_PHASE_PLAN.md"
  "docs/review/CURRENT_PHASE_HANDOFF.md"
  "docs/technical/README.md"
  "docs/technical/ARCHITECTURE.md"
  "docs/technical/OFFLINE_SYNC.md"
  "docs/technical/SUPABASE_RLS.md"
  "docs/technical/TESTING_GATES.md"
  "docs/domain/README.md"
  "docs/domain/SANITARIO.md"
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

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required." >&2
  exit 2
fi

fail=0
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "FAIL: missing required active file: $file" >&2
    fail=1
  fi
done

if [[ "$fail" -eq 0 ]]; then
  if ! rg -q 'context/PROJECT_STATUS\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link PROJECT_STATUS.md." >&2
    fail=1
  fi

  if ! rg -q 'product/ROADMAP\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link the active ROADMAP.md." >&2
    fail=1
  fi

  if ! rg -q 'review/ACTIVE_PHASE_PLAN\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link ACTIVE_PHASE_PLAN.md." >&2
    fail=1
  fi

  if ! rg -q 'review/CURRENT_PHASE_HANDOFF\.md' docs/README.md README.md; then
    echo "FAIL: documentation indexes do not link CURRENT_PHASE_HANDOFF.md." >&2
    fail=1
  fi

  for term in 'Agenda' 'Evento' 'state_\*' 'Protocolo'; do
    if ! rg -q "$term" docs/context/SOURCE_OF_TRUTH.md .agents/rules/CORE_RULES.md; then
      echo "FAIL: source-of-truth contract missing term: $term" >&2
      fail=1
    fi
  done

  if ! rg -q 'docs/archive/' docs/README.md AGENTS.md .agents/rules/CORE_RULES.md; then
    echo "FAIL: archive separation is not documented in active governance files." >&2
    fail=1
  fi

  for agents_contract in \
    'única autoridade interna de roteamento' \
    'no máximo uma skill de apoio' \
    'Não imprimir, persistir nem incorporar credenciais' \
    'validate\.ps1.*perfil explícito' \
    'audit:agents' \
    'gates:docs' \
    '\.agents/archive/\*\*'; do
    if ! rg -q "$agents_contract" AGENTS.md; then
      echo "FAIL: AGENTS.md missing dispatcher contract: $agents_contract" >&2
      fail=1
    fi
  done

  if rg -n --pcre2 'powershell[^\r\n]*validate\.ps1(?![^\r\n]*-Profile)' \
    AGENTS.md .agents scripts docs/technical src/lib/sanitario/AGENTS.md src/lib/insights/README.md \
    --glob '*.md' --glob '!**/archive/**' --glob '!**/_archive/**' >/dev/null; then
    echo "FAIL: active documentation invokes validate.ps1 without an explicit profile." >&2
    rg -n --pcre2 'powershell[^\r\n]*validate\.ps1(?![^\r\n]*-Profile)' \
      AGENTS.md .agents scripts docs/technical src/lib/sanitario/AGENTS.md src/lib/insights/README.md \
      --glob '*.md' --glob '!**/archive/**' --glob '!**/_archive/**' >&2 || true
    fail=1
  fi

  readonly LEGACY_PATH_PATTERN='docs/(ARCHITECTURE|OFFLINE|CONTRACTS|RLS|E2E_MVP|PROCESS|IMPLEMENTATION_STATUS|TECH_DEBT)\.md'
  if rg -n "$LEGACY_PATH_PATTERN" "${ACTIVE_CONTROL_FILES[@]}" >/dev/null 2>&1; then
    echo "FAIL: active governance still references a deprecated root-level docs path." >&2
    rg -n "$LEGACY_PATH_PATTERN" "${ACTIVE_CONTROL_FILES[@]}" >&2 || true
    fail=1
  fi

  if find .agents/skills -type d \( -name _archive -o -name archive \) -print -quit | grep -q .; then
    echo "FAIL: archived skill directory remains under active discovery root .agents/skills." >&2
    fail=1
  fi

  if rg -n 'supabase[[:space:]]+db[[:space:]]+reset' scripts --glob '!README.md' >/dev/null; then
    echo "FAIL: operational script still references destructive Supabase reset." >&2
    fail=1
  fi
  if rg -n 'validate_derivation_active\.sh|if[[:space:]]+\[\[[[:space:]]+-f.*SCRIPT_DIR' scripts/antigravity/docs_gates.sh >/dev/null; then
    echo "FAIL: docs_gates.sh contains an implicit optional gate hook." >&2
    fail=1
  fi
  for package_contract in '"gates:docs"' '"audit:agents"' 'validate_docs_scope\.sh'; do
    if ! rg -q "$package_contract" package.json; then
      echo "FAIL: package.json missing scripts contract: $package_contract" >&2
      fail=1
    fi
  done
  if find scripts -type f \( -name clear_indexeddb.html -o -name seed_github_project.py \) -print -quit | grep -q .; then
    echo "FAIL: destructive or consumerless historical tool remains in active scripts/." >&2
    fail=1
  fi

  mapfile -t active_skills < <(find .agents/skills -type f -name SKILL.md | sort)
  if [[ "${#active_skills[@]}" -eq 0 ]]; then
    echo "FAIL: no active SKILL.md files discovered." >&2
    fail=1
  fi

  for skill in "${active_skills[@]}"; do
    expected_name="${skill%/SKILL.md}"
    expected_name="${expected_name##*/}"
    skill_errors="$(awk -v expected="$expected_name" '
      NR == 1 && $0 != "---" { print "invalid frontmatter opening" }
      NR > 1 && !frontmatter_closed && $0 == "---" { frontmatter_closed=1 }
      /^name:[[:space:]]*/ && !name { name=$0; sub(/^name:[[:space:]]*/, "", name) }
      /^description:[[:space:]]+[^[:space:]]/ { description=1 }
      /^role:[[:space:]]*/ && !role { role=$0; sub(/^role:[[:space:]]*/, "", role) }
      /^## (Missão|Mission)$/ { mission=1 }
      /^## (Leitura inicial|Read first|Ler primeiro)$/ { read_first=1 }
      /^## (Saída obrigatória|Expected output|Output expected|Forma de entrega)$/ { output=1 }
      /^```/ { fences++ }
      END {
        if (!frontmatter_closed) print "invalid frontmatter closing"
        if (name != expected) print "name mismatch: declared=" name ", expected=" expected
        if (!description) print "description missing"
        if (role !~ /^(lifecycle|engineering|domain)$/) print "invalid or missing role: " role
        if (!mission) print "mission section missing"
        if (!read_first) print "read-first section missing"
        if (!output) print "output contract missing"
        if (fences % 2 != 0) print "unbalanced Markdown fences"
      }
    ' "$skill")"
    if [[ -n "$skill_errors" ]]; then
      while IFS= read -r skill_error; do
        echo "FAIL: $skill: $skill_error" >&2
      done <<< "$skill_errors"
      fail=1
    fi
  done

  readonly DESTRUCTIVE_COMMAND_PATTERN='^[[:space:]]*(supabase[[:space:]]+db[[:space:]]+reset|git[[:space:]]+(reset|clean)|rm[[:space:]]+-rf)([[:space:]]|$)'
  if rg -n --glob 'SKILL.md' "$DESTRUCTIVE_COMMAND_PATTERN" .agents/skills >/dev/null; then
    echo "FAIL: prohibited destructive command in active skill." >&2
    rg -n --glob 'SKILL.md' "$DESTRUCTIVE_COMMAND_PATTERN" .agents/skills >&2
    fail=1
  fi
  if rg -n --glob 'SKILL.md' '^[[:space:]]*(rtk[[:space:]]+)?graphify[[:space:]]+update([[:space:]]|$)' .agents/skills >/dev/null; then
    echo "FAIL: Graphify update must be governed by GRAPHIFY_USAGE.md, not required by a skill." >&2
    fail=1
  fi
  if rg -q '`resolved`' .agents/skills/sanitario-catalogo-regulatorio-compliance/SKILL.md; then
    echo "FAIL: unsupported RegulatoryOverlayActionability value 'resolved'." >&2
    fail=1
  fi

  while IFS= read -r record; do
    source_file="${record%%:*}"
    remainder="${record#*:}"
    reference="${remainder#*:}"
    reference="${reference#\`}"
    reference="${reference%\`}"
    if [[ ! -e "$reference" ]]; then
      echo "FAIL: missing explicit reference in $source_file: $reference" >&2
      fail=1
    fi
  done < <(rg -n -o '`(\.agents|docs|scripts)/[^`*<>]+`' "${active_skills[@]}" | sort -u || true)

  mapfile -t governance_markdown < <(find .agents/rules .agents/prompts -type f -name '*.md' | sort)
  markdown_errors="$(awk '
    FNR == 1 {
      if (NR > 1 && fences % 2 != 0) print previous
      previous=FILENAME
      fences=0
    }
    /^```/ { fences++ }
    END { if (fences % 2 != 0) print previous }
  ' "${governance_markdown[@]}")"
  if [[ -n "$markdown_errors" ]]; then
    while IFS= read -r markdown_error; do
      echo "FAIL: unbalanced Markdown fences: $markdown_error" >&2
    done <<< "$markdown_errors"
    fail=1
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Active data-contract audit FAILED." >&2
  exit 1
fi

echo "OK: active governance data contract is coherent."
