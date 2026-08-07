[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepositoryRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $root) {
    throw "Execute o bootstrap dentro de um checkout Git do RebanhoSync."
  }

  return $root.Trim()
}

$repoRoot = Get-RepositoryRoot
$requiredFiles = @(
  "AGENTS.md",
  ".agents/rules/CORE_RULES.md",
  ".agents/rules/CONTEXT_LOADING.md",
  ".agents/rules/no-broad-context.md",
  ".agents/rules/rtk.md",
  ".agents/skills/README.md",
  "scripts/README.md"
)
$referenceFiles = @(
  "README.md",
  "docs/context/PROJECT_STATUS.md",
  "docs/context/SOURCE_OF_TRUTH.md"
)

Write-Host "== RebanhoSync Codex Bootstrap =="
Write-Host "Repository: $repoRoot"
Write-Host ""

$missingRequired = @()
foreach ($relativePath in $requiredFiles) {
  $absolutePath = Join-Path $repoRoot $relativePath
  if (Test-Path -LiteralPath $absolutePath -PathType Leaf) {
    Write-Host "OK   $relativePath"
  } else {
    Write-Host "MISS $relativePath"
    $missingRequired += $relativePath
  }
}

Write-Host ""
Write-Host "Referencias sob demanda:"
foreach ($relativePath in $referenceFiles) {
  $absolutePath = Join-Path $repoRoot $relativePath
  $status = if (Test-Path -LiteralPath $absolutePath -PathType Leaf) { "OK  " } else { "MISS" }
  Write-Host "$status $relativePath"
}

if ($missingRequired.Count -gt 0) {
  throw "Bootstrap incompleto. Arquivos obrigatorios ausentes: $($missingRequired -join ', ')"
}

Write-Host ""
Write-Host "Ordem minima:"
Write-Host "1. AGENTS.md"
Write-Host "2. CORE_RULES.md + CONTEXT_LOADING.md + no-broad-context.md"
Write-Host "3. AGENTS.md local, se existir"
Write-Host "4. CONTEXT_LOADING.md roteia a fase e a skill aplicavel"
Write-Host "5. Implementacao: uma skill principal e no maximo uma de apoio"
Write-Host "6. Lifecycle posterior: gate, reconcile docs e prepare PR em fases separadas"
Write-Host "7. rtk.md para qualquer comando ou validacao"
Write-Host ""
Write-Host "Bootstrap OK"
