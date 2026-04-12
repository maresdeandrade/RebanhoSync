# Matriz Canônica de Campos — Eventos e Agenda

**Status:** Normativo (Baseline Fase 0 — Fechado)  
**Baseline:** b69d35f  
**Última Atualização:** 2026-04-07  
**Derivado por:** Antigravity Docs Update — Auditoria Abril/2026

---

## 1. Fonte de Verdade e Escopo

Este documento é a **fonte canônica do baseline Fase 0** para a estrutura de eventos, agenda e protocolos sanitários. Ele documenta o estado do schema conforme implementado nas migrations `0001_init.sql` (estrutura inicial) até `20260308230824_produtos_veterinarios_ui.sql` (hardenings de março/2026, inclusive closure dos TDs 003, 004, 011, 014, 015, 019, 020).

**Premissas:**

- Baseline de migrations: `0001` (init) + `0023-0037` (hardenings eventos) + `20260308*` (fechamento TDs março/2026)
- Fonte primária: `supabase/migrations/*.sql`
- Este documento NÃO prescreve mudanças futuras (ver `PLANO_UNIFICACAO_EVENTOS.md` para v2)

---

## 2. Tabelas Cobertas

1. `eventos` (envelope)
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

---

## 3. Envelope de Eventos

### 3.1 Tabela `eventos`

**Propósito:** Envelope comum append-only para todos os domínios de eventos.

| Campo

| Tipo                  | Null             | Default/Regra |
| --------------------- | ---------------- | ------------- | ------------------------------------------------------------------------------------- |
| `id`                  | uuid             | Não           | `gen_random_uuid()` / PK                                                              |
| `fazenda_id`          | uuid             | Não           | FK `fazendas(id)`                                                                     |
| `dominio`             | `dominio_enum`   | Não           | enum ('sanitario', 'pesagem', 'nutricao', 'movimentacao', 'reproducao', 'financeiro') |
| `occurred_at`         | timestamptz      | Não           | -                                                                                     |
| `occurred_on`         | date (generated) | Não           | `generated always as ((occurred_at at time zone 'UTC')::date)`                        |
| `animal_id`           | uuid             | Sim           | FK composta `animais(id,fazenda_id)`                                                  |
| `lote_id`             | uuid             | Sim           | FK composta `lotes(id,fazenda_id)`                                                    |
| `source_task_id`      | uuid             | Sim           | Referência lógica a `agenda_itens.id`                                                 |
| `source_tx_id`        | uuid             | Sim           | Rastreabilidade técnica                                                               |
| `source_client_op_id` | uuid             | Sim           | Rastreabilidade técnica                                                               |
| `corrige_evento_id`   | uuid             | Sim           | Self-FK lógica (correção histórica)                                                   |
| `observacoes`         | text             | Sim           | -                                                                                     |
| `payload`             | jsonb            | Não           | `'{}'::jsonb`                                                                         |
| `client_id`           | text             | Não           | -                                                                                     |
| `client_op_id`        | uuid             | Não           | Idempotência                                                                          |
| `client_tx_id`        | uuid             | Sim           | Agrupador transação                                                                   |
| `client_recorded_at`  | timestamptz      | Não           | -                                                                                     |
| `server_received_at`  | timestamptz      | Não           | `now()`                                                                               |
| `deleted_at`          | timestamptz      | Sim           | Soft delete                                                                           |
| `created_at`          | timestamptz      | Não           | `now()`                                                                               |
| `updated_at`          | timestamptz      | Não           | `now()`                                                                               |

**Regras Globais:**

1. **Append-only**: Trigger `trg_eventos_append_only` (`prevent_business_update`) bloqueia UPDATE de campos de negócio.
2. **RLS**: Policy `eventos_select_by_membership` controla acesso por `has_membership(fazenda_id)`.
3. **Correção histórica**: Novo evento com `corrige_evento_id` aponta para o original.

**PM:** `supabase/migrations/0001_init.sql:541-595`

---

## 4. Detalhes por Domínio (1:1)

Todos os detalhes possuem:

- `evento_id` (PK, FK para `eventos(id,fazenda_id)`)
- `fazenda_id` (tenant isolation)
- `payload` (extensão de domínio)
- metadados de sync (`client_*`, `server_received_at`)
- `deleted_at`, `created_at`, `updated_at`
- trigger append-only (`prevent_business_update`)

### 4.1 Sanitário — `eventos_sanitario`

| Campo                  | Tipo                  | Null    | Default/Regra                                     |
| ---------------------- | --------------------- | ------- | ------------------------------------------------- |
| `evento_id`            | uuid                  | Não     | PK, FK `eventos(id,fazenda_id)`                   |
| `fazenda_id`           | uuid                  | Não     | Tenant                                            |
| `tipo`                 | `sanitario_tipo_enum` | Não     | enum ('vacinacao', 'vermifugacao', 'medicamento') |
| `produto`              | text                  | Não     | -                                                 |
| `payload`              | jsonb                 | Não     | `'{}'::jsonb`                                     |
| metadados sync/sistema | diversos              | Sim/Não | padrão                                            |

**PM:** `supabase/migrations/0001_init.sql:597-614`

---

### 4.2 Pesagem — `eventos_pesagem`

| Campo                  | Tipo          | Null    | Default/Regra                   |
| ---------------------- | ------------- | ------- | ------------------------------- |
| `evento_id`            | uuid          | Não     | PK, FK `eventos(id,fazenda_id)` |
| `fazenda_id`           | uuid          | Não     | Tenant                          |
| `peso_kg`              | numeric(10,2) | Não     | `check (peso_kg > 0)`           |
| `payload`              | jsonb         | Não     | `'{}'::jsonb`                   |
| metadados sync/sistema | diversos      | Sim/Não | padrão                          |

**PM:** `supabase/migrations/0001_init.sql:615-631`

---

### 4.3 Nutrição — `eventos_nutricao`

| Campo                  | Tipo          | Null    | Default/Regra                                                             |
| ---------------------- | ------------- | ------- | ------------------------------------------------------------------------- |
| `evento_id`            | uuid          | Não     | PK, FK `eventos(id,fazenda_id)`                                           |
| `fazenda_id`           | uuid          | Não     | Tenant                                                                    |
| `alimento_nome`        | text          | Sim     | -                                                                         |
| `quantidade_kg`        | numeric(12,3) | Sim     | `check (quantidade_kg is null or quantidade_kg > 0)` (adicionado em 0024) |
| `payload`              | jsonb         | Não     | `'{}'::jsonb`                                                             |
| metadados sync/sistema | diversos      | Sim/Não | padrão                                                                    |

**PM (tabela):** `supabase/migrations/0001_init.sql:632-649`  
**PM (check):** `supabase/migrations/0024_hardening_eventos_nutricao.sql:12`

---

### 4.4 Movimentação — `eventos_movimentacao`

| Campo                  | Tipo     | Null    | Default/Regra                   |
| ---------------------- | -------- | ------- | ------------------------------- |
| `evento_id`            | uuid     | Não     | PK, FK `eventos(id,fazenda_id)` |
| `fazenda_id`           | uuid     | Não     | Tenant                          |
| `from_lote_id`         | uuid     | Sim     | -                               |
| `to_lote_id`           | uuid     | Sim     | -                               |
| `from_pasto_id`        | uuid     | Sim     | -                               |
| `to_pasto_id`          | uuid     | Sim     | -                               |
| `payload`              | jsonb    | Não     | `'{}'::jsonb`                   |
| metadados sync/sistema | diversos | Sim/Não | padrão                          |

**Constraints (adicionados em 0025):**

- `ck_evt_mov_destino`: `to_lote_id` OR `to_pasto_id` obrigatório
- `ck_evt_mov_origem_lote_diff`: `from_lote_id != to_lote_id` (se ambos preenchidos)
- `ck_evt_mov_origem_pasto_diff`: `from_pasto_id != to_pasto_id` (se ambos preenchidos)

**PM (tabela):** `supabase/migrations/0001_init.sql:650-669`  
**PM (constraints):** `supabase/migrations/0025_hardening_eventos_movimentacao.sql:6-10`

---

### 4.5 Reprodução — `eventos_reproducao`

| Campo                  | Tipo              | Null    | Default/Regra                                    |
| ---------------------- | ----------------- | ------- | ------------------------------------------------ |
| `evento_id`            | uuid              | Não     | PK, FK `eventos(id,fazenda_id)`                  |
| `fazenda_id`           | uuid              | Não     | Tenant                                           |
| `tipo`                 | `repro_tipo_enum` | Não     | enum ('cobertura', 'IA', 'diagnostico', 'parto') |
| `macho_id`             | uuid              | Sim     | FK lógica (validação em sync-batch)              |
| `payload`              | jsonb             | Não     | `'{}'::jsonb`                                    |
| metadados sync/sistema | diversos          | Sim/Não | padrão                                           |

**Constraints e Validações:**

- `payload.schema_version` deve ser 1 (validado em sync-batch)
- `macho_id` obrigatório para `tipo = 'cobertura'` ou `tipo = 'IA'` (validação em sync-batch)
- `tipo = 'parto'` deve ter `payload.episode_evento_id` referenciando evento de cobertura ou IA (soft constraint)
- `tipo = 'diagnostico'` aceita `episode_evento_id` nulo (marcado como 'unlinked')

**PM (tabela):** `supabase/migrations/0001_init.sql:670-687`  
**PM (views):** `supabase/migrations/0035_reproducao_hardening_v1.sql` (vw_repro_episodios, vw_repro_status_animal)

---

### 4.6 Financeiro — `eventos_financeiro`

| Campo                  | Tipo                   | Null    | Default/Regra                                                  |
| ---------------------- | ---------------------- | ------- | -------------------------------------------------------------- |
| `evento_id`            | uuid                   | Não     | PK, FK `eventos(id,fazenda_id)`                                |
| `fazenda_id`           | uuid                   | Não     | Tenant                                                         |
| `tipo`                 | `financeiro_tipo_enum` | Não     | enum ('compra', 'venda')                                       |
| `valor_total`          | numeric(14,2)          | Não     | `check (valor_total > 0)` (adicionado em 0023)                 |
| `contraparte_id`       | uuid                   | Sim     | FK composta `contrapartes(id,fazenda_id)` (adicionada em 0026) |
| `payload`              | jsonb                  | Não     | `'{}'::jsonb`                                                  |
| metadados sync/sistema | diversos               | Sim/Não | padrão                                                         |

**PM (tabela):** `supabase/migrations/0001_init.sql:688-706`  
**PM (check):** `supabase/migrations/0023_hardening_eventos_financeiro.sql:13`  
**PM (FK):** `supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql`

---

## 5. Agenda e Protocolos

### 5.1 Agenda — `agenda_itens`

**Propósito:** Rail mutável para planejamento (Two Rails). Status transitório (`agendado` → `concluido` | `cancelado`).

| Campo                      | Tipo                      | Null    | Default/Regra                                  |
| -------------------------- | ------------------------- | ------- | ---------------------------------------------- |
| `id`                       | uuid                      | Não     | `gen_random_uuid()` / PK                       |
| `fazenda_id`               | uuid                      | Não     | FK `fazendas(id)`                              |
| `dominio`                  | `dominio_enum`            | Não     | enum                                           |
| `tipo`                     | text                      | Não     | -                                              |
| `status`                   | `agenda_status_enum`      | Não     | `'agendado'`                                   |
| `data_prevista`            | date                      | Não     | -                                              |
| `animal_id`                | uuid                      | Sim     | FK composta `animais(id,fazenda_id)`           |
| `lote_id`                  | uuid                      | Sim     | FK composta `lotes(id,fazenda_id)`             |
| `dedup_key`                | text                      | Sim     | unique parcial quando ativo                    |
| `source_kind`              | `agenda_source_kind_enum` | Não     | `'manual'`                                     |
| `source_ref`               | jsonb                     | Sim     | -                                              |
| `source_client_op_id`      | uuid                      | Sim     | -                                              |
| `source_tx_id`             | uuid                      | Sim     | -                                              |
| `source_evento_id`         | uuid                      | Sim     | Referência a evento de conclusão               |
| `protocol_item_version_id` | uuid                      | Sim     | Referência a `protocolos_sanitarios_itens.id`  |
| `interval_days_applied`    | int                       | Sim     | Intervalo de dias aplicado (agenda automática) |
| `payload`                  | jsonb                     | Não     | `'{}'::jsonb`                                  |
| metadados sync/sistema     | diversos                  | Sim/Não | padrão                                         |

**Constraints:**

1. `ck_agenda_alvo`: `animal_id` OR `lote_id` obrigatório
2. `ck_agenda_dedup_automatico`: se `source_kind='automatico'`, `dedup_key` obrigatório
3. `ux_agenda_dedup_active`: unique parcial em (`fazenda_id`, `dedup_key`) para itens `status='agendado'` e `deleted_at is null`

**PM:** `supabase/migrations/0001_init.sql:476-537`  
**PM (agenda engine):** `supabase/migrations/0028_sanitario_agenda_engine.sql` (funções de recompute e triggers)

---

### 5.2 Protocolos Sanitários — `protocolos_sanitarios`

| Campo                  | Tipo     | Null    | Default/Regra            |
| ---------------------- | -------- | ------- | ------------------------ |
| `id`                   | uuid     | Não     | `gen_random_uuid()` / PK |
| `fazenda_id`           | uuid     | Não     | FK `fazendas(id)`        |
| `nome`                 | text     | Não     | -                        |
| `descricao`            | text     | Sim     | -                        |
| `ativo`                | boolean  | Não     | `true`                   |
| `payload`              | jsonb    | Não     | `'{}'::jsonb`            |
| metadados sync/sistema | diversos | Sim/Não | padrão                   |

**PM:** `supabase/migrations/0001_init.sql:407-434`

---

### 5.3 Itens de Protocolo — `protocolos_sanitarios_itens`

| Campo                  | Tipo                  | Null    | Default/Regra                                                         |
| ---------------------- | --------------------- | ------- | --------------------------------------------------------------------- |
| `id`                   | uuid                  | Não     | `gen_random_uuid()` / PK                                              |
| `fazenda_id`           | uuid                  | Não     | FK `fazendas(id)`                                                     |
| `protocolo_id`         | uuid                  | Não     | FK composta com `fazenda_id` → `protocolos_sanitarios(id,fazenda_id)` |
| `protocol_item_id`     | uuid                  | Não     | Identificador lógico do item                                          |
| `version`              | int                   | Não     | `check (version > 0)`                                                 |
| `tipo`                 | `sanitario_tipo_enum` | Não     | enum                                                                  |
| `produto`              | text                  | Não     | -                                                                     |
| `intervalo_dias`       | int                   | Não     | `check (intervalo_dias > 0)`                                          |
| `dose_num`             | int                   | Sim     | `check (dose_num is null or dose_num > 0)`                            |
| `gera_agenda`          | boolean               | Não     | `true`                                                                |
| `dedup_template`       | text                  | Sim     | Template para render_dedup_key                                        |
| `payload`              | jsonb                 | Não     | `'{}'::jsonb`                                                         |
| metadados sync/sistema | diversos              | Sim/Não | padrão                                                                |

**PM:** `supabase/migrations/0001_init.sql:436-472`

---

## 6. Contrapartes

### 6.1 Tabela `contrapartes`

**Propósito:** Terceiros em transações financeiras (compradores, vendedores, fornecedores).

| Campo                  | Tipo                    | Null    | Default/Regra            |
| ---------------------- | ----------------------- | ------- | ------------------------ |
| `id`                   | uuid                    | Não     | `gen_random_uuid()` / PK |
| `fazenda_id`           | uuid                    | Não     | FK `fazendas(id)`        |
| `tipo`                 | `contraparte_tipo_enum` | Não     | `'pessoa'`               |
| `nome`                 | text                    | Não     | -                        |
| `documento`            | text                    | Sim     | -                        |
| `telefone`             | text                    | Sim     | -                        |
| `email`                | text                    | Sim     | -                        |
| `endereco`             | text                    | Sim     | -                        |
| `payload`              | jsonb                   | Não     | `'{}'::jsonb`            |
| metadados sync/sistema | diversos                | Sim/Não | padrão                   |

**PM:** `supabase/migrations/0001_init.sql:376-406`

---

## 7. Constraints & Invariantes (Consolidado)

### 7.1 Append-Only

Todas as tabelas de evento (`eventos`, `eventos_*`) têm trigger `prevent_business_update`:

- Permite UPDATE apenas de: `deleted_at`, `updated_at`, `server_received_at`
- Bloqueia UPDATE de qualquer outro campo de negócio
- Exceção: Soft delete via `deleted_at`

**PM:** `supabase/migrations/0001_init.sql:81-95` (função), linhas 577-579, 613, 630, 648, 668, 686, 705 (triggers)

### 7.2 RLS por Membership

Todas as tabelas de evento e agenda têm RLS habilitado com policies baseadas em `has_membership(fazenda_id)`.

**PM:** `supabase/migrations/0001_init.sql:718-747`  
**PM (hardening):** `supabase/migrations/0004_rls_hardening.sql`

### 7.3 FKs Compostas / Integridade Tenant

Todas as relações que cruzam tabelas incluem `fazenda_id` na FK composta para garantir tenant isolation:

- `eventos.animal_id` → `animais(id, fazenda_id)`
- `eventos.lote_id` → `lotes(id, fazenda_id)`
- `agenda_itens.animal_id` → `animais(id, fazenda_id)`
- `eventos_financeiro.contraparte_id` → `contrapartes(id, fazenda_id)` (adicionada em 0026)
- etc.

**PM:** `supabase/migrations/0001_init.sql:584-594` (eventos), `0026_fk_eventos_financeiro_contrapartes.sql`

---

## 8. Evidence Index

| Tabela/Feature                | Migration                                   | Linhas Aproximadas | Comando Reproduzível                                                    |
| ----------------------------- | ------------------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `eventos` (envelope)          | 0001_init.sql                               | 541-595            | `rg -n "create table.*eventos" supabase/migrations/0001_init.sql`       |
| `eventos_sanitario`           | 0001_init.sql                               | 597-614            | `rg -n "eventos_sanitario" supabase/migrations/0001_init.sql`           |
| `eventos_pesagem`             | 0001_init.sql                               | 615-631            | `rg -n "eventos_pesagem" supabase/migrations/0001_init.sql`             |
| `eventos_nutricao`            | 0001_init.sql                               | 632-649            | `rg -n "eventos_nutricao" supabase/migrations/0001_init.sql`            |
| `eventos_movimentacao`        | 0001_init.sql                               | 650-669            | `rg -n "eventos_movimentacao" supabase/migrations/0001_init.sql`        |
| `eventos_reproducao`          | 0001_init.sql                               | 670-687            | `rg -n "eventos_reproducao" supabase/migrations/0001_init.sql`          |
| `eventos_financeiro`          | 0001_init.sql                               | 688-706            | `rg -n "eventos_financeiro" supabase/migrations/0001_init.sql`          |
| `agenda_itens`                | 0001_init.sql                               | 476-537            | `rg -n "agenda_itens" supabase/migrations/0001_init.sql`                |
| `protocolos_sanitarios`       | 0001_init.sql                               | 407-434            | `rg -n "protocolos_sanitarios" supabase/migrations/0001_init.sql`       |
| `protocolos_sanitarios_itens` | 0001_init.sql                               | 436-472            | `rg -n "protocolos_sanitarios_itens" supabase/migrations/0001_init.sql` |
| `contrapartes`                | 0001_init.sql                               | 376-406            | `rg -n "contrapartes" supabase/migrations/0001_init.sql`                |
| Financeiro `valor_total > 0`  | 0023_hardening_eventos_financeiro.sql       | 13                 | `rg -n "check.*valor_total" supabase/migrations/`                       |
| Nutrição `quantidade_kg > 0`  | 0024_hardening_eventos_nutricao.sql         | 12                 | `rg -n "check.*quantidade_kg" supabase/migrations/`                     |
| Movimentação constraints      | 0025_hardening_eventos_movimentacao.sql     | 6-10               | `rg -n "ck_evt_mov" supabase/migrations/`                               |
| FK contraparte                | 0026_fk_eventos_financeiro_contrapartes.sql | 5-8                | `rg -n "fk_evt_fin_contraparte" supabase/migrations/`                   |
| Agenda engine sanitária       | 0028_sanitario_agenda_engine.sql            | 1-905              | `ls -lh supabase/migrations/0028_sanitario_agenda_engine.sql`           |
| Reprodução hardening          | 0035_reproducao_hardening_v1.sql            | 1-205              | `rg -n "vw_repro" supabase/migrations/0035_reproducao_hardening_v1.sql` |

---

## 9. Drift/Assunções

### 9.1 Hardening Posterior ao Init

Algumas validações e constraints mencionadas nesta matriz foram adicionadas **após** `0001_init.sql`:

- **`valor_total > 0`** em `eventos_financeiro`: Adicionado em `0023_hardening_eventos_financeiro.sql`
- **`quantidade_kg > 0`** em `eventos_nutricao`: Adicionado em `0024_hardening_eventos_nutricao.sql`
- **Constraints de movimentação destino obrigatório**: Adicionadas em `0025_hardening_eventos_movimentacao.sql`
- **FK contraparte**: Adicionada em `0026_fk_eventos_financeiro_contrapartes.sql`

**Reconciliação:** Estas migrações fazem parte do "baseline Fase 0" (migrations até 0037), portanto são incluídas nesta matriz canônica.

### 9.2 Agenda Engine Sanitária

A geração automática de agenda sanitária via protocolos foi implementada em `0028_sanitario_agenda_engine.sql`:

- Função `sanitario_recompute_agenda_core`
- Triggers em `animais` e `eventos_sanitario`
- Conclusão idempotente via `sanitario_complete_agenda_with_event`

**Status:** Implementado e ativo (baseline Fase 0).

### 9.3 Reprodução Episode Linking

A vinculação de episódios reprodutivos (cobertura/IA → diagnóstico → parto) foi estruturada em `0035_reproducao_hardening_v1.sql`:

- View `vw_repro_episodios`
- View `vw_repro_status_animal`
- Lógica de fallback para episódios sem `episode_evento_id` explícito

**Status:** Implementado e ativo (baseline Fase 0).

---

## Veja Também

- [PLANO_UNIFICACAO_EVENTOS.md](./PLANO_UNIFICACAO_EVENTOS.md) (proposta v2 e roadmap)
- [RECONCILIACAO_REPORT.md](./review/RECONCILIACAO_REPORT.md) (audit report deste baseline)
- [ARCHITECTURE.md](./ARCHITECTURE.md) (Two Rails e offline-first)
- [CONTRACTS.md](./CONTRACTS.md) (sync-batch API)
- [DB.md](./DB.md) (esquema completo do banco)
