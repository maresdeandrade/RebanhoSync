# Contratos de Sincronização

## Endpoint: `/functions/v1/sync-batch`

Edge Function que recebe batches de operações do cliente e as aplica transacionalmente no banco de dados.

---

## Autenticação (Obrigatória)

Todas as requisições **DEVEM** incluir JWT válido no header:

```http
Authorization: Bearer <access_token>
```

### Fluxo de Autenticação

1. Cliente busca sessão via `supabase.auth.getSession()`
2. Extrai `session.access_token`
3. Envia no header Authorization
4. Servidor valida JWT via `supabase.auth.getUser(jwt)`

### Respostas de Autenticação

- **401 Unauthorized**: JWT ausente ou inválido

  ```json
  { "error": "Unauthorized - missing JWT" }
  { "error": "Unauthorized - invalid JWT" }
  ```

- **403 Forbidden**: JWT válido mas usuário não tem membership na `fazenda_id`
  ```json
  { "error": "Forbidden - no access to this farm" }
  ```

---

## Request

### Estrutura

```json
{
  "client_id": "browser:uuid",
  "fazenda_id": "uuid",
  "client_tx_id": "uuid",
  "ops": [
    {
      "client_op_id": "uuid",
      "table": "animais",
      "action": "INSERT",
      "record": {
        "id": "uuid",
        "identificacao": "123",
        "sexo": "M",
        "lote_id": "uuid"
      }
    },
    {
      "client_op_id": "uuid2",
      "table": "eventos",
      "action": "INSERT",
      "record": {
        "id": "uuid",
        "dominio": "movimentacao",
        "occurred_at": "2026-02-05T22:00:00Z",
        "animal_id": "uuid"
      }
    },
    {
      "client_op_id": "uuid3",
      "table": "eventos_movimentacao",
      "action": "INSERT",
      "record": {
        "evento_id": "uuid",
        "from_lote_id": "uuid-old",
        "to_lote_id": "uuid-new"
      }
    },
    {
      "client_op_id": "uuid4",
      "table": "animais",
      "action": "UPDATE",
      "record": {
        "id": "uuid",
        "lote_id": "uuid-new"
      }
    }
  ]
}
```

### Campos

#### Nível de Batch

- **`client_id`** (string): Identificador do cliente (ex: `browser:uuid`, gerado 1x e salvo em localStorage)
- **`fazenda_id`** (uuid): Fazenda alvo da operação (servidor valida membership)
- **`client_tx_id`** (uuid): ID único da transação/gesto (agrupa operações relacionadas)
- **`ops`** (array): Lista de operações a serem aplicadas (ordem importa!)

#### Nível de Operação

- **`client_op_id`** (uuid): ID único da operação (idempotência - duplicata retorna APPLIED)
- **`table`** (string): Nome da tabela remota (ex: `animais`, `eventos`, `eventos_sanitario`)
- **`action`** (string): `INSERT | UPDATE | DELETE`
- **`record`** (object): Dados da operação
  - Para INSERT: payload completo (exceto fazenda_id, client_id, client_op_id, client_tx_id - servidor injeta)
  - Para UPDATE: campos a atualizar + `id` obrigatório
  - Para DELETE: apenas `id` obrigatório (soft delete - servidor seta deleted_at)

### Metadata de Sync (Injetada pelo Servidor)

O servidor **sempre injeta** nos records:

- `fazenda_id`: Valor do request (servidor é autoritativo - ignora valor do cliente)
- `client_id`: Valor do request
- `client_op_id`: Valor da operação
- `client_tx_id`: Valor do request
- `client_recorded_at`: Timestamp não é enviado pelo cliente no record - servidor usa client_recorded_at do gesto local, mas não sobrescreve se vier

---

## Response

### Estrutura

```json
{
  "server_tx_id": "srv-8char",
  "client_tx_id": "uuid",
  "results": [
    { "op_id": "uuid", "status": "APPLIED" },
    { "op_id": "uuid2", "status": "APPLIED" },
    {
      "op_id": "uuid3",
      "status": "REJECTED",
      "reason_code": "ANTI_TELEPORTE",
      "reason_message": "UPDATE animais.lote_id sem evento base de movimentação no mesmo tx"
    },
    {
      "op_id": "uuid4",
      "status": "REJECTED",
      "reason_code": "ANTI_TELEPORTE",
      "reason_message": "..."
    }
  ]
}
```

### Campos

- **`server_tx_id`** (string): ID gerado pelo servidor (padrão: `srv-<8 primeiros chars do client_tx_id>`)
- **`client_tx_id`** (uuid): Echo do client_tx_id do request
- **`results`** (array): Status de cada operação (mesma ordem do request)

### Status de Resposta

#### APPLIED

Sucesso total. Operação aplicada com sucesso ou replay idempotente (client_op_id duplicado).

```json
{ "op_id": "uuid", "status": "APPLIED" }
```

#### APPLIED_ALTERED

Sucesso com modificação. Usado quando o servidor aplica a operação mas com ajustes (ex: dedup de agenda).

```json
{
  "op_id": "uuid",
  "status": "APPLIED_ALTERED",
  "altered": { "dedup": "collision_noop" }
}
```

**Caso de uso**: Agenda com `dedup_key` duplicado. O servidor NÃO cria nova tarefa, mas retorna sucesso alterado (cliente entende que a tarefa já existe).

#### REJECTED

Falha na regra de negócio. **Requer rollback local** pelo cliente.

```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "ANTI_TELEPORTE",
  "reason_message": "UPDATE animais.lote_id sem evento base de movimentação no mesmo tx"
}
```

**Reason Codes**:

- `ANTI_TELEPORTE`: Movimentação sem evento correlato
- `BLOCKED_TABLE`: Tentativa de modificar tabela bloqueada
- `23505`: Unique constraint violation (idempotência ou dedup)
- `VALIDATION_FINANCEIRO_VALOR_TOTAL`: Valor total do evento financeiro deve ser positivo (> 0)
- `VALIDATION_NUTRICAO_QUANTIDADE`: Quantidade de alimento deve ser positiva (> 0) quando informada
- `VALIDATION_MOVIMENTACAO_DESTINO`: Evento de movimentação deve ter destino (`to_lote_id` ou `to_pasto_id`)
- `VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO`: Origem e destino da movimentação não podem ser iguais
- `VALIDATION_FINANCEIRO_CONTRAPARTE`: Contraparte não pertence à mesma fazenda
- `VALIDATION_MISSING_PRIMARY_KEY`: Operação de UPDATE/DELETE sem campo id/evento_id obrigatório
- Outros códigos de erro do Postgres

---

## Regras de Validação por Domínio

### Validações de Eventos Financeiro

| Campo | Regra | Motivo da Validação |
|-------|-------|---------------------|
| `valor_total` | Deve ser maior que zero (`valor_total > 0`) | Previne registros com valores inválidos ou negativos |
| `contraparte_id` | Se informado, deve pertencer à mesma fazenda | Garante integridade referencial tenant-safe |

**Constraint SQL**:
```sql
ALTER TABLE eventos_financeiro
  ADD CONSTRAINT ck_eventos_financeiro_valor_positivo
  CHECK (valor_total > 0);
```

**Exemplo de Rejeição**:
```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "VALIDATION_FINANCEIRO_VALOR_TOTAL",
  "reason_message": "valor_total deve ser maior que zero"
}
```

---

### Validações de Eventos Nutrição

| Campo | Regra | Motivo da Validação |
|-------|-------|---------------------|
| `quantidade_kg` | Se informado, deve ser maior que zero | Previne registros com quantidades inválidas |

**Constraint SQL**:
```sql
ALTER TABLE eventos_nutricao
  ADD CONSTRAINT ck_eventos_nutricao_quantidade_positiva
  CHECK (quantidade_kg IS NULL OR quantidade_kg > 0);
```

**Exemplo de Rejeição**:
```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "VALIDATION_NUTRICAO_QUANTIDADE",
  "reason_message": "quantidade_kg deve ser maior que zero quando informada"
}
```

---

### Validações de Eventos Movimentação

| Campo | Regra | Motivo da Validação |
|-------|-------|---------------------|
| `to_lote_id` ou `to_pasto_id` | Pelo menos um destino deve ser informado | Garante que a movimentação tem destino válido |
| `from_lote_id` vs `to_lote_id` | Não podem ser iguais (se ambos informados) | Previne movimentações circulares sem sentido |
| `from_pasto_id` vs `to_pasto_id` | Não podem ser iguais (se ambos informados) | Previne movimentações circulares sem sentido |

**Constraints SQL**:
```sql
-- Destino obrigatório
ALTER TABLE eventos_movimentacao
  ADD CONSTRAINT ck_eventos_movimentacao_destino
  CHECK (to_lote_id IS NOT NULL OR to_pasto_id IS NOT NULL);

-- Origem diferente de destino (lote)
ALTER TABLE eventos_movimentacao
  ADD CONSTRAINT ck_eventos_movimentacao_lote_origem_destino
  CHECK (from_lote_id IS NULL OR to_lote_id IS NULL OR from_lote_id <> to_lote_id);

-- Origem diferente de destino (pasto)
ALTER TABLE eventos_movimentacao
  ADD CONSTRAINT ck_eventos_movimentacao_pasto_origem_destino
  CHECK (from_pasto_id IS NULL OR to_pasto_id IS NULL OR from_pasto_id <> to_pasto_id);
```

**Exemplos de Rejeição**:
```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "VALIDATION_MOVIMENTACAO_DESTINO",
  "reason_message": "Evento de movimentação deve ter destino (to_lote_id ou to_pasto_id)"
}
```

```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO",
  "reason_message": "Origem e destino da movimentação não podem ser iguais"
}
```

---

### Validações de Eventos Pesagem

| Campo | Regra | Motivo da Validação |
|-------|-------|---------------------|
| `peso_kg` | Deve ser maior que zero | Previne registros com pesos inválidos |

**Constraint SQL** (já existente):
```sql
ALTER TABLE eventos_pesagem
  ADD CONSTRAINT ck_eventos_pesagem_peso_positivo
  CHECK (peso_kg > 0);
```

---

### Validações de Eventos Sanitário

| Campo | Regra | Motivo da Validação |
|-------|-------|---------------------|
| `tipo` | Obrigatório, deve ser enum válido (`vacinacao`, `vermifugacao`, `medicamento`) | Categorização correta do evento |
| `produto` | Obrigatório | Rastreabilidade do produto aplicado |

**Nota**: Validações de `tipo` e `produto` são garantidas pelo schema (NOT NULL + ENUM).

---

### Validações de Chave Primária

| Operação | Campos Obrigatórios | Reason Code |
|----------|---------------------|-------------|
| UPDATE em `animais` | `id` | `VALIDATION_MISSING_PRIMARY_KEY` |
| UPDATE em `eventos` | `id` | `VALIDATION_MISSING_PRIMARY_KEY` |
| UPDATE em `eventos_*` | `evento_id` | `VALIDATION_MISSING_PRIMARY_KEY` |
| UPDATE em `agenda_itens` | `id` | `VALIDATION_MISSING_PRIMARY_KEY` |
| DELETE em qualquer tabela | `id` ou `evento_id` | `VALIDATION_MISSING_PRIMARY_KEY` |

**Exemplo de Rejeição**:
```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "VALIDATION_MISSING_PRIMARY_KEY",
  "reason_message": "Operação UPDATE requer campo 'id' no record"
}
```

---

## Regras de Validação

### 1. Anti-Teleport (Movimentação)

**Regra**: `UPDATE animais.lote_id` **REQUER** evento base + detalhe de movimentação no **mesmo batch**.

**Validação Pré-Aplicação** (antes de executar qualquer operação):

1. Servidor mapeia `animal_id` → `evento_id` para todas ops com `table=eventos`, `action=INSERT`, `dominio=movimentacao`
2. Servidor mapeia `evento_id` de todas ops com `table=eventos_movimentacao`, `action=INSERT`
3. Para cada `UPDATE animais` com `lote_id` alterado:
   - Verifica se existe evento base para este `animal_id`
   - Verifica se existe detalhe `eventos_movimentacao` com este `evento_id`
   - Se **qualquer** validação falhar → **REJEITA TODO O BATCH**

**Atomicidade**: Se anti-teleport falhar, **todas as operações do batch retornam REJECTED** (previne estado inconsistente).

**Exemplo de Batch Válido**:

```json
{
  "ops": [
    {
      "table": "eventos",
      "action": "INSERT",
      "record": { "id": "evt1", "dominio": "movimentacao", "animal_id": "a1" }
    },
    {
      "table": "eventos_movimentacao",
      "action": "INSERT",
      "record": {
        "evento_id": "evt1",
        "from_lote_id": "l1",
        "to_lote_id": "l2"
      }
    },
    {
      "table": "animais",
      "action": "UPDATE",
      "record": { "id": "a1", "lote_id": "l2" }
    }
  ]
}
```

**Exemplo de Batch Inválido**:

```json
{
  "ops": [
    {
      "table": "animais",
      "action": "UPDATE",
      "record": { "id": "a1", "lote_id": "l2" }
    }
  ]
}
// REJECTED: UPDATE lote_id sem evento correlato
```

---

### 2. Blocked Tables

**Regra**: Tabelas sensíveis **não podem** ser modificadas via `sync-batch`.

**Tabelas Bloqueadas**:

- `user_fazendas` (membership só via RPC)
- `user_profiles` (self-only via RLS)
- `user_settings` (self-only via RLS)

**Resposta**:

```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "BLOCKED_TABLE",
  "reason_message": "Table user_fazendas cannot be modified via sync"
}
```

---

### 3. Tenant Consistency (Server Authoritative)

**Regra**: O `fazenda_id` do **request** é sempre autoritativo. Servidor **ignora** `fazenda_id` nos records individuais.

**Código do servidor**:

```typescript
const record = { ...op.record };
if (TABLES_WITH_FAZENDA.has(op.table)) {
  record.fazenda_id = fazenda_id; // Force request fazenda_id
}
```

**Motivo**: Previne ataques onde cliente tenta inserir dados em outra fazenda.

---

### 4. Deduplicação de Agenda

**Regra**: `agenda_itens` com mesmo `dedup_key` e `status=agendado` na mesma fazenda **não duplicam**.

**Índice**:

```sql
CREATE UNIQUE INDEX ux_agenda_dedup_active
  ON agenda_itens(fazenda_id, dedup_key)
  WHERE status = 'agendado' AND deleted_at IS NULL AND dedup_key IS NOT NULL;
```

**Resposta em Colisão**:

```json
{
  "op_id": "uuid",
  "status": "APPLIED_ALTERED",
  "altered": { "dedup": "collision_noop" }
}
```

Cliente interpreta como: "Tarefa já existe, não é erro".

---

### 5. Idempotência (client_op_id)

**Regra**: Operações com `client_op_id` duplicado retornam `APPLIED` sem executar novamente.

**Índice**:

```sql
CREATE UNIQUE INDEX ux_fazendas_op
  ON fazendas(client_op_id)
  WHERE deleted_at IS NULL;
```

**Cenário**:

1. Cliente envia op com `client_op_id=abc123`
2. Servidor aplica com sucesso
3. Cliente perde conexão antes de receber resposta
4. Cliente re-envia mesma op (`client_op_id=abc123`)
5. Postgres rejeita com `23505: unique_violation`
6. Servidor interpreta como idempotência e retorna `APPLIED`

**Código do servidor**:

```typescript
if (error.code === "23505") {
  // Idempotência: já aplicado
  results.push({ op_id: op.client_op_id, status: "APPLIED" });
}
```

---

## HTTP Status Codes

### 200 OK

Batch processado. **Não significa sucesso total** - verificar `results[].status` individual.

```json
{
  "server_tx_id": "srv-abc123de",
  "client_tx_id": "uuid",
  "results": [
    { "op_id": "uuid1", "status": "APPLIED" },
    { "op_id": "uuid2", "status": "REJECTED", "reason_code": "..." }
  ]
}
```

### 401 Unauthorized

JWT ausente ou inválido.

```json
{ "error": "Unauthorized - missing JWT" }
{ "error": "Unauthorized - invalid JWT" }
```

### 403 Forbidden

JWT válido mas usuário não tem membership na `fazenda_id`.

```json
{ "error": "Forbidden - no access to this farm" }
```

### 500 Internal Server Error

Erro fatal no servidor (não relacionado a regras de negócio).

```json
{ "error": "Error message" }
```

---

## Ordem de Execução (Importante!)

Operações são aplicadas **na ordem do array `ops`**. Cliente deve ordenar dependências corretamente:

### Exemplo: Criar Animal + Evento Sanitário

```json
{
  "ops": [
    { "table": "animais", "action": "INSERT", "record": { "id": "a1", ... } },
    { "table": "eventos", "action": "INSERT", "record": { "id": "e1", "animal_id": "a1", ... } },
    { "table": "eventos_sanitario", "action": "INSERT", "record": { "evento_id": "e1", ... } }
  ]
}
```

**Ordem correta**: Animal → Evento → Detalhe

**Ordem incorreta** (ERRO):

```json
{
  "ops": [
    { "table": "eventos", "action": "INSERT", "record": { "id": "e1", "animal_id": "a1", ... } },
    { "table": "animais", "action": "INSERT", "record": { "id": "a1", ... } }
  ]
}
// REJECTED: foreign key constraint (animal_id não existe ainda)
```

---

## Tratamento de Rejeições (Cliente)

### Fluxo do Cliente após REJECTED

1. Servidor retorna `results` com pelo menos uma op `REJECTED`
2. Cliente marca gesto como `status=REJECTED` em `queue_gestures`
3. Cliente executa **rollback determinístico**:
   ```typescript
   await db.transaction("rw", [...getAffectedStores(ops)], async () => {
     for (const op of [...ops].reverse()) {
       await rollbackOpLocal(op);
     }
   });
   ```
4. Cliente salva rejection em `queue_rejections` para notificar usuário:
   ```typescript
   await db.queue_rejections.add({
     client_tx_id,
     client_op_id,
     fazenda_id,
     table: op.table,
     action: op.action,
     reason_code,
     reason_message,
     created_at: new Date().toISOString(),
   });
   ```

### Rollback em Ordem Reversa

Necessário para dependências (ex: evento → detalhe → atualização de animal):

```typescript
// Ordem de aplicação otimista:
// 1. INSERT evento
// 2. INSERT detalhe
// 3. UPDATE animal

// Ordem de rollback (reversa):
// 1. Reverte UPDATE animal (restaura before_snapshot)
// 2. DELETE detalhe (INSERT revertido)
// 3. DELETE evento (INSERT revertido)
```

---

## Retry e Persistência

### Retry (falhas de rede)

- Cliente retenta até **3 vezes** (retry_count < 3)
- Após 3 falhas, gesto vai para `status=ERROR`
- Cliente **NÃO** retenta gestos `REJECTED` (são erros de negócio, não de rede)

### GestureStatus State Machine

```
PENDING → SYNCING → DONE (sucesso)
                  → REJECTED (rollback feito)
                  → PENDING (retry < 3)
                  → ERROR (retry >= 3)
```

### Persistência de Erros

- `queue_rejections`: Erros de negócio (REJECTED)
- `queue_gestures.last_error`: Erros de rede/sistema
- Ambos permitem que UI mostre feedback ao usuário
