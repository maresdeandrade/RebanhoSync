# PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO

Atualizado em: 2026-06-04  
**Status:** Fase 9 em andamento  
**Subfase atual:** 9C — Sociedade Patrimonial e Classificação Operacional Read-only — a iniciar  
**Commit Baseline:** `8cd5534`  
**Baseline anterior consolidado:** `3fe7a81`

---

## 1. Objetivo da Fase 9

Consolidar a base pós-MVP para leitura comercial, patrimonial, classificação operacional e custo, sem antecipar motor comercial avançado.

A Fase 9 deve garantir:

- inventário com unidade e custo coerentes;
- baixa de estoque idempotente;
- snapshot econômico preservado como derivado/read-only;
- relatório operacional parcial de custo;
- sociedade patrimonial mapeada com isolamento adequado;
- classificação operacional como leitura/snapshot, sem virar autorização crítica.

---

## 2. Estado consolidado anterior — Fases 1-8

**Fase 1-5:** Baseline MVP, animais, agenda, sanitário e SLC.  
**Fase 6:** Sanitário avançado, carência, protocolo e evento separados.  
**Gates 6:** Validação de contrato sanitário e separação de agenda/evento/estado.  
**Fase 7:** Compra/venda, sociedade e primeira visão comercial.  
**Fase 8:** Relatórios Fase 1-8, limpeza de warnings e baseline estável.

Compromissos já ativos:

- RLS por `fazenda_id`;
- offline-first com Dexie/IndexedDB + sync;
- Agenda/Eventos/`state_*` separados;
- carência sanitária não autoriza venda/abate por si só;
- produto/dose/lote rastreáveis;
- sync idempotente;
- snapshot/read model não é fonte primária.

---

## 2.1 Matriz de realidade por fase

Status real usa apenas: `CONCLUÍDA`, `PARCIAL`, `HARDENING_RESIDUAL`, `A_INICIAR`, `FUTURA`, `NÃO_CONFIRMADA`.

| Fase/tema | Estado documental | Evidência local | Status real | Lacunas | Conduta no roadmap |
|---|---|---|---|---|---|
| Fase 5 — Exceções/Reconciliação Sanitária | Consolidada em docs ativos; `docs/domain/SANITARIO.md` ainda tem trecho legado como planejamento. | `sanitaryCorrections.ts`, `sanitaryExceptions.ts`, testes e consumo em relatórios/eventos. | `CONCLUÍDA` | Hardening residual e contrato legado. | Não duplicar como fase futura. |
| Fase 6 — Robustez Sanitária em Staging | Consolidada como gate anterior, com pendências residuais não bloqueantes. | Handoff Fase 6, `sync-batch`, RLS, retry/rollback e validações registradas. | `HARDENING_RESIDUAL` | Ruídos de teste/build/DX. | Trilha residual contínua. |
| Fase 7 — Compra/Venda/Sociedade | Documentada como executada parcialmente. | `eventos_comercial`, `commercialOperation*`, `RegistrarComercialSection`, `sociedades_pecuarias`, `sociedade_animais` e testes. | `PARCIAL` | UX, sync, relatórios e hardening operacional. | Hardening/lacuna, não criação do zero. |
| Fase 8 — Relatórios/Baseline | Documentada como relatórios/baseline estável; ampliada pela 9B. | `operationalSummary.ts`, `Relatorios.tsx`, `Home.tsx`, `finance/gerencial.ts` e testes. | `PARCIAL` | KPIs ampliados com fonte/limitação. | Base para próximos KPIs. |
| Fase 9A — Inventário/Custo/Snapshot | Concluída localmente. | Handoff, `LAST_PHASE_RESULT`, validações globais e Supabase registradas. | `CONCLUÍDA` | Nenhuma pendência específica aberta. | Manter concluída. |
| Fase 9B — Custo parcial em relatórios | Concluída localmente. | `inventory.partialCost`, testes de relatório e validações registradas. | `CONCLUÍDA` | Nenhuma pendência específica aberta. | Manter concluída. |
| Fase 9C — Sociedade/Classificação read-only | Atual a iniciar. | `classificationSnapshot.ts`, testes, occupancy; sociedade em Dexie/migrations/UI, diagnóstico 9C pendente. | `A_INICIAR` | Mapear isolamento, consumo e risco de autorização. | Fase atual. |
| Financeiro/DRE/Margem | Ledger existe; DRE/ROI/margem conclusivos não. | `finance_transactions`, `finance_categories`, docs financeiros e testes comerciais bloqueando métricas indevidas. | `PARCIAL` | Método, período, rateio, fonte explícita e limitações. | Futuro explícito, sem antecipar DRE/ROI. |
| Lotes/Pastos/Desempenho | Base parcial no MVP. | `pastos`, `lotes`, occupancy, movimentação e relatórios. | `PARCIAL` | Desempenho ampliado/GMD por período. | Fase futura ou hardening. |
| KPIs operacionais | Relatórios existem; KPIs ampliados são planejados. | `operationalSummary`, `Relatorios`, `Home`, docs de KPI/limites. | `PARCIAL` | Fonte, período e limitação explícitos. | Fase futura read-only. |

---

## 3. Contratos obrigatórios da Fase 9

| Contrato | Status | Regra |
|---|---|---|
| Conversão de unidade | Consolidado na 9A | Unidade de compra/apresentação, unidade base e unidade de consumo/evento devem ser separadas. |
| Custo ausente != zero | Consolidado na 9A/9B | `0` explícito é válido; `null`/`undefined` é custo ausente. |
| Baixa idempotente | Consolidado na 9A | Retry/replay não pode duplicar baixa por evento/source. |
| Snapshot econômico | Consolidado na 9A/9B | Snapshot/read model é derivado, não fonte primária nem autorização. |
| Relatório parcial de custo | Consolidado na 9B | Mostrar custo conhecido e custo ausente separados. |
| Sociedade patrimonial | Pendente 9C | Mapear implementação real, isolamento e lacunas. |
| Classificação operacional | Pendente 9C | Deve permanecer leitura/snapshot, sem autorizar venda/abate/carência. |

---

## 4. Subfase 9A — Inventário Operacional

**Status:** concluída localmente.

### 4.1 Entregas consolidadas

- unidade de compra/apresentação separada da unidade base;
- unidade base separada da unidade de consumo/evento;
- custo total, custo por entrada e custo unitário/base separados;
- lote persistido com custo unitário/base;
- snapshot econômico preservado como derivado/read-only;
- baixa nutricional automática testada por `eventId`;
- retry/replay nutricional testado preservando `client_op_id`, `record.id` e `source_evento_id`;
- conflito remoto `23505` em `insumo_movimentacoes` tratado como `APPLIED`;
- índice único parcial remoto `ux_insumo_movimentacoes_consumo_nutricao_evento` criado para `consumo_nutricao`.

### 4.2 Checklist 9A

- [x] Unidade de compra/apresentação separada da unidade base.
- [x] Unidade base separada da unidade de consumo/evento.
- [x] Custo total separado de custo por entrada.
- [x] Custo unitário/base derivado de custo total ÷ quantidade base.
- [x] Lote persistido com custo unitário/base.
- [x] Snapshot econômico preservado como derivado/read-only.
- [x] Baixa nutricional automática testada por `eventId`.
- [x] Retry/replay nutricional testado.
- [x] Conflito remoto `23505` tratado como `APPLIED`.
- [x] Índice único parcial remoto para `consumo_nutricao`.
- [x] Sem avanço para venda, abate, DRE, ROI, margem, custo por arroba ou motor comercial avançado.

### 4.3 Validações registradas 9A

```txt
pnpm test -- testes focados de inventário/sync/sync-batch: passou
pnpm test: passou (260 arquivos, 1746 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos
supabase db reset: passou
node scripts/codex/validate-supabase-baseline-functional.mjs: passou
git diff --check: passou
```

---

## 5. Subfase 9B — Relatórios Operacionais de Custo Parcial

**Status:** concluída localmente.

### 5.1 Entregas consolidadas

- `inventory.partialCost` em `src/lib/reports/operationalSummary.ts`;
- cálculo fora da UI;
- apresentação em `src/pages/Relatorios.tsx`;
- leitura derivada/read model;
- custo operacional parcial conhecido;
- entradas com custo conhecido;
- saídas/consumos com custo conhecido;
- saldo econômico parcial conhecido por lote ativo;
- custo ausente separado;
- `0` tratado como custo válido;
- `null`/`undefined` tratados como custo ausente;
- ausência de inferência de custo quando snapshot está ausente.

### 5.2 Checklist 9B

- [x] Relatório mostra custo parcial operacional derivado de inventário.
- [x] Entradas com custo conhecido aparecem separadas.
- [x] Saídas/consumos com custo conhecido aparecem separadas.
- [x] Saldo econômico parcial conhecido aparece separado.
- [x] Movimentações/lotes com custo ausente aparecem separados.
- [x] `0` explícito permanece diferente de `null`/ausente.
- [x] Cálculo fica fora da UI.
- [x] UI apenas apresenta o read model.
- [x] Nenhuma regra comercial avançada foi criada.
- [x] Fase 9 inteira não foi marcada como concluída.

### 5.3 Validações registradas 9B

```txt
git diff --check: passou
pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts: passou
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou
pnpm test: passou (260 arquivos, 1747 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/chunks
```

---

## 6. Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only

**Status:** a iniciar.

### 6.1 Objetivo

Mapear o estado real de sociedade patrimonial e classificação operacional, com diagnóstico local antes de qualquer patch.

A 9C deve confirmar se já existe base suficiente para:

- sociedade/participação patrimonial;
- isolamento por `fazenda_id`;
- eventual regra de acesso por sócio, se existir;
- `classificationSnapshot`;
- leitura operacional de classificação;
- consumo de classificação em relatórios, insights ou telas.

A 9C não deve criar autorização operacional/comercial.

### 6.2 Escopo permitido

- Diagnóstico local de sociedade patrimonial existente.
- Diagnóstico local de isolamento por `fazenda_id`.
- Diagnóstico local de participação/sociedade, se implementada.
- Diagnóstico local de `classificationSnapshot`.
- Revisão de usos de classificação em relatórios, insights, telas e read models.
- Testes de contrato read-only, se houver lacuna objetiva.
- Pequena integração de leitura derivada, se o diagnóstico justificar.
- Documentação de contrato da 9C ou registro de lacuna real.

### 6.3 Escopo proibido

- Marcar a Fase 9 inteira como concluída.
- Criar autorização automática de venda, abate, comercialização ou decisão crítica.
- Transformar classificação operacional em regra crítica.
- Transformar snapshot/read model em fonte primária.
- Criar nova fonte de verdade paralela.
- Criar DRE, ROI, margem, custo por arroba ou motor comercial avançado.
- Alterar Supabase, migrations, RLS, RPC, edge functions ou seed sem diagnóstico objetivo e validação proporcional.

### 6.4 Diagnóstico obrigatório antes de patch

Antes de alterar qualquer arquivo, entregar:

1. status local da Fase 9 e confirmação de 9A/9B concluídas;
2. baseline/commit local atual;
3. documentos ativos lidos;
4. onde sociedade patrimonial aparece no modelo, se aparecer;
5. se há isolamento real por `fazenda_id`;
6. se existe participação/sociedade implementada;
7. onde `classificationSnapshot` é calculado;
8. onde `classificationSnapshot` é testado;
9. onde classificação operacional é consumida;
10. se classificação é apenas leitura/snapshot;
11. se há risco de virar autorização;
12. lacunas reais;
13. patch mínimo recomendado ou justificativa para não alterar;
14. validação proporcional conforme `.agents/rules/rtk.md`.

Formato recomendado:

```txt
achado → arquivo → evidência → risco → recomendação mínima
```

### 6.5 Áreas candidatas para leitura inicial

```txt
src/lib/animals/classificationSnapshot.ts
src/lib/animals/__tests__/classificationSnapshot.test.ts
src/features/occupancy/classification.ts
src/lib/reports/operationalSummary.ts
src/pages/Relatorios.tsx
src/lib/insights/herdStageSummary.ts
src/lib/insights/tagSignals.ts
supabase/migrations
docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md
```

#### 6.5.1 Áreas protegidas

```txt
supabase/migrations
supabase/functions
src/lib/sanitario
src/lib/eventos
```

Só tocar áreas protegidas se a tarefa trouxer evidência objetiva, escopo explícito e validação proporcional.

### 6.6 Checklist pendente 9C

#### Diagnóstico

- [ ] Confirmar `git status --short --untracked-files=all`.
- [ ] Confirmar `git diff --check`.
- [ ] Confirmar commit/baseline local.
- [ ] Ler documentos ativos.
- [ ] Mapear sociedade patrimonial no schema/migrations.
- [ ] Mapear sociedade patrimonial em tipos/stores/UI.
- [ ] Confirmar se sociedade existe como dado implementado ou apenas conceito/documentação.
- [ ] Confirmar isolamento por `fazenda_id`.
- [ ] Confirmar se há isolamento por sócio/participação além de `fazenda_id`.
- [ ] Mapear `classificationSnapshot`.
- [ ] Mapear testes de classificação.
- [ ] Mapear consumo de classificação em UI/relatórios/insights.
- [ ] Identificar risco de classificação virar autorização crítica.
- [ ] Registrar lacunas reais.
- [ ] Definir se haverá patch ou apenas documentação.

#### Patch, se houver evidência objetiva

- [ ] Manter classificação como read-only/snapshot.
- [ ] Não criar autorização automática.
- [ ] Não criar regra comercial avançada.
- [ ] Não alterar Supabase/migrations sem justificativa explícita.
- [ ] Não duplicar fonte de verdade.
- [ ] Adicionar testes proporcionais se alterar contrato.
- [ ] Atualizar documentação se houver delta funcional.

#### Validação

- [ ] `git diff --check`.
- [ ] `pnpm test` se houver patch funcional.
- [ ] `pnpm run lint` se houver patch funcional.
- [ ] `pnpm run build` se houver patch funcional.
- [ ] `node scripts/codex/validate-supabase-baseline-functional.mjs` se houver Supabase/RLS/RPC/migration/sync-batch.

### 6.7 Critério de aceite da 9C

A 9C só pode ser considerada avançada se:

- sociedade patrimonial estiver mapeada com evidência local;
- classificação operacional estiver mapeada com evidência local;
- fontes primárias e read models estiverem identificados;
- riscos de autorização indevida estiverem documentados;
- patch mínimo for proposto apenas com evidência objetiva;
- nenhuma decisão comercial crítica for criada;
- nenhuma regra de venda, abate, carência liberatória, ROI, DRE, margem ou custo por arroba for antecipada;
- validação proporcional for definida antes de edição.

---

## 7. Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase

**Status:** prevista

### 7.1 Objetivo

Fechar o Gate da Fase 9 em termos de planejamento, documentação e handoff para a próxima fase. A 9D deve consolidar o que foi aprendido em 9A/9B/9C e definir o nome e o foco da fase seguinte.

### 7.2 Escopo previsto

- validar que 9A e 9B estão concluídas localmente;
- validar diagnóstico de 9C antes de patch;
- documentar lacunas reais remanescentes;
- definir critério de aceitação do gate;
- preparar handoff para a fase seguinte;
- não marcar Fase 9 como concluída até o fechamento da 9D.

### 7.3 Observação

A próxima fase após 9D será nomeada no fechamento da 9D.

## 8. Sequência prevista pós-Fase 9

1. Fase 10 — UX Operacional dos Fluxos Centrais.
2. Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado.
3. Fase 12 — Compra/Venda Operacional: Hardening e Lacunas.
4. Fase 13 — Relatórios/KPIs Operacionais Read-only Ampliados.
5. Fase 14 — Financeiro Gerencial Explícito.
6. Fase 15 — Motor de Decisão Assistida.
7. Fase 16 — Beta Externo / SLC / Hardening de Produto.

A próxima fase após 9D será nomeada no fechamento da 9D. A sequência acima é referência preliminar corrigida pela matriz de realidade; não reabre Fases 5/6 e não trata compra/venda, sociedade ou relatórios como inexistentes.

## 8.1 Trilhas residuais contínuas

- Sanitário/reconciliação: apenas hardening residual das Fases 5/6, salvo bug objetivo.
- Build/testes/DX: higiene residual de warnings, logs e estabilidade de suite.
- Compliance regulatório: módulo futuro com fonte oficial e separação de alerta vs bloqueio.
- Reprodução ampliada: módulo futuro com contrato de domínio, eventos, agenda, estado atual e testes.

## 9. Pendências abertas da Fase 9

Pendências reais da Fase 9 neste momento:

| Prioridade | Item | Status | Conduta |
|---|---|---|---|
| P1 | Diagnóstico da sociedade patrimonial na 9C | Aberto | Executar antes de qualquer patch. |
| P1 | Diagnóstico da classificação operacional read-only na 9C | Aberto | Mapear `classificationSnapshot` e usos. |
| P1 | Confirmar se há lacuna de isolamento por sócio/participação | Aberto | Só propor migration/RLS se houver evidência objetiva. |
| P2 | Ruído residual em `stderr/stdout` de testes | Aberto | Tratar em gate próprio de higiene residual. |
| P2 | Warnings conhecidos de build | Aberto | Tratar em tarefa própria de build/performance. |
| P2 | Avisos de Dialog/act em testes | Aberto | Tratar em gate futuro de testes UI. |

Não há pendência aberta conhecida para:

- separação de custo por entrada vs custo unitário/base;
- idempotência local/remota da baixa nutricional;
- índice único parcial remoto de `consumo_nutricao`;
- snapshot econômico como derivado/read-only;
- leitura parcial de custo operacional da 9B.

---

## 10. Restrições permanentes da Fase 9

Não avançar sem tarefa explícita para:

- venda;
- abate;
- DRE;
- ROI;
- margem;
- custo por arroba;
- motor comercial avançado;
- aptidão automática para venda;
- aptidão automática para abate;
- carência liberatória;
- financeiro automático;
- autorização automática baseada em classificação.

Preservar:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico append-only.
state_* = read model / estado atual.
Protocolo = regra/configuração, não execução.
Snapshot = evidência histórica congelada/read model derivado.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
Tags/sinais/insights = auxiliares, nunca fonte primária.
```

---

## 11. Validação técnica geral

Antes de nova implementação:

```bash
git status --short --untracked-files=all
git diff --check
```

Se houver patch funcional:

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se houver Supabase, migrations, RLS, RPC, edge functions, sync-batch ou baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## 12. Resultado esperado ao fim da Fase 9

A Fase 9 só deve ser considerada concluída quando:

- 9A estiver consolidada e documentada;
- 9B estiver consolidada e documentada;
- 9C tiver mapeado sociedade patrimonial e classificação operacional;
- lacunas reais estiverem resolvidas ou registradas como pendência explícita;
- nenhuma autorização crítica indevida tiver sido criada;
- todos os contratos obrigatórios da Fase 9 estiverem documentados;
- validação proporcional tiver passado;
- Fase 9 inteira for fechada em documento próprio, sem confundir fechamento de subfase com fechamento de fase.
