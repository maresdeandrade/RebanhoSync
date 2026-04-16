$ErrorActionPreference = "Stop"

try {
    $inputJson = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($inputJson)) {
        Write-Output '{"cancel":false,"contextModification":"","errorMessage":""}'
        exit 0
    }

    $payload = $inputJson | ConvertFrom-Json
    $workspace = $null

    if ($payload.workspaceRoots -and $payload.workspaceRoots.Count -gt 0) {
        $workspace = $payload.workspaceRoots[0]
    }

    $context = ""

    if ($workspace) {
        $projectContextPath = Join-Path $workspace ".project-context"
        if (Test-Path $projectContextPath) {
            $context = Get-Content $projectContextPath -Raw
        }
    }

    if ([string]::IsNullOrWhiteSpace($context)) {
        $context = @"
RebanhoSync project context:
- Leia primeiro: README.md, docs/CURRENT_STATE.md, docs/PROCESS.md
- Preserve Two Rails: agenda mutável, eventos append-only
- Preserve fazenda_id como fronteira de isolamento
- Para sync/offline, preservar idempotência e rollback determinístico
- Não usar docs/archive/** como fonte operacional
- Preferir diff mínimo, escopo estreito e no máximo 1 capability principal por tarefa
"@.Trim()
    }

    $result = @{
        cancel = $false
        contextModification = $context
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