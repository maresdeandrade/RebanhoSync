param(
  [Parameter(Mandatory=$true)]
  [string[]]$Paths
)

$ErrorActionPreference = "Stop"

$blockedPrefixes = @(
  "docs/archive/",
  "dist/",
  "coverage/"
)

$blockedSuffixes = @(
  ".tsbuildinfo"
)

foreach ($path in $Paths) {
  $normalized = $path.Replace("\", "/").Trim()

  foreach ($prefix in $blockedPrefixes) {
    if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-Error "Blocked path for Codex task: $path"
      exit 1
    }
  }

  foreach ($suffix in $blockedSuffixes) {
    if ($normalized.EndsWith($suffix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-Error "Blocked path for Codex task: $path"
      exit 1
    }
  }
}

Write-Host "Preflight OK"
exit 0