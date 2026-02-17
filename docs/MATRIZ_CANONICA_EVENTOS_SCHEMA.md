# Matriz Canonica de Campos - Eventos e Agenda

Status: Normativo
Baseline: 0bb8829
Última Atualização: 2026-02-12
Derivado por: Antigravity Docs Update — Rev D

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

Fonte de verdade: `supabase/migrations/0001_init.sql` a `0036`.

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
| `quantidade_kg` | numeric(12,3) | Sim | `check (quantidade_kg > 0)` (quando nao nulo) (NOT VALID) |
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

**Constraints**:
- `to_lote_id` OR `to_pasto_id` obrigatório (NOT VALID)
- `from_lote_id != to_lote_id` (se ambos preenchidos) (NOT VALID)
- `from_pasto_id != to_pasto_id` (se ambos preenchidos) (NOT VALID)

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

**Constraints e Validações**:
- `payload.schema_version` deve ser 1
- `macho_id` obrigatório para `tipo = 'cobertura'` ou `tipo = 'IA'`
- `tipo = 'parto'` deve ter `payload.episode_evento_id` referenciando evento de cobertura ou IA
- `tipo = 'diagnostico'` aceita `episode_evento_id` nulo (marcado como 'unlinked')

**Views Auxiliares**:
- `vw_repro_episodios`: Agrega eventos em episódios (Cobertura -> Diagnóstico -> Parto).
- `vw_repro_status_animal`: Infere status reprodutivo atual (PRENHA, SERVIDA, etc.) e categoria produtiva (VACA/NOVILHA).

### 3.6 `eventos_financeiro`

| Campo | Tipo | Null | Default/Regra |
|---|---|---|---|
| `evento_id` | uuid | Nao | PK |
| `fazenda_id` | uuid | Nao | - |
| `tipo` | `financeiro_tipo_enum` | Nao | enum |
| `valor_total` | numeric(14,2) | Nao | `check (valor_total > 0)` (NOT VALID) |
| `contraparte_id` | uuid | Sim | FK composta `contrapartes(id,fazenda_id)` (NOT VALID) |
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

## 6. Constraints & Invariants (consolidado)

1. **Append-only**: triggers `prevent_business_update` e `prevent_business_delete` em todas as tabelas de eventos.
2. **Multi-tenancy**: RLS mandatória via `has_membership(fazenda_id)`.
3. **Integridade**: Todas as tabelas filhas possuem FK composta `(parent_id, fazenda_id)` para garantir isolamento.
4. **Hardening (v1.1)**: Constraints de valor e consistência (`valor_total`, `quantidade`, `movimentacao_destino`) aplicadas (status `NOT VALID` no baseline).

## 7. Evidence Index

| Objeto | PM Evidence |
|---|---|
| `eventos` | `PM: supabase/migrations/0001_init.sql` |
| `eventos_sanitario` | `PM: supabase/migrations/0001_init.sql` |
| `eventos_pesagem` | `PM: supabase/migrations/0001_init.sql` |
| `eventos_nutricao` | `PM: supabase/migrations/0024_hardening_eventos_nutricao.sql` |
| `eventos_movimentacao` | `PM: supabase/migrations/0025_hardening_eventos_movimentacao.sql` |
| `eventos_reproducao` | `PM: supabase/migrations/0035_reproducao_hardening_v1.sql` |
| `eventos_financeiro` | `PM: supabase/migrations/0023_hardening_eventos_financeiro.sql` |
| `agenda_itens` | `PM: supabase/migrations/0001_init.sql` |
| `protocolos_sanitarios` | `PM: supabase/migrations/0001_init.sql` |
| `contrapartes` | `PM: supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql` |
