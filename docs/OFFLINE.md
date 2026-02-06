# Estratégia Offline-First

O sistema utiliza **Dexie.js** (IndexedDB) para persistência local e uma arquitetura de fila de gestos para sincronização.

---

## Stores Dexie

### Categorias de Stores (12 total)

#### 1. **state\_\*** (7 stores) - Cópia local para leitura instantânea

Replica o estado atual das tabelas do Supabase para queries locais (offline).

- **`state_animais`**: Rebanho completo
  - Índices: `id`, `[fazenda_id+identificacao]`, `[fazenda_id+lote_id]`, `fazenda_id`
- **`state_lotes`**: Grupos de animais
  - Índices: `id`, `fazenda_id`
- **`state_pastos`**: Áreas de pastagem
  - Índices: `id`, `fazenda_id`
- **`state_agenda_itens`**: Tarefas agendadas
  - Índices: `id`, `fazenda_id`, `[fazenda_id+data_prevista]`
- **`state_contrapartes`**: Compradores/vendedores
  - Índices: `id`, `fazenda_id`
- **`state_protocolos_sanitarios`**: Protocolos de vacinação
  - Índices: `id`, `fazenda_id`
- **`state_protocolos_sanitarios_itens`**: Itens dos protocolos
  - Índices: `id`, `fazenda_id`, `protocolo_id`

#### 2. **event\_\*** (7 stores) - Log local de eventos ocorridos

Replica eventos append-only para visualização offline (timeline, histórico).

- **`event_eventos`**: Eventos base
  - Índices: `id`, `[fazenda_id+animal_id+occurred_at]`, `fazenda_id`
- **`event_eventos_sanitario`**: Detalhe 1:1 (vacinação/vermifugação/medicamento)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_pesagem`**: Detalhe 1:1 (peso em kg)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_nutricao`**: Detalhe 1:1 (alimento, quantidade)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_movimentacao`**: Detalhe 1:1 (origem/destino lote/pasto)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_reproducao`**: Detalhe 1:1 (cobertura, IA, diagnóstico, parto)
  - Índices: `evento_id`, `fazenda_id`
- **`event_eventos_financeiro`**: Detalhe 1:1 (compra, venda, valor)
  - Índices: `evento_id`, `fazenda_id`

#### 3. **queue\_\*** (3 stores) - Fila de sincronização

Gerencia operações pendentes e erros de sync.

- **`queue_gestures`**: Metadados de transações
  - Índices: `client_tx_id`, `[status+created_at]`, `fazenda_id`
  - Campos: `client_tx_id`, `fazenda_id`, `client_id`, `status`, `last_error`, `retry_count`, `created_at`
- **`queue_ops`**: Operações individuais com snapshots para rollback
  - Índices: `client_op_id`, `client_tx_id`, `fazenda_id`
  - Campos: `client_op_id`, `client_tx_id`, `table`, `action`, `record`, `before_snapshot`, `created_at`
- **`queue_rejections`**: Erros do servidor que exigem ação do usuário
  - Índices: `++id`, `client_tx_id`, `fazenda_id`
  - Campos: `id` (auto-increment), `client_tx_id`, `client_op_id`, `fazenda_id`, `table`, `action`, `reason_code`, `reason_message`, `created_at`

---

## Mapeamento de Tabelas (tableMap.ts)

### Nomenclatura Dual (Remoto ↔ Local)

O sistema usa nomenclatura diferente no Supabase vs Dexie para separar concerns:

- **Remoto** (Supabase): `animais`, `eventos`, `agenda_itens`
- **Local** (Dexie): `state_animais`, `event_eventos`, `state_agenda_itens`

### Funções de Tradução

#### getLocalStoreName(remoteTable)

Converte nome remoto → local.

```typescript
getLocalStoreName("animais"); // → "state_animais"
getLocalStoreName("eventos"); // → "event_eventos"
getLocalStoreName("eventos_pesagem"); // → "event_eventos_pesagem"
getLocalStoreName("agenda_itens"); // → "state_agenda_itens"
```

**Regra**: Se já vier no formato local (`state_*`, `event_*`), retorna como está.

#### getRemoteTableName(storeOrRemote)

Converte nome local → remoto.

```typescript
getRemoteTableName("state_animais"); // → "animais"
getRemoteTableName("event_eventos"); // → "eventos"
getRemoteTableName("event_eventos_pesagem"); // → "eventos_pesagem"
getRemoteTableName("animais"); // → "animais" (já é remoto)
```

**Regra**: Se já vier remoto (existe em TABLE_MAP), retorna como está.

### TABLE_MAP

```typescript
const TABLE_MAP: Record<string, string> = {
  // State Rails
  animais: "state_animais",
  lotes: "state_lotes",
  pastos: "state_pastos",
  agenda_itens: "state_agenda_itens",
  contrapartes: "state_contrapartes",
  protocolos_sanitarios: "state_protocolos_sanitarios",
  protocolos_sanitarios_itens: "state_protocolos_sanitarios_itens",

  // Event Rails (Append-Only)
  eventos: "event_eventos",
  eventos_sanitario: "event_eventos_sanitario",
  eventos_pesagem: "event_eventos_pesagem",
  eventos_nutricao: "event_eventos_nutricao",
  eventos_movimentacao: "event_eventos_movimentacao",
  eventos_reproducao: "event_eventos_reproducao",
  eventos_financeiro: "event_eventos_financeiro",
};
```

---

## Fluxo de Escrita (Optimistic UI)

### 1. Usuário realiza uma ação

```typescript
// Exemplo: Criar animal
const fazenda_id = "uuid-fazenda";
const animal = {
  id: crypto.randomUUID(),
  identificacao: "123",
  sexo: "M",
  lote_id: "uuid-lote",
};
```

### 2. `createGesture` gera `client_tx_id`

```typescript
const client_tx_id = await createGesture(fazenda_id, [
  {
    table: "animais",
    action: "INSERT",
    record: animal,
  },
]);
```

**Internamente**:

- Gera `client_tx_id` (UUID)
- Para cada operação, gera `client_op_id` (UUID)
- Injeta metadata de sync no record: `fazenda_id`, `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at`
- Salva em `queue_gestures` (status: PENDING)
- Salva em `queue_ ops`

### 3. Aplicação Otimista em `state_*`

```typescript
await applyOpLocal(op);
```

**Fluxo interno**:

1. Traduz `"animais"` → `"state_animais"` via `getLocalStoreName()`
2. **Captura `before_snapshot`** (para rollback futuro):
   ```typescript
   if (op.action === "UPDATE" && !op.before_snapshot) {
     const existing = await store.get(op.record.id);
     op.before_snapshot = existing;
     await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
   }
   ```
3. Aplica operação:
   - **INSERT/UPDATE**: `await store.put(op.record)`
   - **DELETE**: `await store.update(op.record.id, { deleted_at: now() })` (soft delete)

**Resultado**: UI instantaneamente reflete a mudança (animal aparece na lista).

### 4. `SyncWorker` detecta o gesto pendente

Worker roda a cada **5 segundos** e processa gestos com `status = PENDING`.

```typescript
const pending = await db.queue_gestures
  .where("status")
  .equals("PENDING")
  .sortBy("created_at");
```

### 5. Envio para o servidor

```typescript
const {
  data: { session },
} = await supabase.auth.getSession();

const response = await fetch(`${env.supabaseFunctionsUrl}/sync-batch`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`, // ✅ JWT
  },
  body: JSON.stringify({
    client_id: gesture.client_id,
    fazenda_id: gesture.fazenda_id,
    client_tx_id: gesture.client_tx_id,
    ops: ops.map((o) => ({
      client_op_id: o.client_op_id,
      table: getRemoteTableName(o.table), // "state_animais" → "animais"
      action: o.action,
      record: o.record,
    })),
  }),
});
```

**Nota**: Traduz nomes locais → remotos via `getRemoteTableName()`.

---

## GestureStatus (State Machine)

### Estados Possíveis

```
PENDING → SYNCING → DONE (sucesso total)
                  → REJECTED (rollback local executado)
                  → ERROR (max retries ou erro fatal)
```

### Transições

#### PENDING

Gesto criado, aguardando sync. Retry permitido (retry_count < 3).

#### SYNCING

Worker está enviando para o servidor (fetch em andamento).

#### DONE

**Todas** as operações retornaram `APPLIED` ou `APPLIED_ALTERED`.

**Ação**:

```typescript
await db.queue_gestures.update(client_tx_id, { status: "DONE" });
await db.queue_ops.where("client_tx_id").equals(client_tx_id).delete();
```

#### REJECTED

**Pelo menos uma** operação retornou `REJECTED`.

**Ação**:

1. Marca gesto como `REJECTED`
2. Salva rejeições em `queue_rejections`
3. **Executa rollback local**

#### ERROR

Retry >= 3 ou erro fatal (ex: 500 Internal Server Error).

**Ação**:

```typescript
await db.queue_gestures.update(client_tx_id, {
  status: "ERROR",
  last_error: `Max retries: ${error.message}`,
});
```

---

## Rollback Determinístico

Quando o servidor rejeita operações, o cliente usa `before_snapshot` para **restaurar o estado exato** anterior.

### before_snapshot (Captura)

Capturado em `applyOpLocal()` **antes** da aplicação otimista:

```typescript
if (op.action === "UPDATE" && !op.before_snapshot) {
  const existing = await store.get(op.record.id);
  op.before_snapshot = existing; // Snapshot completo do registro
  await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
}

if (op.action === "DELETE") {
  const existing = await store.get(op.record.id);
  op.before_snapshot = existing;
  await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
}
```

**Nota**: INSERT não precisa de snapshot (rollback = DELETE).

### rollbackOpLocal (Reversão)

Reverte a operação otimista usando o snapshot:

```typescript
export const rollbackOpLocal = async (op: Operation) => {
  if (!op.before_snapshot && op.action !== "INSERT") return;

  const localStoreName = getLocalStoreName(op.table);
  const store = (db as any)[localStoreName];
  if (!store) return;

  if (op.action === "INSERT") {
    // INSERT revertido = DELETE
    await store.delete(op.record.id);
  } else if (op.action === "UPDATE" || op.action === "DELETE") {
    // UPDATE/DELETE revertido = Restaurar snapshot
    if (op.before_snapshot) {
      await store.put(op.before_snapshot);
    }
  }
};
```

### Ordem de Rollback (Reversa)

Rollback **DEVE** ocorrer em ordem **reversa** para respeitar dependências:

```typescript
await db.transaction("rw", [...getAffectedStores(ops)], async () => {
  // Rollback em ordem reversa
  for (const op of [...ops].reverse()) {
    await rollbackOpLocal(op);
  }
});
```

**Por quê reversa?**

Imagine este batch:

1. `INSERT eventos` (id: evt1, animal_id: a1)
2. `INSERT eventos_sanitario` (evento_id: evt1)
3. `UPDATE animais` (id: a1, lote_id: novo)

Se reverter na ordem normal (1→2→3):

1. DELETE evt1 → ❌ FK violation (eventos_sanitario ainda referencia evt1)

Se reverter na ordem reversa (3→2→1):

1. Restaura animal (antes do UPDATE)
2. DELETE eventos_sanitario (sem dependências)
3. DELETE evt1 (eventos_sanitario já deletado) → ✅ Sucesso

---

## JWT e Autenticação no Sync

### Cliente: Busca do Token

```typescript
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

if (sessionError || !session) {
  throw new Error("Não autenticado - sessão expirada");
}

const jwt = session.access_token;
```

### Cliente: Envio do Token

```typescript
headers: {
  "Authorization": `Bearer ${jwt}`
}
```

### Servidor: Validação do Token

```typescript
// Edge Function sync-batch
const authHeader = req.headers.get("Authorization");
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized - missing JWT" }), {
    status: 401,
  });
}

const jwt = authHeader.replace("Bearer ", "");

const {
  data: { user },
  error: authError,
} = await supabaseAdmin.auth.getUser(jwt);

if (authError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized - invalid JWT" }), {
    status: 401,
  });
}
```

### Servidor: Validação de Membership

```typescript
const { data: membership } = await supabaseUser
  .from("user_fazendas")
  .select("role")
  .eq("user_id", user.id)
  .eq("fazenda_id", fazenda_id)
  .is("deleted_at", null)
  .maybeSingle();

if (!membership) {
  return new Response(
    JSON.stringify({ error: "Forbidden - no access to this farm" }),
    { status: 403 },
  );
}
```

**Nota**: Servidor usa **user-scoped client** (não service role) para aplicar operações, garantindo que RLS policies sejam respeitadas.

---

## Retry Logic

### Estratégia

- **Retry < 3**: Marca como `PENDING` novamente (tenta novamente no próximo ciclo do worker)
- **Retry >= 3**: Marca como `ERROR` (desiste, exige intervenção manual)

### Código

```typescript
catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));

  const retryCount = gesture.retry_count || 0;
  if (retryCount < 3) {
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "PENDING",
      retry_count: retryCount + 1,
      last_error: error.message
    });
  } else {
    await db.queue_gestures.update(gesture.client_tx_id, {
      status: "ERROR",
      last_error: `Max retries: ${error.message}`
    });
  }
}
```

### Quando NÃO retenta

- **REJECTED** (erro de negócio, não de rede): Rollback executado, gesto marcado como REJECTED permanentemente
- **401/403** (auth/permission): Retry não resolve problemas de autenticação/autorização

---

## Diferença: State vs Event Stores

### state\_\* (Mutável)

- Refletem o **estado atual** do sistema
- Podem ser **atualizados** (ex: animal muda de lote)
- Soft delete via `deleted_at`

### event\_\* (Append-Only)

- Log **imutável** de fatos passados
- **Nunca** são atualizados no Dexie local (espelham constraint do servidor)
- Correções via novos eventos (contra-lançamento)

---

## Queries Locais (Exemplo)

### Buscar animais de um lote

```typescript
const animais = await db.state_animais
  .where("[fazenda_id+lote_id]")
  .equals([fazenda_id, lote_id])
  .toArray();
```

### Buscar eventos de um animal

```typescript
const eventos = await db.event_eventos
  .where("[fazenda_id+animal_id+occurred_at]")
  .between(
    [fazenda_id, animal_id, new Date(0).toISOString()],
    [fazenda_id, animal_id, new Date().toISOString()],
  )
  .reverse() // Mais recentes primeiro
  .toArray();
```

### Buscar gestos pendentes

```typescript
const pending = await db.queue_gestures
  .where("[status+created_at]")
  .between(
    ["PENDING", new Date(0).toISOString()],
    ["PENDING", new Date().toISOString()],
  )
  .sortBy("created_at"); // Ordem cronológica
```
