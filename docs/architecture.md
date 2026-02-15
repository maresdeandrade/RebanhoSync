# Arquitetura do RebanhoSync

Este documento é a **Fonte de Verdade** arquitetural do sistema. Ele consolida os princípios de Two Rails, Offline-First, Multi-Tenancy e Segurança.

## 1. Princípios Fundamentais: Two Rails

O sistema opera sob o paradigma de **Two Rails** para separar claramente "intenção futura" de "fato passado".

### Rail 1: Agenda (Mutável)
- **Propósito:** Representa o **futuro** (planejamento).
- **Mutabilidade:** Total. Itens podem ser criados, editados, adiados ou cancelados.
- **Tabela:** `agenda_itens`.
- **Status:** `agendado` → `concluido` | `cancelado`.
- **Deduplicação:** Uso de `dedup_key` para evitar duplicidade em tarefas geradas automaticamente por protocolos.

### Rail 2: Eventos (Append-Only)
- **Propósito:** Representa o **passado** (fatos históricos).
- **Imutabilidade:** Garantida por triggers de banco (`prevent_business_update`).
- **Tabela:** `eventos` (cabeçalho) + `eventos_*` (detalhes: sanitário, pesagem, etc).
- **Correção:** Erros não são editados; são corrigidos por novos eventos de "contra-lançamento" (`corrige_evento_id`).

### Desacoplamento (Sem FK Dura)
Não existe Foreign Key (FK) rígida entre Agenda e Eventos no banco de dados.
- **Motivo:** Permitir sincronização independente e evitar "constraint hell" em cenários offline.
- **Vínculo Lógico:**
  - Agenda aponta para Evento que a concluiu: `source_evento_id`.
  - Evento aponta para Tarefa que o originou: `source_task_id`.

---

## 2. Fluxo Offline e Sincronização

O sistema é **Offline-First**. Toda escrita ocorre primeiro no banco local (Dexie.js) e depois é sincronizada.

### Arquitetura de Dados Local (Dexie.js)
1.  **`state_*` (Mutable):** Espelho do estado atual (ex: `state_animais`, `state_lotes`).
2.  **`event_*` (Append-Only):** Log local de eventos (ex: `event_eventos`).
3.  **`queue_*` (Outbox):** Fila de sincronização (`queue_gestures`, `queue_ops`).

### Ciclo de Vida da Escrita (The Gesture)
1.  **Ação do Usuário:** UI chama `createGesture` com um array de operações (INSERT/UPDATE/DELETE).
2.  **Aplicação Local (Otimista):**
    - Dados são escritos imediatamente em `state_*` ou `event_*`.
    - Um snapshot anterior (`before_snapshot`) é salvo em `queue_ops` para possível rollback.
3.  **Sync Worker:** Processo em background detecta gestos `PENDING`.
4.  **Envio:** POST para `/functions/v1/sync-batch` com JWT do usuário.

### Processamento no Servidor (`sync-batch`)
O endpoint é transacional e **autoritativo**:
1.  **Autenticação:** Valida JWT.
2.  **Autorização:** Verifica membership na `fazenda_id` (tabela `user_fazendas`).
3.  **Tenant Enforcement:** Força o `fazenda_id` do request em todos os registros (ignora payload do cliente).
4.  **Anti-Teleport:** Valida integridade de movimentações (ex: não permite mudar lote sem evento de movimentação).
5.  **Idempotência:** Ignora `client_op_id` já processados.
6.  **Resposta:**
    - `APPLIED`: Sucesso.
    - `APPLIED_ALTERED`: Sucesso com ajuste (ex: colisão de dedup na agenda).
    - `REJECTED`: Erro de regra de negócio (dispara **Rollback Local** reverso no cliente).

---

## 3. Multi-Tenancy e Isolamento

O sistema é estritamente multi-tenant, isolado por **Fazenda**.

- **Identificador:** Coluna `fazenda_id` (UUID) obrigatória em TODAS as tabelas de dados.
- **Membership:** Acesso controlado pela tabela `user_fazendas` (N:N entre Users e Fazendas).
- **Roles:**
  - `owner`: Controle total, gestão de membros.
  - `manager`: Gestão operacional, não pode deletar fazenda ou remover owner.
  - `cowboy`: Operacional (registro de eventos/tarefas), leitura total.

### Estratégia de Isolamento
1.  **No Banco (RLS):** Policies verificam `has_membership(fazenda_id)`.
2.  **No Sync (Edge Function):** O `fazenda_id` é injetado pelo servidor baseado no contexto da requisição, impedindo injeção de dados em outros tenants.
3.  **No Cliente (Dexie):** Queries locais filtram sempre por `fazenda_id` ativo.

---

## 4. Segurança

A segurança é composta por camadas (Defense in Depth).

### RLS (Row Level Security) Hardened
- **Padrão:** Todas as tabelas têm RLS habilitado.
- **Leitura:** Permitida se `has_membership(fazenda_id)`.
- **Escrita:** Permitida conforme Role (ex: Cowboy insere eventos mas não edita Lotes).
- **Append-Only:** Triggers bloqueiam `UPDATE` em colunas de negócio na tabela `eventos`.

### RPCs Security Definer (`admin_*`)
Operações sensíveis que exigem elevar privilégios ou validações complexas são feitas via Stored Procedures (RPCs) com `SECURITY DEFINER`.
- **`create_fazenda`**: Cria fazenda e vincula criador como Owner.
- **`admin_set_member_role`**: Altera papéis com regras estritas (ex: Manager não rebaixa Owner).
- **`admin_remove_member`**: Soft-delete de membros.
- **`handle_new_user`**: Trigger para auto-provisionamento de perfil.

### Tabelas Bloqueadas no Sync
O endpoint de sync rejeita explicitamente operações em tabelas de sistema:
- `user_fazendas` (Use RPCs).
- `user_profiles` (Edição direta via RLS apenas).
- `user_settings` (Edição direta via RLS apenas).

---

## 5. Invariantes do Sistema

Regras absolutas que não podem ser quebradas:

1.  **Eventos são Imutáveis:** Nenhuma edição de dados de negócio em eventos passados. Apenas contra-lançamentos.
2.  **Fazenda é Mandatória:** Todo dado deve pertencer a uma `fazenda_id`. Dados órfãos são violação de integridade.
3.  **Servidor é Autoritativo:** O servidor decide o estado final. Em conflito, o servidor vence (ou rejeita).
4.  **Anti-Teleporte:** Um animal não muda de local (`lote_id`) sem um evento de movimentação correspondente no mesmo batch.
5.  **Isolamento de Tenant:** Um usuário nunca acessa dados de uma fazenda onde não tem membership ativo.
6.  **Offline-First:** A UI nunca bloqueia esperando rede. A escrita é sempre local primeiro.
7.  **Idempotência:** Reenviar o mesmo batch (retry) não duplica dados.

---

## Tech Stack (Referência)

- **Frontend:** React 19, TypeScript, Vite, Tailwind, shadcn/ui.
- **Local DB:** Dexie.js (IndexedDB).
- **Backend:** Supabase (Postgres, Auth, Edge Functions).
- **Sync:** Custom Sync Engine (Queue + Batches).
