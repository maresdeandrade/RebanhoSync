# Contracts & Sync Protocol

> **Source of Truth**: `supabase/functions/sync-batch/index.ts` & `supabase/functions/sync-batch/rules.ts`
>
> Este documento descreve o contrato estrito entre o Cliente (Offline-First) e o Servidor (Edge Function). O servidor é autoritativo.

## Endpoint

`POST /functions/v1/sync-batch`

### Authentication
*   **Header**: `Authorization: Bearer <JWT>`
*   **Header**: `Content-Type: application/json`

---

## Request Format

O cliente envia um "batch" de operações agrupadas por uma transação lógica (`client_tx_id`).

```json
{
  "client_id": "uuid-v4",
  "fazenda_id": "uuid-v4",
  "client_tx_id": "tx-123456789",
  "ops": [
    {
      "client_op_id": "op-1",
      "table": "animais",
      "action": "INSERT",
      "record": {
        "id": "uuid-animal",
        "brinco": "123",
        "...": "..."
      }
    }
  ]
}
```

### Fields
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `client_id` | UUID | Sim | ID da instalação do app cliente. |
| `fazenda_id` | UUID | Sim | Contexto do tenant. O servidor **sobrescreve** qualquer `fazenda_id` dentro de `record` com este valor. |
| `client_tx_id` | String | Sim | Identificador único da transação gerada no cliente. |
| `ops` | Array | Sim | Lista ordenada de operações. |

### Operation Object
| Campo | Tipo | Valores | Descrição |
|---|---|---|---|
| `client_op_id` | String | Unique | ID idempotente da operação. |
| `table` | String | - | Nome da tabela (ex: `animais`, `eventos_sanitario`). |
| `action` | String | `INSERT`, `UPDATE`, `DELETE` | Tipo da mutação. |
| `record` | Object | - | Payload da operação. |

---

## Server Behavior & Logic

### 1. Anti-Teleport (Atomic Pre-Validation)
Antes de processar qualquer operação, o servidor valida regras de consistência espacial (Anti-Teleporte) para `eventos_movimentacao` e `animais`.

*   **Regra**: Se `strict_anti_teleporte` estiver ativado na fazenda e a validação falhar, **TODO O BATCH É REJEITADO**.
*   **Response**: Status 200 OK, mas todos os items em `results` terão status `REJECTED` com code `ANTI_TELEPORTE`.

### 2. Security Blocks
As seguintes tabelas são estritamente proibidas via sync e retornarão `REJECTED` (`SECURITY_BLOCKED_TABLE`):
*   `user_fazendas`
*   `user_profiles`
*   `user_settings`

### 3. Server Authoritative Injection
O servidor ignora valores enviados pelo cliente e injeta os seguintes campos em `INSERT`:
*   `fazenda_id` (do envelope do request)
*   `client_id` (do envelope do request)
*   `client_op_id` (da operação)
*   `client_tx_id` (do envelope do request)
*   `created_at` (DB default, se omitido)
*   `updated_at` (DB default, se omitido)
*   `server_received_at` (Gerado pelo DB)

### 4. Reproduction Hardening
Para a tabela `eventos_reproducao` (`INSERT`):
*   **Schema Version**: `record.payload.schema_version` DEVE ser `1`. (Code: `PAYLOAD_SCHEMA_VERSION_REQUIRED`)
*   **Macho Obrigatório**: Se `tipo` for `cobertura` ou `IA`, `macho_id` é obrigatório.
*   **Episode Linking**:
    *   `parto` DEVE ter link com evento anterior (serviço) ou será rejeitado (`EPISODE_LINK_REQUIRED_FOR_PARTO`).
    *   `diagnostico` pode ser `unlinked`.

### 5. Idempotency & Conflicts
*   **Duplicate Key (Geral)**: Se houver colisão de chave única (Erro DB `23505`), a operação é considerada sucesso silencioso (`APPLIED`).
*   **Duplicate Key (Agenda)**: Para `agenda_itens`, retorna `APPLIED_ALTERED` com `altered: { dedup: 'collision_noop' }`.

---

## Response Format

O servidor retorna o resultado individual de cada operação, mantendo a ordem.

```json
{
  "server_tx_id": "srv-tx-12345678",
  "client_tx_id": "tx-123456789",
  "results": [
    {
      "op_id": "op-1",
      "status": "APPLIED"
    },
    {
      "op_id": "op-2",
      "status": "REJECTED",
      "reason_code": "VALIDATION_FINANCEIRO_VALOR_TOTAL",
      "reason_message": "Valor total deve ser positivo"
    }
  ]
}
```

### Result Statuses

| Status | Significado |
|---|---|
| `APPLIED` | Sucesso. O dado foi persistido ou ignorado por idempotência. |
| `APPLIED_ALTERED` | Sucesso, mas o servidor alterou algo logicamente relevante (ex: deduplicação explícita). |
| `REJECTED` | Falha. O cliente DEVE marcar como erro ou tentar corrigir. |

### Reason Codes (Authoritative)

Mapeamento de erros do banco ou regras de negócio para códigos fixos:

**Validation & Constraints**
*   `VALIDATION_FINANCEIRO_VALOR_TOTAL`: Check constraint `ck_evt_fin_valor_total_pos`.
*   `VALIDATION_NUTRICAO_QUANTIDADE`: Check constraint `ck_evt_nutricao_quantidade_pos_nullable`.
*   `VALIDATION_MOVIMENTACAO_DESTINO`: Check constraint `ck_evt_mov_destino_required`.
*   `VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO`: Check constraint `ck_evt_mov_from_to_diff`.
*   `VALIDATION_FINANCEIRO_CONTRAPARTE`: FK constraint `fk_evt_fin_contraparte_fazenda`.
*   `VALIDATION_MISSING_PRIMARY_KEY`: Falta ID no `UPDATE`/`DELETE`.

**Logic & Rules**
*   `ANTI_TELEPORTE`: Falha de consistência espacial (Movimentação sem evento base, etc).
*   `SECURITY_BLOCKED_TABLE`: Tentativa de escrever em tabela protegida.
*   `PAYLOAD_SCHEMA_VERSION_REQUIRED`: Payload de reprodução inválido.
*   `EPISODE_LINK_REQUIRED_FOR_PARTO`: Parto sem link para serviço.
*   `INVALID_EPISODE_REFERENCE`: Link de episódio inválido ou não encontrado.

**Database Generic**
*   `FOREIGN_KEY_VIOLATION`: Erro `23503` genérico.
*   `CHECK_CONSTRAINT_VIOLATION`: Erro `23514` genérico.
*   `NOT_NULL_VIOLATION`: Erro `23502`.
*   `INVALID_INPUT_SYNTAX`: Erro `22P02` (UUID inválido, etc).
*   `PERMISSION_DENIED`: Erro `42501` (RLS violation).
*   `DB_<CODE>`: Fallback para outros códigos Postgres.
*   `INTERNAL_ERROR`: Exceção não tratada no Edge Function.
