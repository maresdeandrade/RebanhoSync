$ErrorActionPreference = "Stop"

try {
    $inputJson = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($inputJson)) {
        Write-Output '{"cancel":false,"contextModification":"","errorMessage":""}'
        exit 0
    }

    $payload = $inputJson | ConvertFrom-Json

    $taskText = ""
    if ($payload.taskComplete -and $payload.taskComplete.task) {
        $taskText = [string]$payload.taskComplete.task
    }

    $message = @"
Task finished successfully.

Before considering the work done, verify:
- pnpm run lint
- pnpm test
- pnpm run build

If the task touched:
- sync/offline -> re-check rollback, idempotência, tableMap, reason codes
- migrations/RLS/contracts -> re-check fazenda_id, FK composta, append-only, RPC safeguards, docs normativos
- docs -> update only what changed in reality; do not touch derived docs without delta funcional real
- architecture/contracts -> evaluate whether an ADR is needed

Delivery standard:
- diff mínimo
- até 3 riscos
- até 5 arquivos principais afetados
"@.Trim()

    if (-not [string]::IsNullOrWhiteSpace($taskText)) {
        $message += "`n`nCompleted task:`n- $taskText"
    }

    $result = @{
        cancel = $false
        contextModification = $message
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