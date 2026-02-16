# REBANHOSYNC - Guia para Agentes e Desenvolvedores

Este arquivo contém as diretrizes **oficiais** de arquitetura, dados e segurança do projeto.

> **Fontes de Verdade:**
> - `docs/ARCHITECTURE.md` (Two Rails, Sync Flow)
> - `docs/OFFLINE.md` (Dexie Stores, Queue, Rollback)
> - `docs/CONTRACTS.md` (Endpoint Sync, Status Codes)
> - `docs/DB.md` (Schema, Enums, FKs Compostas)
> - `docs/RLS.md` (RBAC, Policies, RPCs)
> - `docs/E2E_MVP.md` (Fluxos Críticos)

---

## 1. Princípios do Domínio (Two Rails)

O sistema opera sob o paradigma de **Two Rails** para conciliar estado mutável e rastreabilidade imutável.

### Rail 1: Agenda (Mutável)
- **Propósito:** Intenções futuras (ex: tarefas agendadas).
- **Características:** Mutável (`UPDATE` permitido), Status (`agendado` → `concluido` | `cancelado`).
- **Deduplicação:** Essencial para protocolos automáticos (via `dedup_key`).

### Rail 2: Eventos (Append-Only)
- **Propósito:** Fatos passados (ex: pesagem realizada, vacina aplicada).
- **Características:** **Imutável**. Trigger `prevent_business_update` bloqueia alterações em colunas de negócio.
- **Correções:** Feitas via contra-lançamento (novo evento que anula o anterior), nunca por edição direta.

### Sem "FK Dura" (Agenda ↔ Evento)
- Não existe Foreign Key rígida no banco entre `agenda_itens` e `eventos`.
- **Motivo:** Desacoplamento. Eventos podem existir sem agenda (emergências) e tarefas podem ser resolvidas por múltiplos eventos.
- **Vínculo Lógico:** Usa-se `source_task_id` (nos eventos) ou `source_evento_id` (na agenda) apenas para referência e rastreabilidade.

---

## 2. Offline-First (Dexie Stores)

O frontend utiliza **Dexie.js** (IndexedDB) com 3 categorias de stores:

### `state_*` (7 stores)
- **O que são:** Réplica local do estado atual das entidades.
- **Comportamento:** Mutável. Reflete a "foto" atual do banco.
- **Exemplos:** `state_animais`, `state_lotes`, `state_agenda_itens`.

### `event_*` (7 stores)
- **O que são:** Log local de eventos ocorridos.
- **Comportamento:** Append-only. Usado para montar timelines e histórico offline.
- **Exemplos:** `event_eventos`, `event_eventos_sanitario`, `event_eventos_pesagem`.

### `queue_*` (3 stores)
- **O que são:** Fila de sincronização e controle de transações.
- **Stores:**
  - `queue_gestures`: Metadados da transação (`client_tx_id`, `status`: PENDING/SYNCING/DONE/REJECTED).
  - `queue_ops`: Operações individuais (`client_op_id`, `table`, `action`, `record`, `before_snapshot`).
  - `queue_rejections`: Erros de negócio retornados pelo servidor.

---

## 3. Sync Contract (Sincronização)

O sync é orientado a **Gestos** (Transações Atômicas).

### Fluxo de Escrita
1.  **UI:** Usuário realiza ação (ex: vacinar animal).
2.  **Local:** `createGesture` gera `client_tx_id` e grava em `queue_gestures` + `queue_ops`.
3.  **Otimismo:** Aplica mudança imediatamente em `state_*` e captura `before_snapshot` para rollback.
4.  **Worker:** A cada ~5s, pega gestos `PENDING`.
5.  **Envio:** POST `/functions/v1/sync-batch` com payload JSON.

### Endpoint: `/functions/v1/sync-batch`
- **Auth:** Bearer JWT obrigatório.
- **Validação:** Membership (`has_membership`), Anti-teleporte, Blocked Tables (`user_fazendas`).
- **Resposta:** Lista de status por operação (`APPLIED`, `APPLIED_ALTERED`, `REJECTED`).

---

## 4. Idempotência e Deduplicação

O sistema deve ser resiliente a falhas de rede e retries.

### Identificadores
- **`client_tx_id`**: UUID do gesto. Agrupa operações atômicas.
- **`client_op_id`**: UUID da operação individual. Chave de idempotência no banco.
- **`dedup_key`**: String lógica na Agenda (ex: `animal_123:vacina_aftosa:2023-10`).

### Status de Retorno
- **`APPLIED`**: Sucesso. (Ou idempotência: `client_op_id` já existia).
- **`APPLIED_ALTERED`**: Sucesso com modificação. (Ex: `dedup_key` colidiu, servidor não criou duplicata mas retornou OK).
- **`REJECTED`**: Erro de negócio (ex: Anti-teleporte, validação financeira).
  - **Ação do Cliente:** Executa `rollbackOpLocal` usando `before_snapshot` em ordem reversa.

---

## 5. Segurança (Multi-tenant & RLS)

### Isolamento Estrito
- **Tenant:** Tudo é isolado por `fazenda_id`.
- **FKs Compostas:** Todas as FKs devem incluir `fazenda_id`.
  - *Correto:* `FOREIGN KEY (lote_id, fazenda_id) REFERENCES lotes(id, fazenda_id)`
  - *Errado:* `FOREIGN KEY (lote_id) REFERENCES lotes(id)`

### RLS Hardened
- **`user_fazendas`**: Tabela de membership é **SELECT-ONLY** via RLS.
- **Mutações de Membership:** Permitidas **apenas** via RPCs `SECURITY DEFINER`:
  - `create_fazenda()`
  - `admin_set_member_role()`
  - `admin_remove_member()`
- **RPCs:** Devem validar permissões manualmente (`IF role <> 'owner' THEN RAISE...`) e setar `search_path`.

---

## 6. RBAC (Role-Based Access Control)

Roles definidas em `farm_role_enum`.

| Role | Leitura | Escrita (Operacional) | Escrita (Estrutural) | Gestão de Membros |
| :--- | :--- | :--- | :--- | :--- |
| **Cowboy** | ✅ Total | ✅ Eventos, Agenda, Animais | ❌ (Lotes, Pastos, Protocolos) | ❌ |
| **Manager** | ✅ Total | ✅ Tudo do Cowboy | ✅ Lotes, Pastos, Protocolos | ❌ |
| **Owner** | ✅ Total | ✅ Tudo do Manager | ✅ Tudo do Manager | ✅ Adicionar/Remover/Alterar Roles |

*Nota: Manager não pode alterar role de Owner nem remover membros.*

---

## 7. Checklist de PR (Pull Request)

Antes de submeter alterações:

- [ ] **RLS Policies:** Novas tabelas têm RLS habilitado e policies de isolamento por `fazenda_id`.
- [ ] **FKs Compostas:** Foreign Keys incluem `fazenda_id` para garantir integridade do tenant.
- [ ] **Append-Only:** Tabelas de eventos têm trigger `prevent_business_update`.
- [ ] **Anti-Teleporte:** Lógica de movimentação (se tocada) valida consistência (UPDATE animal + INSERT evento).
- [ ] **Dexie Stores:** Alterações de schema refletidas nos stores locais (`state_*`, `event_*`).
- [ ] **E2E Scripts:** Fluxos críticos (login, sync, offline) validados conforme `docs/E2E_MVP.md`.
- [ ] **Migrations:** SQL idempotente e seguro (não quebra dados existentes).
