$ErrorActionPreference = "Stop"

Write-Host "== RebanhoSync Codex Bootstrap =="

if (Test-Path ".\AGENTS.md") {
  Write-Host "AGENTS.md found."
} else {
  Write-Host "WARNING: AGENTS.md not found."
}

$docs = @(
  "README.md",
  "docs/CURRENT_STATE.md",
  "docs/PROCESS.md"
)

foreach ($doc in $docs) {
  if (Test-Path $doc) {
    Write-Host "OK   $doc"
  } else {
    Write-Host "MISS $doc"
  }
}

Write-Host ""
Write-Host "Read first:"
Write-Host "- README.md"
Write-Host "- docs/CURRENT_STATE.md"
Write-Host "- docs/PROCESS.md"
Write-Host ""
Write-Host "Global invariants:"
Write-Host "- Two Rails"
Write-Host "- fazenda_id isolation"
Write-Host "- idempotent sync"
Write-Host "- deterministic rollback"
Write-Host "- no docs/archive/** as operational truth"
Write-Host ""
Write-Host "Validation commands:"
Write-Host "- pnpm run lint"
Write-Host "- pnpm test"
Write-Host "- pnpm run build"