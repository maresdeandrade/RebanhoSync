# Analise Tecnica de Campos de Eventos Financeiros

## 1. Escopo

Esta analise cobre o estado atual do dominio `financeiro` no RebanhoSync:

- schema de banco (`eventos` + `eventos_financeiro`)
- permissao de acesso (RLS)
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
- `src/pages/Home.tsx`
- `src/components/layout/SideNav.tsx`
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

Nao existe role literal `admin` no enum `farm_role_enum`. Nesta analise, "administrador" e tratado como equivalente operacional a `manager` no modulo de fazenda.

## 3. Estado atual da implementacao de financeiro

### 3.1 Frontend

Hoje, nao existe formulario funcional de registro financeiro:

- `Registrar` nao possui opcao `financeiro`.
- rota `/financeiro` existe, mas aponta para `Placeholder`.
- `/eventos` tambem esta em `Placeholder`, sem tela de gestao de eventos financeiros.

### 3.2 Backend e dados

O dominio financeiro esta modelado no backend:

- `dominio_enum` inclui `financeiro`.
- `financeiro_tipo_enum` inclui `compra` e `venda`.
- existe tabela `eventos_financeiro`.
- existe RLS para select/insert em `eventos_financeiro`.
- `sync-batch` aceita `eventos_financeiro`.
- store local `event_eventos_financeiro` existe.

## 4. Inventario e mapeamento de campos

## 4.1 Tabela base `eventos` (aplicavel ao financeiro)

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---|---|
| `id` | uuid | Sim | PK do evento |
| `fazenda_id` | uuid | Sim | tenant |
| `dominio` | `dominio_enum` | Sim | deve ser `financeiro` |
| `occurred_at` | timestamptz | Sim | data do fato |
| `occurred_on` | date gerado | Sim | derivado |
| `animal_id` | uuid null | Nao | opcional (evento associado a animal) |
| `lote_id` | uuid null | Nao | opcional (evento por lote) |
| `source_task_id` | uuid null | Nao | rastreio agenda |
| `source_tx_id` | uuid null | Nao | rastreio tecnico |
| `source_client_op_id` | uuid null | Nao | rastreio tecnico |
| `corrige_evento_id` | uuid null | Nao | correcao append-only |
| `observacoes` | text null | Nao | observacao livre |
| `payload` | jsonb | Sim | default `{}` |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

## 4.2 Tabela detalhe `eventos_financeiro`

| Campo | Tipo | Obrigatorio | Origem funcional |
|---|---|---|---|
| `evento_id` | uuid | Sim | PK + FK para `eventos` |
| `fazenda_id` | uuid | Sim | tenant |
| `tipo` | `financeiro_tipo_enum` | Sim | `compra` ou `venda` |
| `valor_total` | numeric(14,2) | Sim | valor da transacao |
| `contraparte_id` | uuid null | Nao | pessoa/empresa da operacao |
| `payload` | jsonb | Sim | extensoes do dominio |
| `client_*`, `server_received_at` | tecnicos | Sim | sync/idempotencia |

### 4.3 Validacoes de banco existentes

- `tipo` e obrigatorio via enum.
- `valor_total` e obrigatorio, mas sem `check (> 0)`.
- `contraparte_id` e opcional e sem FK explicita para `contrapartes`.
- trigger append-only bloqueia update de colunas de negocio apos insert.

## 4.4 Camada offline e API

### Stores locais

- `event_eventos`
- `event_eventos_financeiro`

### Table map

- remoto `eventos_financeiro` <-> local `event_eventos_financeiro`

### Sync API

`sync-batch` aceita operacoes para `eventos_financeiro` com:

- validacao de membership na fazenda
- forca de `fazenda_id` no servidor
- retorno por operacao (`APPLIED`, `REJECTED`, etc.)

## 5. Matriz de visibilidade por perfil (estado atual)

## 5.1 Campos financeiros em formularios

Como nao existe formulario financeiro hoje:

| Campo financeiro em formulario | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| `tipo` (compra/venda) | Oculto | Oculto | Oculto | Oculto |
| `valor_total` | Oculto | Oculto | Oculto | Oculto |
| `contraparte_id` | Oculto | Oculto | Oculto | Oculto |
| `documento`/`centro_custo` (especificos) | Oculto | Oculto | Oculto | Oculto |

## 5.2 Visibilidade de modulo

| Tela | Owner | Admin/Manager | Manager | Cowboy |
|---|---|---|---|---|
| Card Financeiro (Home/SideNav) | Exibido | Exibido | Exibido | Exibido |
| `/financeiro` | Placeholder | Placeholder | Placeholder | Placeholder |
| `/eventos` | Placeholder | Placeholder | Placeholder | Placeholder |

## 5.3 Acesso de dados via RLS

| Operacao em `eventos_financeiro` | Owner | Admin/Manager | Manager | Cowboy |
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
- Correcao deve usar novo evento, nao update do existente.

## 6.3 Campos automaticos

- `occurred_on` (derivado)
- `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at`
- `server_received_at`

## 7. Perfil de acesso e responsabilidades

1. Membership ativo e obrigatorio para acessar/registrar dados.
2. Backend `sync-batch` reforca tenant e bloqueia tabelas sensiveis.
3. RLS atual nao diferencia papeis para insert de eventos financeiros.
4. Nao ha aprovacao hierarquica para eventos financeiros no estado atual.
5. Nao ha separacao de responsabilidade contabil x operacional por campo.

## 8. Problemas e oportunidades de otimizacao

## 8.1 Gaps de implementacao

1. Dominio financeiro existe no banco, mas sem UI funcional de captura.
2. Sem listagem/consulta operacional no frontend.

## 8.2 Gaps de validacao

1. `valor_total` nao tem check de positividade no banco.
2. `contraparte_id` e opcional sem regra de obrigatoriedade por tipo de operacao.
3. Sem validacao de moeda, imposto, desconto, forma de pagamento.
4. Sem vinculacao obrigatoria a documento fiscal quando aplicavel.

## 8.3 Gaps de integridade referencial

1. `contraparte_id` nao possui FK explicita em `eventos_financeiro`.
2. Isso permite gravar IDs inconsistentes sem bloqueio referencial nessa tabela.

## 8.4 UX e operacao

1. Usuario ve modulo Financeiro na navegacao, mas encontra placeholder.
2. Nao existe feedback de conciliacao, vencimento ou status financeiro.
3. Nao existe timeline financeira por animal/lote/periodo.

## 9. Proposta de otimizacao (impacto x esforco)

| Prioridade | Acao | Impacto | Esforco |
|---|---|---|---|
| P0 | Implementar formulario financeiro basico (`tipo`, `valor_total`, `contraparte`) | Alto | Medio |
| P0 | Adicionar `check (valor_total > 0)` no schema | Alto | Baixo |
| P0 | Tornar `contraparte_id` obrigatorio por regra de negocio quando aplicavel | Alto | Baixo |
| P1 | Adicionar FK de `contraparte_id` para `contrapartes` (com `fazenda_id`) | Alto | Medio |
| P1 | Exibir eventos financeiros em tela dedicada com filtros | Alto | Medio |
| P2 | Introduzir fluxo de aprovacao para eventos acima de limite de valor | Alto | Medio |

## 10. Novos campos recomendados

Campos sugeridos para evolucao de `eventos_financeiro`:

- `responsavel_user_id` (uuid)
- `centro_custo` (text ou uuid)
- `categoria_financeira` (enum)
- `subcategoria_financeira` (text/enum)
- `forma_pagamento` (enum: pix, boleto, transferencia, dinheiro, cartao)
- `status_pagamento` (enum: previsto, pago, vencido, cancelado)
- `data_vencimento` (date)
- `data_pagamento` (date)
- `numero_documento` (text)
- `numero_nota_fiscal` (text)
- `moeda` (char(3))
- `taxa_cambio` (numeric)
- `valor_bruto`, `valor_desconto`, `valor_imposto`, `valor_liquido` (numeric)
- `evento_origem_id` (uuid para vinculo com manejo/sanitario/nutricao/movimentacao)
- `observacoes_estruturadas` (jsonb)

## 11. Escalabilidade futura

1. Crescimento de volume:
   - adicionar indices por `fazenda_id`, `occurred_at`, `tipo`, `status_pagamento`.
2. Integracao ERP:
   - contratos de exportacao versionados (CSV/JSON/API), com IDs externos.
3. Compliance e auditoria:
   - trilha de aprovacao, usuario responsavel e referencias fiscais.
4. Offline:
   - suporte a batches grandes de lancamentos e tratamento detalhado de rejeicoes.
5. Orgaos reguladores:
   - campos padronizados para documentos e rastreabilidade de transacoes ligadas ao rebanho.

## 12. Recomendacoes tecnicas finais

1. Schema:
   - reforcar integridade (`valor_total > 0`, FK de contraparte).
2. Frontend:
   - criar fluxo de lancamento financeiro e consulta consolidada.
3. Backend:
   - manter append-only e validar regras de negocio por tipo.
4. Governanca:
   - incluir aprovacao por faixa de valor e politica de segregacao de funcoes.

