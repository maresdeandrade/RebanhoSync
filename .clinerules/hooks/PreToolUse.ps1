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

    $tool = $payload.preToolUse.tool
    $params = $payload.preToolUse.parameters

    $blockedWritePatterns = @(
        "docs\archive\*",
        "dist\*",
        "coverage\*",
        "*.tsbuildinfo"
    )

    $criticalPatterns = @(
        "src\lib\offline\*",
        "supabase\functions\sync-batch\*",
        "supabase\migrations\*",
        "src\lib\sanitario\*",
        "src\lib\reproduction\*"
    )

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

    $isWriteTool = $tool -in @("write_to_file", "replace_in_file", "apply_diff", "insert_content", "search_and_replace")

    if ($isWriteTool) {
        foreach ($path in $candidatePaths) {
            if (Match-AnyPath -TargetPath $path -Patterns $blockedWritePatterns) {
                $result = @{
                    cancel = $true
                    contextModification = ""
                    errorMessage = "Blocked by project hook: do not write to generated or historical paths ($path)."
                } | ConvertTo-Json -Compress

                Write-Output $result
                exit 0
            }
        }
    }

    $extraContext = ""

    foreach ($path in $candidatePaths) {
        if (Match-AnyPath -TargetPath $path -Patterns $criticalPatterns) {
            $extraContext = "Critical area touched: $path. Preserve invariants, keep diff minimal, and review AGENTS/local skills before structural edits."
            break
        }
    }

    $result = @{
        cancel = $false
        contextModification = $extraContext
        errorMessage = ""
    } | ConvertTo-Json -Compress

    Write-Output $result
    exit 0
}
catch {
    $result = @{
        cancel = $false
        contextModification = ""
        errorMessage = ""
    } | ConvertTo-Json -Compress

    Write-Output $result
    exit 0
}