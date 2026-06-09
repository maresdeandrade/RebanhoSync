# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-08

## 0. Handoff Atual — Fase 12D1

Fase 12D1 — Schema e contratos mínimos de Produto, Protocolo e Fonte Técnica v2 — executada em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:

- criada migration `supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql`;
- criadas estruturas v2 em paralelo para fonte técnica, cobertura por campo, produto sanitário, autorização por espécie, dose/via, carência, protocolo sanitário e item versionado;
- RLS habilitada, policies e grants mínimos criados;
- contratos TypeScript puros criados em `src/lib/sanitario/rules/*V2.ts`;
- validadores sentinela criados para fonte forte por campo, guideline isolado, produto, autorização por espécie, carência, protocolo, item versionado e snapshots;
- testes v2 criados em `src/lib/sanitario/rules/__tests__`;
- legados de produto/protocolo/catálogo foram auditados e mantidos por dependência ativa de UI/offline/sync, sem reset;
- legados foram marcados como não-canônicos por comentários SQL;
- Dexie, sync-batch, UI, seed, agenda automática, evento, estoque, carência ativa, venda, abate, aptidão, SISBOV, GTA, PNIB e rastreabilidade animal não foram alterados.

Próxima fase recomendada:

- 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2.

Escopo mínimo da próxima fase:

- montar snapshots técnicos a partir do contrato v2;
- manter builders puros;
- não criar evento por agenda;
- não iniciar offline/sync amplo antes da estabilização dos snapshots.

---

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

Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente — fechada localmente.

Status: 11.5H concluída como fechamento documental e handoff técnico; 11.5I concluída como reconciliação normativa; 11.5J executada como rebaseline estratégico documental.

Plano específico: `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`.

Motivo da fase extra:

- protocolos sanitários são frequentemente janelas operacionais, não datas exatas;
- antes do motor de elegibilidade, regra sanitária e produto precisam de contrato bibliográfico/legal/bula;
- a agenda sanitária antiga pode ser substituída;
- a separação `Protocolo -> Agenda -> Evento` foi consolidada em core puro antes da Fase 12;
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

11.5G — Semântica final de fechamento da agenda — concluída localmente em core puro.

Resultado da 11.5G:

- core puro criado em `src/lib/sanitario/agenda/sanitaryAgendaClosure.ts`;
- testes focados criados em `src/lib/sanitario/agenda/__tests__/sanitaryAgendaClosure.test.ts`;
- `createSanitaryAgendaClosureCommand` gera comando/intenção `agenda_closure_intent` para fechamento administrativo de agenda sanitária;
- fechamento cobre execução total com evento, execução parcial com evento, fechamento sem execução, cancelamento e dispensa;
- execução total/parcial exige `SanitaryEventExecutionCommand` com `source.agendaDedupKey` compatível com a agenda;
- fechamento sem execução, cancelamento e dispensa exigem motivo;
- execução parcial preserva animais planejados não executados com motivo;
- fechamento sem execução, cancelamento e dispensa rejeitam evento informado por engano;
- fechamento executado rejeita animal executado fora do escopo planejado da agenda;
- fechamento parcial rejeita caso todos os animais planejados tenham sido executados;
- `closedAt` é obrigatório e validado como data/data-hora real recebida por parâmetro;
- `dedupKey` é determinística, considera agenda, tipo, data/hora, evento e animais ordenados, sem depender de `productName` ou `loteName`;
- saída declara `createsEvent: false`, `persistsEvent: false`, `createsHistoricalFact: false`, `createsInventoryMovement: false` e `calculatesWithdrawal: false`;
- não houve persistência de agenda/evento, fechamento real no banco, baixa de estoque, carência ativa, autorização de venda/abate, Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch ou seed.

Validações executadas:

- `pnpm test -- src/lib/sanitario/agenda`;
- `pnpm test -- src/lib/sanitario`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`.

11.5H — Fechamento e handoff — concluída localmente como etapa documental.

Resultado da 11.5H:

- contratos 11.5A a 11.5G consolidados como Agenda Sanitária v2 em core puro/documental;
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` registrados como intenções/comandos ainda sem aplicação em Supabase, Dexie ou sync;
- Agenda preservada como intenção/tarefa futura;
- Evento preservado como fato histórico executado;
- fechamento administrativo de agenda preservado como estado da intenção, sem virar histórico sanitário;
- `completed` sanitário continua dependente de evento compatível;
- baixa de estoque continua dependente de evento real;
- carência continua dependente de produto executado e fonte técnica explícita;
- venda, abate e aptidão operacional seguem bloqueados sem fonte técnica explícita;
- persistência, sync, schema, RLS, UI, RPC, Edge Functions, Dexie e seed não foram implementados na 11.5H;
- Fase 12 não foi iniciada.

Riscos residuais documentados:

- contratos core ainda não estão conectados à persistência real;
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` ainda não são aplicados em Supabase/Dexie/sync;
- fluxo legado de agenda e `status='concluido'` precisam ser auditados antes de migration/constraint;
- integração offline-first exigirá idempotência real, replay, rollback e sucesso parcial;
- RLS/multi-tenant precisam ser validados antes de qualquer persistência remota;
- estoque e carência devem continuar derivados de evento real/produto executado, não de agenda.

Validações executadas na 11.5H:

- `git status --short --untracked-files=all`;
- `git status -sb`;
- `git log --oneline -5`;
- `git rev-parse --short HEAD`;
- `git diff --check`;
- `git diff --cached --check`;
- `pnpm test -- src/lib/sanitario`;
- `pnpm test`;
- `pnpm run lint`;
- `pnpm run build`;
- `git status --short --untracked-files=all`.

---

11.5J — Rebaseline Estratégico do Roadmap Técnico — executada documentalmente.

Resultado da 11.5J:

- roadmap técnico reordenado após a Agenda Sanitária v2;
- Fase 12 redefinida como Fundação Sanitária v2: Persistência, Sync, Schema e Rollout;
- Reprodução Operacional v1 definida como Fase 13;
- Compra/Venda Operacional movida para Fase 14;
- KPIs, Financeiro, Motor de Decisão Assistida e Beta externo movidos para Fases 15-18;
- trilhas residuais contínuas preservadas fora da sequência principal;
- Fase 12 não teve implementação funcional iniciada antes da 12A.

---

## 4. Fase 12

Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout — foi aberta em 12A como auditoria documental/diagnóstica, avançou em 12B para modelagem clean/reset documental, em 12C para fundação SQL/RLS/reset controlado e em 12D0 para modelo canônico de protocolo/produto/fonte técnica.

Subfases recentes:

- 12A — Auditoria do fluxo legado e decisão de schema da Agenda Sanitária v2.
- Plano/relatório 12A: `docs/review/PLANO_FASE_12A_AUDITORIA_FLUXO_LEGADO_SCHEMA_SANITARIO.md`.
- Decisão 12A: `PROSSEGUIR COM ESCOPO REDUZIDO`.
- Recomendação 12A: criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória.
- 12B — Modelagem clean da persistência sanitária v2 com liberdade de reset.
- Plano/relatório 12B: `docs/review/PLANO_FASE_12B_MODELAGEM_CLEAN_PERSISTENCIA_SANITARIA_V2.md`.
- Decisão 12B: `PROSSEGUIR COM ESCOPO REDUZIDO`.
- Recomendação 12B: criar persistência sanitária v2 clean em estruturas dedicadas, resetar agenda sanitária legada e não manter compatibilidade reversa por produto.
- 12C — Migration clean da Agenda Sanitária v2 e reset controlado do legado sanitário.
- Migration 12C: `supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql`.
- Decisão 12C: `PROSSEGUIR COM ESCOPO REDUZIDO`.
- Resultado 12C: fundação SQL/RLS criada; Dexie, sync-batch e UI não conectados.
- 12D0 — Modelo canônico de Protocolo Sanitário v2, Produto e Fonte Técnica.
- Plano/relatório 12D0: `docs/review/PLANO_FASE_12D_MODELO_CANONICO_PROTOCOLO_SANITARIO_V2.md`.
- Decisão 12D0: `PROSSEGUIR COM ESCOPO REDUZIDO`.
- Resultado 12D0: contrato documental criado para fonte técnica, produto sanitário, regra de carência, protocolo versionado, item versionado, bovino/bubalino, status de autorização e snapshots técnicos; SQL, Dexie, sync-batch, UI e seed não foram alterados.

Fatos principais da 12A:

- worktree limpo;
- 11.5J commitada;
- diagnóstico local executado;
- fluxo legado SQL/RPC/Dexie/UI auditado;
- `status='concluido'` confirmado como ambíguo para sanitário v2;
- `source_evento_id` confirmado como vínculo factual quando há execução real;
- dados factuais (`eventos`, `eventos_sanitario`, `insumo_movimentacoes`) classificados como preservação obrigatória;
- testes sentinela futuros definidos para retry, replay, conflitos, RLS e dados legados.

Fatos principais da 12B:

- worktree limpo e 12A preservada em `HEAD dd441b0`;
- decisão clean/reset registrada documentalmente;
- `agenda_itens` sanitário classificado como legado descartável;
- `state_agenda_itens` sanitário, filas antigas incompatíveis, payload/dedup/status sanitário legado e seeds/demo sanitários obsoletos classificados como resetáveis;
- `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, protocolos usados como histórico e catálogos técnicos usados em eventos reais classificados como preservação obrigatória;
- modelo alvo definido com `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- execução real preservada exclusivamente em `eventos` + `eventos_sanitario`;
- baixa de estoque preservada como derivada apenas de evento real;
- carência preservada como futura leitura/snapshot a partir de produto executado e fonte técnica;
- nenhuma migration, RLS, Dexie, sync-batch, UI, seed ou regra funcional foi implementada.

Fatos principais da 12C:

- 12B preservada no histórico local em `HEAD 555662b` antes do patch;
- migration nova criada sem alterar `00000000000000_rebuild_base_schema_sanitario.sql`;
- enums v2 criados sem reutilizar `agenda_status_enum` e sem status `concluido`;
- criadas `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- FKs compostas com `fazenda_id` criadas para agenda/animais/eventos/protocolos/lotes;
- RLS habilitada e policies por membership criadas;
- reset aplicado apenas em `agenda_itens` com `dominio='sanitario'`, via soft-delete operacional;
- recompute sanitário legado passou a no-op com validação de membership;
- trigger bloqueia nova escrita sanitária legada em `agenda_itens`;
- `eventos`, `eventos_sanitario` e `insumo_movimentacoes` não foram apagados nem alterados;
- Dexie, sync-batch, UI e seed funcional não foram alterados.

Fatos principais da 12D0:

- guideline curatorial localizado como Markdown em `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`; o PDF citado no prompt não existe no workspace;
- guideline usado como fonte de casos reais e matriz de validação, não como seed final ou autorização crítica;
- modelo canônico definido para `SourceRef`, produto sanitário, regra de carência, protocolo sanitário, item versionado, elegibilidade, janela operacional e snapshots técnicos;
- campos críticos como dose, via, carência, espécie autorizada e obrigatoriedade legal exigem fonte forte por campo;
- bubalino não herda autorização de bovino por padrão;
- itens experimentais/alerta não entram em protocolo automático;
- próxima fase segura redefinida para 12D1 — contrato persistido/migration de produto, protocolo e fonte técnica, antes de offline/sync.

Sequência estratégica vigente:

1. Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout.
2. Fase 13 — Reprodução Operacional v1.
3. Fase 14 — Compra/Venda Operacional: Hardening e Lacunas.
4. Fase 15 — Relatórios/KPIs Operacionais Read-only Ampliados.
5. Fase 16 — Financeiro Gerencial Explícito.
6. Fase 17 — Motor de Decisão Assistida.
7. Fase 18 — Beta Externo / SLC / Hardening de Produto.

---

## 5. Escopo proibido nesta transição

Não fazer sem tarefa explícita:

- reabrir a Fase 11;
- avançar para implementação funcional da Fase 12C+ sem nova decisão explícita;
- alterar código funcional nesta preparação documental;
- criar migrations, schema, RLS, RPC, sync-batch, edge functions ou alterações Supabase fora da próxima subfase explicitamente autorizada;
- tratar agenda como histórico;
- tratar agenda concluída como evento;
- criar evento sem execução real;
- baixar estoque na materialização da agenda;
- criar venda, abate, aptidão comercial, carência liberatória, DRE, ROI, margem, custo por arroba ou motor de decisão.

---

## 6. Checklist para próxima subfase

Executar no início de nova rodada/12D1:

```bash
git status --short --untracked-files=all
git diff --check
```

Antes de qualquer implementação, confirmar que a 12C fechou com migration/RLS validada, reset legado aplicado, a 12D0 definiu o contrato canônico e o fluxo Dexie/sync/UI ainda está desconectado.

Se a próxima subfase tocar Supabase/RLS/migration/schema:

```bash
pnpm test -- src/lib/sanitario
pnpm test -- supabase/functions/sync-batch
pnpm test
pnpm run lint
pnpm run build
node scripts/codex/validate-supabase-baseline-functional.mjs
git diff --check
git diff --cached --check
git status --short --untracked-files=all
```

Não avançar para offline/sync da Agenda Sanitária v2 antes de estabilizar o contrato persistido de produto, protocolo, fonte técnica e snapshot.
