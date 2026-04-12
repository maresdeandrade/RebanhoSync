# REBANHOSYNC — Guia para Agentes e Desenvolvedores

Este arquivo contém as diretrizes **oficiais** de arquitetura, dados e segurança do projeto.

> **Estado atual do produto:** Beta interno — MVP completo (7/7 domínios operacionais implementados).  
> **Última atualização documental:** 2026-04-07

> **Fontes de Verdade (ler nesta ordem ao retomar):**
> - `docs/CURRENT_STATE.md` (snapshot executivo)
> - `docs/PRODUCT.md` (visão de produto, escopo e princípios)
> - `docs/SYSTEM.md` (Two Rails, Sync Flow, Banco, Offline-first, Contratos, RLS e Taxonomia Mínima)
> - `docs/PROCESS.md` (fluxo capability-centric e governança de projeto)
> - `docs/REFERENCE.md` (stack de repositório, mapas de rotas, topologia E2E)
> - `docs/IMPLEMENTATION_STATUS.md` (matriz de capacidades atual)
> - `docs/ROADMAP.md` (evolução e curto prazo)
> - `docs/TECH_DEBT.md` (gaps residuais mapeados)

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
- **Correções:** Feitas via contra-lançamento (novo evento com `corrige_evento_id`), nunca por edição direta.

### Sem "FK Dura" (Agenda ↔ Evento)
- Não existe Foreign Key rígida no banco entre `agenda_itens` e `eventos`.
- **Motivo:** Desacoplamento. Eventos podem existir sem agenda (emergências) e tarefas podem ser resolvidas por múltiplos eventos.
- **Vínculo Lógico:** Usa-se `source_task_id` (nos eventos) ou `source_evento_id` (na agenda) apenas para referência e rastreabilidade.

---

## 2. Offline-First (Dexie Stores)

O frontend utiliza **Dexie.js v4** (IndexedDB) na **versão 8** do schema, com 4 categorias de stores:

### `state_*` (9 stores)
- **O que são:** Réplica local mutável do estado atual das entidades.
- **Comportamento:** Mutável. Reflete a "foto" atual do banco.
- **Stores:** `state_animais`, `state_lotes`, `state_pastos`, `state_agenda_itens`, `state_contrapartes`, `state_animais_sociedade`, `state_categorias_zootecnicas`, `state_protocolos_sanitarios`, `state_protocolos_sanitarios_itens`.

### `event_*` (7 stores)
- **O que são:** Log local append-only de eventos ocorridos.
- **Comportamento:** Append-only. Usado para timelines e histórico offline.
- **Stores:** `event_eventos`, `event_eventos_sanitario`, `event_eventos_pesagem`, `event_eventos_nutricao`, `event_eventos_movimentacao`, `event_eventos_reproducao`, `event_eventos_financeiro`.

### `queue_*` (3 stores)
- **O que são:** Fila de sincronização e controle de transações.
- **Stores:**
  - `queue_gestures`: Metadados da transação (`client_tx_id`, `status`: PENDING/SYNCING/DONE/REJECTED/ERROR).
  - `queue_ops`: Operações individuais (`client_op_id`, `table`, `action`, `record`, `before_snapshot`).
  - `queue_rejections`: Erros de negócio retornados pelo servidor (com TTL 7d e auto-purge).

### `metrics_events` (1 store — Dexie v8)
- **O que é:** Store de telemetria local de piloto. Append-only local.
- **Campos:** `event_name`, `route`, `entity`, `status`, `fazenda_id`, `created_at`.
- **Nota:** os dados permanecem no dispositivo; sem envio remoto automático no estado atual (TD-021 resolvido via flush externo documentado em Roadmap).

### Contrato de History Confidence (Novo)
- **O que é:** Entradas e rebanho sem histórico de vacinação assumem state de compliance e `history_confidence = unknown`. Requerem eventos ou documentos (`compliance_state = catch_up_required`).

---

## 3. Sync Contract (Sincronização)

O sync é orientado a **Gestos** (Transações Atômicas).

### Fluxo de Escrita
1. **UI:** Usuário realiza ação (ex: vacinar animal).
2. **Local:** `createGesture` gera `client_tx_id` e grava em `queue_gestures` + `queue_ops`.
3. **Otimismo:** Aplica mudança imediatamente em `state_*` e captura `before_snapshot` para rollback.
4. **Worker:** A cada ~5s, pega gestos `PENDING`.
5. **Envio:** POST `/functions/v1/sync-batch` com payload JSON.
6. **Retry:** até 3 tentativas em caso de falha de rede. Gestos com erro de auth são recuperados no próximo startup.

### Endpoint: `/functions/v1/sync-batch`
- **Auth:** Bearer JWT obrigatório.
- **Validações:** Membership (`has_membership`), Anti-teleporte, Blocked Tables (`user_fazendas`, `user_profiles`, `user_settings`), Taxonomia canônica (`schema_version = 1`), Episódios reprodução (linking cobertura→parto).
- **Resposta:** Lista de status por operação (`APPLIED`, `APPLIED_ALTERED`, `REJECTED`).
- **Post-sync pull:** após sync de animais/eventos/agenda, o worker faz pull seletivo para refletir triggers server-side.

---

## 4. Idempotência e Deduplicação

O sistema é resiliente a falhas de rede e retries.

### Identificadores
- **`client_tx_id`**: UUID do gesto. Agrupa operações atômicas.
- **`client_op_id`**: UUID da operação individual. Chave de idempotência no banco.
- **`dedup_key`**: String lógica na Agenda (ex: `${fazenda_id}|animal:${animalId}|piv:${versionId}|dose:${doseNum}`).

### Status de Retorno
- **`APPLIED`**: Sucesso (ou idempotência: `client_op_id` já existia).
- **`APPLIED_ALTERED`**: Sucesso com modificação (ex: `dedup_key` colidiu).
- **`REJECTED`**: Erro de negócio (ex: Anti-teleporte, validação de payload).
  - **Ação do Cliente:** Executa `rollbackOpLocal` usando `before_snapshot` em ordem reversa.

---

## 5. Segurança (Multi-tenant & RLS)

### Isolamento Estrito
- **Tenant:** Tudo é isolado por `fazenda_id`.
- **FKs Compostas:** FKs internas devem incluir `fazenda_id`.
  - *Correto:* `FOREIGN KEY (lote_id, fazenda_id) REFERENCES lotes(id, fazenda_id)`
  - *Errado:* `FOREIGN KEY (lote_id) REFERENCES lotes(id)`
- **Exceção documentada:** `produtos_veterinarios` é tabela global (sem `fazenda_id`) — catálogo compartilhado entre tenants. Ver `docs/ADRs/ADR-0002`.

### RLS Hardened
- **`user_fazendas`**: Tabela de membership é **SELECT-ONLY** via RLS.
- **Mutações de Membership:** Apenas via RPCs `SECURITY DEFINER`:
  - `create_fazenda()`, `admin_set_member_role()`, `admin_remove_member()`
  - `create_invite()`, `accept_invite()`, `reject_invite()`, `cancel_invite()`, `get_invite_preview()`
- **RPCs:** Validam permissões explicitamente e fixam `search_path = public`.

### RBAC de DELETE — Animais
- **DELETE em `animais`** é restrito a `owner` e `manager` via policy `animais_delete_by_role`.
- `Cowboy` só pode `INSERT` e `UPDATE` em animais.
- Evidência: migration `20260308230748_rbac_delete_hardening_animais.sql`.

---

## 6. RBAC (Role-Based Access Control)

Roles definidas em `farm_role_enum`.

| Role | Leitura | Escrita (Operacional) | Escrita (Estrutural) | DELETE Animais | Gestão de Membros |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cowboy** | ✅ Total | ✅ Eventos, Agenda, Animais (INSERT/UPDATE) | ❌ | ❌ | ❌ |
| **Manager** | ✅ Total | ✅ Tudo do Cowboy | ✅ Lotes, Pastos, Protocolos | ✅ | ❌ |
| **Owner** | ✅ Total | ✅ Tudo do Manager | ✅ Tudo do Manager | ✅ | ✅ |

*Nota: Manager não pode alterar role de Owner nem remover membros (owner only).*

---

## 7. Taxonomia Canônica Bovina

O sistema deriva classificações de animais a partir de **fatos**, não de labels persistidos.

### Três eixos de classificação
- `categoria_zootecnica` (ex: bezerro, novilha, vaca, touro)
- `fase_veterinaria` (ex: amamentando, desmamado)
- `estado_produtivo_reprodutivo` (ex: prenhe, seca, recem_parida, vazia)

### Princípios
- Persistir apenas **fatos mínimos** em `animais.payload.taxonomy_facts` (contrato v1 com `schema_version = 1`)
- Derivar labels e categorias em selectors/projections (nunca persistir labels derivados)
- Validação no cliente (`src/lib/offline/ops.ts`) e no servidor (`sync-batch/taxonomy.ts`)
- Paridade TS ↔ SQL view testada por fixture em `src/lib/animals/__tests__/taxonomySqlParity.test.ts`

### Campos de `taxonomy_facts` (v1)
`castrado`, `puberdade_confirmada`, `prenhez_confirmada`, `data_prevista_parto`, `data_ultimo_parto`, `em_lactacao`, `secagem_realizada`, `data_secagem`

---

## 8. Padrões de Código Obrigatórios

### TypeScript
- `catch (e: unknown)` + `e instanceof Error` — nunca `catch (e: any)`
- `setInterval`: usar `ReturnType<typeof setInterval>` — nunca `NodeJS.Timeout` (Vite não é Node)
- Sem strict mode global (MVP)

### Operações de Sync
- Records enviados ao servidor **devem conter:** `fazenda_id`, `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at`
- **Nunca enviar:** `created_at` / `updated_at` (server-managed)
- **Sempre usar `tableMap.ts`:** ops usam nome remoto (ex: `animais`), Dexie usa nome local (`state_animais`)

### Agenda
- `data_prevista`: **sempre** string `'YYYY-MM-DD'`
- `dominio`: ex. `'sanitario'` (diferente de `tipo`)
- `status`: `agendado | concluido | cancelado`

### Segurança de Banco
- Toda tabela tenant: `fazenda_id` obrigatório + RLS habilitada
- Tabelas de eventos: trigger `prevent_business_update` obrigatório
- RPCs com privilégio: `SECURITY DEFINER` + `search_path = public` + validação explícita de role
- Policies de RLS **não podem** consultar a própria tabela via subquery — usar helpers `SECURITY DEFINER`

---

## 9. Checklist de PR (Pull Request)

Antes de submeter alterações:

- [ ] **Build verde:** `pnpm exec tsc --noEmit` + `pnpm run lint` + `pnpm run build`
- [ ] **RLS Policies:** novas tabelas têm RLS habilitado e policies por `fazenda_id`
- [ ] **FKs Compostas:** Foreign Keys internas incluem `fazenda_id` (ou justificativa documentada)
- [ ] **Append-Only:** tabelas de eventos têm trigger `prevent_business_update`
- [ ] **Anti-Teleporte:** lógica de movimentação valida consistência (UPDATE animal + INSERT evento)
- [ ] **Dexie Stores:** mudanças de schema refletidas nos stores locais + nova versão Dexie
- [ ] **tableMap.ts:** novas tabelas sync adicionadas ao mapeamento remoto ↔ local
- [ ] **Migrations:** SQL idempotente e seguro (não quebra dados existentes)
- [ ] **E2E:** fluxos críticos validados conforme base em `docs/REFERENCE.md`
- [ ] **Taxonomia:** se tocar `animais.payload`, respeitar contrato `taxonomy_facts` v1
- [ ] **Docs:** atualizar `IMPLEMENTATION_STATUS.md` e `TECH_DEBT.md` se aplicável
