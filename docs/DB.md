# Database Schema - RebanhoSync

> **Status:** Normativo
> **Fonte de Verdade:** Migrations PostgreSQL (Supabase)
> **Última Atualização:** 2026-02-16

Este documento define o schema lógico do banco de dados, alinhado às migrações aplicadas.

---

## 1. Tenant & Auth

O sistema é Multi-Tenant (por `fazenda_id`) e utiliza RLS para isolamento.

### `fazendas`

- **PK:** `id` (uuid)
- **Dados:** `nome`, `codigo`, `municipio`, `timezone`.
- **Extensões:** `estado`, `cep`, `area_total_ha`, `tipo_producao`, `sistema_manejo`, `benfeitorias` (jsonb).
- **Sync:** `client_*`, `server_received_at`, `deleted_at`.

### `user_fazendas`

Tabela de associação (Membership) N:N.

- **PK:** `(user_id, fazenda_id)`
- **Dados:** `role` (owner, manager, cowboy), `is_primary`.

### `farm_invites`

Sistema de convites.

- **PK:** `id`
- **Dados:** `token`, `status`, `expires_at`, `role`.

---

## 2. Entidades Administrativas

### `protocolos_sanitarios`

Cabeçalho de protocolos.

- **FK:** `fazenda_id`

### `protocolos_sanitarios_itens`

Regras de aplicação.

- **Dados:** `tipo`, `produto`, `intervalo_dias`, `gera_agenda`, `dedup_template`.

### `contrapartes`

Pessoas ou empresas (compradores, vendedores).

- **Dados:** `tipo`, `documento`, `telefone`.

### `categorias_zootecnicas` (Planejado - Fase 2)

Regras de classificação automática (Idade/Sexo).

---

## 3. State (Estado Operacional)

Active Record do sistema.

### `pastos`

Locais físicos.

- **Dados:** `capacidade_ua`, `tipo_pasto`.

### `lotes`

Agrupamento lógico.

- **FK:** `pasto_id`.

### `animais`

Cabeças de gado.

- **FK:** `lote_id`, `pai_id`, `mae_id`.
- **Dados:** `identificacao`, `sexo`, `status` (ativo/vendido/morto), `origem`.

### `animais_sociedade` (Planejado - Fase 2)

Rastreio de propriedade de terceiros.

---

## 4. Agenda (Rail 1)

### `agenda_itens`

Planejamento futuro.

- **FK:** `animal_id`, `lote_id`.
- **Dados:** `status`, `data_prevista`, `dedup_key`.
- **Unique:** `(fazenda_id, dedup_key)` para itens agendados.

---

## 5. Eventos (Rail 2 - Append-Only)

Histórico imutável.

### `eventos` (Header)

Tabela mãe.

- **FK:** `source_task_id`, `corrige_evento_id`.
- **Dados:** `dominio`, `occurred_at`.

### Detalhes por Domínio

- **`eventos_sanitario`**: `tipo`, `produto`.
- **`eventos_pesagem`**: `peso_kg`.
- **`eventos_nutricao`**: `alimento_nome`, `quantidade_kg`.
- **`eventos_movimentacao`**: `from_lote_id`, `to_lote_id`.
- **`eventos_reproducao`**: `tipo`, `macho_id`.
- **`eventos_financeiro`**: `tipo`, `valor_total`, `contraparte_id`.

---

## 6. Sincronização e Auditoria

Todas as tabelas de negócio possuem o "Envelope de Sync":

- `client_id`, `client_tx_id`, `client_op_id`
- `client_recorded_at`, `server_received_at`
- `deleted_at` (Soft Delete)

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**RLS.md**](./RLS.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
