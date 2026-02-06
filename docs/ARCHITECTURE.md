# Arquitetura: Two Rails & Event Sourcing

O sistema opera sob o paradigma de **Two Rails** para conciliar a necessidade de um estado atual rápido com a rastreabilidade total de fatos passados.

## Rail 1: Agenda (Mutável)

A Agenda representa o **futuro**. É uma lista de intenções que podem ser alteradas, adiadas ou canceladas.

- **Status:** `agendado -> concluido | cancelado`.
- **Deduplicação:** Essencial para evitar ruído em protocolos automatizados.

## Rail 2: Eventos (Append-Only)

Os Eventos representam o **passado**. São fatos imutáveis que ocorreram no campo.

- **Imutabilidade:** Garantida por triggers de banco (`prevent_business_update`) que bloqueiam qualquer `UPDATE` em colunas de negócio.
- **Correções:** Se um peso foi digitado errado, não se edita o evento. Lança-se um novo evento de "Contra-lançamento" ou "Correção" que referencia o original.

## Por que "Sem FK dura" entre Agenda e Evento?

Não existe uma Foreign Key rígida ligando `agenda_itens` a `eventos`.

- **Motivo:** Um evento pode ocorrer sem ter sido agendado (manejo de emergência). Uma tarefa agendada pode ser concluída por múltiplos eventos ou por um evento que cobre várias tarefas.
- **Referência Lógica:** Usamos `source_evento_id` na agenda apenas para rastreabilidade, permitindo que o sistema de sync seja desacoplado e resiliente a falhas parciais.

---

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **Database**: PostgreSQL (Supabase-hosted)
- **Backend**: Supabase (Auth + RLS + Edge Functions)
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Routing**: React Router v6
- **State Management**: React Query (@tanstack/react-query)

---

## Arquitetura Offline-First

O sistema utiliza **Dexie.js** para armazenamento local (IndexedDB) com uma arquitetura de fila de gestos (gesture-based sync).

### Dexie Stores (12 stores)

#### 1. **state\_\*** (7 stores) - Cópia local para leitura instantânea

- `state_animais` - Rebanho
- `state_lotes` - Grupos de animais
- `state_pastos` - Áreas de pastagem
- `state_agenda_itens` - Tarefas agendadas
- `state_contrapartes` - Compradores/vendedores
- `state_protocolos_sanitarios` - Protocolos de vacinação
- `state_protocolos_sanitarios_itens` - Itens dos protocolos

#### 2. **event\_\*** (7 stores) - Log local de eventos ocorridos

- `event_eventos` - Eventos base
- `event_eventos_sanitario` - Detalhe 1:1 (vacinação, vermifugação, medicamento)
- `event_eventos_pesagem` - Detalhe 1:1 (peso em kg)
- `event_eventos_nutricao` - Detalhe 1:1 (alimento, quantidade)
- `event_eventos_movimentacao` - Detalhe 1:1 (origem/destino lote/pasto)
- `event_eventos_reproducao` - Detalhe 1:1 (cobertura, IA, diagnóstico, parto)
- `event_eventos_financeiro` - Detalhe 1:1 (compra, venda, valor)

#### 3. **queue\_\*** (3 stores) - Fila de sincronização

- `queue_gestures` - Metadados de transações (`client_tx_id`, `status`, `fazenda_id`)
- `queue_ops` - Operações individuais com `before_snapshot` para rollback
- `queue_rejections` - Erros do servidor que exigem ação do usuário

### Mapeamento de Tabelas (tableMap.ts)

O sistema usa **nomenclatura dual** (remoto ↔ local):

- **getLocalStoreName()**: `"animais"` → `"state_animais"`, `"eventos"` → `"event_eventos"`
- **getRemoteTableName()**: `"state_animais"` → `"animais"`, `"event_eventos"` → `"eventos"`

---

## Fluxo de Sincronização (Offline → Online)

### 1. Ação do Usuário

```typescript
createGesture(fazenda_id, [
  { table: "animais", action: "INSERT", record: {...} }
])
```

- Gera `client_tx_id` (UUID único para a transação)
- Cada operação recebe `client_op_id` individual

### 2. Aplicação Otimista Local

```typescript
applyOpLocal(op);
```

- Captura `before_snapshot` antes de aplicar
- Aplica imediatamente em `state_*` ou `event_*` (UI instantânea)
- Salva operação em `queue_ops`
- Marca gesto como `PENDING` em `queue_gestures`

### 3. Sync Worker (a cada 5s)

```typescript
syncWorker.ts;
```

- Detecta gestos com `status = PENDING`
- Busca `session.access_token` (JWT) do Supabase Auth
- Envia batch para Edge Function `/functions/v1/sync-batch`

### 4. Validação no Servidor (sync-batch)

- **Autenticação**: Valida JWT Bearer token (401 se inválido)
- **Autorização**: Verifica membership em `user_fazendas` (403 se não membro)
- **Anti-Teleport**: Valida que `UPDATE animais.lote_id` tem evento de movimentação correlato
- **Blocked Tables**: Rejeita operações em `user_fazendas`, `user_profiles`, `user_settings`
- **Tenant Consistency**: Força `fazenda_id` ao valor do request (servidor é autoritativo)
- **Idempotência**: `client_op_id` duplicado retorna `APPLIED` sem erro

### 5. Resposta e Rollback Determinístico

- **Sucesso Total**: `status = DONE`, limpa `queue_ops`
- **Rejeição Parcial/Total**: `status = REJECTED`
  - Executa `rollbackOpLocal()` em ordem **reversa** usando `before_snapshot`
  - INSERT → DELETE da linha criada
  - UPDATE/DELETE → PUT do snapshot anterior
  - UI reverte ao estado consistente (sem dados fantasma)

---

## Edge Functions

### sync-batch

Endpoint transacional que recebe batches de operações do cliente.

**Endpoint**: `POST /functions/v1/sync-batch`

**Autenticação**: JWT obrigatório (`Authorization: Bearer <token>`)

**Segurança**:

- Valida membership na fazenda via RLS
- Aplica operações usando user-scoped client (não service role)
- RLS policies do Postgres protegem dados por tenant

**Validações**:

- Anti-teleport para movimentação de animais
- Deduplicação de agenda (`dedup_key`)
- Bloqueio de tabelas sensíveis

**Respostas**:

- `200 OK`: Batch processado (results contém status por operação)
- `401 Unauthorized`: JWT ausente ou inválido
- `403 Forbidden`: Sem membership na fazenda
- `500 Internal Server Error`: Erro fatal

---

## Estrutura de Páginas e Guards

### Rotas Públicas

- `/` - Index (redirect)
- `/login` - Login
- `/signup` - Cadastro

### Rotas Protegidas (RequireAuth)

- `/select-fazenda` - Seleção de fazenda ativa

### Rotas Protegidas (RequireAuth + RequireFarm)

Proteção dupla: usuário autenticado **E** fazenda ativa selecionada.

#### Guards de Rota

```typescript
<RequireAuth>           // session existe?
  <RequireFarm>         // activeFarmId existe?
    <AppShell />        // Layout principal
  </RequireFarm>
</RequireAuth>
```

#### Páginas Funcionais

- `/home` - Home
- `/dashboard` - Dashboard com métricas
- `/animais` - Lista de animais
- `/animais/novo` - Cadastro de animal
- `/animais/:id` - Detalhe do animal (timeline de eventos)
- `/lotes` - Gestão de lotes
- `/pastos` - Gestão de pastos
- `/agenda` - Agenda de tarefas
- `/registrar` - Registro de eventos multi-domínio
- `/reconciliacao` - Tela de reconciliação de sync
- `/admin/membros` - Gestão de membros (owner only)

### Fluxo de Redirecionamento

1. **Sem sessão** → `/login`
2. **Com sessão, sem fazenda ativa** → `/select-fazenda`
3. **Com sessão e fazenda ativa** → rotas funcionais liberadas

---

## Multi-Tenant e Sincronização de Estado Ativo

### Gestão de Fazenda Ativa

O sistema mantém a fazenda ativa em **dois lugares**:

1. **localStorage**: `"gestao_agro_active_farm_id"` (sobrevive refresh)
2. **Supabase**: `user_settings.active_fazenda_id` (sincroniza entre devices)

### Reconciliação (login/seleção)

- **Login inicial**: Se `user_settings.active_fazenda_id` existe, carrega para localStorage
- **Seleção manual**: Atualiza AMBOS (localStorage + Supabase)
- **Garantia**: AuthContext sempre busca em paralelo e reconcilia divergências

### Isolamento por Tenant (fazenda_id)

- Todas as queries Dexie filtram por `fazenda_id` ativo
- Sync batch envia `fazenda_id` no payload
- RLS policies no Postgres garantem isolamento via `has_membership(fazenda_id)`
