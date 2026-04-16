param(
  [string]$Title = "",
  [string]$Capability = "",
  [string[]]$Files = @(),
  [string[]]$Risks = @(),
  [string[]]$Docs = @()
)

$ErrorActionPreference = "Stop"

Write-Host "== RebanhoSync PR Prep =="

Write-Host ""
Write-Host "Suggested title:"
if ($Title) {
  Write-Host $Title
} else {
  Write-Host "[capability] concise summary"
}

Write-Host ""
Write-Host "Context:"
if ($Capability) {
  Write-Host "- capability/theme: $Capability"
} else {
  Write-Host "- capability/theme: <fill>"
}

Write-Host ""
Write-Host "Key files:"
if ($Files.Count -eq 0) {
  Write-Host "- <fill>"
} else {
  foreach ($file in $Files) {
    Write-Host "- $file"
  }
}

Write-Host ""
Write-Host "Risks:"
if ($Risks.Count -eq 0) {
  Write-Host "- none explicitly registered"
} else {
  foreach ($risk in $Risks) {
    Write-Host "- $risk"
  }
}

Write-Host ""
Write-Host "Docs:"
if ($Docs.Count -eq 0) {
  Write-Host "- no doc updates"
} else {
  foreach ($doc in $Docs) {
    Write-Host "- $doc"
  }
}

Write-Host ""
Write-Host "Validation:"
Write-Host "- pnpm run lint"
Write-Host "- pnpm test"
Write-Host "- pnpm run build"