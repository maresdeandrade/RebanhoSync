# Análise Técnica de Campos de Eventos de Pesagem

## 1. Escopo

Esta análise cobre o estado atual dos campos de pesagem no GestaoAgro:

- criação de evento no formulário (`/registrar`)
- persistência em `eventos` + `eventos_pesagem`
- visualizações em `AnimalDetalhe` e `Dashboard`
- sincronização (`sync-batch`) e camada offline
- permissões por perfil e RLS

Fontes principais:

- `src/pages/Registrar.tsx`
- `src/pages/AnimalDetalhe.tsx`
- `src/pages/Dashboard.tsx`
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0004_rls_hardening.sql`
- `supabase/functions/sync-batch/index.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/db.ts`

## 2. Perfis e nomenclatura

No modelo atual de fazenda:

- `owner` = proprietário
- `manager` = gerente
- `cowboy` = funcionário

Não há role literal `admin` no enum de fazenda (`farm_role_enum`), então nesta análise "administrador" é tratado como equivalente operacional a `manager`.

## 3. Fluxo de criação de pesagem

1. Seleciona lote (`selectedLoteId`).
2. Seleciona animais (`selectedAnimais`).
3. Seleciona ação `pesagem` (`tipoManejo`).
4. Informa peso por animal (`pesagemData[animalId]`).
5. Confirma.
6. Para cada animal, o app gera:
   - `INSERT` em `eventos` com `dominio = 'pesagem'`
   - `INSERT` em `eventos_pesagem` com `peso_kg`

## 4. Inventário completo de campos

### 4.1 Campos de formulário (UI)

| Campo UI | Nome técnico | Tipo | Obrigatório hoje | Destino |
|---|---|---|---|---|
| Lote | `selectedLoteId` | `string` | Sim para fluxo | filtro de seleção |
| Animais | `selectedAnimais` | `string[]` | Sim | `eventos.animal_id` |
| Tipo de manejo | `tipoManejo` | union string | Sim | `eventos.dominio` |
| Peso por animal | `pesagemData[animalId]` | `string -> number` | **Fraco no frontend** | `eventos_pesagem.peso_kg` |

### 4.2 Campos persistidos em `eventos`

| Campo | Tipo | Origem | Regra |
|---|---|---|---|
| `id` | uuid | `crypto.randomUUID()` | PK |
| `fazenda_id` | uuid | contexto ativo/servidor | tenant obrigatório |
| `dominio` | enum | `tipoManejo` | `pesagem` |
| `occurred_at` | timestamptz | `new Date().toISOString()` | obrigatório |
| `occurred_on` | date gerado | derivado | automático |
| `animal_id` | uuid | animal selecionado | FK composta |
| `lote_id` | uuid nullable | lote atual do animal | FK composta |
| `source_task_id` | uuid nullable | não usado no fluxo | opcional |
| `corrige_evento_id` | uuid nullable | não usado no fluxo | opcional |
| `observacoes` | text nullable | não usado no fluxo | opcional |
| `payload` | jsonb | default | `{}` |
| `client_*`, `server_received_at` | técnico | injeção automática | sync/idempotência |

### 4.3 Campos persistidos em `eventos_pesagem`

| Campo | Tipo | Origem | Regra |
|---|---|---|---|
| `evento_id` | uuid | id do evento base | PK + FK |
| `fazenda_id` | uuid | contexto ativo/servidor | tenant obrigatório |
| `peso_kg` | numeric(10,2) | input usuário | `check (peso_kg > 0)` |
| `payload` | jsonb | default | `{}` |
| `client_*`, `server_received_at` | técnico | injeção automática | sync/idempotência |

### 4.4 Campos em visualização

| Tela | Campo exibido | Fonte |
|---|---|---|
| `AnimalDetalhe` | `ultimoPeso.peso_kg` e data | join local `event_eventos` + `event_eventos_pesagem` |
| `Dashboard` | série `media` (na prática peso por evento) | últimos eventos de pesagem |
| Timeline do animal | domínio/data/observação | não mostra `peso_kg` explicitamente |

## 5. Visibilidade por perfil

### 5.1 Formulário de criação (`/registrar`)

| Campo | Proprietário | Gerente | Funcionário | Administrador* |
|---|---|---|---|---|
| Lote | Exibido | Exibido | Exibido | Exibido |
| Animais | Exibido | Exibido | Exibido | Exibido |
| Ação Pesagem | Exibido | Exibido | Exibido | Exibido |
| Peso por animal | Exibido | Exibido | Exibido | Exibido |
| Confirmação | Exibido | Exibido | Exibido | Exibido |

\* Equivalente a `manager` no estado atual.

### 5.2 Visualização de pesagem

| Recurso | Proprietário | Gerente | Funcionário | Administrador* |
|---|---|---|---|---|
| Peso atual no `AnimalDetalhe` | Exibido | Exibido | Exibido | Exibido |
| Evolução no `Dashboard` | Exibido | Exibido | Exibido | Exibido |
| Tela `/eventos` | Placeholder | Placeholder | Placeholder | Placeholder |

## 6. Nível de edição

### 6.1 Durante criação

- Editáveis: `selectedLoteId`, `selectedAnimais`, `tipoManejo`, `pesagemData[animalId]`.
- Campo calculado: nenhum de negócio; apenas metadata técnica.

### 6.2 Após criação

- `eventos` e `eventos_pesagem` são append-only para colunas de negócio.
- Não há tela de edição de pesagem.
- Correção depende de novo evento (contra-lançamento/correção), não update.

### 6.3 Campos somente leitura/automáticos

- `occurred_on` (gerado)
- `client_op_id`, `client_tx_id`, `client_recorded_at`, `client_id`
- `server_received_at`

## 7. Perfil de acesso (visualizar x modificar)

### 7.1 Banco (RLS)

- `eventos`: `SELECT` e `INSERT` para qualquer membro da fazenda.
- `eventos_pesagem`: `SELECT` e `INSERT` para qualquer membro da fazenda.
- Não há fluxo de update de negócio suportado para eventos.

### 7.2 Backend de sync

- Valida membership ativo na fazenda antes de processar.
- Força `fazenda_id` no servidor para tabelas do tenant.
- Processa operações e retorna status (`APPLIED`, `APPLIED_ALTERED`, `REJECTED`).

## 8. Problemas atuais

1. Validação de peso no frontend é insuficiente:
   - `parseFloat(pesagemData[animalId] || "0")` pode enviar `0` quando vazio.
   - banco rejeita por `check (peso_kg > 0)`.
2. UX de erro genérica:
   - usuário não recebe feedback claro por animal/campo rejeitado.
3. Timeline do animal não mostra peso de cada evento de pesagem.
4. Dashboard chama série de `media`, mas usa peso pontual por evento.
5. `/eventos` ainda não existe para gestão operacional de histórico.

## 9. Proposta de otimização (impacto x esforço)

| Prioridade | Ação | Impacto | Esforço |
|---|---|---|---|
| P0 | Tornar peso obrigatório por animal selecionado | Alto | Baixo |
| P0 | Validar `min > 0`, faixa plausível e valor numérico no frontend | Alto | Baixo |
| P0 | Exibir erro por animal na confirmação/rejeição | Alto | Médio |
| P1 | Mostrar pesos na etapa de confirmação | Médio | Baixo |
| P1 | Exibir `peso_kg` na timeline do animal | Médio | Baixo |
| P1 | Permitir informar `occurred_at` real da pesagem | Alto | Médio |
| P2 | Implementar tela `/eventos` com filtro de pesagem | Alto | Médio |

## 10. Novos campos recomendados (expansão pecuária)

### 10.1 Operacionais

- `responsavel_user_id` (uuid)
- `metodo_pesagem` (enum: `balanca_eletronica`, `balanca_mecanica`, `estimado`, etc.)
- `equipamento_id` (text/uuid)
- `lote_pesagem_id` (uuid opcional)
- `observacoes_estruturadas` (jsonb)

### 10.2 Contexto ambiental

- `temperatura_c` (numeric)
- `umidade_pct` (numeric)
- `condicao_climatica` (enum)

### 10.3 Correlação de manejo

- `evento_sanitario_id` (uuid opcional)
- `evento_nutricao_id` (uuid opcional)

## 11. Escalabilidade futura

1. Múltiplas espécies:
   - validar faixa de peso por espécie/categoria.
2. Integração com balanças:
   - `source_system`, `source_external_id`, `raw_payload`, deduplicação por origem.
3. Offline robusto:
   - validação pré-fila + UI de rejeições por operação.
4. Exportações:
   - contrato de saída versionado para ERP/reguladores com trilha de auditoria.

## 12. Recomendações técnicas finais

1. **Schema**:
   - expandir `eventos_pesagem` com campos de contexto (responsável, método, equipamento, ambiente).
2. **Validações**:
   - frontend forte + constraint de banco já existente.
3. **Erros e notificações**:
   - mensagens por animal/campo e tela de reprocessamento de rejeições.
4. **Integridade histórica**:
   - manter append-only e correção via novo evento referenciando o anterior.

