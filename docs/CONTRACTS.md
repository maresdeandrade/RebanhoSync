# Contratos de Sincronização e API

> **Status:** Normativo
> **Fonte de Verdade:** Edge Function `sync-batch`
> **Última Atualização:** 2026-02-15

Este documento define os contratos da API de Sincronização e códigos de retorno.

---

## 1. Endpoint: Sync Batch (`/functions/v1/sync-batch`)

Gateway único de escrita transacional.

### Request Payload

```json
{
  "client_id": "uuid",
  "fazenda_id": "uuid",
  "client_tx_id": "uuid",
  "ops": [
    {
      "client_op_id": "uuid",
      "table": "nome_tabela",
      "action": "INSERT" | "UPDATE" | "DELETE",
      "record": { ... }
    }
  ]
}
```

### Response Payload

```json
{
  "server_tx_id": "srv-...",
  "results": [
    {
      "op_id": "uuid",
      "status": "APPLIED" | "APPLIED_ALTERED" | "REJECTED",
      "reason_code": "CODE",
      "reason_message": "...",
      "altered": { ... }
    }
  ]
}
```

---

## 2. Status de Resultado

| Status                | Significado                      | Ação do Cliente         |
| :-------------------- | :------------------------------- | :---------------------- |
| **`APPLIED`**         | Sucesso / Idempotente.           | Marcar `SYNCED`.        |
| **`APPLIED_ALTERED`** | Aceito com mudanças (ex: Dedup). | Atualizar estado local. |
| **`REJECTED`**        | Recusado (Erro/Regra).           | **Rollback Local**.     |

---

## 3. Reason Codes (Rejeição)

### Segurança

- `SECURITY_BLOCKED_TABLE`: Escrita em tabelas de sistema protegidas.
- `PERMISSION_DENIED`: Bloqueio por RLS.

### Validação de Negócio

- `ANTI_TELEPORTE`: Movimentação sem evento correspondente.
- `PAYLOAD_SCHEMA_VERSION_REQUIRED`: Eventos complexos sem versão.
- `VALIDATION_ERROR`: Dados incompletos ou inválidos.
- `INVALID_EPISODE_REFERENCE`: Vínculo reprodutivo quebrado.

### Constraints de Banco

- `VALIDATION_FINANCEIRO_VALOR_TOTAL`: Valor <= 0.
- `VALIDATION_MOVIMENTACAO_DESTINO`: Sem destino definido.
- `VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO`: Origem = Destino.

---

## 4. Idempotência e Tratamento

- **Idempotência:** Duplicatas retornam `APPLIED`.
- **Agenda:** Colisão de `dedup_key` retorna `APPLIED_ALTERED` (`collision_noop`).
- **Atomicidade:** Anti-teleporte valida lote inteiro; falha rejeita tudo. Falhas individuais (constraint) rejeitam apenas a operação, permitindo sucesso parcial do restante.

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**OFFLINE.md**](./OFFLINE.md)
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md)
