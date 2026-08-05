[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$Paths
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepositoryRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $root) {
    throw "Execute o preflight dentro de um checkout Git."
  }

  return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $root.Trim()).ProviderPath)
}

function Get-RelativeRepositoryPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot
  )

  $candidate = $InputPath.Trim()
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    throw "Path vazio nao e permitido."
  }

  $absolutePath = if ([System.IO.Path]::IsPathRooted($candidate)) {
    [System.IO.Path]::GetFullPath($candidate)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot $candidate))
  }

  $rootWithSeparator = $RepositoryRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  ) + [System.IO.Path]::DirectorySeparatorChar

  if (-not $absolutePath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase) -and
      -not $absolutePath.Equals($RepositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path fora do repositorio: $InputPath"
  }

  $existingAncestor = $absolutePath
  while (-not (Test-Path -LiteralPath $existingAncestor)) {
    $parent = [System.IO.Path]::GetDirectoryName($existingAncestor)
    if (-not $parent -or $parent -eq $existingAncestor) {
      throw "Nao foi possivel resolver o path: $InputPath"
    }
    $existingAncestor = $parent
  }
  $resolvedAncestor = [System.IO.Path]::GetFullPath(
    (Resolve-Path -LiteralPath $existingAncestor).ProviderPath
  )
  $remainingSuffix = $absolutePath.Substring($existingAncestor.Length).TrimStart(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $resolvedCandidate = if ($remainingSuffix) {
    [System.IO.Path]::GetFullPath((Join-Path $resolvedAncestor $remainingSuffix))
  } else {
    $resolvedAncestor
  }
  if (-not $resolvedCandidate.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase) -and
      -not $resolvedCandidate.Equals($RepositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path resolve por symlink para fora do repositorio: $InputPath"
  }

  if ($absolutePath.Equals($RepositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return "."
  }

  return $absolutePath.Substring($rootWithSeparator.Length).Replace("\", "/")
}

$repoRoot = Get-RepositoryRoot
$violations = @()

foreach ($path in $Paths) {
  try {
    $relativePath = Get-RelativeRepositoryPath -InputPath $path -RepositoryRoot $repoRoot
    $segments = $relativePath.Split("/", [System.StringSplitOptions]::RemoveEmptyEntries)
    $isRepositoryRoot = $relativePath -eq "."
    $isArchive = $relativePath.Equals("docs/archive", [System.StringComparison]::OrdinalIgnoreCase) -or
      $relativePath.StartsWith("docs/archive/", [System.StringComparison]::OrdinalIgnoreCase)
    $hasGeneratedDirectory = $segments | Where-Object {
      $_.Equals("dist", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals("coverage", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals("node_modules", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals(".git", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals(".supabase", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals("graphify-out", [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Equals("tmp", [System.StringComparison]::OrdinalIgnoreCase)
    }
    $isBuildInfo = $relativePath.EndsWith(".tsbuildinfo", [System.StringComparison]::OrdinalIgnoreCase)

    if ($isRepositoryRoot -or $isArchive -or $hasGeneratedDirectory -or $isBuildInfo) {
      $violations += "$path -> $relativePath"
    } else {
      Write-Host "OK   $relativePath"
    }
  } catch {
    $violations += "$path -> $($_.Exception.Message)"
  }
}

if ($violations.Count -gt 0) {
  $details = $violations | ForEach-Object { "- $_" }
  throw "Preflight bloqueado:`n$($details -join [Environment]::NewLine)"
}

Write-Host "Preflight OK"
