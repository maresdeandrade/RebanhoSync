# Análise Arquitetural do Módulo Sanitário - GestaoAgro

## 1. Visão Geral e Desenho Atual

### 1.1 Arquitetura de Referência (Two Rails)

O módulo sanitário opera sob o paradigma **Two Rails** implementado no projeto:

| Rail        | Tabela              | Comportamento              | Uso Típico                                  |
| ----------- | ------------------- | -------------------------- | ------------------------------------------- |
| **Agenda**  | `agenda_itens`      | Mutável (UPDATE permitido) | Tarefas agendadas (vacinação, vermifugação) |
| **Eventos** | `eventos_sanitario` | Append-only (imutável)     | Registro de ações realizadas                |

### 1.2 Stack Tecnológico

- **Frontend**: React + TypeScript + Dexie.js v8 (IndexedDB)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Sync**: Protocolo baseado em Gestos (client_tx_id, client_op_id)
- **Offline-First**: Replicação local via Dexie Stores

### 1.3 Estrutura de Dados

**Tabelas Principais:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEMA SANITÁRIO                             │
├─────────────────────────────────────────────────────────────────┤
│  state_protocolos_sanitarios  (mutável)                       │
│  ├── id, fazenda_id, nome, descricao, ativo                  │
│  └── payload (JSONB - configurações, layers, etc)              │
│                                                                 │
│  state_protocolos_sanitarios_itens (mutável)                  │
│  ├── id, protocolo_id, tipo, produto, intervalo_dias         │
│  ├── dose_num, gera_agenda, regime                            │
│  └── payload (calendar_config, etc)                           │
│                                                                 │
│  event_eventos_sanitario (append-only)                        │
│  ├── evento_id, tipo (vacinacao/vermifugacao/medicamento)    │
│  ├── produto, payload                                          │
│  └── trigger: prevent_business_update                         │
│                                                                 │
│  agenda_itens (mutável, domínio=sanitario)                    │
│  ├── id, animal_id, protocolo_item_version_id                │
│  ├── data_prevista, status (agendado/concluido/cancelado)    │
│  └── dedup_key (prevenção duplicatas)                         │
│                                                                 │
│  fazenda_sanidade_config (state, por fazenda)                 │
│  ├── modo_calendario, uf, aptidao, sistema                    │
│  └── payload (activated_templates, overlay_runtime)           │
│                                                                 │
│  produtos_veterinarios (catálogo global, sem fazenda_id)       │
│  catalog_protocolos_oficiais (cache local SBMV)               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE REGISTRO SANITÁRIO                      │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐     ┌────────────────┐     ┌─────────────────────────────┐
  │   UI/UX     │────▶│  createGesture │────▶│  queue_gestures            │
  │  (Registrar)│     │    (Dexie)     │     │  queue_ops                 │
  └─────────────┘     └────────────────┘     └────────────┬──────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────────────┐
                                              │   sync-batch (Edge Fn)     │
                                              │   • Anti-teleporte         │
                                              │   • Validação Taxonomy     │
                                              │   • RLS + Membership       │
                                              └────────────┬──────────────┘
                                                           │
         ┌─────────────────────────────────────────────────┴────────────┐
         │                       POST-SYNC PULL                          │
         ▼                                                            ▼
  ┌─────────────────┐                                    ┌──────────────────────┐
  │ agenda_itens   │                                    │  server triggers     │
  │ (rollback)     │                                    │  - recompute agenda  │
  └─────────────────┘                                    │  - close on event    │
                                                          └──────────────────────┘
```

### 1.5 Interfaces e Componentes

**Camada de Serviço (`src/lib/sanitario/`):**

| Módulo               | Responsabilidade                                              |
| -------------------- | ------------------------------------------------------------- |
| `service.ts`         | RPCs `concluirPendenciaSanitaria`, fetch pendências/histórico |
| `compliance.ts`      | Regulatory overlays, conformidade legal                       |
| `calendarEngine.ts`  | Cálculo de datas de vencimento                                |
| `officialCatalog.ts` | Catálogo SBMV de protocolos                                   |
| `products.ts`        | Catálogo de produtos veterinários                             |
| `customization.ts`   | Operações CRUD de protocolos                                  |
| `regimen.ts`         | Lógica de regimes (sequencial, único, etc.)                   |
| `protocolLayers.ts`  | Camadas de protocolo (oficial, template, custom)              |
| `alerts.ts`          | Alertas sanitários (doenças notificação)                      |
| `transit.ts`         | Restrições de trânsito (PNCEBT)                               |

**Componentes Frontend:**

```
src/components/sanitario/
├── FarmProtocolManager.tsx          # CRUD de protocolos da fazenda
├── OfficialSanitaryPackManager.tsx  # Pack oficial SBMV
├── RegulatoryOverlayManager.tsx    # Overlays regulatórios
```

**Stores Dexie (v11):**

```typescript
// State Stores
state_protocolos_sanitários;
state_protocolos_sanitários_itens;
state_fazenda_sanidade_config;

// Event Stores
event_eventos_sanitario;

// Catalog Stores (v10-v11)
catalog_produtos_veterinários;
catalog_protocolos_oficiais;
catalog_protocolos_oficiais_itens;
catalog_doenças_notificáveis;
```

---

## 2. Pontos de Falha, Estrangulamentos e Riscos

### 2.1 Falhas Arquiteturais Identificadas

| #   | Falha                                                   | Impacto                                                                          | Localização                                                |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| F1  | **Ausência de cache dedicado para pendências**          | A cada load, executa view complexa `vw_sanitario_pendencias` com joins múltiplos | `service.ts:120-142`                                       |
| F2  | **Falta de índice composto para busca por animal+tipo** | Queries de pendências por animal são lentas                                      | `db.ts` - sem `animal_id+tipo`                             |
| F3  | **Fragilidade no recompute de agenda**                  | Trigger `trg_sanitario_recompute_agenda_on_event` pode falhar silenciosamente    | `0028_sanitario_agenda_engine.sql`                         |
| F4  | **Compliance sem histórico de mudanças**                | Updates em `fazenda_sanidade_config` são mutate sem auditoria                    | `compliance.ts`                                            |
| F5  | **Sem deduplicação no registro de eventos**             | Duplicatas podem ocorrer em rede instável                                        | `service.ts` - usa `client_op_id` mas sem dedup no payload |

### 2.2 Pontos de Estrangulamento (Bottlenecks)

| #   | Bottleneck                                     | Tipo         | Impacto                                                                        |
| --- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| B1  | **RPC `sanitario_complete_agenda_with_event`** | Concorrência | Transação única faz SELECT FOR UPDATE + INSERT + UPDATE - lock em agenda_itens |
| B2  | **View `vw_sanitario_pendencias`**             | Database     | Join em 4 tabelas + cálculo de dias_em_atraso                                  |
| B3  | **Pull total de protocolos ao acessar página** | Rede         | Baixa todos os protocolos da fazenda, sem paginação                            |
| B4  | **Catalog update síncrono**                    | Rede         | refreshVeterinaryProductsCatalog() bloqueia UI                                 |

### 2.3 Riscos de Segurança

| Risco    | Descrição                                           | Mitigação Atual                                                               |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **RS-1** | Mutation de eventos sanitários via trigger          | Trigger `prevent_business_update` existe - verificar se aplicado corretamente |
| **RS-2** | Ausência de validação de produtos no frontend       | Products normalization existe mas sem validação rigorosa                      |
| **RS-3** | Overlays regulatórios podem ser editados por Cowboy | `RegulatoryOverlayManager` expõe edit para `canManage=false` (verificar)      |
| **RS-4** | Exposição de dados entre fazendas via RLS           | RLS habilitado, mas `fazenda_sanidade_config` não tem `fazenda_id` como PK    |

### 2.4 Conformidade Regulamentar

| Regulamento                  | Status                   | Observações                                                |
| ---------------------------- | ------------------------ | ---------------------------------------------------------- |
| **PNCEBT**                   | ✅ Implementado          | Bloqueio de trânsito interestadual se vac. não registradas |
| **SBMV**                     | ✅ Catálogo oficial      | Mapeamento em migrations + cache local                     |
| **GTA**                      | ✅ Parcial               | Requires GTA implementado nos protocolos                   |
| **Doenças Notificáveis**     | ✅ Alertas implementados | `alerts.ts` com estados de suspeita/encerramento           |
| **Carência de medicamentos** | ⚠️ Parcial               | Lógica em `calendarEngine.ts` mas não validada no sync     |

---

## 3. Oportunidades de Melhoria

### 3.1 Eficiência no Registro de Informações

| #        | Oportunidade                                                     | Complexidade | Impacto                                   |
| -------- | ---------------------------------------------------------------- | ------------ | ----------------------------------------- |
| **OM-1** | Registro rápido via scanner de código de barras (produto)        | Média        | Reduz tempo de preenchimento em 60%       |
| **OM-2** | Preenchimento automático de produto via autocomplete offline     | Baixa        | Usa cache Dexie para sugestão instantânea |
| **OM-3** | Registro em lote (múltiplos animais) com dedup automático        | Alta         | Otimiza VACINAÇÃO EM LOTE                 |
| **OM-4** | Histórico inline no momento do registro (exibe última aplicação) | Baixa        | Melhora decisão do usuário                |
| **OM-5** | Smart defaults baseados no protocolo (dose anterior)             | Média        | Previne erros de intervalo                |

### 3.2 Escalabilidade

| #        | Oportunidade                              | Complexidade | Impacto                              |
| -------- | ----------------------------------------- | ------------ | ------------------------------------ |
| **OM-6** | Paginação no pull de protocolos           | Baixa        | Melhora tempo de load inicial        |
| **OM-7** | Cache de pendências no IndexedDB          | Alta         | Elimina round-trip para visualização |
| **OM-8** | Prefetch de eventos sanitários por animal | Média        | Melhora performance em detail views  |

### 3.3 Segurança

| #         | Oportunidade                                     | Complexidade | Impacto                |
| --------- | ------------------------------------------------ | ------------ | ---------------------- |
| **OM-9**  | Validação server-side de carência medicinal      | Alta         | Conformidade legal     |
| **OM-10** | Immutable audit trail para overlays regulatórios | Média        | Conformidade auditoria |

---

## 4. Arquitetura Proposta Consolidada

### 4.1 Objetivos Clear

| Objetivo           | Métrica de Sucesso                                 |
| ------------------ | -------------------------------------------------- |
| **Segurança**      | 100% das operações com validação de carência + RLS |
| **Eficiência**     | <500ms para registro de evento sanitário           |
| **Escalabilidade** | Suporte a 10.000+ animais sem degradação           |
| **Conformidade**   | compliance PNCEBT, SBMV, GTA automáticas           |

### 4.2 Visão de Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITETURA PROPOSTA                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CAMADA DE APRESENTAÇÃO                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ QuickRegister   │  │ BatchEntry       │  │ SmartAutoComplete        │ │
│  │ (1-click)       │  │ (lote animals)   │  │ (offline products)       │ │
│  └─────────────────┘  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAMADA DE NEGÓCIO (Regras de Domínio)                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ SanitarioFacade │  │ ComplianceEngine │  │ CalendarEngine (otimizado)│ │
│  │ (orchestrator)  │  │ (regulatory)      │  │ (cached dates)           │ │
│  └─────────────────┘  └──────────────────┘  └──────────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ ProductResolver │  │ CarenciaValidator│  │ DedupManager             │ │
│  │ (offline cache) │  │ (server validate)│  │ (client+server)          │ │
│  └─────────────────┘  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAMADA DE DADOS (Offline-First)                                           │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │ state_protocolos_*   │  │ event_eventos_*    │  │ cache_* (novo)    │  │
│  │ (mutable)            │  │ (append-only)      │  │ (pendencias)     │  │
│  └──────────────────────┘  └────────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAMADA DE INFRAESTRUTURA                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ sync-batch       │  │ RPCs (secure)    │  │ Web Workers (async)   │  │
│  │ (gestures)       │  │ (validations)     │  │ (prefetch, compute)   │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Diagrama de Componentes UML

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIAGRAMA DE COMPONENTES - MÓDULO SANITÁRIO               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│  UI Layer   │
│             │
│ ┌─────────┐ │
│ │Registrar│─┼─────────────────────────────┐
│ └─────────┘ │                             │
│ ┌─────────┐ │                             │         ┌──────────────────┐
│ │Protocolo│─┼──┐                          │         │ QuickRegister    │
│ └─────────┘ │  │                          │         │ Component        │
│ ┌─────────┐ │  │      ┌───────────────────┴────────▶│ (novo)           │
│ │Alertas  │─┼──┤      │                           │ └──────────────────┘
│ └─────────┘ │  │      │                           │
└─────────────┘  │      │                           ▼
                │      │                  ┌──────────────────┐
                │      │                  │ SanitarioFacade │
                │      │                  │ (orchestrator)   │
                │      │                  └────────┬─────────┘
                │      │                           │
       ┌────────┴──────┴───────────────────────────┤
       │                                          │
       ▼                                          ▼
┌────────────────────────┐          ┌────────────────────────────┐
│   OfflineDB (Dexie)    │          │  SyncManager               │
│                        │          │                            │
│ ┌────────────────────┐│          │ ┌────────────────────────┐ │
│ │ state_protocolos   ││          │ │ createGesture()         │ │
│ ├────────────────────┤│          │ │ queue_ops               │ │
│ │ event_eventos_*    ││          │ │ sync-batch async       │ │
│ ├────────────────────┤│          │ └────────────────────────┘ │
│ │ cache_pendencias   ││          │            │                │
│ │ (NEW)              ││          │            ▼                │
│ ├────────────────────┤│          │ ┌────────────────────────┐ │
│ │ catalog_* (v10-11) ││          │ │ PostSyncPull            │ │
│ └────────────────────┘│          │ └────────────────────────┘ │
└────────────────────────┘          └────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐      ┌────────────────────────────┐   │
│  │ Database           │      │ Edge Functions             │   │
│  │                    │      │                            │   │
│  │ - agenda_itens     │◀────▶│ - sync-batch               │   │
│  │ - eventos          │      │ - sanitario_complete_*    │   │
│  │ - eventos_sanitario│     │ - validate_carencia (NEW)  │   │
│  │ - protocolos_*     │      └────────────────────────────┘   │
│  │ - fazenda_config   │                                        │
│  │                    │      ┌────────────────────────────┐   │
│  │ Views:             │      │ RLS + Security Policies    │   │
│  │ - vw_sanitario_*  │      │ (fazenda isolation)        │   │
│  └────────────────────┘      └────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Diagrama de Sequência (Registro de Vacinação)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              DIAGRAMA DE SEQUÊNCIA - REGISTRO DE VACINAÇÃO                  │
└─────────────────────────────────────────────────────────────────────────────┘

actor "Usuário" as user
participant "UI (Registrar)" as ui
participant "SanitarioFacade" as facade
participant "OfflineDB" as db
participant "SyncManager" as sync
database "Supabase" as db_remote

== Pré-carregamento (background) ==

sync -> db: prefetchCachePendencies()
db --> sync: pendencies[]

== Registro do Usuário ==

user -> ui: registraVacina(animalId, protocoloId, produto)

ui -> facade: createSanitaryGesture(input)
  note over facade: Valida deduplicação local\nValida produto no cache

facade -> db: createGesture() + queue_ops()
facade -> db: getBeforeSnapshot()

facade -> db: applyOptimisticUpdate()
  note over db: Updates state_protocolos\nMark pending

facade -> db: commit()
  note over db: Gesture committed\nStatus: PENDING

facade --> ui: gestureCreated()

== Sync Background (a cada 5s) ==

sync -> db: fetchPendingGestures()
db --> sync: gestures[]

sync -> sync: buildSyncPayload(gestures)

sync -> db_remote: POST /functions/v1/sync-batch
  note over db_remote: Anti-teleporte validation\nRLS check\nTaxonomy validation

db_remote --> sync: results[] (APPLIED/APPLIED_ALTERED/REJECTED)

alt resultado == APPLIED || APPLIED_ALTERED
  sync -> db: updateGestureStatus(DONE)
  sync -> db: fetchPostSyncUpdates()
  sync -> db: mergeUpdates()
else resultado == REJECTED
  sync -> db: rollbackOpLocal(beforeSnapshot)
  sync -> db: storeRejection(reason)
end

ui -> ui: refreshView()
```

### 4.5 Fluxograma de Processos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO - REGISTRO SANITÁRIO OTIMIZADO                    │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────────┐
                              │  Usuário seleciona   │
                              │  Animal + Protocolo  │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  Produto: autocomplete│
                              │  (offline cache)     │
                              └──────────┬───────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
           ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
           │  Escaneado   │     │  Manual      │     │  history    │
           │  (código)   │     │  (texto)     │     │  (sugere)   │
           └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
                  │                    │                    │
                  └────────────┬───────┴────────────┬────────┘
                               ▼                    ▼
                    ┌──────────────────────────────┐
                    │  Valida Carência Medicinal   │
                    │  (se aplicável)              │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │        resultado              │
                    │   ok    │    alerta   │ erro  │
                    └────┬────┴──────┬─────┴───┬───┘
                         │           │         │
                         ▼           ▼         ▼
                 ┌───────────┐ ┌─────────┐ ┌──────────┐
                 │ Proceed   │ │ Confirma│ │ Block   │
                 │           │ │ + log   │ │ + msg   │
                 └─────┬─────┘ └────┬────┘ └────┬────┘
                       │            │           │
                       └────────────┴───────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ createGesture +     │
                         │ optimistic update   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Sync (background)   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Feedback: success/  │
                         │ error + retry      │
                         └─────────────────────┘
```

---

## 5. Plano de Desenvolvimento

### 5.1 Fases de Implementação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PLANO DE DESENVOLVIMENTO - MÓDULO SANITÁRIO             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 1: FUNDAMENTOS (Semanas 1-2)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [1.1] Cache Local de Pendências                                            │
│   ├── Nova store Dexie: cache_sanitario_pendencias                         │
│   ├── Index: [fazenda_id+animal_id+tipo+status]                             │
│   ├── TTL: 1 hora (invalida em sync)                                        │
│   └── Impacto: F1, B2                                                       │
│                                                                             │
│ [1.2] Preenchimento Automático de Produto                                   │
│   ├── Busca em cache catalog_produtos_veterinarios                         │
│   ├── Fuzzy search para inputs parciais                                    │
│   └── Impacto: OM-2, OM-4                                                   │
│                                                                             │
│ [1.3] Validação de Carência Server-Side (MVP)                               │
│   ├── Nova RPC: validate_sanitario_carencia                                 │
│   ├── Verifica se produto tem período de carência                          │
│   └── Impacto: RS-2, OM-9                                                  │
│                                                                             │
│ [1.4] Índices Otimizados no IndexedDB                                       │
│   ├── Adicionar: state_protocolos_sanitarios_itens (protocolo_id, tipo)    │
│   ├── Adicionar: event_eventos_sanitario (animal_id, tipo)                 │
│   └── Impacto: F2, B3                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 2: EFICIÊNCIA (Semanas 3-4)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [2.1] Quick Register (1-Click)                                              │
│   ├── Component: QuickSanitaryRegister                                     │
│   ├── Flow: Scan → auto-fill → confirm → done                               │
│   ├── Meta: < 10 segundos para registro                                    │
│   └── Impacto: OM-1                                                        │
│                                                                             │
│ [2.2] Registro em Lote (Batch)                                             │
│   ├── UI: seleção múltipla de animais                                       │
│   ├── Validação: mesmo produto, mesma dose                                 │
│   ├── Deduplicação: batch dedup_key                                        │
│   └── Impacto: OM-3                                                        │
│                                                                             │
│ [2.3] Histórico Inline no Registro                                          │
│   ├── Exibe última aplicação do produto ao selecionar                      │
│   ├── Calcula dias desde última dose                                        │
│   └── Impacto: OM-4                                                         │
│                                                                             │
│ [2.4] Smart Defaults (baseado em protocolo)                               │
│   ├── Propaga dose_num, intervalo_dias do protocolo                       │
│   ├── Sugere produto baseado em dose anterior                              │
│   └── Impacto: OM-5                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 3: ESCALABILIDADE (Semanas 5-6)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [3.1] Paginação no Pull de Protocolos                                       │
│   ├── Modificar pullDataForFarm com offset/limit                           │
│   ├── Carregamento lazy em scroll                                          │
│   └── Impacto: B3                                                           │
│                                                                             │
│ [3.2] Prefetch de Eventos por Animal                                        │
│   ├── Web Worker para pré-carregamento                                     │
│   ├── Cache LRU em memória (100 animais)                                   │
│   └── Impacto: B4, OM-8                                                     │
│                                                                             │
│ [3.3] Otimização de Views do PostgreSQL                                     │
│   ├── Refatorar vw_sanitario_pendencias                                    │
│   ├── Adicionar índice: (fazenda_id, animal_id, data_prevista)            │
│   └── Impacto: B2                                                           │
│                                                                             │
│ [3.4] Async Catalog Refresh                                                │
│   ├── Non-blocking product catalog update                                  │
│   ├── Debounce de 5 segundos em input                                       │
│   └── Impacto: B4                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 4: CONFORMIDADE (Semanas 7-8)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [4.1] Auditoria de Overlays Regulatórios                                    │
│   ├── Novo store: event_regulatory_overlay                                 │
│   ├── Immutable - append-only                                              │
│   └── Impacto: F4, RS-4                                                     │
│                                                                             │
│ [4.2] Validação de Carência Completa                                        │
│   ├── Lookup em produtos_veterinarios                                      │
│   ├── Bloqueio UI se dentro do período                                     │
│   └── Impacto: RS-1, RS-2                                                   │
│                                                                             │
│ [4.3] RBAC para Regulatory Overlays                                        │
│   ├── Verificar canManage antes de edit                                    │
│   ├── Restringir a Manager/Owner                                           │
│   └── Impacto: RS-3                                                         │
│                                                                             │
│ [4.4] Testes de Integração com SBMV                                         │
│   ├── Fixture de protocolos oficiais                                       │
│   ├── Validação de compliance automática                                   │
│   └── Impacto: Todo                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 5: ESTABILIZAÇÃO (Semanas 9-10)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [5.1] Monitoramento e Métricas                                              │
│   ├── Extender metrics_events para sanitary                               │
│   ├── Dashboard de performance                                            │
│   └── Alertas de degradação                                               │
│                                                                             │
│ [5.2] Testes E2E Automatizados                                             │
│   ├── Cypress: Registro sanitário completo                                │
│   ├── Cypress: Batch registro                                             │
│   └── Cypress: Compliance overlay                                         │
│                                                                             │
│ [5.3] Documentação                                                         │
│   ├── Atualizar docs/SYSTEM.md                                            │
│   ├── ADRs para mudanças significativas                                    │
│   └── README de kontribusi                                                 │
│                                                                             │
│ [5.4] Release Candidate                                                   │
│   ├── Version bump                                                         │
│   ├── Migration scripts                                                    │
│   └── Rollout plan                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Priorização e Dependências

| Prioridade | Item                              | Dependências  | Entrega |
| ---------- | --------------------------------- | ------------- | ------- |
| **P0**     | Cache local pendências            | Nenhuma       | Fase 1  |
| **P0**     | Validação de carência server-side | Nenhuma       | Fase 1  |
| **P1**     | Preenchimento automático produto  | Catalog cache | Fase 1  |
| **P1**     | Quick Register 1-click            | Nenhuma       | Fase 2  |
| **P1**     | Registro em lote                  | Nenhuma       | Fase 2  |
| **P2**     | Paginação protocolos              | Nenhuma       | Fase 3  |
| **P2**     | Prefetch eventos                  | Nenhuma       | Fase 3  |
| **P2**     | Auditoria overlays                | Nenhuma       | Fase 4  |
| **P3**     | Monitoramento                     | Nenhuma       | Fase 5  |

### 5.3 Estimativa de Esforço

| Fase      | Estória de Usuário          | Pontos        |
| --------- | --------------------------- | ------------- |
| 1         | Cache local de pendências   | 5             |
| 1         | Autocomplete de produtos    | 3             |
| 1         | Validação de carência MVP   | 5             |
| 1         | Índices Dexie               | 2             |
| 2         | Quick Register              | 8             |
| 2         | Registro em lote            | 8             |
| 2         | Histórico inline            | 3             |
| 2         | Smart defaults              | 3             |
| 3         | Paginação protocolos        | 5             |
| 3         | Prefetch eventos            | 5             |
| 3         | Async catalog               | 3             |
| 4         | Auditoria overlays          | 5             |
| 4         | Validação carência completa | 5             |
| 4         | RBAC overlays               | 3             |
| 5         | Monitoramento               | 5             |
| 5         | E2E Tests                   | 8             |
| **Total** |                             | **66 pontos** |

---

## 6. Recomendações Finais

### 6.1 Ações Imediatas (Próximas 2 Semanas)

1. **Implementar cache local de pendências** - Resolve F1 e B2
2. **Adicionar índices em event_eventos_sanitario** - Resolve F2
3. **Validação básica de carência no sync** - Resolve RS-2

### 6.2 Estratégia de Rollout

- **Semana 1-2**: Feature flags para cache + autocomplete
- **Semana 3-4**: Beta com 5 fazendas (quick register)
- **Semana 5-6**: Rollout progressivo (lote + paginação)
- **Semana 7-8**: Full rollout + monitoramento

### 6.3 Métricas de Sucesso

| Métrica                     | Baseline | Meta   |
| --------------------------- | -------- | ------ |
| Tempo médio registro        | 45s      | <15s   |
| Latência pendências offline | 2s       | <200ms |
| Taxa de erro em lote        | 12%      | <2%    |
| Carência violações          | 0        | 0      |

---

_Documento gerado automaticamente via análise de codebase_
_Data: 2026-04-12_
_Versão: 1.0_
