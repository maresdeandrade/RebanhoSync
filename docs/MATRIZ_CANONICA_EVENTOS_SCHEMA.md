# Matriz Canonica de Campos - Eventos e Agenda

Data: 2026-02-11
Status: baseline oficial da Fase 0
Fonte de verdade: `supabase/migrations/0001_init.sql` (sem alteracoes dessas tabelas nas migrations `0002` a `0022`).

## 1. Escopo da matriz

Tabelas cobertas:

1. `eventos`
2. `eventos_sanitario`
3. `eventos_pesagem`
4. `eventos_nutricao`
5. `eventos_movimentacao`
6. `eventos_reproducao`
7. `eventos_financeiro`
8. `agenda_itens`
9. `contrapartes`
10. `protocolos_sanitarios`
11. `protocolos_sanitarios_itens`

## 2. Envelope de eventos

### 2.1 `eventos`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `id` | uuid | Nao | `gen_random_uuid()` / PK |
| `fazenda_id` | uuid | Nao | FK `fazendas(id)` |
| `dominio` | `dominio_enum` | Nao | enum |
| `occurred_at` | timestamptz | Nao | - |
| `occurred_on` | date (generated) | Nao | `generated always as ((occurred_at at time zone 'UTC')::date)` |
| `animal_id` | uuid | Sim | FK composta `animais(id,fazenda_id)` |
| `lote_id` | uuid | Sim | FK composta `lotes(id,fazenda_id)` |
| `source_task_id` | uuid | Sim | - |
| `source_tx_id` | uuid | Sim | - |
| `source_client_op_id` | uuid | Sim | - |
| `corrige_evento_id` | uuid | Sim | - |
| `observacoes` | text | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

Regras:

1. Append-only via trigger `prevent_business_update`.
2. RLS habilitado (policy por membership).

## 3. Detalhes por dominio (1:1)

### 3.1 `eventos_sanitario`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `tipo` | `sanitario_tipo_enum` | Nao | enum |
| `produto` | text | Nao | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 3.2 `eventos_pesagem`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `peso_kg` | numeric(10,2) | Nao | `check (peso_kg > 0)` |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 3.3 `eventos_nutricao`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `alimento_nome` | text | Sim | - |
| `quantidade_kg` | numeric(12,3) | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 3.4 `eventos_movimentacao`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `from_lote_id` | uuid | Sim | - |
| `to_lote_id` | uuid | Sim | - |
| `from_pasto_id` | uuid | Sim | - |
| `to_pasto_id` | uuid | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 3.5 `eventos_reproducao`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `tipo` | `repro_tipo_enum` | Nao | enum |
| `macho_id` | uuid | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 3.6 `eventos_financeiro`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `tipo` | `financeiro_tipo_enum` | Nao | enum |
| `valor_total` | numeric(14,2) | Nao | sem check atualmente |
| `contraparte_id` | uuid | Sim | sem FK dedicada atualmente |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

## 4. Agenda e protocolos

### 4.1 `agenda_itens`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `id` | uuid | Nao | `gen_random_uuid()` / PK |
| `fazenda_id` | uuid | Nao | FK `fazendas(id)` |
| `dominio` | `dominio_enum` | Nao | enum |
| `tipo` | text | Nao | - |
| `status` | `agenda_status_enum` | Nao | `agendado` |
| `data_prevista` | date | Nao | - |
| `animal_id` | uuid | Sim | FK composta `animais(id,fazenda_id)` |
| `lote_id` | uuid | Sim | FK composta `lotes(id,fazenda_id)` |
| `dedup_key` | text | Sim | unique parcial quando ativo |
| `source_kind` | `agenda_source_kind_enum` | Nao | `manual` |
| `source_ref` | jsonb | Sim | - |
| `source_client_op_id` | uuid | Sim | - |
| `source_tx_id` | uuid | Sim | - |
| `source_evento_id` | uuid | Sim | - |
| `protocol_item_version_id` | uuid | Sim | - |
| `interval_days_applied` | int | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

Constraints:

1. `ck_agenda_alvo`: exige `animal_id` ou `lote_id`.
2. `ck_agenda_dedup_automatico`: se `source_kind='automatico'`, `dedup_key` obrigatorio.
3. `ux_agenda_dedup_active`: dedup por `fazenda_id,dedup_key` para itens ativos.

### 4.2 `protocolos_sanitarios`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `id` | uuid | Nao | `gen_random_uuid()` / PK |
| `fazenda_id` | uuid | Nao | FK `fazendas(id)` |
| `nome` | text | Nao | - |
| `descricao` | text | Sim | - |
| `ativo` | boolean | Nao | `true` |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

### 4.3 `protocolos_sanitarios_itens`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `id` | uuid | Nao | `gen_random_uuid()` / PK |
| `fazenda_id` | uuid | Nao | FK `fazendas(id)` |
| `protocolo_id` | uuid | Nao | FK composta com `fazenda_id` |
| `protocol_item_id` | uuid | Nao | identificador logico do item |
| `version` | int | Nao | `check (version > 0)` |
| `tipo` | `sanitario_tipo_enum` | Nao | enum |
| `produto` | text | Nao | - |
| `intervalo_dias` | int | Nao | `check (intervalo_dias > 0)` |
| `dose_num` | int | Sim | `check (dose_num is null or dose_num > 0)` |
| `gera_agenda` | boolean | Nao | `true` |
| `dedup_template` | text | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

## 5. Contrapartes

### 5.1 `contrapartes`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `id` | uuid | Nao | `gen_random_uuid()` / PK |
| `fazenda_id` | uuid | Nao | FK `fazendas(id)` |
| `tipo` | `contraparte_tipo_enum` | Nao | `pessoa` |
| `nome` | text | Nao | - |
| `documento` | text | Sim | - |
| `telefone` | text | Sim | - |
| `email` | text | Sim | - |
| `endereco` | text | Sim | - |
| `payload` | jsonb | Nao | `'{}'::jsonb` |
| `client_id` | text | Nao | - |
| `client_op_id` | uuid | Nao | - |
| `client_tx_id` | uuid | Sim | - |
| `client_recorded_at` | timestamptz | Nao | - |
| `server_received_at` | timestamptz | Nao | `now()` |
| `deleted_at` | timestamptz | Sim | soft delete |
| `created_at` | timestamptz | Nao | `now()` |
| `updated_at` | timestamptz | Nao | `now()` |

