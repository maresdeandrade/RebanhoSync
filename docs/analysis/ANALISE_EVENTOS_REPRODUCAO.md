# Analise Tecnica de Campos de Eventos de Reproducao

## 1. Escopo

Esta analise cobre o estado atual do dominio `reproducao` no GestaoAgro:

- schema de banco (`eventos` + `eventos_reproducao`)
- politicas de acesso (RLS)
- camada offline-first e sincronizacao
- interfaces de criacao/visualizacao existentes
- lacunas tecnicas e plano de evolucao

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

No escopo tenant da fazenda, os papeis validos sao:

- `owner` (proprietario)
- `manager` (gerente)
- `cowboy` (funcionario)

Nao existe role literal `admin` no enum `farm_role_enum`. Nesta analise, "administrador" e tratado como equivalente operacional a `manager`.

## 3. Estado atual da implementacao de reproducao

### 3.1 Frontend

Hoje, nao existe formulario funcional de registro de reproducao:

- `Registrar` nao possui opcao `reproducao`.
- rota `/eventos` esta em `Placeholder`.
- nao ha tela dedicada para reproducao.

### 3.2 Backend e dados

O dominio de reproducao esta modelado no backend:

- `dominio_enum` inclui `reproducao`.
- `repro_tipo_enum` inclui `cobertura`, `IA`, `diagnostico`, `parto`.
- existe tabela `eventos_reproducao`.
- existe RLS para select/insert em `eventos_reproducao`.
- `sync-batch` aceita `eventos_reproducao`.
- store local `event_eventos_reproducao` existe.

## 4. Inventario e mapeamento de campos

## 4.1 Tabela base `eventos` (aplicavel a reproducao)

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---|---|
| `id` | uuid | Sim | PK do evento |
| `fazenda_id` | uuid | Sim | tenant |
| `dominio` | `dominio_enum` | Sim | deve ser `reproducao` |
| `occurred_at` | timestamptz | Sim | data/hora do fato |
| `occurred_on` | date gerado | Sim | derivado |
| `animal_id` | uuid null | Nao | alvo individual opcional |
| `lote_id` | uuid null | Nao | alvo por lote opcional |
| `source_task_id` | uuid null | Nao | rastreio de agenda |
| `source_tx_id` | uuid null | Nao | rastreio tecnico |
| `source_client_op_id` | uuid null | Nao | rastreio tecnico |
| `corrige_evento_id` | uuid null | Nao | correcao append-only |
| `observacoes` | text null | Nao | observacao livre |
| `payload` | jsonb | Sim | default `{}` |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

## 4.2 Tabela detalhe `eventos_reproducao`

| Campo | Tipo | Obrigatorio | Origem funcional |
|---|---|---|---|
| `evento_id` | uuid | Sim | PK + FK para `eventos` |
| `fazenda_id` | uuid | Sim | tenant |
| `tipo` | `repro_tipo_enum` | Sim | `cobertura`, `IA`, `diagnostico`, `parto` |
| `macho_id` | uuid null | Nao | reprodutor associado |
| `payload` | jsonb | Sim | extensoes do dominio |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

### 4.3 Validacoes de banco existentes

- `tipo` e obrigatorio via enum.
- `macho_id` nao possui FK explicita para `animais` nesta tabela.
- trigger append-only bloqueia update de colunas de negocio apos insert.

## 4.4 Camada offline e API

### Stores locais

- `event_eventos`
- `event_eventos_reproducao`

### Table map

- remoto `eventos_reproducao` <-> local `event_eventos_reproducao`

### Sync API

`sync-batch` aceita operacoes para `eventos_reproducao` com:

- validacao de membership na fazenda
- forca de `fazenda_id` no servidor
- retorno por operacao (`APPLIED`, `REJECTED`, etc.)

## 5. Matriz de visibilidade por perfil (estado atual)

## 5.1 Campos de reproducao em formularios

Como nao existe formulario de reproducao hoje:

| Campo em formulario | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| `tipo` | Oculto | Oculto | Oculto | Oculto |
| `macho_id` | Oculto | Oculto | Oculto | Oculto |
| `data_reproducao` (derivado de occurred_at) | Oculto | Oculto | Oculto | Oculto |

## 5.2 Acesso por RLS

| Operacao em `eventos_reproducao` | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| `SELECT` | Sim | Sim | Sim | Sim |
| `INSERT` | Sim | Sim | Sim | Sim |
| update de negocio apos criar | Nao | Nao | Nao | Nao |

Observacao: "admin" tenant nao existe, equivalente pratico e `manager`.

## 6. Nivel de edicao por contexto

## 6.1 Criacao inicial

- Nao existe criacao por UI atualmente.
- Criacao tecnica via operacoes/sync e possivel.

## 6.2 Apos criacao

- Sem edicao de colunas de negocio (append-only).
- Correcao deve usar novo evento, nao update.

## 6.3 Campos automaticos

- `occurred_on` (derivado)
- `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at`
- `server_received_at`

## 7. Perfil de acesso e responsabilidades

1. Membership ativo e obrigatorio para acessar/registrar dados.
2. Backend `sync-batch` reforca tenant e bloqueia tabelas sensiveis.
3. RLS atual nao diferencia papeis para insert de eventos de reproducao.
4. Nao ha workflow de aprovacao para eventos reprodutivos.
5. Nao ha separacao de responsabilidade por campo (vet, inseminador, etc.).

## 8. Problemas e oportunidades de otimizacao

## 8.1 Gaps de implementacao

1. Dominio de reproducao existe no banco, mas sem UI funcional de captura.
2. Nao ha timeline detalhada por tipo reprodutivo no frontend.

## 8.2 Gaps de validacao

1. `macho_id` e opcional e sem FK referencial nesta tabela.
2. Nao ha regras para validar sexo do macho, compatibilidade ou status do reprodutor.
3. Nao ha validacao de janela reprodutiva ou intervalo entre eventos.

## 8.3 Gaps de integridade

1. Falta FK de `macho_id` para `animais` com `fazenda_id`.
2. Sem restricoes para evitar registros inconsistentes (ex.: macho fora do lote).

## 8.4 UX e operacao

1. Usuario final nao pode registrar reproducao pela UI.
2. Nao ha fluxo de acompanhamento de gestacao/parto integrado.

## 9. Proposta de otimizacao (impacto x esforco)

| Prioridade | Acao | Impacto | Esforco |
|---|---|---|---|
| P0 | Implementar formulario de reproducao no `Registrar` | Alto | Medio |
| P0 | Validar `tipo` e campos obrigatorios por tipo (ex.: `macho_id` em cobertura/IA) | Alto | Medio |
| P1 | Criar FK de `macho_id` para `animais` com `fazenda_id` | Alto | Medio |
| P1 | Exibir eventos reprodutivos na timeline do animal | Medio | Baixo |
| P2 | Criar tela de gestao reprodutiva (ciclos, diagnosticos, partos) | Alto | Medio |

## 10. Novos campos recomendados

Campos sugeridos para evolucao de `eventos_reproducao`:

- `responsavel_user_id` (uuid)
- `macho_id` (FK obrigatoria por tipo)
- `tecnica` (enum: monta, ia, transferencia)
- `dose_semen_id` (uuid)
- `lote_semen` (text)
- `diagnostico_resultado` (enum: positivo, negativo, inconclusivo)
- `data_prevista_parto` (date)
- `data_parto_real` (date)
- `numero_crias` (int)
- `status_reprodutivo` (enum)
- `observacoes_estruturadas` (jsonb)

## 11. Escalabilidade futura

1. Multiplas especies:
   - ciclos e tecnicas variam por especie.
2. Integracao com veterinaria:
   - laudos e exames, integracao com laboratorio.
3. Offline robusto:
   - suporte a batches grandes e reprocessamento de rejeicoes.
4. Analiticos:
   - taxa de concepcao, intervalo entre partos, performance por reprodutor.

## 12. Recomendacoes tecnicas finais

1. Schema:
   - adicionar checks por tipo e FKs para reprodutor.
2. Frontend:
   - UI completa de registro e acompanhamento.
3. Backend:
   - manter append-only, com correcao via novo evento.
4. Governanca:
   - fluxos de aprovacao para procedimentos criticos.

