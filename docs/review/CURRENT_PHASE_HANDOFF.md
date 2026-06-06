# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-06

## 1. Última fase fechada

Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado — concluída localmente.

Resultado consolidado da Fase 11:

- leituras de lote/pasto/desempenho preservam fonte explícita, período e limitação;
- `state_*` permanece estado atual/read model;
- eventos permanecem histórico/fato executado;
- `state_pasto_ocupacoes` permanece read model parcial de ocupação atual;
- GMD depende de pesagens explícitas válidas;
- GMD agregado de lote/pasto permanece parcial sem permanência comprovada no período;
- UA/ha depende de `area_ha` válida e peso explícito;
- relatórios operacionais ampliados declaram fonte, período e limitação;
- custo operacional parcial não é DRE, ROI, margem ou custo por arroba;
- nenhum código funcional, Supabase, RLS, migration, RPC, schema, sync ou edge function foi alterado no fechamento documental da 11F.

Referência: `docs/review/PLANO_FASE_11.md`.

---

## 2. Fase atual

Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente.

Status: 11.5F concluída localmente / pronta para iniciar 11.5G.

Plano específico: `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`.

Motivo da fase extra:

- protocolos sanitários são frequentemente janelas operacionais, não datas exatas;
- antes do motor de elegibilidade, regra sanitária e produto precisam de contrato bibliográfico/legal/bula;
- a agenda sanitária antiga pode ser substituída;
- a separação `Protocolo -> Agenda -> Evento` precisa ser redesenhada antes da Fase 12;
- o app é offline-first, então RPC não deve ser caminho principal;
- materialização de agenda deve ser idempotente e não pode criar evento nem baixar estoque.

---

## 3. Últimas execuções da Fase 11.5

11.5A — Diagnóstico + contrato alvo + teste sentinela de retry/offline/sync — concluída localmente.

Resultado da 11.5A:

- diagnosticar o contrato atual `Protocolo -> Agenda -> Evento`;
- mapear tabelas, stores, tipos, hooks, telas e testes afetados;
- definir contrato alvo da Agenda Sanitária v2;
- registrar decisão sobre substituição/descarte da agenda sanitária antiga;
- definir critérios de idempotência;
- reforçar teste sentinela de retry/offline/sync em `supabase/functions/sync-batch/rules.test.ts`;
- não implementar UI, motor de elegibilidade, preview, materialização, migration, schema ou RPC nesta subfase.

11.5B0 — Contrato bibliográfico de regra sanitária e produto — concluída localmente.

Resultado da 11.5B0:

- contratos puros criados em `src/lib/sanitario/rules/sanitaryProtocolRule.ts`;
- contratos cobrem `SourceRef`, `SanitaryProduct`, `WithdrawalRule`, `SanitaryProtocolRule` e `WithdrawalSnapshotOnEvent`;
- validações puras cobrem fonte explícita em regra crítica, guideline isolado, carência do produto, exigência de produto e conclusão por evento executado;
- testes focados criados em `src/lib/sanitario/rules/__tests__/sanitaryProtocolRule.test.ts`;
- não houve motor de elegibilidade, demanda, preview, materialização, evento, cálculo runtime de carência, UI, migration, schema, RLS, sync-batch, seed, RPC, persistência, Supabase ou Dexie.

Próxima execução:

- 11.5C — Demanda sanitária agrupada.

11.5B1 — Motor puro de elegibilidade sanitária por janela — concluída localmente.

Resultado da 11.5B1:

- motor puro criado em `src/lib/sanitario/eligibility/sanitaryEligibility.ts`;
- testes focados criados em `src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts`;
- `computeSanitaryEligibility` consome animal, `SanitaryProtocolRule`, eventos executados, `referenceDate` e thresholds;
- status cobrem `not_applicable`, `insufficient_data`, `not_yet_eligible`, `eligible_soon`, `in_action_window`, `near_deadline`, `overdue` e `completed`;
- `completed` depende apenas de evento sanitário compatível, executado, não cancelado/deletado, do mesmo animal e não futuro;
- ausência de dados críticos retorna limitações explícitas em vez de inferir histórico;
- agenda, Supabase, Dexie, React, UI, storage, RPC, `Date.now()` e persistência não foram usados.

11.5B1.1 — Hardening de elegibilidade por dose múltipla e âncora por evento — concluída localmente.

Resultado da 11.5B1.1:

- `requiredDoseCount > 1` não retorna `completed` por contagem genérica de eventos compatíveis;
- enquanto não houver validação explícita de sequência de doses, o motor retorna `unsupported_required_dose_count`;
- janela com âncora `"evento"` exige `anchorEventCriteria` efetivo;
- `anchorEventCriteria: {}` é tratado como critério ausente e retorna `missing_anchor_event_criteria`;
- inputs seguem imutáveis nos testes.

Validações executadas:

- `pnpm test -- src/lib/sanitario/eligibility`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`.

11.5C — Demanda sanitária agrupada — concluída localmente.

Resultado da 11.5C:

- core puro criado em `src/lib/sanitario/demand/sanitaryDemand.ts`;
- testes focados criados em `src/lib/sanitario/demand/__tests__/sanitaryDemand.test.ts`;
- `createSanitaryDemandGroupsFromEligibilityResults` agrupa elegibilidades já calculadas;
- `computeSanitaryDemandGroups` chama `computeSanitaryEligibility` sem IO e com `referenceDate` recebido por parâmetro;
- agrupamento considera protocolo, item/produto/classe, ação, lote, janela e status derivado;
- nomes de produto e lote ficam como exibição, não como identidade primária do grupo;
- `insufficient_data` é preservado como pendência de cadastro;
- `not_applicable` é contado, mas não entra em `actionableAnimalIds`;
- limitações agregadas são deduplicadas e a saída é determinística;
- demanda permanece leitura derivada, com `materialization: "none"`;
- não houve agenda, evento, baixa de estoque, carência ativa, autorização de venda/abate, Supabase, Dexie, React, UI, storage, RPC, `Date.now()`, migration, schema, RLS, sync-batch ou seed.

Validações executadas:

- `pnpm test -- src/lib/sanitario/demand`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`.

Próxima execução:

- 11.5D — Preview operacional editável.

11.5D — Preview operacional editável — concluída localmente.

Resultado da 11.5D:

- core puro criado em `src/lib/sanitario/preview/sanitaryOperationalPreview.ts`;
- testes focados criados em `src/lib/sanitario/preview/__tests__/sanitaryOperationalPreview.test.ts`;
- `createSanitaryOperationalPreview` consome `SanitaryDemandGroup[]` já recebido por parâmetro;
- preview gera grupos operacionais apenas para demandas acionáveis;
- `insufficient_data` é preservado como bloqueio/cadastro pendente com identidade operacional;
- `not_applicable` não entra como item operacional;
- `previewGroupId` e `sourceDemandKey` preservam protocolo, item, produto, classe, ação, lote e janela;
- data sugerida fica dentro da janela quando possível;
- campos editáveis são declarados sem persistir nada;
- saída é determinística e não muta inputs;
- preview permanece simulação derivada, com `materialization: "none"`;
- não houve agenda, evento, baixa de estoque, carência ativa, autorização de venda/abate, Supabase, Dexie, React, UI, storage, RPC, `Date.now()`, migration, schema, RLS, sync-batch ou seed.

Validações executadas:

- `pnpm test -- src/lib/sanitario/preview`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`.

Próxima execução:

- 11.5E — Materialização idempotente da agenda sanitária.

11.5E — Materialização idempotente da agenda sanitária — concluída localmente.

Resultado da 11.5E:

- core puro criado em `src/lib/sanitario/agenda/sanitaryAgendaMaterialization.ts`;
- testes focados criados em `src/lib/sanitario/agenda/__tests__/sanitaryAgendaMaterialization.test.ts`;
- `createSanitaryAgendaMaterializationCommands` consome `SanitaryOperationalPreview` ou `SanitaryPreviewGroup[]` já recebidos por parâmetro;
- materialização gera comandos `agenda_intent`, não `agenda_itens` persistido;
- `dedupKey` é determinística e considera protocolo, item, produto, classe, ação, lote, data, janela e animais ordenados;
- `dedupKey` não depende de `productName` ou `loteName`;
- overrides editáveis permitem data de execução, responsável e observação;
- grupos sem animais, sem data, com data inválida ou data fora da janela são rejeitados explicitamente;
- vínculo com `previewGroupId` e `sourceDemandKey` é preservado;
- saída é determinística e não muta inputs;
- resultado declara criação de intenção de agenda, com `createsEvent: false` e `createsInventoryMovement: false`;
- não houve persistência, agenda remota/local, evento, baixa de estoque, carência ativa, autorização de venda/abate, Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch ou seed.

Validações executadas:

- `pnpm test -- src/lib/sanitario/agenda`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`;
- `git diff --cached --check`.

Próxima execução:

- 11.5F — Execução sanitária como evento.

11.5F — Execução sanitária como evento — concluída localmente em escopo reduzido.

Resultado da 11.5F:

- core puro criado em `src/lib/sanitario/execution/sanitaryEventExecution.ts`;
- testes focados criados em `src/lib/sanitario/execution/__tests__/sanitaryEventExecution.test.ts`;
- `createSanitaryEventExecutionCommand` gera comando/intenção `event_execution_intent` para execução sanitária como fato histórico futuro;
- contrato aceita execução vinculada a comando de agenda materializada ou execução sanitária manual com protocolo explícito;
- `occurredAt` é obrigatório e validado como data/data-hora real;
- animais executados são normalizados, deduplicados e ordenados;
- execução parcial exige motivo para cada animal planejado não executado;
- execução vinculada rejeita animal fora do escopo planejado;
- `dedupKey` é determinística, considera `productId`/`productClass` e não depende de `productName` ou `loteName`;
- vínculo com `agendaDedupKey`, `previewGroupId` e `sourceDemandKey` é preservado quando existe agenda de origem;
- saída declara `createsEvent: true`, mas `persistsEvent: false`, `createsAgenda: false`, `closesAgenda: false` e `createsInventoryMovement: false`;
- não houve persistência de evento, fechamento de agenda, baixa de estoque, carência ativa, autorização de venda/abate, Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch ou seed.

Validações executadas:

- `pnpm test -- src/lib/sanitario/execution`;
- `pnpm test -- src/lib/sanitario`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`.

Próxima execução:

- 11.5G — Semântica final de fechamento da agenda.

---

## 4. Fase 12

Fase 12 — Compra/Venda Operacional: Hardening e Lacunas — permanece bloqueada.

Não iniciar Fase 12 até fechamento formal da Fase 11.5.

---

## 5. Escopo proibido nesta transição

Não fazer sem tarefa explícita:

- reabrir a Fase 11;
- iniciar Fase 12;
- alterar código funcional nesta preparação documental;
- criar migrations, schema, RLS, RPC, sync-batch, edge functions ou alterações Supabase nesta preparação;
- tratar agenda como histórico;
- tratar agenda concluída como evento;
- criar evento sem execução real;
- baixar estoque na materialização da agenda;
- criar venda, abate, aptidão comercial, carência liberatória, DRE, ROI, margem, custo por arroba ou motor de decisão.

---

## 6. Checklist antes da 11.5G

Executar no início de nova rodada:

```bash
git status --short --untracked-files=all
git diff --check
```

Se uma etapa futura tocar sync/offline/Supabase/RLS/migration/schema:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
