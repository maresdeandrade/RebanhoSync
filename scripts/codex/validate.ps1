param(
  [string[]]$TouchedPaths = @(),
  [Parameter(Mandatory = $true)]
  [ValidateSet("focused", "standard", "full")]
  [string]$Profile,
  [string[]]$TestPaths = @(),
  [string[]]$LintPaths = @(),
  [switch]$IncludeBuild,
  [switch]$ConfirmFull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )

  Write-Host "> $Command $($Arguments -join ' ')"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
  }
}

function Get-GitPaths {
  $paths = [System.Collections.Generic.List[string]]::new()
  $commands = @(
    @("diff", "--name-only", "--diff-filter=ACMRTUXB"),
    @("diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"),
    @("ls-files", "--others", "--exclude-standard")
  )

  foreach ($arguments in $commands) {
    $output = & git @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to inspect repository paths: git $($arguments -join ' ')"
    }
    foreach ($item in $output) {
      if (-not [string]::IsNullOrWhiteSpace($item)) { $paths.Add($item) }
    }
  }
  return @($paths | Sort-Object -Unique)
}

function Normalize-RepoPath {
  param(
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string]$RepoRoot
  )

  $trimmed = $Value.Trim().Trim('"').Replace("\", "/")
  while ($trimmed.StartsWith("./", [System.StringComparison]::Ordinal)) {
    $trimmed = $trimmed.Substring(2)
  }
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }

  $candidate = if ([System.IO.Path]::IsPathRooted($trimmed)) {
    [System.IO.Path]::GetFullPath($trimmed)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $trimmed))
  }
  $rootPrefix = $RepoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Touched path escapes repository root: $Value"
  }
  return $candidate.Substring($rootPrefix.Length).Replace("\", "/")
}

foreach ($required in @("git", "pnpm")) {
  if (-not (Get-Command $required -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $required"
  }
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Run this validator inside a Git repository."
}
$repoRoot = [System.IO.Path]::GetFullPath($repoRoot)
Set-Location $repoRoot

foreach ($requiredFile in @("package.json", "pnpm-lock.yaml")) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $requiredFile) -PathType Leaf)) {
    throw "Repository contract file not found: $requiredFile"
  }
}

if ($TouchedPaths.Count -eq 0) {
  $TouchedPaths = Get-GitPaths
  Write-Host "TouchedPaths not supplied; derived from staged, unstaged and untracked files."
}

$normalizedPaths = @(
  $TouchedPaths |
    ForEach-Object { Normalize-RepoPath -Value $_ -RepoRoot $repoRoot } |
    Where-Object { $_ } |
    Sort-Object -Unique
)

$criticalPrefixes = @(
  "src/lib/offline/",
  "supabase/functions/sync-batch/",
  "supabase/migrations/",
  "src/lib/sanitario/",
  "src/lib/reproduction/"
)
$criticalTouched = $false
foreach ($path in $normalizedPaths) {
  foreach ($prefix in $criticalPrefixes) {
    if ($path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $criticalTouched = $true
      break
    }
  }
  if ($criticalTouched) { break }
}

Write-Host "== RebanhoSync Validation Gate =="
Write-Host "Repository: $repoRoot"
Write-Host "Touched paths: $($normalizedPaths.Count)"
Write-Host "Profile: $Profile"
if ($criticalTouched) {
  Write-Host "Critical area detected. Review, when applicable:"
  Write-Host "- rollback, retry/replay, idempotency, tableMap and reason codes"
  Write-Host "- fazenda_id, composite FKs, RLS, grants and RPC safeguards"
  Write-Host "- Agenda=intent, Evento=fact, append-only history and domain invariants"
}

Invoke-Checked git diff --check
Invoke-Checked git diff --cached --check

$rtk = Get-Command rtk -ErrorAction SilentlyContinue
function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if ($rtk) {
    Invoke-Checked rtk pnpm @Arguments
  } else {
    Write-Host "INFO rtk not available; using repository pnpm directly."
    Invoke-Checked pnpm @Arguments
  }
}

switch ($Profile) {
  "focused" {
    if ($IncludeBuild) {
      throw "IncludeBuild nao e permitido no perfil focused. Use standard ou full."
    }
    if ($TestPaths.Count -gt 0) {
      Invoke-Pnpm test -- @TestPaths
    }
    if ($LintPaths.Count -gt 0) {
      Invoke-Pnpm exec eslint -- @LintPaths
    }
  }
  "standard" {
    if ($TestPaths.Count -eq 0 -and $LintPaths.Count -eq 0 -and -not $IncludeBuild) {
      throw "Perfil standard exige TestPaths, LintPaths ou IncludeBuild explicitamente."
    }
    if ($TestPaths.Count -gt 0) {
      Invoke-Pnpm test -- @TestPaths
    }
    if ($LintPaths.Count -gt 0) {
      Invoke-Pnpm exec eslint -- @LintPaths
    }
    if ($IncludeBuild) {
      Invoke-Pnpm run build
    }
  }
  "full" {
    if (-not $ConfirmFull) {
      throw "Perfil full exige -ConfirmFull para confirmar validacao ampla autorizada."
    }
    if ($TestPaths.Count -gt 0 -or $LintPaths.Count -gt 0 -or $IncludeBuild) {
      throw "Perfil full possui contrato fixo; nao combine TestPaths, LintPaths ou IncludeBuild."
    }
    Invoke-Pnpm run lint
    Invoke-Pnpm test
    Invoke-Pnpm run build
  }
}

Write-Host "Validation OK"
exit 0
