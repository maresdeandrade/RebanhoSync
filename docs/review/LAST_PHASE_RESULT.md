# Last Phase Result — RebanhoSync

Atualizado em: 2026-06-05
**Baseline Commit documental anterior:** `82b68b2`
**Commit local observado no início da 10F:** `0f2fd8e`

## 0. Resultado mais recente

Fase 11F — Fechamento documental da Fase 11 — executada.

Resultado da 11F:

- diagnóstico inicial executado antes do patch documental;
- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado — concluída localmente;
- 11A, 11B, 11C, 11D e 11E preservadas como concluídas;
- fonte explícita, período e limitação consolidados em leituras de lote/pasto/desempenho;
- `state_*` preservado como estado atual/read model;
- eventos preservados como histórico/fato executado;
- `state_pasto_ocupacoes` preservado como read model parcial de ocupação atual;
- GMD preservado como dependente de pesagens explícitas válidas;
- GMD agregado de lote/pasto permanece parcial sem permanência comprovada no período;
- UA/ha preservada como dependente de `area_ha` válida e peso explícito;
- relatórios operacionais ampliados preservam fonte, período e limitação;
- custo operacional parcial preservado sem DRE, ROI, margem ou custo por arroba;
- nenhum código funcional, schema, Supabase, RLS, migration, RPC, sync ou edge function foi alterado;
- nenhum avanço para venda, abate, aptidão comercial, carência liberatória, motor de decisão ou recomendação crítica.

Validação local da 11F:

```txt
git status --short --untracked-files=all: passou; worktree limpo antes do patch.
git status -sb: main...origin/main [ahead 4].
git log --oneline -5: HEAD bb2482e e commits 11A-11E confirmados.
git rev-parse --short HEAD: bb2482e.
git diff --check: passou antes do patch.
git diff --check: passou após patch documental.
git diff -- docs/review docs/context: executado para revisão do patch documental.
```

Próxima fase sugerida: Fase 12 — Compra/Venda Operacional: Hardening e Lacunas, preparada mas não iniciada.

---

Fase 11E — Relatórios operacionais ampliados — concluída localmente.

Resultado da 11E:

- diagnóstico inicial executado antes do patch;
- patch pequeno/read-only aplicado em `src/lib/reports/operationalSummary.ts`;
- tela de relatórios ajustada em `src/pages/Relatorios.tsx`;
- testes focados atualizados em `src/lib/reports/__tests__/operationalSummary.test.ts` e `src/pages/__tests__/Relatorios.e2e.test.tsx`;
- relatórios passaram a declarar fontes e limitações em tela, CSV e impressão;
- `state_*` segue comunicado como estado atual/read model, sem histórico completo;
- agenda segue comunicada como pendência/intenção futura, não fato executado;
- pesagens são apresentadas como peso médio/última pesagem no período, sem afirmar GMD ou desempenho de lote/pasto sem permanência comprovada;
- custo operacional parcial segue limitado, sem DRE, ROI, margem ou custo por arroba;
- nenhum schema, Supabase, RLS, migration, RPC, sync ou edge function foi alterado;
- nenhum avanço para venda, abate, aptidão comercial, carência liberatória, motor de decisão ou recomendação crítica.

Validação local da 11E:

```txt
pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts: passou (1 arquivo, 8 testes).
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou (1 arquivo, 1 teste).
git diff --check: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
```

Próximo foco indicado na 11E: Fase 11F — Fechamento, agora executada.

---

Fase 11D — Desempenho read-only se houver fonte suficiente — concluída localmente.

Resultado da 11D:

- diagnóstico inicial executado antes do patch;
- patch pequeno/read-only aplicado em `src/features/occupancy/cockpitManejoAdapter.ts`;
- testes focados atualizados em `src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts`;
- GMD de lote/pasto continua exigindo pesagens explícitas válidas e período em dias distintos;
- GMD agregado de lote/pasto permanece parcial quando a permanência no período não estiver comprovada, mesmo se todos os animais atuais tiverem GMD individual;
- limitações seguem declarando que a leitura usa animais atuais e não comprova desempenho histórico completo nem permanência no período;
- nenhum schema, Supabase, RLS, migration, RPC, sync ou edge function foi alterado;
- nenhum avanço para venda, abate, custo por arroba, DRE, ROI, margem, motor de decisão ou recomendação crítica.

Validação local da 11D:

```txt
pnpm test -- src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts: passou (1 arquivo, 23 testes).
git diff --check: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
```

Próximo foco indicado na 11D: Fase 11E — Relatórios operacionais ampliados, agora concluída localmente.

---

Fase 11C — Ocupação, lotação e movimentações — concluída localmente.

Resultado da 11C:

- diagnóstico inicial executado antes do patch;
- patch pequeno/read-only aplicado em `src/features/occupancy/cockpitManejoAdapter.ts`;
- testes focados atualizados em `src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts`;
- movimentações apenas de entrada passaram a retornar leitura atual parcial, sem afirmar permanência histórica completa;
- limitações de permanência por eventos agora declaram que histórico completo exige eventos completos de entrada e saída;
- UA total do lote passou a explicitar dependência de peso explícito dos animais atuais;
- nenhum schema, Supabase, RLS, migration, RPC, sync ou edge function foi alterado;
- nenhum avanço para venda, abate, custo por arroba, DRE, ROI, margem, motor de decisão ou recomendação crítica.

Validação local da 11C:

```txt
pnpm test -- src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts: passou (1 arquivo, 22 testes).
git diff --check: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
```

Próximo foco indicado na 11C: Fase 11D — Desempenho read-only se houver fonte suficiente, agora concluída localmente.

---

Fase 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos — concluída localmente.

Resultado da 11B:

- patch pequeno/read-only aplicado em `src/features/occupancy/cockpitManejoAdapter.ts`;
- testes focados atualizados em `src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts`;
- `LoteDetalhe` e `PastoDetalhe` tocados apenas para labels de permanência montados fora do adapter;
- GMD passou a ser comunicado como leitura baseada nos animais atuais com pesagens válidas, sem comprovar desempenho histórico completo do lote/pasto;
- `state_pasto_ocupacoes` passou a ser tratado como read model parcial de ocupação atual, não histórico completo;
- permanência por movimentações passou a declarar limitação histórica;
- taxa UA/ha passou a explicitar dependência de `area_ha` válida e peso explícito;
- nenhum schema, Supabase, RLS, migration, RPC, sync ou edge function foi alterado;
- nenhum avanço para venda, abate, custo por arroba, DRE, ROI, margem, motor de decisão ou recomendação crítica.

Validação local da 11B:

```txt
pnpm test -- src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts: passou (1 arquivo, 21 testes).
git diff --check: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
```

Próximo foco indicado na 11B: Fase 11C — Ocupação, lotação e movimentações, agora concluída localmente.

---

Fase 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado — concluída documentalmente.

Resultado da 11A:

- diagnóstico técnico/documental executado sem patch funcional;
- commit local analisado: `0d350b8`;
- baseline documental encontrado nos docs ativos: `0f2fd8e`;
- contexto anterior citava `8a62445`;
- worktree limpo no diagnóstico;
- `git diff --check` passou;
- documentos ativos lidos: `docs/review/CURRENT_PHASE_HANDOFF.md`, `docs/review/ACTIVE_PHASE_PLAN.md`, `docs/review/LAST_PHASE_RESULT.md`, `docs/review/OPEN_REVIEW_ITEMS.md`, `docs/context/PROJECT_STATUS.md`, `docs/product/ROADMAP.md`, `AGENTS.md`, `.agents/rules/CORE_RULES.md`, `.agents/rules/CONTEXT_LOADING.md`, `.agents/rules/no-broad-context.md`, `.agents/rules/rtk.md` e `docs/domain/LOTES_PASTOS.md`;
- plano específico criado em `docs/review/PLANO_FASE_11.md`;
- fontes reais confirmadas:
  - estado atual: `state_lotes`, `state_pastos`, `state_animais`;
  - ocupação/read model: `state_pasto_ocupacoes`;
  - histórico: `event_eventos` + `event_eventos_movimentacao`;
  - peso/GMD: `event_eventos_pesagem` com `event_eventos.occurred_at`;
  - lotação UA/ha: pesos + `state_pastos.area_ha`;
- lacunas confirmadas:
  - `state_pasto_ocupacoes` não deve ser tratado como fonte histórica primária completa;
  - GMD por lote/pasto não comprova permanência no lote/pasto sem movimentações suficientes no período;
  - ocupação histórica depende de eventos consistentes de entrada/saída;
  - lotação UA/ha depende de peso explícito e `area_ha` válida;
- riscos de inferência indevida registrados;
- 11B foi preparada como próximo patch pequeno, read-only, e depois concluída localmente.

Restrições preservadas na 11A:

- nenhum código funcional foi alterado;
- nenhuma alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions;
- nenhum avanço para custo por arroba, DRE, ROI, margem, motor de decisão, venda/abate automático, carência liberatória ou recomendação crítica.

Validação local da 11A:

```txt
git status --short --untracked-files=all: passou; worktree limpo.
git status -sb: main...origin/main.
git log --oneline -1: 0d350b8 docs: update continuity prompt and tool configurations.
git rev-parse --short HEAD: 0d350b8.
git diff --check: passou.
```

Como a 11A é documental, não foi rodada suite completa.

Próximo foco indicado na 11A: Fase 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos, agora concluída localmente.

---

Fase 10A — Diagnóstico UX e mapa de fricção — concluída sem patch.

Fase 10B — Agenda/Registrar: clareza de intenção futura vs execução real — concluída localmente.

Fase 10C — Home/Central Operacional — concluída localmente.

Fase 10D — Animal, Eventos e Histórico — concluída localmente.

Fase 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda — concluída localmente.

Fase 10F — Fechamento da Fase 10 e handoff — executada.

Fase 10 — UX Operacional dos Fluxos Centrais — concluída localmente.

Fechamento da 10F:

- 10A preservada como concluída;
- 10B preservada como concluída localmente;
- 10C preservada como concluída localmente;
- 10D preservada como concluída localmente;
- 10E preservada como concluída localmente;
- ausência de P0/P1 aberta em `docs/review/OPEN_REVIEW_ITEMS.md` confirmada;
- riscos residuais P2 preservados;
- Fase 11 definida como próxima fase.

Validação local da 10F:

```txt
git status --short --untracked-files=all: passou antes do patch; worktree limpo.
git diff --check: passou antes do patch.
git rev-parse --short HEAD: 0f2fd8e.
```

Como a 10F é documental, não foi rodada suite completa.

Próxima fase: Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado.

---

Patch aplicado na 10E:

- `Lotes` e `Pastos` passaram a reforçar estado atual/read model e histórico de movimentos executados;
- `LoteDetalhe` e `PastoDetalhe` passaram a explicitar que timeline, movimentações, rondas e operações são fatos históricos executados;
- operações comerciais do lote passaram a aparecer como registros manuais informados pelo usuário, sem recomendação ou aptidão comercial;
- `Relatorios` passou a reforçar leitura derivada/parcial de eventos, `state_*` e agenda;
- saldo financeiro operacional e custo parcial foram limitados como leitura parcial, não DRE, ROI, margem ou custo por arroba;
- `RegistrarComercialSection` passou a exibir `Compra manual` e `Venda manual`, sem validar aptidão comercial;
- testes focados de LoteDetalhe, PastosP2, Relatorios e RegistrarComercialSection foram atualizados.

Restrições preservadas na 10E:

- histórico operacional continua sendo eixo de rastreabilidade, não recomendação;
- Lotes/Pastos continuam separando estado atual de fato histórico;
- Relatórios continuam leitura derivada/parcial;
- Compra/Venda continua registro manual informado pelo usuário;
- nenhuma regra crítica nova foi criada;
- nenhum cálculo de relatório, insight, classificação ou evento foi alterado;
- nenhuma alteração em Supabase, RLS, migrations, RPC, edge functions, schema ou sync.

Validação local da 10E:

```txt
pnpm test -- src/pages/__tests__/LoteDetalhe.test.tsx: passou (1 arquivo, 1 teste; warnings conhecidos de React Router future flags)
pnpm test -- src/pages/__tests__/PastosP2.test.tsx: passou (1 arquivo, 11 testes; warnings conhecidos de React Router future flags)
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou (1 arquivo, 1 teste)
pnpm test -- src/pages/Registrar/__tests__/RegistrarComercialSection.test.tsx: passou (1 arquivo, 1 teste)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes
```

Próximo foco sugerido na 10E era Fase 10F — executada nesta etapa.

---

Patch aplicado na 10D:

- `AnimalDetalhe` passou a explicitar `Estado atual` no topo da ficha;
- hint no topo do animal reforça que estado, status e classificação são leitura operacional e não autorizam venda ou abate;
- CTA comercial do animal passou de `Registrar venda` para `Registrar venda manual`;
- `Eventos` passou a apresentar `Historico de eventos executados`;
- CTA de Eventos passou para `Novo registro manual`;
- copy de Eventos reforça que a tela lista fatos já registrados e que novo registro abre fluxo manual, sem transformar agenda em histórico;
- quick action de Registrar passou de `Venda` para `Venda manual`, com helper deixando claro que registra operação informada pelo usuário e não valida aptidão comercial;
- testes focados de AnimalDetalhe, Eventos e quick action de Registrar foram atualizados.

Restrições preservadas na 10D:

- animal continua sendo entidade/estado atual;
- eventos continuam sendo fatos históricos executados;
- venda/saída continua sendo registro manual informado pelo usuário;
- classificação/status continuam leitura operacional, sem aptidão para venda/abate;
- nenhuma regra crítica nova foi criada;
- nenhum cálculo de classificação, evento ou relatório foi alterado;
- nenhuma alteração em Supabase, RLS, migrations, RPC, edge functions, schema ou sync.

Validação local da 10D:

```txt
pnpm test -- src/pages/__tests__/AnimalDetalhe.test.tsx: passou (1 arquivo, 9 testes)
pnpm test -- src/pages/__tests__/Eventos.test.tsx: passou (1 arquivo, 3 testes; warnings conhecidos de React Router future flags)
pnpm test -- src/pages/Registrar/__tests__/quickActionPolicy.helper.test.ts: passou (1 arquivo, 5 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes
```

Próximo foco sugerido na 10D era Fase 10E — concluída localmente nesta etapa.

---

Patch aplicado na 10C:

- CTA principal da Home passou para `Registrar execucao`;
- introdução da Home reforça pendência de agenda, execução real no Registrar, histórico/estado atual/sinais como leitura;
- `Acoes rapidas` passou para `Atalhos de registro`, com copy explícita de que cria evento executado e não autoriza venda, abate ou carência;
- atalhos de Home passaram a usar labels `Registrar ...`;
- link regulatório/comercial deixou de sugerir revisão de venda/trânsito e passou a `Revisar registros comerciais`;
- painel da Central reforça estados `completo`, `parcial`, `vazio` e `bloqueado`;
- sinais auxiliares deixam explícito que não persistem tags nem autorizam ação operacional.

Patch aplicado na 10B:

- CTA global da Agenda passou de `Registrar` para `Registrar execução`;
- estado vazio da Agenda passou de `Registrar` para `Registrar execução`;
- CTA direto de item de agenda passou de `Concluir` para `Fechar pendência`;
- hints de item reforçam que Registrar grava execução e que fechar pendência apenas encerra a tarefa futura;
- teste focado de Agenda cobre o novo label de execução.

Restrições preservadas:

- Agenda continua sendo intenção/tarefa futura;
- Registrar continua sendo fluxo de execução real;
- Evento continua sendo fato histórico executado;
- nenhuma regra crítica nova foi criada;
- nenhum cálculo de insight/relatório foi alterado;
- nenhuma alteração em Supabase, RLS, migrations, RPC, edge functions, schema ou sync.

Validação local da 10C:

```txt
pnpm test -- src/pages/__tests__/Home.test.tsx: passou (1 arquivo, 7 testes)
pnpm test -- src/features/operationalInsights: passou (3 arquivos, 18 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/chunks
```

Próximo foco sugerido: Fase 10D — Animal, Eventos e Histórico.

---

## 1. Nome da fase

Fase 10 — UX Operacional dos Fluxos Centrais.

Subfase mais recente: 10F — Fechamento da Fase 10 e handoff.

---

## 2. Fonte de continuidade usada

- `docs/product/ROADMAP.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`
- `.agents/rules/CORE_RULES.md`
- `.agents/rules/CONTEXT_LOADING.md`

---

## 3. Resultado final da Fase 9

Fase 9 concluída localmente.

Consolidado:

- 9A — Inventário Operacional: concluída localmente.
- 9B — Relatórios Operacionais de Custo Parcial: concluída localmente.
- 9C — Sociedade Patrimonial e Classificação Operacional Read-only: concluída localmente.
- 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase: executada.

A 9D validou localmente que não há P0/P1 bloqueante aberto em `docs/review/OPEN_REVIEW_ITEMS.md`, que os riscos residuais estão documentados e que a próxima fase está explicitamente definida.

---

## 4. Entregas consolidadas

9A consolidou inventário operacional com unidade de compra/apresentação, unidade base e unidade de consumo/evento separadas, custo total/custo por entrada/custo unitário separados, snapshot econômico read-only e baixa nutricional idempotente.

9B consolidou `inventory.partialCost` como leitura derivada/read model em relatórios, separando custo conhecido de custo ausente e preservando `0` como custo válido.

9C consolidou sociedade patrimonial e classificação operacional como leitura/snapshot:

- sociedade patrimonial mapeada em tipos, Dexie, pull/tableMap, migrations/RLS e Registrar;
- isolamento por `fazenda_id` preservado;
- `classificationSnapshot` mantido com `source` e `limitations`;
- teste de contrato adicionado para impedir interpretação de classificação como autorização de venda, abate ou carência.

9D fechou o gate documental e definiu a próxima fase.

---

## 5. Validações executadas

Validações registradas nas subfases anteriores:

```txt
9A:
pnpm test -- testes focados de inventário/sync/sync-batch: passou
pnpm test: passou (260 arquivos, 1746 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos
supabase db reset: passou
node scripts/codex/validate-supabase-baseline-functional.mjs: passou
git diff --check: passou

9B:
git diff --check: passou
pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts: passou
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou
pnpm test: passou (260 arquivos, 1747 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/chunks

9C:
git diff --check: passou
pnpm test -- src/lib/animals/__tests__/classificationSnapshot.test.ts: passou
pnpm test -- src/pages/Registrar/__tests__/sociedadePecuaria.effect.test.ts: passou
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes
```

Validações executadas na 9D:

```txt
git status --short --untracked-files=all: passou antes do patch; worktree limpo.
git diff --check: passou antes do patch.
git rev-parse --short HEAD: 84383ab.
```

Como a 9D é documental, não foi rodada suite completa.

---

## 6. Riscos residuais aceitos

Pendências P2 permanecem abertas e não bloqueiam o fechamento local da Fase 9:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Avisos de Dialog/act em testes.

Não há pendência aberta conhecida para 9A, 9B ou 9C que impeça o fechamento do gate.

---

## 7. Restrições preservadas

Não houve avanço para:

- venda;
- abate;
- DRE;
- ROI;
- margem;
- custo por arroba;
- motor comercial avançado;
- autorização automática;
- carência liberatória;
- financeiro automático por sociedade;
- regra crítica baseada em classificação.

---

## 8. Próxima fase

Próxima fase definida: Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado.

A Fase 11 deve iniciar por diagnóstico, sem patch direto e sem regra crítica nova. GMD por período exige fonte explícita; movimentações e ocupação devem permanecer como eventos/read models; custo por arroba, DRE, ROI, margem, motor de decisão e venda/abate automático permanecem fora do escopo inicial.

---

## 9. Status final

```txt
Fase 9A: concluída localmente.
Fase 9B: concluída localmente.
Fase 9C: concluída localmente.
Fase 9D: executada.
Fase 9 completa: concluída localmente.
Fase 10A: concluída.
Fase 10B: concluída localmente.
Fase 10C: concluída localmente.
Fase 10D: concluída localmente.
Fase 10E: concluída localmente.
Fase 10F: executada.
Fase 10 completa: concluída localmente.
Próxima fase: Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado.
```
