# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-05

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

Status: 11.5A concluída localmente / pronta para iniciar 11.5B0.

Plano específico: `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`.

Motivo da fase extra:

- protocolos sanitários são frequentemente janelas operacionais, não datas exatas;
- antes do motor de elegibilidade, regra sanitária e produto precisam de contrato bibliográfico/legal/bula;
- a agenda sanitária antiga pode ser substituída;
- a separação `Protocolo -> Agenda -> Evento` precisa ser redesenhada antes da Fase 12;
- o app é offline-first, então RPC não deve ser caminho principal;
- materialização de agenda deve ser idempotente e não pode criar evento nem baixar estoque.

---

## 3. Última execução da Fase 11.5

11.5A — Diagnóstico + contrato alvo + teste sentinela de retry/offline/sync — concluída localmente.

Resultado da 11.5A:

- diagnosticar o contrato atual `Protocolo -> Agenda -> Evento`;
- mapear tabelas, stores, tipos, hooks, telas e testes afetados;
- definir contrato alvo da Agenda Sanitária v2;
- registrar decisão sobre substituição/descarte da agenda sanitária antiga;
- definir critérios de idempotência;
- reforçar teste sentinela de retry/offline/sync em `supabase/functions/sync-batch/rules.test.ts`;
- não implementar UI, motor de elegibilidade, preview, materialização, migration, schema ou RPC nesta subfase.

Próxima execução:

- 11.5B0 — Contrato bibliográfico de regra sanitária e produto.

Objetivo da 11.5B0:

- documentar fonte técnica por campo crítico de regra sanitária e produto;
- tratar guideline como apoio técnico, não fonte única de verdade;
- exigir validação por norma oficial, bula ou MV responsável quando a regra for crítica;
- manter carência vinculada primariamente ao produto;
- registrar que agenda, preview e demanda agrupada não geram carência;
- preparar a 11.5B1 sem implementar motor, UI, schema, migration, RLS, sync-batch ou seeds.

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

## 6. Checklist antes da 11.5B0

Executar no início de nova rodada:

```bash
git status --short --untracked-files=all
git diff --check
```

Se uma etapa futura tocar sync/offline/Supabase/RLS/migration/schema:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
