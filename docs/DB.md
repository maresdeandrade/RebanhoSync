# Database Schema - Gestão Pecuária

## Estrutura de Tabelas

O banco de dados é dividido em quatro grandes grupos:

### 1. Tenant & Auth (4 tabelas)

- **`fazendas`** - Raiz do tenant (multi-farm). Cada fazenda é isolada das demais.
- **`user_fazendas`** - Membership (user ↔ fazenda + role). Relacionamento N:N com papéis.
- **`user_profiles`** - Perfil do usuário (display_name, phone, avatar_url, locale, timezone).
- **`user_settings`** - Preferências do usuário (theme, date_format, notifications, sync_prefs, **active_fazenda_id**).

### 2. State (Estado Atual) (7 tabelas)

- **`pastos`** - Áreas de pastagem (nome, area_ha, capacidade_ua, benfeitorias).
- **`lotes`** - Grupos de animais (nome, status: ativo/inativo, pasto_id, touro_id).
- **`animais`** - Rebanho (identificacao, sexo, status: ativo/vendido/morto, lote_id, pai_id, mae_id).
- **`contrapartes`** - Pessoas/empresas (tipo: pessoa/empresa, nome, documento, telefone, email).
- **`protocolos_sanitarios`** - Protocolos de vacinação/tratamento (nome, descricao, ativo).
- **`protocolos_sanitarios_itens`** - Itens do protocolo (tipo, produto, intervalo_dias, dose_num, gera_agenda, dedup_template).

### 3. Agenda (Mutável) (1 tabela)

- **`agenda_itens`** - Tarefas agendadas (dominio, tipo, status: agendado → concluido/cancelado, data_prevista, animal_id/lote_id, dedup_key).

### 4. Eventos (Append-Only) (7 tabelas)

- **`eventos`** - Eventos base (dominio, occurred_at, animal_id/lote_id, source_task_id, corrige_evento_id).
- **`eventos_sanitario`** - Detalhe 1:1 (tipo: vacinacao/vermifugacao/medicamento, produto).
- **`eventos_pesagem`** - Detalhe 1:1 (peso_kg).
- **`eventos_nutricao`** - Detalhe 1:1 (alimento_nome, quantidade_kg).
- **`eventos_movimentacao`** - Detalhe 1:1 (from_lote_id, to_lote_id, from_pasto_id, to_pasto_id).
- **`eventos_reproducao`** - Detalhe 1:1 (tipo: cobertura/IA/diagnostico/parto, macho_id).
- **`eventos_financeiro`** - Detalhe 1:1 (tipo: compra/venda, valor_total, contraparte_id).

---

## Tipos Enum

O sistema define 13 tipos enum para garantir consistência de dados:

### Controle de Acesso

- **`farm_role_enum`**: `cowboy | manager | owner`

### Animais

- **`sexo_enum`**: `M | F`
- **`animal_status_enum`**: `ativo | vendido | morto`
- **`papel_macho_enum`**: `reprodutor | rufiao`

### Gestão

- **`lote_status_enum`**: `ativo | inativo`
- **`contraparte_tipo_enum`**: `pessoa | empresa`

### Eventos e Agenda

- **`dominio_enum`**: `sanitario | pesagem | nutricao | movimentacao | reproducao | financeiro`
- **`agenda_status_enum`**: `agendado | concluido | cancelado`
- **`agenda_source_kind_enum`**: `manual | automatico`

### Detalhes de Eventos

- **`sanitario_tipo_enum`**: `vacinacao | vermifugacao | medicamento`
- **`repro_tipo_enum`**: `cobertura | IA | diagnostico | parto`
- **`financeiro_tipo_enum`**: `compra | venda`

### Preferências

- **`theme_enum`**: `system | light | dark`

---

## FKs Compostas (Multi-tenant)

Para garantir o isolamento total entre fazendas (tenants), utilizamos **chaves estrangeiras compostas** `(id, fazenda_id)`.

### Por que FKs Compostas?

Isso impede que um animal da Fazenda A seja movido para um lote da Fazenda B, **mesmo que o atacante conheça o UUID do lote**. A integridade referencial é verificada no nível do banco.

### Exemplos

```sql
-- Animal só pode referenciar lote da MESMA fazenda
ALTER TABLE animais
  ADD CONSTRAINT fk_animais_lote
  FOREIGN KEY (lote_id, fazenda_id)
  REFERENCES lotes(id, fazenda_id);

-- Lote só pode referenciar pasto da MESMA fazenda
ALTER TABLE lotes
  ADD CONSTRAINT fk_lotes_pasto
  FOREIGN KEY (pasto_id, fazenda_id)
  REFERENCES pastos(id, fazenda_id);
```

---

## Idempotência e Offline-first

Cada tabela possui um **índice de unicidade** baseado em `(fazenda_id, client_op_id)` (ou apenas `client_op_id` para tabelas sem tenant).

### client_op_id

Um UUID gerado no frontend **no momento do gesto do usuário**.

### Garantia de Idempotência

Se o app tentar sincronizar a mesma operação duas vezes (devido a instabilidade de rede), o banco **rejeitará a duplicata**, mantendo o estado consistente.

```sql
CREATE UNIQUE INDEX ux_fazendas_op
  ON fazendas(client_op_id)
  WHERE deleted_at IS NULL;
```

---

## Dedup de Agenda

A tabela `agenda_itens` possui um **índice parcial de deduplicação** para evitar tarefas duplicadas quando protocolos automáticos disparam repetidamente.

### Índice de Dedup

```sql
CREATE UNIQUE INDEX ux_agenda_dedup_active
  ON agenda_itens(fazenda_id, dedup_key)
  WHERE status = 'agendado' AND deleted_at IS NULL AND dedup_key IS NOT NULL;
```

### Constraint de Negócio

```sql
CONSTRAINT ck_agenda_dedup_automatico
  CHECK (source_kind = 'manual' OR dedup_key IS NOT NULL)
```

Se `source_kind = 'automatico'`, a agenda **DEVE** ter `dedup_key` preenchido.

### Resposta do Servidor em Colisão

Quando o `sync-batch` detecta colisão de `dedup_key`, retorna:

```json
{ "status": "APPLIED_ALTERED", "altered": { "dedup": "collision_noop" } }
```

Não é um erro — o cliente entende que a tarefa já existe.

---

## Funções de Trigger

### set_updated_at()

Atualiza automaticamente `updated_at = now()` em **todas as tabelas** antes de qualquer `UPDATE`.

```sql
CREATE TRIGGER trg_animais_updated_at
  BEFORE UPDATE ON animais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### prevent_business_update() (Append-Only Guard)

Garante que eventos são **append-only**: bloqueia `UPDATE` em colunas de negócio.

**Permite apenas**:

- `deleted_at`
- `updated_at`
- `server_received_at`

**Bloqueia**:

- Todas as outras colunas (ex: `peso_kg`, `produto`, `occurred_at`, etc.)

```sql
CREATE TRIGGER trg_eventos_append_only
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION prevent_business_update();
```

Se tentarem alterar colunas de negócio, o trigger lança exceção:

```
Append-only violation on eventos. Updates to business columns are not allowed.
```

---

## Views (Helpers)

Views para simplificar queries de dados ativos (não deletados):

- **`vw_animais_active`**: `SELECT * FROM animais WHERE deleted_at IS NULL`
- **`vw_lotes_active`**: `SELECT * FROM lotes WHERE deleted_at IS NULL`
- **`vw_pastos_active`**: `SELECT * FROM pastos WHERE deleted_at IS NULL`
- **`vw_agenda_active`**: `SELECT * FROM agenda_itens WHERE deleted_at IS NULL AND status = 'agendado'`

Uso:

```sql
SELECT * FROM vw_animais_active WHERE fazenda_id = :fazenda_id;
```

---

## RPCs (Security Definer)

O sistema usa **Stored Procedures** com `SECURITY DEFINER` para operações críticas que **não podem ser expostas diretamente** via RLS.

### 1. handle_new_user() (Trigger)

**Migração**: `0002_user_auto_provision.sql`

**Propósito**: Auto-provisiona `user_profiles` e `user_settings` quando um novo usuário se autentica via Supabase Auth.

**Trigger**: `AFTER INSERT ON auth.users`

**Ação**:

- Cria `user_profiles` com `display_name` do metadata ou email
- Cria `user_settings` com defaults (theme: system, locale: pt-BR, timezone: America/Sao_Paulo)

---

### 2. create_fazenda(nome, codigo, municipio)

**Migração**: `0003_create_fazenda_rpc.sql`

**Propósito**: Cria uma nova fazenda, adiciona o criador como `owner`, e define como `active_fazenda_id`.

**Fluxo**:

1. Insere em `fazendas` (created_by = auth.uid())
2. Insere em `user_fazendas` (role = 'owner', is_primary = true)
3. **UPSERT** em `user_settings` (active_fazenda_id = nova fazenda)

**Retorna**: `fazenda_id` (UUID)

**Exemplo**:

```sql
SELECT create_fazenda('Fazenda Santa Maria', 'FSM-001', 'São Paulo');
```

---

### 3. admin_set_member_role(fazenda_id, target_user_id, new_role)

**Migração**: `0005_member_management_rpcs.sql`

**Propósito**: Alterar o role de um membro na fazenda.

**Permissões**:

- **owner**: pode alterar qualquer role (exceto rebaixar o último owner)
- **manager**: pode alterar roles **NÃO-owner** (não promove/rebaixa owner)

**Safeguards**:

- ❌ Manager não pode alterar role de owner
- ❌ Apenas owner pode promover para owner
- ❌ Não pode rebaixar o último owner da fazenda

**Exemplo**:

```sql
SELECT admin_set_member_role(
  'uuid-da-fazenda',
  'uuid-do-usuario',
  'manager'
);
```

---

### 4. admin_remove_member(fazenda_id, target_user_id)

**Migração**: `0005_member_management_rpcs.sql`

**Propósito**: Remover membro da fazenda (soft delete).

**Permissões**: **owner only**

**Safeguards**:

- ❌ Não pode remover o último owner da fazenda

**Ação**:

```sql
UPDATE user_fazendas
SET deleted_at = now(), updated_at = now()
WHERE user_id = target_user_id
  AND fazenda_id = fazenda_id
  AND deleted_at IS NULL;
```

---

## Metadata de Sync (Todas as Tabelas)

Todas as tabelas incluem colunas de sincronização offline-first:

- **`client_id`**: Identifica o cliente (ex: `browser:uuid`, `server`)
- **`client_op_id`**: UUID único da operação (idempotência)
- **`client_tx_id`**: UUID da transação/gesto (agrupa operações)
- **`client_recorded_at`**: Timestamp de quando o usuário fez a ação (timezone-aware)
- **`server_received_at`**: Timestamp de quando o servidor recebeu (default: now())
- **`deleted_at`**: Soft delete (NULL = ativo)
- **`created_at`**: Timestamp de criação
- **`updated_at`**: Timestamp de última atualização (auto via trigger)

Essas colunas permitem:

- Rastreamento de origem (dispositivo/servidor)
- Replay idempotente (mesma `client_op_id` não duplica)
- Auditoria completa (quem criou, quando, de onde)
