# Contratos de Sincronização

## Endpoint: `/functions/v1/sync-batch`

Edge Function que recebe batches de operações do cliente e as aplica **sequencialmente** no banco de dados.

> **Nota sobre Atomicidade**: O batch **NÃO** é executado em uma transação única de banco de dados (exceto pela validação de Anti-Teleport que rejeita tudo antes da execução). Se uma operação falhar no meio do batch, as anteriores **permanecem aplicadas**. O cliente é responsável por lidar com falhas parciais (rollback local) e eventual consistência.

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
5. Servidor valida membership em `user_fazendas` (role e deleted_at)

### Respostas de Autenticação

- **401 Unauthorized**: JWT ausente, malformado ou inválido (expirado/revogado)

  ```json
  { "error": "Unauthorized - missing JWT" }
  { "error": "Unauthorized - invalid JWT" }
  ```

- **403 Forbidden**: JWT válido mas usuário não tem membership ativo na `fazenda_id`
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
      "table": "eventos_reproducao",
      "action": "INSERT",
      "record": {
        "evento_id": "uuid",
        "tipo": "cobertura",
        "macho_id": "uuid-touro",
        "payload": {
          "schema_version": 1
        }
      }
    }
  ]
}
```

### Campos

#### Nível de Batch

- **`client_id`** (string): Identificador do cliente (ex: `browser:uuid`)
- **`fazenda_id`** (uuid): Fazenda alvo da operação (servidor valida membership)
- **`client_tx_id`** (uuid): ID único da transação/gesto (agrupa operações relacionadas)
- **`ops`** (array): Lista de operações a serem aplicadas (ordem importa!)

#### Nível de Operação

- **`client_op_id`** (uuid): ID único da operação (idempotência - duplicata retorna APPLIED)
- **`table`** (string): Nome da tabela remota (ex: `animais`, `eventos`, `eventos_reproducao`)
- **`action`** (string): `INSERT | UPDATE | DELETE`
- **`record`** (object): Dados da operação
  - Para INSERT: payload completo (exceto metadados injetados pelo servidor)
  - Para UPDATE: campos a atualizar + `id` (ou PK) obrigatório
  - Para DELETE: `id` (ou PK) obrigatório (soft delete - servidor seta `deleted_at`)

### Metadata de Sync (Injetada pelo Servidor)

O servidor **sempre injeta/sobrescreve** nos records para tabelas com tenant (`TABLES_WITH_FAZENDA`):

- `fazenda_id`: Valor do request (servidor é autoritativo - ignora valor do cliente)
- `client_id`: Valor do request
- `client_op_id`: Valor da operação
- `client_tx_id`: Valor do request

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
      "reason_message": "UPDATE animais.lote_id sem evento base de movimentacao no mesmo tx"
    }
  ]
}
```

### Campos

- **`server_tx_id`** (string): ID gerado pelo servidor (`srv-` + 8 primeiros chars do `client_tx_id`)
- **`client_tx_id`** (uuid): Echo do client_tx_id do request
- **`results`** (array): Status de cada operação (mesma ordem do request)

### Status de Resposta

#### APPLIED

Sucesso total. Operação aplicada com sucesso ou replay idempotente (client_op_id duplicado - código `23505`).

```json
{ "op_id": "uuid", "status": "APPLIED" }
```

#### APPLIED_ALTERED

Sucesso com modificação. Usado especificamente para `agenda_itens` quando ocorre colisão de `dedup_key` (código `23505` específico).

```json
{
  "op_id": "uuid",
  "status": "APPLIED_ALTERED",
  "altered": { "dedup": "collision_noop" }
}
```

**Significado**: A tarefa já existe. O cliente deve tratar como sucesso (noop).

#### REJECTED

Falha na regra de negócio ou erro de banco. **Requer rollback local** pelo cliente.

```json
{
  "op_id": "uuid",
  "status": "REJECTED",
  "reason_code": "ANTI_TELEPORTE",
  "reason_message": "UPDATE animais.lote_id sem evento base de movimentacao no mesmo tx"
}
```

---

## Reason Codes (Mapeamento Autoritativo)

O servidor normaliza erros do banco e validações de negócio para os seguintes códigos:

### Validações de Negócio (Pré-Insert)

| Código | Descrição |
| :--- | :--- |
| `SECURITY_BLOCKED_TABLE` | Tentativa de modificar tabela bloqueada (`user_fazendas`, `user_profiles`, `user_settings`) |
| `ANTI_TELEPORTE` | Falha na validação estrita de movimentação (ver regras abaixo) |
| `PAYLOAD_SCHEMA_VERSION_REQUIRED` | `eventos_reproducao` requer `payload.schema_version: 1` |
| `VALIDATION_ERROR` | Erro genérico de validação (ex: Macho ID obrigatório em Cobertura/IA) |
| `INVALID_EPISODE_REFERENCE` | `episode_evento_id` inválido ou não encontrado em `eventos_reproducao` |
| `EPISODE_LINK_REQUIRED_FOR_PARTO` | Parto requer vínculo com evento de serviço anterior |
| `VALIDATION_MISSING_PRIMARY_KEY` | UPDATE/DELETE sem ID ou PK |

### Erros de Banco (Pós-Insert)

Mapeamento de exceções do Postgres (`normalizeDbError`):

| Código | Origem (Constraint/Erro) | Descrição |
| :--- | :--- | :--- |
| `VALIDATION_FINANCEIRO_VALOR_TOTAL` | `ck_evt_fin_valor_total_pos` | Valor total deve ser positivo |
| `VALIDATION_NUTRICAO_QUANTIDADE` | `ck_evt_nutricao_quantidade_pos_nullable` | Quantidade deve ser positiva |
| `VALIDATION_MOVIMENTACAO_DESTINO` | `ck_evt_mov_destino_required` | Destino (lote ou pasto) obrigatório |
| `VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO` | `ck_evt_mov_from_to_diff` | Origem e destino devem ser diferentes |
| `VALIDATION_FINANCEIRO_CONTRAPARTE` | `fk_evt_fin_contraparte_fazenda` | Contraparte deve pertencer à mesma fazenda |
| `CHECK_CONSTRAINT_VIOLATION` | Outros `23514` | Violação de check constraint genérica |
| `FOREIGN_KEY_VIOLATION` | Outros `23503` | Violação de chave estrangeira genérica |
| `NOT_NULL_VIOLATION` | `23502` | Campo obrigatório nulo |
| `INVALID_INPUT_SYNTAX` | `22P02` | Erro de sintaxe (ex: UUID inválido) |
| `PERMISSION_DENIED` | `42501` | Permissão negada (RLS) |
| `DB_<code>` | Outros | Fallback para código do Postgres (ex: `DB_23505` se não tratado) |
| `INTERNAL_ERROR` | Exception | Erro não tratado no servidor |

---

## Regras de Validação Específicas

### 1. Anti-Teleport (Movimentação)

**Escopo**: Batch inteiro. Se falhar, **todo o batch retorna REJECTED** (atomicidade simulada na validação).

**Ativação**: Depende de Feature Flag `strict_anti_teleport` (configurável em `fazendas.metadata`).

**Regra**: `UPDATE animais` alterando `lote_id` ou `pasto_id` **REQUER**:
1. Evento base (`eventos`) com `dominio='movimentacao'` no mesmo batch.
2. Detalhe (`eventos_movimentacao`) vinculado ao evento base no mesmo batch.
3. Exceção: Venda (`eventos` financeiro + `eventos_financeiro` tipo venda) permite saída do lote/pasto (setar null).

**Erro**:
- `reason_code`: `ANTI_TELEPORTE`
- `reason_message`: "UPDATE animais.lote_id/pasto_id sem evento base de movimentacao no mesmo tx" ou "Evento de movimentacao sem detalhe correlato..."

### 2. Eventos de Reprodução (Hardening)

**Regra 1**: Payload Versioning
- Todo INSERT em `eventos_reproducao` deve ter `record.payload.schema_version = 1`.
- Erro: `PAYLOAD_SCHEMA_VERSION_REQUIRED`.

**Regra 2**: Macho Obrigatório
- Tipos `cobertura` e `IA` exigem `macho_id`.
- Erro: `VALIDATION_ERROR`.

**Regra 3**: Episode Linking (Parto/Diagnóstico)
- Se `episode_evento_id` for fornecido: Servidor valida existência e tipo (deve ser Cobertura/IA).
- Se `tipo='parto'` e link não fornecido: Erro `EPISODE_LINK_REQUIRED_FOR_PARTO`.
- Se `tipo='diagnostico'` e link não fornecido: Aceita (pode ser "unlinked" se configurado).

### 3. Blocked Tables

**Regra**: Tabelas sensíveis de sistema não podem ser modificadas via sync.
- `user_fazendas`
- `user_profiles`
- `user_settings`

**Erro**: `SECURITY_BLOCKED_TABLE`.

### 4. Tenant Consistency

**Regra**: O `fazenda_id` do **request** sobrescreve qualquer `fazenda_id` enviado nos records das tabelas tenant-scoped.
- Isso previne injeção de dados em outros tenants.

---

## Ordem de Execução

As operações são executadas **sequencialmente** na ordem do array `ops`.
- O servidor **NÃO** reordena operações.
- O cliente é responsável por enviar dependências antes de dependentes (ex: INSERT Animal antes de INSERT Evento).

---

## Compatibilidade com Cliente

### Tratamento de Rejeições

O cliente deve monitorar `results` por `status: REJECTED`.
- Se houver **qualquer** rejeição, o cliente deve realizar **rollback local** das operações otimistas.
- A rejeição deve ser registrada em `queue_rejections` para feedback ao usuário.
- O Gesto (transação) deve ser marcado como `REJECTED` e não retentado automaticamente.

### Tratamento de Idempotência

- `APPLIED` em operação já existente (replay) é considerado sucesso.
- O cliente não precisa fazer nada.

### Tratamento de Dedup (Agenda)

- `APPLIED_ALTERED` com `altered.dedup = 'collision_noop'` é considerado sucesso.
- O cliente deve manter o item de agenda local como "sincronizado".
