param(
  [string[]]$TouchedPaths = @()
)

$ErrorActionPreference = "Stop"

Write-Host "== RebanhoSync Codex Validate =="

$criticalPrefixes = @(
  "src/lib/offline/",
  "supabase/functions/sync-batch/",
  "supabase/migrations/",
  "src/lib/sanitario/",
  "src/lib/reproduction/"
)

$criticalTouched = $false

foreach ($path in $TouchedPaths) {
  $normalized = $path.Replace("\", "/").Trim()

  foreach ($prefix in $criticalPrefixes) {
    if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $criticalTouched = $true
      break
    }
  }

  if ($criticalTouched) { break }
}

if ($criticalTouched) {
  Write-Host "Critical area touched."
  Write-Host "- review rollback / idempotence / tableMap / reason codes when applicable"
  Write-Host "- review fazenda_id / composite FK / append-only / RPC safeguards when applicable"
  Write-Host "- review domain invariants when touching sanitário/reprodução"
  Write-Host ""
}

pnpm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Validation OK"
exit 0