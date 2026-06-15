# ACTIVE_PHASE_PLAN - Fase 12F2

**Status:** Fase 12F2 concluida localmente - payloads candidatos para futura seed/importacao dos Protocolos Sanitarios v2.
**Foco:** Artefatos importaveis candidatos; sem seed executada, migration, schema, runtime, Dexie, sync, UI, agenda, evento, estoque, carencia ativa ou automacao operacional.
**Criado:** 2026-06-14
**Atualizado:** 2026-06-14
**Plano base:** `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`

---

## Objetivo em 1 paragrafo

Executar a Fase 12F2 convertendo a normalizacao 12F1 em payloads tecnicos candidatos para futura seed/importacao: `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2`, `sanitario_rotation_rules_v2` e `sanitario_source_refs_field_level_v2`. A fase e documental/importavel candidata; nao executa seed/import, nao cria migration, nao altera schema/runtime/Dexie/sync/UI e nao cria agenda, evento, estoque, carencia ativa, venda, abate, leite ou aptidao operacional.

---

## Decisao 12F2

Decisao: `FASE 12F2 CONCLUIDA COMO ARTEFATO IMPORTAVEL CANDIDATO`.

Entregue nesta fase:
- plano principal `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`;
- payload candidato `docs/review/evidence/SEED_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
- payload candidato `docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
- payload candidato `docs/review/evidence/SEED_PRODUCT_CLASS_GROUPS_CANDIDATA_12F2.md`;
- payload candidato `docs/review/evidence/SEED_ROTATION_RULES_CANDIDATA_12F2.md`;
- payload candidato `docs/review/evidence/SEED_SOURCE_REFS_CANDIDATA_12F2.md`;
- 10 protocolos em payload candidato;
- 19 itens versionados em payload candidato;
- 4 ProductClassGroups antiparasitarios fechados;
- sourceRefs por campo preservados;
- sourceGaps criticos preservados;
- fragilidades pre-12F3 registradas, incluindo reconciliacao de ProductClassGroup members contra schema real e changelog 22->19;
- zero `agenda_allowed`;
- zero `approved_for_catalog`;
- aftosa preservada como `archived/blocked`;
- B19 preservada como regra nacional para femeas bovinas e bubalinas de 3 a 8 meses.

Nao implementado nesta fase:
- seed executada;
- migration;
- alteracao de schema;
- codigo funcional/runtime;
- UI;
- Dexie/sync;
- agenda real;
- evento real;
- estoque;
- carencia ativa;
- venda, abate, leite ou aptidao operacional.

Proxima fase segura:
- `12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

---

## Historico anterior — Fase 12F1

Decisao: `FASE 12F1 CONCLUIDA COMO NORMALIZACAO TECNICA CANDIDATA`.

Entregue nesta fase:
- plano principal `docs/review/PLANO_FASE_12F1_NORMALIZACAO_PROTOCOLOS_V2.md`;
- evidencia `docs/review/evidence/PROTOCOLOS_SANITARIOS_V2_NORMALIZADOS_12F1.md`;
- evidencia `docs/review/evidence/PROTOCOLO_ITENS_NORMALIZADOS_12F1.md`;
- evidencia `docs/review/evidence/PRODUCT_CLASS_GROUPS_NORMALIZADOS_12F1.md`;
- evidencia `docs/review/evidence/ROTATION_RULES_ANTIPARASITARIOS_12F1.md`;
- evidencia `docs/review/evidence/SOURCE_REFS_FIELD_LEVEL_12F1.md`;
- 10 protocolos normalizados;
- 19 itens normalizados;
- 4 `ProductClassGroup` antiparasitarios fechados;
- `associacoes_antiparasitarias` marcada como `reserved_candidate`;
- `rotationRule` antiparasitario padrao definido;
- `sourceRefs` por campo critico, `sourcePolicy` separada e `sourceGaps` explicitos;
- nenhum item promovido a `agenda_allowed`;
- febre aftosa preservada como `archived/blocked` com `productRequirementKind = none`.

Validacao curatorial final:
- Brucelose B19 possui regra normativa nacional consolidada para femeas bovinas e bubalinas de 3 a 8 meses.
- B19 usa `legal_status = obrigatorio_norma_nacional`, `curationStatus = needs_review`, `automationStatus = manual_only`, `allowsAgendaAuto = false` e `agenda_allowed = false`.
- Bloqueios da B19 permanecem operacionais: `requires_mv_habilitado`, `requires_official_record_flow`, `requires_marking_when_applicable`, `requires_executed_product_snapshot` e `requires_product_catalog_validation`.
- Aftosa contingencia usa `productRequirementKind = none`, sem produto sugerido.
- `sourceRef` real foi separado de `sourcePolicy` baseada em produto executado.

Nao implementado nesta fase:
- codigo funcional;
- migration;
- seed real;
- UI;
- Dexie/sync;
- agenda real;
- evento real;
- baixa de estoque;
- carencia ativa;
- venda, abate, leite ou aptidao operacional.

Proxima fase autorizavel:
- `12F2 — Seed/import real candidato dos Protocolos Sanitarios v2, condicionado a revisao tecnica e ainda sem ativacao automatica`.

---

## Historico anterior — Fase 12F0

Decisao: `FASE 12F0 CONCLUIDA COMO CATALOGO CURATORIAL CANDIDATO`.

Entregue nesta fase:
- plano principal `docs/review/PLANO_FASE_12F0_ESTRUTURACAO_CURATORIAL_PROTOCOLOS_SANITARIOS_V2.md`;
- evidencia `docs/review/evidence/PROTOCOLOS_SANITARIOS_V2_CANDIDATOS_12F0.md`;
- evidencia `docs/review/evidence/ITENS_PROTOCOLO_SANITARIO_V2_CANDIDATOS_12F0.md`;
- evidencia `docs/review/evidence/MAPA_FONTES_PROTOCOLOS_SANITARIOS_V2_12F0.md`;
- 10 protocolos candidatos classificados;
- 19 itens candidatos estruturados;
- ProductRequirement definido por item;
- ProductClass/ProductClassGroup mapeado quando aplicavel;
- sourceRefs/source_gaps documentados;
- nenhum item promovido a `agenda_allowed`;
- febre aftosa preservada como `archived/blocked`.

Nao implementado nesta fase:
- codigo funcional;
- migration;
- seed;
- UI;
- Dexie/sync;
- agenda real;
- evento real;
- baixa de estoque;
- carencia ativa;
- venda, abate, leite ou aptidao operacional.

## Historico anterior — Fase 12E5

**Status:** Fase 12E5 concluida localmente - hardening final offline/sync sanitario v2.
**Foco:** Cursor incremental por `updated_at`, retry/replay seguro de closures, sucesso parcial, bloqueios permanentes de superficie e gate 12F.
**Criado:** 2026-06-13
**Atualizado:** 2026-06-13
**Plano base:** 12E5 - Hardening offline/sync sanitario v2

---

## Objetivo em 1 paragrafo

Executar a Fase 12E5 endurecendo a fundacao offline/sync sanitaria v2 antes da 12F: adicionar cursor incremental local por `updated_at` aos pulls sanitarios v2, preservar tombstones, reforcar retry/replay e sucesso parcial de closures, bloquear permanentemente push de `catalog_*` e `state_*`, manter agenda/animais v2 pull-only e documentar o gate tecnico para protocolos. A fase nao estrutura protocolo real, nao cria seed, nao altera UI, nao cria evento sanitario executado, nao baixa estoque, nao calcula carencia ativa e nao libera venda, abate, leite ou aptidao operacional.

---

## Decisao 12E5

Decisao: `PROSSEGUIR PARA GATE 12F COM FUNDACAO OFFLINE/SYNC ENDURECIDA`.

Implementado nesta fase:
- store Dexie v26 `sync_pull_cursors` para cursores locais por tabela/escopo;
- pull incremental por `updated_at` para ProductClass v2, catalogo tecnico sanitario v2 com `updated_at` e Agenda Sanitaria v2;
- full fetch inicial permanece quando nao ha cursor;
- filtro incremental usa `updated_at >= last_updated_at` para nao perder empates e depende do merge/upsert idempotente local;
- tombstones com `deleted_at` continuam preservados no pull incremental;
- `sanitario_produto_fontes_v2` permanece em full fetch/merge porque o contrato local/remoto usado na 12E3 nao possui `updated_at`;
- bloqueio local explicito de `state_*` como superficie direta de push;
- testes de retry de rede, replay por `client_op_id`, sucesso parcial e conflito de closure reforcados;
- sync-batch preserva idempotencia de replay por duplicidade generica de `client_op_id` e continua rejeitando closure ativa duplicada como conflito controlado.

Gate 12F:
- `catalog_*` confirmado como pull-only;
- `state_*` confirmado como read-model, sem superficie direta de push;
- ProductClass v2 e catalogo tecnico sanitario v2 disponiveis offline e pull-only;
- Agenda v2 offline/sync estavel como intencao operacional;
- agenda/animais v2 seguem pull-only;
- closure pushavel continua restrita a fechamento administrativo sem execucao;
- closure nao cria evento, estoque, carencia ativa ou liberacao operacional;
- baseline funcional, sync-batch, lint e build devem passar antes de iniciar 12F;
- P0 aberto deve bloquear 12F.

Nao implementado nesta fase:
- protocolo sanitario real estruturado;
- seed curatorial;a
- UI;
- migration;
- evento sanitario executado;
- baixa de estoque;
- carencia ativa;
- venda, abate, leite ou aptidao operacional.

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
