$ErrorActionPreference = "Stop"

function Get-NormalizedPath {
    param([string]$PathValue)
    if ([string]::IsNullOrWhiteSpace($PathValue)) { return "" }
    return $PathValue.Replace("/", "\").Trim()
}

function Match-AnyPath {
    param(
        [string]$TargetPath,
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        $p = Get-NormalizedPath $pattern
        if ($TargetPath -like $p) { return $true }
    }
    return $false
}

try {
    $inputJson = [Console]::In.ReadToEnd()
    $payload = $inputJson | ConvertFrom-Json

    $tool = $payload.postToolUse.tool
    $params = $payload.postToolUse.parameters
    $success = $payload.postToolUse.success

    if (-not $success) {
        Write-Output '{"cancel":false,"contextModification":"","errorMessage":""}'
        exit 0
    }

    $candidatePaths = New-Object System.Collections.Generic.List[string]

    foreach ($propName in @("path", "file_path", "target_file")) {
        if ($params.PSObject.Properties.Name -contains $propName) {
            $value = $params.$propName
            if ($value) { [void]$candidatePaths.Add((Get-NormalizedPath $value)) }
        }
    }

    if ($params.PSObject.Properties.Name -contains "paths") {
        foreach ($p in $params.paths) {
            if ($p) { [void]$candidatePaths.Add((Get-NormalizedPath $p)) }
        }
    }

    $criticalPatterns = @(
        "src\lib\offline\*",
        "supabase\functions\sync-batch\*",
        "supabase\migrations\*",
        "src\lib\sanitario\*",
        "src\lib\reproduction\*"
    )

    $matchedCritical = $false
    foreach ($path in $candidatePaths) {
        if (Match-AnyPath -TargetPath $path -Patterns $criticalPatterns) {
            $matchedCritical = $true
            break
        }
    }

    if ($matchedCritical) {
        $context = @"
A critical area was modified.
Before concluding, validate:
- pnpm run lint
- pnpm test
- pnpm run build

If the change touched:
- sync/offline: review rollback, idempotência, tableMap, reason codes
- migrations/RLS: review fazenda_id, FK composta, append-only, RPC safeguards
- sanitário/reprodução: review domain invariants and whether local skill guidance was followed
"@.Trim()

        $result = @{
            cancel = $false
            contextModification = $context
            errorMessage = ""
        } | ConvertTo-Json -Compress

        Write-Output $result
        exit 0
    }

    Write-Output '{"cancel":false,"contextModification":"","errorMessage":""}'
    exit 0
}
catch {
    Write-Output '{"cancel":false,"contextModification":"","errorMessage":""}'
    exit 0
}