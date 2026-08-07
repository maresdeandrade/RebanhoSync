[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Title,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Capability,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Summary,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$Files,

  [Parameter(Mandatory = $true)]
  [ValidateSet("READY", "NOT_READY")]
  [string]$VerificationStatus,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$Validations,

  [string[]]$Risks = @(),
  [string[]]$Docs = @(),
  [string[]]$NotExecuted = @(),
  [string]$OutputPath = "",
  [switch]$Force,
  [string]$OverwriteConfirmation = "",
  [switch]$AllowExternalOutput,
  [string]$ExternalOutputConfirmation = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($VerificationStatus -ne "READY") {
  throw "PR nao pode ser preparado: verification gate = $VerificationStatus."
}

function Add-Bullets {
  param(
    [System.Collections.Generic.List[string]]$Target,
    [string[]]$Values,
    [string]$EmptyMessage
  )

  if ($Values.Count -eq 0) {
    $Target.Add("- $EmptyMessage")
    return
  }

  foreach ($value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $Target.Add("- $($value.Trim())")
    }
  }
}

$body = [System.Collections.Generic.List[string]]::new()
$body.Add("# $($Title.Trim())")
$body.Add("")
$body.Add("## Contexto")
$body.Add("")
$body.Add("- Capability: $($Capability.Trim())")
$body.Add("- Verification gate: READY")
$body.Add("")
$body.Add("## Resumo")
$body.Add("")
$body.Add($Summary.Trim())
$body.Add("")
$body.Add("## Arquivos principais")
$body.Add("")
Add-Bullets -Target $body -Values $Files -EmptyMessage "ERRO: nenhum arquivo informado"
$body.Add("")
$body.Add("## Riscos residuais")
$body.Add("")
Add-Bullets -Target $body -Values $Risks -EmptyMessage "Nenhum risco residual informado."
$body.Add("")
$body.Add("## Documentacao")
$body.Add("")
Add-Bullets -Target $body -Values $Docs -EmptyMessage "Nenhuma alteracao documental informada."
$body.Add("")
$body.Add("## Validacoes executadas")
$body.Add("")
Add-Bullets -Target $body -Values $Validations -EmptyMessage "ERRO: nenhuma validacao informada"

if ($NotExecuted.Count -gt 0) {
  $body.Add("")
  $body.Add("## Validacoes nao executadas")
  $body.Add("")
  Add-Bullets -Target $body -Values $NotExecuted -EmptyMessage "Nenhuma"
}

$content = ($body -join [Environment]::NewLine) + [Environment]::NewLine

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  Write-Output $content
  return
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Execute prepare-pr.ps1 dentro de um checkout Git."
}
$repoRoot = [System.IO.Path]::GetFullPath($repoRoot)
$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  [System.IO.Path]::GetFullPath($OutputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
}
$rootPrefix = $repoRoot.TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
$insideRepository = $resolvedOutput.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
$gitDirectory = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".git"))
$insideGitDirectory = $resolvedOutput.Equals($gitDirectory, [System.StringComparison]::OrdinalIgnoreCase) -or
  $resolvedOutput.StartsWith($gitDirectory + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)

if ($insideGitDirectory) {
  throw "OutputPath nao pode apontar para .git."
}
if (-not $insideRepository -and
    (-not $AllowExternalOutput -or $ExternalOutputConfirmation -ne "ALLOW_EXTERNAL_PR_OUTPUT")) {
  throw "Output externo bloqueado. Exige -AllowExternalOutput e -ExternalOutputConfirmation ALLOW_EXTERNAL_PR_OUTPUT."
}

$outputExists = Test-Path -LiteralPath $resolvedOutput
if ($outputExists -and -not $Force) {
  throw "Arquivo de saida ja existe: $resolvedOutput. Sobrescrita exige -Force e confirmacao inequívoca."
}
if ($outputExists -and $Force -and $OverwriteConfirmation -ne "OVERWRITE_PR_OUTPUT") {
  throw "Sobrescrita exige -OverwriteConfirmation OVERWRITE_PR_OUTPUT."
}
$outputIsDirectory = $outputExists -and (Test-Path -LiteralPath $resolvedOutput -PathType Container)
if ($outputIsDirectory) {
  throw "OutputPath deve apontar para arquivo, nao diretorio: $resolvedOutput"
}
$parent = [System.IO.Path]::GetDirectoryName($resolvedOutput)
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
  [System.IO.Directory]::CreateDirectory($parent) | Out-Null
}
[System.IO.File]::WriteAllText($resolvedOutput, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "PR body salvo em: $resolvedOutput"
