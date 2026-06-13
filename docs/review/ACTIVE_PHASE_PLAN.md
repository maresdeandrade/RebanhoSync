# ACTIVE_PHASE_PLAN - Fase 12E4

**Status:** Fase 12E4 concluida localmente - Agenda Sanitaria v2 com Dexie, pull por fazenda e push controlado de closures.
**Foco:** Base offline/sync operacional para `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`.
**Criado:** 2026-06-13
**Atualizado:** 2026-06-13
**Plano base:** 12E4 - Agenda Sanitaria v2 offline/sync em escopo controlado

---

## Objetivo em 1 paragrafo

Executar a Fase 12E4 criando stores Dexie `ops_*` para Agenda Sanitaria v2, adicionando pull remoto por `fazenda_id` na ordem agenda -> animais -> closures e habilitando push controlado somente para closures operacionais com `client_op_id`/idempotencia e conflito rastreavel. A fase nao executa evento sanitario, nao baixa estoque, nao calcula carencia ativa, nao libera venda, abate, leite ou aptidao operacional, nao estrutura protocolos reais, nao altera UI, nao cria seed e nao cria migration.

---

## Decisao 12E4

Decisao: `PROSSEGUIR COM ESCOPO CONTROLADO`.

Implementado nesta fase:
- stores Dexie v25 para `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2` e `ops_sanitario_agenda_closures_v2`;
- tipos locais minimos espelhando os campos reais da migration da Agenda Sanitaria v2;
- `tableMap` remoto -> local para as 3 estruturas `ops_*`;
- pull especifico `pullSanitarioAgendaV2(fazenda_id)`;
- pull tenant por `fazenda_id`, sem pull global;
- ordem de pull `sanitario_agenda_v2` -> `sanitario_agenda_animais_v2` -> `sanitario_agenda_closures_v2`;
- aplicacao local em modo merge, preservando `updated_at`, `deleted_at`, metadata e vinculos `agenda_id`/`animal_id`;
- bloqueio local de push para `catalog_*`, `sanitario_agenda_v2` e `sanitario_agenda_animais_v2`;
- push controlado de `sanitario_agenda_closures_v2`;
- push de closure bloqueia `executed_with_event`, `partially_executed_with_event` e qualquer `execution_evento_id` preenchido;
- reconciliacao pos-sync com `pullSanitarioAgendaV2`;
- sucesso parcial especifico para gestures compostas apenas por closures: aceitas saem de `queue_ops`, rejeitadas permanecem rastreaveis;
- conflito de closure ativa duplicada mapeado para `sanitario_agenda_closure_already_exists`.

Nao implementado nesta fase:
- push de catalogos `catalog_*`;
- push de `state_*`;
- push de agenda/animais v2;
- evento sanitario executado;
- snapshot tecnico de evento;
- baixa de estoque;
- carencia ativa;
- liberacao de venda, abate, leite ou aptidao operacional;
- protocolo estruturado real;
- UI, migration ou seed.

---

## Evidencia tecnica

Arquivos gerados/alterados:
- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/__tests__/sanitarioAgendaV2Store.test.ts`
- `src/lib/offline/__tests__/sanitarioAgendaV2Pull.test.ts`
- `src/lib/offline/__tests__/sanitarioAgendaV2Sync.test.ts`
- `supabase/functions/sync-batch/index.ts`
- `supabase/functions/sync-batch/rules.ts`
- `supabase/functions/sync-batch/rules.test.ts`
- docs ativos de fase/status/roadmap/dominio

---

## Criterios de aceitacao da fase

- [x] Stores Dexie da Agenda Sanitaria v2 criadas.
- [x] Pull remoto Agenda v2 implementado por fazenda.
- [x] Pull respeita ordem agenda -> animais -> closures.
- [x] `deleted_at` e `updated_at` preservados quando existem no contrato remoto.
- [x] Push controlado implementado somente para closures.
- [x] Push de closure restrito a fechamento administrativo sem `execution_evento_id`.
- [x] Idempotencia por `client_op_id` preservada no push de closure.
- [x] Conflito de closure duplicada tratado como rejeicao controlada.
- [x] Sucesso parcial tratado para gestures de closures.
- [x] Nenhum push de `catalog_*` implementado.
- [x] Nenhum push novo de `state_*` implementado.
- [x] ProductClass e catalogo tecnico sanitario v2 seguem pull-only.
- [x] Nenhuma UI alterada.
- [x] Nenhuma migration criada.
- [x] Nenhum seed criado.
- [x] Nenhum protocolo estruturado criado.
- [x] Nenhum evento sanitario executado criado.
- [x] Nenhuma baixa de estoque criada.
- [x] Nenhuma carencia ativa criada.
- [x] Nenhuma liberacao de venda, abate, leite ou aptidao criada.

## Proxima fase segura

`12E5 - Hardening offline/sync` ou `12F - Estruturacao curatorial dos protocolos`, conforme decisao de gate.
