# Contratos de Sincronização

## POST /sync-batch
Endpoint transacional para processar um lote de operações.

### Request
```json
{
  "client_id": "browser-client",
  "fazenda_id": "uuid",
  "client_tx_id": "uuid",
  "ops": [
    { "op_id": "uuid", "table": "animais", "action": "INSERT", "record": { ... } }
  ]
}
```

### Response
```json
{
  "server_tx_id": "srv-abc123",
  "client_tx_id": "uuid",
  "results": [
    { "op_id": "uuid", "status": "APPLIED" },
    { "op_id": "uuid", "status": "REJECTED", "reason_code": "ANTI_TELEPORTE", "reason_message": "..." }
  ]
}