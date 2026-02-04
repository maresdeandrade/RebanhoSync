# Contratos de Sincronização

## Endpoint: `/functions/v1/sync-batch`

### Request
```json
{
  "client_id": "browser-client",
  "fazenda_id": "uuid",
  "client_tx_id": "uuid",
  "ops": [
    {
      "client_op_id": "uuid",
      "table": "animais",
      "action": "INSERT",
      "record": { "id": "...", "identificacao": "123" }
    }
  ]
}
```

### Response
```json
{
  "server_tx_id": "srv-8char",
  "client_tx_id": "uuid",
  "results": [
    { "op_id": "uuid", "status": "APPLIED" },
    { "op_id": "uuid", "status": "REJECTED", "reason_code": "ANTI_TELEPORTE", "reason_message": "..." }
  ]
}
```

### Status de Resposta
- `APPLIED`: Sucesso total ou replay idempotente.
- `APPLIED_ALTERED`: Sucesso com modificação (ex: colisão de dedup na agenda).
- `REJECTED`: Falha na regra de negócio (exige rollback local).