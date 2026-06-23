# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-15

## 0. Handoff Atual — Fase 12I

Fase 12I — Catalogo Sanitario v2 read-only offline-first — executada localmente.

Decisao: `12I_CATALOGO_SANITARIO_V2_OFFLINE_READ_ONLY`.

Resultado:
- Criados stores Dexie v27 `catalog_sanitario_protocolos_v2` e `catalog_sanitario_protocolo_itens_versions_v2`.
- Ampliados os índices de `catalog_sanitario_product_class_groups_v2` para consulta de grupos do catalogo de protocolos.
- Implementado `pullSanitarioProtocolCatalogV2` para baixar protocolos, itens e ProductClassGroups globais em modo merge/incremental.
- A leitura local Dexie em `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts` lista protocolos, itens por protocolo, grupos e resumo read-only.
- Avanco UI posterior: rota `/protocolos-sanitarios/catalogo-v2` criada para visualizar o catalogo local/offline em modo read-only.
- Testes confirmam 10 protocolos, 20 itens ativos apos saneamento de `raiva_herbivoros` e `matrizes_pre_parto`, 4 grupos, B19 nacional, aftosa retired/bloqueada e 6 antiparasitarios com ProductClassGroup.
- Não foi criado push, `queue_ops`, sync-batch de escrita, UI operacional, migration, schema, RLS, Edge Function, agenda, evento, estoque, carencia ativa ou liberação operacional.

Próximo passo seguro:
- validar a tela read-only em runtime com Dexie populado, mantendo tudo sem agenda automatica.

---

## 0.1 Handoff anterior — Fase 12H

Fase 12H — Leitura read-only dos Protocolos Sanitarios v2 importados — executada localmente.

Decisao: `12H_LEITURA_READ_ONLY_PROTOCOLS_SANITARIOS_V2_IMPORTADOS`.

Resultado:
- Criada camada `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`.
- Implementadas consultas read-only para protocolos v2, itens por protocolo e ProductClassGroups v2.
- Implementado resumo read-only para validar 10 protocolos, 20 itens ativos apos saneamento de raiva e matrizes pre-parto, 4 grupos e 16 members bloqueados.
- B19 nacional, aftosa retired/bloqueada e 6 itens antiparasitarios com `product_class_group_id` foram confirmados em teste.
- A camada consulta banco via cliente Supabase-like e nao le o JSON 12F10 em runtime.
- Nenhum caminho de escrita, migration, schema, RLS, UI, Dexie, sync, Edge Function, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Próximo passo seguro:
- conectar esta leitura a uma superficie UI read-only ou a pull offline objetivo, mantendo protocolos como regra/configuracao e sem agenda automatica.

---

## 0.2 Handoff anterior — Fase 12G

Fase 12G — Importador controlado dos Protocolos Sanitarios v2 — executada localmente.

Decisao: `12G_IMPORTADOR_CONTROLADO_PROTOCOLS_SANITARIOS_V2_COM_PAYLOAD_12F10`.

Resultado:
- Criado `scripts/codex/import-sanitario-protocols-v2.mjs`.
- O script usa exclusivamente `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.
- Implementados os modos `--validate`, `--dry-run` e `--apply`.
- `--apply` falha sem `ALLOW_SANITARIO_IMPORT=1`.
- `--validate` passou.
- Apply real executado localmente: 33 `create`, 0 `update`, 0 `skip`, 16 `reject`.
- Dry-run pos-apply passou com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`.
- ProductClassGroup members continuam bloqueados por ausência de `class_id` real.
- Nenhuma migration, schema, RLS, UI, Dexie, sync, Edge Function, agenda, evento, estoque, carência ativa ou liberação operacional foi criada.

---

## 0.1 Handoff anterior — Fase 12F10

Fase 12F10 — Consolidacao e reducao documental dos Protocolos Sanitarios v2 — executada localmente.

Decisao: `12F10_CONSOLIDAR_ARTEFATOS_CANONICOS_ANTES_DE_12G0`.

Resultado:
- Consolidado payload final em `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.
- Preservadas as contagens 10 protocolos, 19 itens, 4 ProductClassGroups e 16 rejeicoes de members.
- Mantido `execute_import=false`.
- Criados decision record, import gate e archive index 12F0-12F9.
- `LAST_PHASE_RESULT` foi reduzido para resumo executivo recente.
- Nenhum seed/import, migration, schema, runtime, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Proxima fase segura:
- `12G0 — dry-run real do import usando somente o payload canonico 12F10, com autorizacao explicita, transacao e rollback`.

---

## 0.1 Handoff anterior — Fase 12F9

Fase 12F9 — Payload JSON completo importavel candidato para Protocolos Sanitarios v2 — executada localmente.

Decisao: `FASE 12F9 CONCLUIDA COMO GERACAO JSON CANDIDATA NAO DESTRUTIVA`.

Resultado:
- Criado `scripts/codex/validate-sanitario-complete-payloads-12f9.mjs`.
- Criado `docs/review/PLANO_FASE_12F9_PAYLOAD_JSON_COMPLETO_PROTOCOLOS_V2.md`.
- Criados JSONs candidatos em `docs/review/evidence/`.
- Criado relatorio e resultado de validacao 12F9.
- Contagem candidata: 10 protocolos, 19 itens, 4 ProductClassGroups e 16 members rejeitados.
- B19, aftosa, ProductClassGroup e carencia por evento/produto/snapshot foram preservados.
- Nenhum seed/import, migration, banco, UI, Dexie, sync, Edge Function, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Validacao:
- `node scripts/codex/validate-sanitario-complete-payloads-12f9.mjs`: 543 PASS, 0 WARNING, 0 FAIL.

Proxima fase segura:
- `12G0 — Import controlado/dry-run dos payloads candidatos, somente com autorizacao explicita para carga real`.

---

## 0.1 Handoff anterior — Fase 12F8

Fase 12F8 — Revalidacao do adapter contra schema atualizado e adaptacao documental dos itens ProductClassGroup — executada localmente.

Decisao: `FASE 12F8 CONCLUIDA COMO REVALIDACAO NAO DESTRUTIVA DO ADAPTER`.

Resultado:
- Criado `scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs`.
- Criado `docs/review/PLANO_FASE_12F8_REVALIDACAO_ADAPTER_PRODUCT_CLASS_GROUP.md`.
- Criadas evidencias 12F8 em `docs/review/evidence/`.
- Migration 12F7 revalidada quanto a enum, coluna `product_class_group_id`, FK, CHECK e trigger.
- 6 itens antiparasitarios antes rejeitados foram adaptados como payload candidato com `product_class_group_id` por lookup.
- Contagem passou para 19 itens adaptaveis e 0 rejeicao por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.
- 16 ProductClassGroup members continuam bloqueados por ausencia de `class_id` real.
- Nenhum seed/import, migration nova, insercao no banco, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Validacao:
- `node scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs`: 167 PASS, 0 WARNING, 0 FAIL.

Proxima fase segura:
- `12F9 — Gerar payload JSON completo importavel candidato para protocolos/itens/grupos, ainda sem executar import`.

---

## 0.1 Handoff anterior — Fase 12F7

Fase 12F7 — Migration controlada para suportar ProductClassGroup em itens de protocolo sanitario v2 — executada localmente.

Decisao: `FASE 12F7 CONCLUIDA COMO MIGRATION CONTROLADA`.

Resultado:
- Criada migration `supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql`.
- `sanitario_product_requirement_kind_v2_enum` passou a aceitar `product_class_group`.
- `sanitario_protocolo_itens_versions_v2` recebeu `product_class_group_id`.
- Criada FK para `sanitario_product_class_groups_v2(id)` com `on delete restrict`.
- CHECK de requisito de produto passou a validar exatamente uma modalidade coerente.
- Criada trigger para bloquear grupo deletado, fora de escopo e agenda automatica com grupo blocked/archived.
- Contrato TS do item recebeu `productClassGroupId`.
- Testes focados, reset Supabase, lint e build passaram.
- Nenhum seed/import, protocolo ativo, agenda, evento, estoque, carencia ativa, UI, Dexie, sync ou liberacao operacional foi criado.

Proxima fase segura:
- `12F8 — Revalidar adapter 12F4/12F5 contra schema atualizado e tentar adaptar os 6 itens antiparasitarios antes rejeitados, ainda sem seed/import real`.

---

## 0.1 Handoff anterior — Fase 12F6

Fase 12F6 — Decisao estrutural sobre ProductClassGroup em itens de protocolo sanitario v2 — executada documentalmente.

Decisao: `RECOMENDAR OPCAO A — SUPORTE DIRETO A PRODUCT_CLASS_GROUP NO ITEM`.

Resultado:
- Criado `docs/review/PLANO_FASE_12F6_DECISAO_PRODUCT_CLASS_GROUP_ITENS.md`.
- Criadas evidencias 12F6 em `docs/review/evidence/`.
- Confirmado que o schema SQL real de `sanitario_protocolo_itens_versions_v2` ainda nao aceita `product_class_group`.
- Confirmado que o contrato TypeScript ja reconhece `product_class_group`, mas o import segue bloqueado sem suporte SQL.
- Recomendada futura migration com enum `product_class_group`, coluna `product_class_group_id`, FK para `sanitario_product_class_groups_v2(id)` e CHECK de requisito unico.
- Rejeitada conversao de `product_class_group` para `product_class`, `specific_product` ou `none`.
- Mantidos bloqueados os 6 itens antiparasitarios rejeitados na 12F4 ate existir schema futuro.
- Nenhuma migration, seed/import, schema, runtime, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criada.

Proxima fase segura:
- `12F7 — Migration controlada para suportar ProductClassGroup em itens de protocolo sanitario v2`, ainda sem seed/import real e sem ativacao automatica.

---

## 0.1 Handoff anterior — Fase 12F5

Fase 12F5 — Validacao automatizada do adapter/normalizer candidato — executada localmente com script somente leitura e relatorios documentais.

Decisao: `FASE 12F5 CONCLUIDA COMO VALIDACAO AUTOMATIZADA NAO DESTRUTIVA`.

Resultado:
- Criado `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`.
- Criado `docs/review/PLANO_FASE_12F5_VALIDACAO_AUTOMATIZADA_ADAPTER.md`.
- Criadas evidencias 12F5 em `docs/review/evidence/`.
- Script executado com exit code 0.
- Resultado do script: 300 PASS, 1 WARNING, 0 FAIL.
- B19 nacional validada.
- Aftosa archived/blocked validada.
- ProductClassGroup em itens rejeitado corretamente.
- ProductClassGroup members bloqueados corretamente.
- Flags proibidas ausentes.
- Nenhum protocolo foi promovido a `approved_for_catalog`.
- Nenhum protocolo ou item foi promovido a `agenda_allowed`.
- Nenhum codigo funcional, migration, seed/import, schema, UI, Dexie, sync, agenda real, evento real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi criado.

Proxima fase segura:
- `12F6 — Decisao estrutural sobre ProductClassGroup em itens`, ainda sem seed/import real.

---

## 0.1 Handoff anterior — Fase 12F4

Fase 12F4 — Adapter/normalizer dos payloads candidatos para schema real — executada localmente como fase documental.

Decisao: `FASE 12F4 CONCLUIDA COMO ADAPTER/NORMALIZER CANDIDATO DOCUMENTAL`.

Resultado:
- 10 protocolos adaptaveis.
- 13 itens adaptaveis.
- 6 itens antiparasitarios rejeitados.
- 4 ProductClassGroups adaptaveis parcialmente.
- 16 ProductClassGroup members bloqueados.
- Proxima etapa definida como validacao automatizada sem import.

---

## 0.2 Handoff anterior — Fase 12F3

Fase 12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real — executada localmente como fase documental.

Decisao: `FASE 12F3 CONCLUIDA COMO VALIDACAO TECNICA DOCUMENTAL`.

Resultado:
- Payloads 12F2 avaliados contra `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2`, ProductClass v2 e contratos TypeScript.
- Import bruto bloqueado por divergencias de enum/coluna/FK.
- Proxima etapa definida como adapter/normalizer sem import.

---

## 0.2 Handoff anterior — Fase 12F2

Fase 12F2 — Seed/import candidata dos Protocolos Sanitarios v2 — executada localmente como fase documental/importavel candidata.

Decisao: `FASE 12F2 CONCLUIDA COMO ARTEFATO IMPORTAVEL CANDIDATO`.

Resultado:
- Criado `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`.
- Criados payloads candidatos 12F2 em `docs/review/evidence/`.
- 10 protocolos convertidos para payload candidato de `sanitario_protocolos_v2`.
- 19 itens versionados convertidos para payload candidato de `sanitario_protocolo_itens_versions_v2`.
- 4 ProductClassGroups e 16 membros convertidos para payload candidato de ProductClassGroup.
- RotationRule antiparasitario convertido para artefato candidato de `sanitario_rotation_rules_v2`.
- SourceRefs field-level convertidos para artefato candidato de `sanitario_source_refs_field_level_v2`.
- B19 preservada como regra normativa nacional para femeas bovinas e bubalinas de 3 a 8 meses.
- Aftosa preservada como `archived`/`blocked` e `productRequirementKind = none`.
- Fragilidades pre-12F3 registradas: tolerancia numerica normalizada, `matrizes_pre_parto` sem enum composto, `fieldSourceRefs` separado de `sourceGaps`/`sourcePolicy`, ProductClassGroup members pendentes de reconciliacao contra schema real e changelog 22->19 documentado.
- Nenhum protocolo foi promovido a `approved_for_catalog`.
- Nenhum protocolo ou item foi promovido a `agenda_allowed`.
- Nenhum codigo funcional, migration, seed executada, schema, UI, Dexie, sync, agenda real, evento real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi criado.

Proxima fase segura:
- `12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

---

## 0.1 Handoff anterior — Fase 12F1

Fase 12F1 — Normalizacao dos Protocolos Sanitarios v2 em artefato tecnico estruturado — executada localmente como fase documental.

Decisao: `FASE 12F1 CONCLUIDA COMO NORMALIZACAO TECNICA CANDIDATA`.

Resultado:
- Criado `docs/review/PLANO_FASE_12F1_NORMALIZACAO_PROTOCOLOS_V2.md`.
- Criadas evidencias normalizadas 12F1 em `docs/review/evidence/`.
- 10 protocolos normalizados para futura seed/importacao candidata.
- 19 itens normalizados.
- 4 `ProductClassGroup` antiparasitarios fechados.
- Nenhum protocolo ou item foi promovido a `agenda_allowed`.
- Nenhum codigo funcional, migration, seed, UI, Dexie, sync, agenda real, evento real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi criado.

---

## 0.2 Handoff anterior — Fase 12F0

Fase 12F0 — Estruturacao curatorial dos Protocolos Sanitarios v2 — executada localmente como fase documental.

Decisao: `FASE 12F0 CONCLUIDA COMO CATALOGO CURATORIAL CANDIDATO`.

Resultado:
- Criado `docs/review/PLANO_FASE_12F0_ESTRUTURACAO_CURATORIAL_PROTOCOLOS_SANITARIOS_V2.md`.
- Criadas evidencias curatoriais 12F0 em `docs/review/evidence/`.
- 10 protocolos candidatos classificados.
- 19 itens candidatos estruturados.
- ProductClass/ProductClassGroup mapeado quando aplicavel.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional, migration, seed, UI, Dexie, sync, agenda real, evento real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi criado.

---

## 0.2 Handoff anterior — Fase 12E5

Fase 12E5 — Hardening final offline/sync sanitario v2 — executada localmente.

Decisao: `PROSSEGUIR PARA 12F APOS VALIDACOES DE GATE`.

Resultado:
- Criada store Dexie v26 `sync_pull_cursors` para cursores locais por tabela/escopo.
- Pull incremental por `updated_at` implementado para ProductClass v2, catalogo tecnico sanitario v2 com `updated_at` e Agenda Sanitaria v2.
- Full fetch inicial continua possivel quando nao ha cursor; cursor ausente/corrompido nao bloqueia pull.
- Cursor e salvo por tabela/store/escopo: global, tenant, fazenda ou unscoped.
- Pull global de ProductClass e fontes tecnicas continua separado e nao depende de `fazenda_id`.
- Pull tenant/fazenda continua filtrando por `fazenda_id` quando o contrato exige.
- Tombstones com `deleted_at` continuam preservados por merge/upsert; nao ha delete fisico.
- `sanitario_produto_fontes_v2` permanece full fetch/merge porque nao possui `updated_at` no contrato local usado.
- Retry/replay de closures reforcado: falha de rede preserva `queue_ops`, sucesso remove op aplicada, rejeicao gera `queue_rejections` e conflito dispara reconciliacao.
- Sucesso parcial de closures preserva aceitas sincronizadas e mantem rejeitadas rastreaveis.
- `catalog_*` segue pull-only e nao gera `queue_ops`.
- `state_*` foi bloqueado como superficie direta de push.
- `sanitario_agenda_v2` e `sanitario_agenda_animais_v2` seguem pull-only.
- Push de closure continua bloqueando `executed_with_event`, `partially_executed_with_event` e qualquer `execution_evento_id`.
- Nenhuma UI, migration, seed, protocolo estruturado, evento sanitario executado, baixa de estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Gate 12F:
- autorizado somente com P0 zerado, baseline funcional passando, sync-batch passando, lint/build passando e contratos `catalog_*` pull-only, `state_*` read-model, Agenda=intencao e Closure sem execucao preservados.

Proxima fase recomendada:
- `12F — Estruturacao curatorial dos Protocolos Sanitarios v2`.

---

## 0.1 Handoff anterior — Fase 12E4

Fase 12E4 — Agenda Sanitaria v2 offline/sync em escopo controlado — executada localmente.

Decisao: `PROSSEGUIR COM ESCOPO CONTROLADO`.

Resultado:
- Criadas stores Dexie v25 `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2` e `ops_sanitario_agenda_closures_v2`.
- Criados tipos locais minimos para espelhar as 3 tabelas reais da migration da Agenda Sanitaria v2.
- `tableMap` mapeia as tabelas remotas da Agenda v2 para stores locais `ops_*`.
- Criado pull especifico `pullSanitarioAgendaV2(fazenda_id)`, sempre tenant-scoped por `fazenda_id`.
- Pull respeita ordem agenda -> animais -> closures e aplica dados em merge/upsert, preservando `updated_at`, `deleted_at`, metadata e vinculos.
- `pullInitialData` passou a executar o pull da Agenda v2 apos ProductClass v2 e catalogo tecnico sanitario v2.
- `createGesture` bloqueia `queue_ops` para `catalog_*`, `sanitario_agenda_v2` e `sanitario_agenda_animais_v2`.
- Push foi habilitado somente para `sanitario_agenda_closures_v2`, com `client_op_id` preservado.
- Push de closure na 12E4 aceita apenas closures administrativas sem `execution_evento_id`; `executed_with_event`, `partially_executed_with_event` e `execution_evento_id` preenchido sao bloqueados.
- `sync-batch` trata as tabelas da Agenda v2 como tenant-scoped e continua dependente do RLS existente.
- Duplicidade de closure ativa e normalizada como rejeicao controlada `sanitario_agenda_closure_already_exists`.
- Sucesso parcial de gestures compostas apenas por closures preserva aceitas sincronizadas e mantem rejeitadas com erro rastreavel.
- ProductClass v2 e catalogo tecnico sanitario v2 continuam pull-only.
- `execution_evento_id` em agenda, animais e closures pode existir apenas como dado vindo de pull/read remoto; nao e superficie de push da 12E4.
- Nenhuma UI, migration, seed, protocolo estruturado, evento sanitario executado, baixa de estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Proxima fase recomendada:
- `12E5 — Hardening offline/sync` ou `12F — Estruturacao curatorial dos protocolos`, conforme decisao de gate.

---

## 0.1 Handoff anterior — Fase 12E3

Fase 12E3 — Catalogo tecnico sanitario v2 ampliado em Dexie com pull remoto — executada localmente em escopo reduzido.

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Criadas stores Dexie v24 para as 7 estruturas autorizadas do catalogo tecnico sanitario v2: fontes tecnicas, cobertura por campo, produtos, autorizacao por especie, produto-fonte, dose rules e carencia rules catalogadas.
- Criados tipos locais minimos e mapeamento `tableMap` remoto -> `catalog_*` para essas 7 estruturas.
- Criado pull especifico `pullSanitarioTechnicalCatalogV2`.
- `sanitario_fontes_tecnicas_v2` e baixada em duas consultas: global com `scope = 'global'` e `fazenda_id is null`, e fazenda com `scope = 'fazenda'` e `fazenda_id` atual, conforme enum real da migration.
- As demais 6 tabelas autorizadas sao baixadas sem filtro artificial por `fazenda_id`; leitura acessivel permanece governada pelo schema/RLS existente e pelos vinculos do catalogo.
- Dados sao aplicados em modo merge, preservando `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON; tombstones nao sao apagados fisicamente.
- `pullInitialData` passou a executar o pull do catalogo tecnico sanitario v2 apos ProductClass v2.
- Testes focados cobrem stores, pull global/fazenda, ausencia de `queue_ops`, ordem de gravacao, soft-delete, metadata/arrays, regra de nao heranca bovino -> bubalino e ausencia de carencia ativa.
- `sanitario_produto_carencia_fontes_v2`, protocolos v2 e itens versionados permanecem fora desta fase.
- Nenhum push, sync-batch, UI, migration, seed, protocolo estruturado, agenda real, evento real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementado.

Proxima fase recomendada:
- `12E4 — Agenda Sanitaria v2 offline/sync em escopo controlado`.

---

## 0.1 Handoff anterior — Fase 12E2

Fase 12E2 — Pull remoto ProductClass v2 para cache local Dexie — executada localmente em escopo reduzido.

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Criado pull especifico para ProductClass v2 em `pullSanitarioProductClassV2Catalog`.
- As 4 tabelas remotas sao baixadas em ordem de dependencia: classes, grupos, memberships e regras default.
- Registros globais sao buscados separadamente com `scope = 'global'` e `fazenda_id is null`.
- Registros tenant sao buscados separadamente com `scope = 'tenant'` e `fazenda_id` da fazenda atual.
- Dados globais e tenant sao aplicados nos stores locais `catalog_*` criados na 12E1, em modo merge.
- `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON sao preservados; tombstones nao sao apagados fisicamente.
- ProductClass v2 nao entrou no fluxo de push, nao cria `queue_ops` e nao chama sync-batch.
- `pullInitialData` passou a executar o pull ProductClass v2 apos o pull padrao, sem adicionar essas tabelas ao `DEFAULT_REMOTE_TABLES` tenant-scoped.
- Baseline P1 ajustado: `validate-supabase-baseline-functional.mjs` nao tenta mais escrever agenda sanitaria legada em `agenda_itens`; a etapa sanitaria cria evento/detalhe sanitario diretamente.
- Nenhuma UI, migration, seed, protocolo estruturado, agenda real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Proxima fase recomendada:
- `12E3 — Catalogo tecnico sanitario v2 ampliado`.

---

## 0.2 Handoff anterior — Fase 12E1

Fase 12E1 — Dexie schema/stores para ProductClass v2 — executada localmente em escopo reduzido.

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Stores Dexie locais criadas para ProductClass v2 em `catalog_sanitario_product_classes_v2`, `catalog_sanitario_product_class_groups_v2`, `catalog_sanitario_product_class_group_members_v2` e `catalog_sanitario_product_class_default_rules_v2`.
- Versionamento Dexie atualizado para v23.
- Tipos locais minimos criados para preservar campos criticos remotos: `id`, `fazenda_id`, `scope`, `created_at`, `updated_at`, `deleted_at`, `metadata`, `limitations` e campos especificos de cada tabela.
- Indices locais adicionados para consultas futuras por `scope`, `fazenda_id`, `deleted_at`, `updated_at`, chaves semanticas, status curatoriais/automacao e compostos principais.
- `tableMap` mapeia as 4 tabelas remotas ProductClass v2 para stores locais `catalog_*`, sem adiciona-las ao pull inicial.
- Teste focado valida registro de stores, representacao global (`scope='global'`, `fazenda_id=null`), tenant (`scope='tenant'`, `fazenda_id` preenchido), preservacao de `deleted_at`, `updated_at`, metadata e arrays, sem criar `queue_ops`.
- Nenhum pull, push, sync-batch, UI, migration, seed, protocolo, agenda, evento, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementado.

Proxima fase recomendada:
- `12E2 — Sync/Pull ProductClass v2 e correcao do baseline P1`.

---

## 0.3 Handoff anterior — Fase 12E0

Fase 12E0 — Diagnóstico Técnico e Contrato de Implementação para Offline/Sync da Fundação Sanitária v2 — executada localmente como patch documental.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Plano técnico de sincronização/offline criado em [PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md](file:///c:/Users/mares/dyad-apps/GestaoAgro/docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md).
- Mapeamento remoto → local proposto para as 17 estruturas sanitárias v2 Supabase/Dexie (14 de Catálogo e 3 de Operação).
- Estratégia de pull/push diferenciada para registros de escopo global (pull-only) vs tenant (`scope = 'tenant'`).
- Soft-delete e constraints de idempotência RLS (por `client_op_id` / `dedup_key`) documentados.
- Ordem de implementação em 4 subfases curtas sugerida: 12E1 (ProductClass Dexie) -> 12E2 (ProductClass sync/P1) -> 12E3 (Catálogo ampliado) -> 12E4 (Agenda Sanitária v2 Dexie/sync).
- Classificação da pendência P1 (atualizar `validate-supabase-baseline-functional.mjs`) mapeada para resolução na Fase 12E2.
- Nenhum código funcional, UI, Dexie, migrations ou sync-batch foi alterado nesta subfase.

Próxima fase recomendada:
- `12E1 — Dexie schema/stores para ProductClass v2`.

---

## 0.4 Handoff anterior — Fase 12D6

Fase 12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass — executada como migration física Postgres no Supabase em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Migration física de banco de dados criada em `supabase/migrations/20260610203500_sanitario_product_class_v2.sql`.
- Tabelas criadas: `sanitario_product_classes_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2` e `sanitario_product_class_default_rules_v2`.
- CHECK constraints de integridade para restringir tipos, cardinalidade de espécies e tipagem JSONB estrutural mínima.
- RLS habilitada em todas as tabelas com policies explícitas de `SELECT` (reutilizando `has_membership`) e de `INSERT`/`UPDATE` com `WITH CHECK` restrito a `owner`/`manager`.
- Triggers `BEFORE INSERT OR UPDATE` para memberships e default rules executando validação e derivação determinística, bloqueando FKs inativas (`deleted_at is not null`).
- Privilégios de DELETE omitidos nos grants; soft-deletion via UPDATE exigido.
- Sem inserção de dados curatoriais, seeds de produto ou UI/Dexie integrados.
- Alterações em sanitaryClassificationsV2.ts and sanitaryProductClassV2.test.ts foram correções mínimas de build/lint, sem mudança de regra sanitária, sem Dexie, sem sync, sem UI e sem alteração de contrato da 12D5.

Próxima fase recomendada:
- `12E0 — Diagnóstico técnico e contrato de implementação para offline/sync da Fundação Sanitária v2`.

---

## 0.5 Handoff anterior — Fase 12D5

Fase 12D5 — Contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy — executada como implementação funcional pura em TypeScript em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- Contratos TypeScript de `ProductClassV2` e `ProductClassGroupV2` definidos em `sanitaryProductClassV2.ts`.
- Enums `SanitaryCurationStatusV2`, `SanitaryAutomationStatusV2` e `ExecutionProductPolicyV2` criados.
- Union discriminada estruturada `SanitaryProductRequirementRuleV2` modelada.
- Guards de tipo, validadores puros (`validateProductRequirementRuleV2`, `validateProductClassGroupV2`, `validateProductClassV2`) criados e validados.
- `fixed_by_protocol` bloqueado em nível de validador runtime para `product_class` e `product_class_group`.
- Item de protocolo versionado (`SanitaryProtocolItemVersionV2`) estendido com o campo opcional estruturado `productRequirementRule` em `sanitaryProtocolV2.ts`.
- Validador do item versionado estendido para validar a integridade de `productRequirementRule`, bloquear mismatches com `productRequirementKind` e exigir regra quando kind for `product_class_group`.
- Versionamento semântico (`requiresNewProtocolItemVersionV2`) estendido para detectar alterações estruturadas na regra de produto.
- 18 testes unitários novos criados cobrindo validações, mismatches, coerência profunda, versionamento e guards de tipo.
- Suíte completa de 900+ testes passou com sucesso absoluto e build limpo executado.
- SQL, RLS, Dexie, sync-batch e UI não foram alterados.

---

## 0.2. Handoff anterior — Fase 12D4

Fase 12D4 — Rebaseline conceitual das matrizes sanitárias v2: ProductClass, status curatorial e política de execução — executada como patch documental em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:
- modelo canônico `SanitaryProtocol → SanitaryProtocolItemVersion → ProductRequirement → ProductClass → ProductClassDefaultRule/Membership → SanitaryProduct` documentado no README curatorial;
- `ProductClass` consolidada como entidade conceitual central — o item do protocolo exige uma classe, não um produto;
- `ProductClassDefaultRule` separada com `can_validate_execution = false` e `requires_executed_product_for_withdrawal = true` invariáveis;
- `SanitaryProduct` separado como exemplo/configuração/execução — nunca obrigatório do protocolo;
- enums canônicos aplicados: `CurationStatus` (candidate/needs_review/approved_for_catalog/blocked/archived), `AutomationStatus` (manual_only/preview_allowed/agenda_allowed/blocked), `ExecutionProductPolicy` (not_required/required_at_agenda/required_at_execution/fixed_by_protocol);
- `approved_for_seed` removido como status canônico; substituído por `approved_for_catalog`;
- `requires_product_at_execution` removido de `automation_status`; virou `execution_product_policy = required_at_execution`;
- linguagem de bulas corrigida: fontes produto-específicas com `scope_note` explícito; não representam toda a classe nem fixam carência no protocolo;
- matriz de produtos separada em Seção A (ProductClass), B (ProductClassDefaultRule) e C (SanitaryProduct exemplos);
- 12 `ProductClass` definidas conceitualmente; 19 defaults por classe/espécie/aptidão; 4 produtos exemplo identificados;
- relatório de rebaseline 12D4 criado em `docs/review/evidence/RELATORIO_REVISAO_12D4_PRODUCT_CLASS_E_STATUS.md`;
- critério de inclusão adicionado à matriz de fontes técnicas;
- nenhum protocolo promovido para `approved_for_catalog` nesta fase;
- carência permanece atributo de `WithdrawalRule` do `SanitaryProduct` executado — nunca do protocolo, item ou classe;
- bubalino não herdou autorização bovina em nenhuma linha;
- SQL, RLS, Dexie, sync-batch, UI, contratos TypeScript 12D1/12D2, seed, agenda, evento, estoque, venda, abate, aptidão, SISBOV, GTA, PNIB e rastreabilidade animal não foram alterados.

---� Schema/contratos ProductClass, defaults e memberships`.

---

## 0.1. Handoff anterior — Fase 12D3

Fase 12D3 — Extração curatorial de protocolos sanitários candidatos v2 para revisão — executada como patch documental em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado:

- guideline curatorial localizado e usado como fonte de casos e estrutura, não como seed final;
- 4 matrizes revisáveis criadas em `docs/review/evidence/`;
- 21 protocolos candidatos extraídos e classificados com status curatorial e de automação;
- 23 itens versionáveis candidatos extraídos com dose, via, janela, espécie e limitações;
- 14 produtos/classes candidatos extraídos com carências e status de autorização;
- 15 fontes técnicas identificadas, todas `PRECISA_VALIDAR` (nenhuma fonte forte disponível no workspace);
- README curatorial criado para guiar revisão humana;
- toda linha tem status curatorial e de automação;
- toda linha declara lacunas e fonte mínima necessária;
- bubalino não herdou autorização bovina em nenhuma linha;
- itens experimentais/alerta ficaram bloqueados como `not_automatable_alert`;
- carência zero apenas candidata onde guideline cita explicitamente (aftosa/IN-48/2020 e eprinomectina);
- nenhuma carência foi liberada;
- nenhuma linha é seed final;
- nenhuma agenda automática foi criada;
- SQL, RLS, Dexie, sync-batch, UI, contratos TypeScript 12D1/12D2, seed, evento, estoque, venda, abate, aptidão, SISBOV, GTA, PNIB e rastreabilidade animal não foram alterados.

Próxima fase recomendada:

- `12D4 — Revisão técnico-veterinária das matrizes curatoriais`.

---

## 0.1. Handoff anterior — Fase 12D2

Fase 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2 — executada em escopo reduzido.

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
