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

Status: 11.5B1.1 concluída localmente / pronta para iniciar 11.5C.

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

Objetivo da 11.5C:

- transformar elegibilidades individuais em demanda operacional agrupada;
- agrupar por protocolo, janela, lote/categoria e status derivado;
- preservar demanda como leitura derivada, não agenda nem evento;
- não materializar agenda, criar evento, baixar estoque ou calcular carência ativa.

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

## 6. Checklist antes da 11.5C

Executar no início de nova rodada:

```bash
git status --short --untracked-files=all
git diff --check
```

Se uma etapa futura tocar sync/offline/Supabase/RLS/migration/schema:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
