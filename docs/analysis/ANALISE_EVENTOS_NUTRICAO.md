# Analise Tecnica de Campos de Eventos de Nutricao

## 1. Escopo

Esta analise cobre o que esta implementado hoje para o dominio `nutricao`:

- schema de banco (`eventos` + `eventos_nutricao`)
- politicas de acesso (RLS)
- camada offline-first (Dexie + queue)
- API de sincronizacao (`sync-batch`)
- telas atuais do frontend e lacunas de implementacao

Fontes principais:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0004_rls_hardening.sql`
- `supabase/functions/sync-batch/index.ts`
- `src/pages/Registrar.tsx`
- `src/App.tsx`
- `src/pages/Placeholder.tsx`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`

## 2. Perfis e papeis

No tenant da fazenda, os papeis validos sao:

- `owner` (proprietario)
- `manager` (gerente)
- `cowboy` (funcionario)

Nao existe role literal `admin` no enum `farm_role_enum`. Nesta analise, "administrador" e tratado como equivalente operacional a `manager` no contexto da fazenda.

## 3. Estado atual da implementacao de nutricao

### 3.1 Frontend

Hoje, nao existe formulario ativo para criar evento de nutricao:

- `Registrar` so oferece `sanitario`, `pesagem`, `movimentacao`.
- nao existe bloco condicional `tipoManejo === "nutricao"` no frontend.
- nao existe tela dedicada de listagem/edicao para nutricao.
- `/eventos` esta em placeholder (em desenvolvimento).

### 3.2 Backend e dados

Apesar de nao haver UI de criacao, o dominio `nutricao` esta modelado e pronto no backend:

- `dominio_enum` inclui `nutricao`.
- existe tabela `eventos_nutricao`.
- existe RLS para select/insert em `eventos_nutricao`.
- `sync-batch` aceita operacoes para `eventos_nutricao`.
- stores offline para `eventos_nutricao` existem.

## 4. Inventario e mapeamento de campos

## 4.1 Tabela base `eventos` (aplicavel ao dominio nutricao)

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---|---|
| `id` | uuid | Sim | PK do evento base |
| `fazenda_id` | uuid | Sim | Tenant |
| `dominio` | `dominio_enum` | Sim | Deve ser `nutricao` para este dominio |
| `occurred_at` | timestamptz | Sim | Data/hora do fato |
| `occurred_on` | date gerado | Sim | Derivado de `occurred_at` |
| `animal_id` | uuid null | Nao | alvo individual opcional |
| `lote_id` | uuid null | Nao | alvo por lote opcional |
| `source_task_id` | uuid null | Nao | rastreio de agenda |
| `source_tx_id` | uuid null | Nao | rastreio tecnico |
| `source_client_op_id` | uuid null | Nao | rastreio tecnico |
| `corrige_evento_id` | uuid null | Nao | referencia de correcao |
| `observacoes` | text null | Nao | observacoes livres |
| `payload` | jsonb | Sim | default `{}` |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

## 4.2 Tabela detalhe `eventos_nutricao`

| Campo | Tipo | Obrigatorio | Origem funcional |
|---|---|---|---|
| `evento_id` | uuid | Sim | PK + FK para `eventos` |
| `fazenda_id` | uuid | Sim | tenant |
| `alimento_nome` | text null | Nao | identifica alimento/racao |
| `quantidade_kg` | numeric(12,3) null | Nao | quantidade aplicada/fornecida |
| `payload` | jsonb | Sim | extensao |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

### 4.3 Validacoes de banco existentes

- Nao existe `check` de negocio para `alimento_nome` e `quantidade_kg`.
- O modelo atual permite ambos `null`.
- Trigger append-only impede update de colunas de negocio apos criacao.

## 4.4 Camada offline e API

### Offline stores

- `event_eventos` (base)
- `event_eventos_nutricao` (detalhe)

### Table map

- remoto `eventos_nutricao` <-> local `event_eventos_nutricao`

### Sync API

`sync-batch` aceita `INSERT` em `eventos` e `eventos_nutricao` desde que usuario tenha membership ativo na fazenda.

## 5. Matriz de visibilidade por perfil (estado atual)

## 5.1 Campos em formularios de criacao

Como nao existe UI de nutricao hoje:

| Campo de nutricao em formulario | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| `alimento_nome` | Oculto | Oculto | Oculto | Oculto |
| `quantidade_kg` | Oculto | Oculto | Oculto | Oculto |
| `observacoes_nutricao` (especifico) | Oculto | Oculto | Oculto | Oculto |

## 5.2 Campos no banco/API (acesso de dados)

Com base em RLS:

| Campo (`eventos_nutricao`) | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| Visualizar (`SELECT`) | Sim | Sim | Sim | Sim |
| Inserir (`INSERT`) | Sim | Sim | Sim | Sim |
| Editar colunas de negocio apos criar | Nao | Nao | Nao | Nao |

Observacao: "admin" tenant nao existe, equivalente pratico e `manager`.

## 6. Nivel de edicao por contexto

## 6.1 Criacao inicial

- Nao ha criacao por formulario no frontend.
- Criacao tecnica via operacoes offline/API e possivel.

## 6.2 Apos criacao

- Evento e append-only.
- Nao ha update de negocio em `eventos`/`eventos_nutricao`.
- Correcao deve ocorrer por novo evento (com `corrige_evento_id` quando aplicavel).

## 6.3 Campos automaticos

- `occurred_on` (derivado)
- `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at` (injetados por `createGesture`)
- `server_received_at` (servidor)

## 7. Perfil de acesso e responsabilidades

1. Membership em `user_fazendas` e obrigatoria para qualquer operacao.
2. `sync-batch` forca consistencia de tenant via `fazenda_id` server-side.
3. RLS de nutricao hoje nao diferencia owner/manager/cowboy para select/insert.
4. Nao existe workflow de aprovacao para eventos de nutricao.
5. Nao existe regra de delegacao temporaria por campo para nutricao.

## 8. Problemas e oportunidades de otimizacao

## 8.1 Redundancias e inconsistencias

1. Dominio `nutricao` existe completo no backend, mas sem UI de captura.
2. Falta padrao de payload para nutricao (risco de dados heterogeneos).

## 8.2 Validacoes insuficientes

1. `alimento_nome` pode ser null.
2. `quantidade_kg` pode ser null.
3. Nao existe check para quantidade > 0.
4. Nao existe validacao de unidade de medida, tipo de dieta ou contexto.

## 8.3 UX e operacao

1. Usuario final nao consegue registrar nutricao pela interface atual.
2. Nao ha feedback visual de historico nutricional por animal/lote.
3. Nao ha filtros por alimento, periodo, responsavel.

## 8.4 Integridade e auditoria

1. Sem campos de responsavel tecnico da alimentacao.
2. Sem vinculo estruturado com eventos sanitarios/reprodutivos correlatos.

## 9. Proposta de otimizacao (impacto x esforco)

| Prioridade | Acao | Impacto | Esforco |
|---|---|---|---|
| P0 | Implementar formulario de nutricao no `Registrar` | Alto | Medio |
| P0 | Validar `alimento_nome` obrigatorio e `quantidade > 0` | Alto | Baixo |
| P0 | Exibir erros por campo e por animal/lote | Alto | Medio |
| P1 | Exibir nutricao na timeline do animal e visao por lote | Alto | Medio |
| P1 | Padronizar payload de nutricao (schema versionado) | Medio | Medio |
| P2 | Criar tela de eventos nutricionais com filtros | Alto | Medio |

## 10. Novos campos recomendados (pecuaria moderna)

Campos sugeridos para `eventos_nutricao` (ou tabela correlata):

- `responsavel_user_id` (uuid)
- `metodo_fornecimento` (enum: cocho, pasto, trato manual, automatizado)
- `tipo_alimento` (enum: racao, silagem, sal_mineral, suplemento, volumoso)
- `alimento_id` (uuid opcional para catalogo)
- `quantidade` (numeric)
- `unidade` (enum: kg, g, l, saca)
- `lote_produto` (text)
- `custo_unitario` (numeric)
- `custo_total` (numeric calculado)
- `temperatura_c`, `umidade_pct` (contexto ambiental)
- `evento_sanitario_id` (uuid opcional)
- `evento_financeiro_id` (uuid opcional)
- `observacoes_estruturadas` (jsonb)

## 11. Escalabilidade futura

1. Multiplas especies:
   - dieta e unidade podem variar por especie/categoria.
2. Integracao com automacao:
   - cocho inteligente, sensores de consumo, importacao em lote.
3. Offline em campo:
   - suporte a lotes grandes de registros nutricionais e reprocessamento de rejeicoes.
4. Integracao externa:
   - exportacao para ERP, custo por lote, custo por kg ganho.

## 12. Recomendacoes tecnicas finais

1. Schema:
   - adicionar checks minimos (`quantidade > 0`) e obrigatoriedade condicional.
2. API:
   - manter `sync-batch`, mas com mensagens de erro especificas por campo de nutricao.
3. Frontend:
   - adicionar UI de criacao/consulta e validacao em tempo real.
4. Governanca:
   - preservar append-only e incluir fluxo de correcao rastreavel.

