# RebanhoSync — Offline-First MVP

Aplicação **offline-first** para gestão pecuária com **multi-tenant por fazenda**, RBAC (`owner | manager | cowboy`), sincronização por **gestos** (`client_tx_id`) e servidor Supabase com **RLS hardened** + **RPCs security definer**.

---

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- Supabase (Auth, Postgres, RLS, RPCs, Edge Functions)
- Dexie.js (IndexedDB) para armazenamento local offline
- pnpm

---

## Estado do Projeto

### ✅ Implementado (MVP Completo)

#### Autenticação e Multi-Tenant
- Login/logout com Supabase Auth
- Seleção de fazenda ativa (multi-device)
  - Cache local em `localStorage`
  - Persistência remota em `user_settings.active_fazenda_id`
- Onboarding invite-first com `can_create_farm`
- RBAC client-side (UI) + RLS server-side

#### Gestão do Rebanho
- Cadastro de animais (identificação, sexo, status)
- Cadastro de lotes (nome, status, touro)
- Cadastro de pastos (nome, área em hectares)
- Cadastro de contrapartes (pessoas/empresas)

#### Eventos (Two Rails - Append-Only)
- Eventos sanitários (vacinação, vermifugação, medicamento)
- Eventos de pesagem (peso em kg)
- Eventos de movimentação (entre lotes/pastos)
- Eventos de reprodução (cobertura, IA, diagnóstico, parto)
- Eventos financeiros (compra, venda)
- Timeline de eventos por animal

#### Agenda
- Tarefas agendadas (mutáveis)
- Status: agendado, concluido, cancelado
- Deduplicação automática via `dedup_key`
- source_kind: manual, automatico

#### Protocolos Sanitários
- Templates de protocolos
- Itens de protocolo (tipo, produto, intervalo_dias, dose_num)
- Geração automática de agenda
- Deduplicação via `dedup_template`

#### Fluxos Offline → Sync
- Criação de gestos (`createGesture`)
- Aplicação otimista no Dexie
- Sync worker (a cada 5 segundos)
- Anti-teleport (validação server-side)
- Rollback determinístico com `before_snapshot`

#### Segurança
- JWT obrigatório no sync-batch
- RLS policies por tenant
- Membership verification
- Tabelas bloqueadas (user_fazendas, user_profiles, user_settings)
- RPCs security definer para operações críticas

#### Campos de Fazenda (Migração 0016)
- nome, codigo, municipio
- **NOVO**: estado (UF), cep, area_total_ha
- **NOVO**: tipo_producao (corte/leite/mista)
- **NOVO**: sistema_manejo (confinamento/semi/pastagem)

#### Performance (Migração 0018)
- idx_animais_status
- idx_animais_lote
- idx_animais_sexo
- idx_eventos_fazenda_dominio_occurred
- idx_eventos_fazenda_animal_occurred
- idx_agenda_fazenda_data
- idx_agenda_fazenda_status

### 🔄 Em Desenvolvimento

- Dashboard com métricas (implementação parcial visível na UI)
- Página de eventos (link na home, estrutura criada)
- Página financeiro (link na home, estrutura criada)

### ⏳ Planejado (Ver ROADMAP.md)

Consulte o documento [`docs/ROADMAP.md`](docs/ROADMAP.md) para funcionalidades planejadas:

- Campos adicionais em animais (origem, brinco, raça, pelagem)
- Sistema de sociedade de animais
- Categorias zootécnicas automáticas
- Catálogo de produtos veterinários
- Controle de estoque
- Relatórios e dashboards avançados
- Integração GTA/Sisbov

---

## Arquitetura (Visão Rápida)

### Two Rails: State + Events

```
Rail 1 (State - Mutável):
├── animais        → Estado atual do rebanho
├── lotes          → Agrupamentos de animais
├── pastos         → Áreas de pastagem
├── agenda_itens   → Tarefas agendadas
├── contrapartes  → Compradores/vendedores
└── protocolos_*  → Templates de manejo

Rail 2 (Events - Append-Only):
├── eventos              → Registro base
├── eventos_sanitario   → Vacinação/vermifugação/medicamento
├── eventos_pesagem      → Peso em kg
├── eventos_nutricao    → Alimentação
├── eventos_movimentacao → Transferências
├── eventos_reproducao   → Cobertura/IA/diagnóstico/parto
└── eventos_financeiro  → Compra/venda
```

### Offline-First com Fila de Gestos

```typescript
// 1. UI cria gesto
const client_tx_id = await createGesture(fazenda_id, ops);

// 2. Cliente aplica otimista no Dexie
await applyOpLocal(op);

// 3. Ops ficam em queue_ops e queue_gestures

// 4. syncWorker envia para Edge Function sync-batch
await syncBatch(gesture);

// 5. Servidor retorna APPLIED / APPLIED_ALTERED / REJECTED

// 6. Se REJECTED, rollback com before_snapshot
```

### Mapeamento de Tabelas

Fonte única: [`src/lib/offline/tableMap.ts`](src/lib/offline/tableMap.ts)

| Remoto (Supabase) | Local (Dexie) |
|-------------------|---------------|
| `animais` | `state_animais` |
| `lotes` | `state_lotes` |
| `pastos` | `state_pastos` |
| `agenda_itens` | `state_agenda_itens` |
| `contrapartes` | `state_contrapartes` |
| `protocolos_sanitarios` | `state_protocolos_sanitarios` |
| `protocolos_sanitarios_itens` | `state_protocolos_sanitarios_itens` |
| `eventos` | `event_eventos` |
| `eventos_sanitario` | `event_eventos_sanitario` |
| `eventos_pesagem` | `event_eventos_pesagem` |
| `eventos_movimentacao` | `event_eventos_movimentacao` |
| `eventos_reproducao` | `event_eventos_reproducao` |
| `eventos_financeiro` | `event_eventos_financeiro` |

---

## Segurança (P0)

### JWT Obrigatório no Sync

A Edge Function `sync-batch` exige:

```http
Authorization: Bearer <access_token>
```

Validações:
- **401**: JWT ausente ou inválido
- **403**: Usuário sem acesso à fazenda

### RLS Hardened

- `user_fazendas`: SELECT-only (sem INSERT/UPDATE/DELETE direto)
- Membership/gestão de membros **somente via RPCs**:

| RPC | Descrição |
|-----|-----------|
| `create_fazenda` | Cria fazenda + owner bootstrap |
| `admin_set_member_role` | Altera role de membro |
| `admin_remove_member` | Remove membro (soft delete) |
| `create_invite` | Cria convite |
| `accept_invite` | Aceita convite |
| `reject_invite` | Rejeita convite |
| `cancel_invite` | Cancela convite |
| `get_invite_preview` | Visualiza convite |
| `can_create_farm` | Verifica se pode criar fazenda |

---

## Estrutura de Pages

```
src/pages/
├── AcceptInvite.tsx     # Aceitar convite
├── AdminMembros.tsx     # Gestão de membros
├── Agenda.tsx           # Agenda de tarefas
├── Animais.tsx         # Lista de animais
├── AnimalDetalhe.tsx   # Detalhe do animal
├── AnimalEditar.tsx    # Editar animal
├── AnimalNovo.tsx      # Cadastrar animal
├── CriarFazenda.tsx    # Criar nova fazenda
├── Dashboard.tsx       # Dashboard (em desenvolvimento)
├── EditarFazenda.tsx   # Editar dados da fazenda
├── Home.tsx            # Página principal
├── Index.tsx           # Redirect
├── Login.tsx           # Login
├── LoteDetalhe.tsx    # Detalhe do lote
├── LoteNovo.tsx        # Criar lote
├── Lotes.tsx           # Lista de lotes
├── Membros.tsx         # Lista de membros
├── NotFound.tsx        # 404
├── PastoDetalhe.tsx   # Detalhe do pasto
├── PastoNovo.tsx       # Criar pasto
├── Pastos.tsx          # Lista de pastos
├── Perfil.tsx          # Perfil do usuário
├── Reconciliacao.tsx   # Reconciliação de sync
├── Registrar.tsx       # Registro de eventos
├── SelectFazenda.tsx  # Seleção de fazenda ativa
└── SignUp.tsx          # Cadastro
```

---

## Rodando Localmente

### Pré-requisitos

- Node.js 18+
- pnpm
- Projeto Supabase configurado

### Variáveis de Ambiente

Crie `.env.local`:

```bash
VITE_SUPABASE_URL="https://xxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="..."
VITE_SUPABASE_FUNCTIONS_URL="https://xxxx.supabase.co/functions/v1"
```

### Comandos

```bash
# Instalar dependências
pnpm install

# Dev server
pnpm dev

# Build
pnpm run build

# Typecheck
pnpm exec tsc --noEmit

# Lint
pnpm run lint
```

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitetura Two Rails e offline-first |
| [`docs/DB.md`](docs/DB.md) | Schema do banco de dados |
| [`docs/RLS.md`](docs/RLS.md) | Row Level Security e permissões |
| [`docs/CONTRACTS.md`](docs/CONTRACTS.md) | Contratos da Edge Function sync-batch |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Estratégia offline-first com Dexie |
| [`docs/E2E_MVP.md`](docs/E2E_MVP.md) | Fluxos de teste E2E |
| [`docs/ONBOARDING_FIX.md`](docs/ONBOARDING_FIX.md) | Fluxo de onboarding corrigido |
| [`docs/ANALISE_CAMPOS_FAZENDA.md`](docs/ANALISE_CAMPOS_FAZENDA.md) | Análise de campos de fazendas |
| [`docs/ANALISE_CAMPOS_REBANHO.md`](docs/ANALISE_CAMPOS_REBANHO.md) | Análise de campos do rebanho |
| [`docs/ANALISE_EVENTOS_SANITARIOS.md`](docs/ANALISE_EVENTOS_SANITARIOS.md) | Análise de eventos sanitários |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | **Funcionalidades planejadas** |

---

## Convenções de Código

### TypeScript

```typescript
// Erros: catch como unknown + instanceof Error
catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));
}

// setInterval: tipar corretamente
const timer = setInterval(fn, 1000) as unknown as ReturnType<typeof setInterval>;

// Server-managed: não enviar created_at/updated_at em payloads
```

### Offline Sync

```typescript
// Metadata de sync via client_*
const record = {
  ...data,
  client_id: getClientId(),
  client_op_id: crypto.randomUUID(),
  client_tx_id: txId,
  client_recorded_at: new Date().toISOString(),
};
```

---

## Troubleshooting

### "Invalid hook call"

Causas comuns:
- Duas cóias de React (pnpm/workspaces)
- Peer dependencies inconsistentes

Solução:
```bash
pnpm why react
# Verificar duplicações
pnpm install
```

### Sync não funciona

1. Verificar JWT no console:
   ```javascript
   console.log(await supabase.auth.getSession())
   ```

2. Verificar console do sync-worker:
   ```javascript
   // Logs mostram status de sync
   console.log('[sync-worker] Processing gesture...')
   ```

3. Verificar rejections:
   ```javascript
   const rejections = await db.queue_rejections.toArray();
   ```

---

## Licença

Proprietário - DYAD Apps
