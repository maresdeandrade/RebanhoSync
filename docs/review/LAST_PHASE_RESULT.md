# Last Phase Result — RebanhoSync

Atualizado em: 2026-06-14
**Baseline Commit:** `3853b80`

## 0. Resultado mais recente

Fase 12F5 — Validacao automatizada do adapter/normalizer candidato — executada localmente como script somente leitura e relatorio documental.

Decisao: `FASE 12F5 CONCLUIDA COMO VALIDACAO AUTOMATIZADA NAO DESTRUTIVA`.

Resultado da 12F5:
- Criado script local `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`.
- Criado plano principal `docs/review/PLANO_FASE_12F5_VALIDACAO_AUTOMATIZADA_ADAPTER.md`.
- Criadas 3 evidencias 12F5 em `docs/review/evidence/`.
- Script executado com exit code 0.
- Resultado consolidado: 300 PASS, 1 WARNING, 0 FAIL.
- Flags proibidas ausentes.
- Contagens 12F4 validadas.
- B19 nacional validada.
- Febre aftosa archived/blocked validada.
- Rejeicoes ProductClassGroup validadas.
- ProductClassGroup members sem `class_id` bloqueados corretamente.
- SourceRefs e RotationRules em JSONB confirmados.
- Nenhum protocolo recebeu `approved_for_catalog`.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional de produto, migration, seed/import, schema, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Patch da 12F5:
- `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`
- `docs/review/PLANO_FASE_12F5_VALIDACAO_AUTOMATIZADA_ADAPTER.md`
- `docs/review/evidence/VALIDACAO_AUTOMATIZADA_ADAPTER_12F5.md`
- `docs/review/evidence/RESULTADO_VALIDACAO_ADAPTER_12F5.md`
- `docs/review/evidence/REGRAS_VALIDACAO_ADAPTER_12F5.md`
- docs ativos de fase/status/roadmap/dominio

Proxima execucao recomendada:
- `12F6 — Decisao estrutural sobre ProductClassGroup em itens`, ainda sem seed/import real.

---

## 0.1 Resultado anterior — Fase 12F4

Fase 12F4 — Adapter/normalizer dos payloads candidatos para schema real — executada localmente como fase documental.

Decisao: `FASE 12F4 CONCLUIDA COMO ADAPTER/NORMALIZER CANDIDATO DOCUMENTAL`.

Resultado da 12F4:
- Criado plano principal `docs/review/PLANO_FASE_12F4_ADAPTER_PAYLOADS_SCHEMA_REAL.md`.
- Criadas 6 evidencias 12F4 em `docs/review/evidence/`.
- 10 protocolos classificados como adaptaveis para `sanitario_protocolos_v2`.
- 13 itens classificados como adaptaveis para `sanitario_protocolo_itens_versions_v2`.
- 6 itens antiparasitarios rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.
- 4 ProductClassGroups adaptaveis parcialmente.
- 16 ProductClassGroup members bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- SourceRefs e RotationRules tiveram destino JSONB definido.
- B19 nacional foi preservada.
- Febre aftosa ficou archived/blocked com `legal_status = bloqueado`, `status = retired` no protocolo adaptado e `productRequirementKind = none` nos itens.
- Nenhum protocolo recebeu `approved_for_catalog`.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional, migration, seed/import, schema, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Patch da 12F4:
- `docs/review/PLANO_FASE_12F4_ADAPTER_PAYLOADS_SCHEMA_REAL.md`
- `docs/review/evidence/ADAPTER_PROTOCOLOS_V2_12F4.md`
- `docs/review/evidence/ADAPTER_ITENS_PROTOCOLOS_V2_12F4.md`
- `docs/review/evidence/ADAPTER_PRODUCT_CLASS_GROUPS_12F4.md`
- `docs/review/evidence/ADAPTER_SOURCE_REFS_ROTATION_RULES_12F4.md`
- `docs/review/evidence/REJEICOES_PAYLOADS_12F4.md`
- `docs/review/evidence/PAYLOADS_ADAPTADOS_SCHEMA_REAL_12F4.md`
- docs ativos de fase/status/roadmap/dominio

Proxima execucao recomendada:
- `12F5 — Validacao automatizada do adapter/normalizer candidato`, ainda sem aplicar seed/import e sem ativacao automatica.

---

## 0.1 Resultado anterior — Fase 12F3

Fase 12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real — executada localmente como fase documental.

Decisao: `FASE 12F3 CONCLUIDA COMO VALIDACAO TECNICA DOCUMENTAL`.

Resultado da 12F3:
- Criado plano principal `docs/review/PLANO_FASE_12F3_VALIDACAO_PAYLOADS_SCHEMA_REAL.md`.
- Criadas 5 evidencias 12F3 em `docs/review/evidence/`.
- Todos os payloads 12F2 foram avaliados contra schema SQL e contratos TypeScript existentes.
- `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2` e ProductClass v2 foram auditados.
- Divergencias de coluna, enum, JSONB, FK, constraints, RLS e destino documental foram registradas.
- Import bruto ficou bloqueado; payloads podem avancar somente para adapter/normalizer 12F4.
- B19 nacional foi preservada.
- Febre aftosa permaneceu archived/blocked.
- `agenda_allowed` permaneceu zero.
- `approved_for_catalog` permaneceu zero.
- Nenhum codigo funcional, migration, seed/import, schema, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Patch da 12F3:
- `docs/review/PLANO_FASE_12F3_VALIDACAO_PAYLOADS_SCHEMA_REAL.md`
- `docs/review/evidence/VALIDACAO_SCHEMA_REAL_PROTOCOLOS_12F3.md`
- `docs/review/evidence/VALIDACAO_SCHEMA_REAL_ITENS_12F3.md`
- `docs/review/evidence/VALIDACAO_SCHEMA_REAL_PRODUCT_CLASS_GROUPS_12F3.md`
- `docs/review/evidence/VALIDACAO_SCHEMA_REAL_SOURCE_REFS_12F3.md`
- `docs/review/evidence/MAPA_AJUSTES_PAYLOADS_12F3.md`
- docs ativos de fase/status/roadmap/dominio

Proxima execucao recomendada:
- `12F4 — Adapter/normalizer de payload candidato para schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

---

## 0.1 Resultado anterior — Fase 12F2

Fase 12F2 — Seed/import candidata dos Protocolos Sanitarios v2 — executada localmente como fase documental/importavel candidata.

Decisao: `FASE 12F2 CONCLUIDA COMO ARTEFATO IMPORTAVEL CANDIDATO`.

Resultado da 12F2:
- Criado plano principal `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`.
- Criados 5 artefatos de payload candidato em `docs/review/evidence/`.
- 10 protocolos convertidos para payload candidato.
- 19 itens versionados convertidos para payload candidato.
- 4 ProductClassGroups antiparasitarios e 16 membros convertidos para payload candidato.
- RotationRule e SourceRefs field-level convertidos para artefatos documentais candidatos.
- B19 preservada como regra normativa nacional para femeas bovinas e bubalinas de 3 a 8 meses.
- Febre aftosa ficou `archived/blocked` com `productRequirementKind = none`.
- Fragilidades pre-12F3 registradas e parcialmente normalizadas nos payloads candidatos: intervalos ideais sem string, tipo composto removido, `fieldSourceRefs` separado de gaps/politicas e changelog 22->19 documentado.
- Nenhum protocolo recebeu `approved_for_catalog`.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional, migration, seed executada, schema, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

Patch da 12F2:
- `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`
- `docs/review/evidence/SEED_PROTOCOLOS_V2_CANDIDATA_12F2.md`
- `docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md`
- `docs/review/evidence/SEED_PRODUCT_CLASS_GROUPS_CANDIDATA_12F2.md`
- `docs/review/evidence/SEED_ROTATION_RULES_CANDIDATA_12F2.md`
- `docs/review/evidence/SEED_SOURCE_REFS_CANDIDATA_12F2.md`
- docs ativos de fase/status/roadmap/dominio

Proxima execucao recomendada:
- `12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

---

## 0.1 Resultado anterior — Fase 12F1

Fase 12F1 — Normalizacao dos Protocolos Sanitarios v2 em artefato tecnico estruturado — executada localmente como fase documental.

Decisao: `FASE 12F1 CONCLUIDA COMO NORMALIZACAO TECNICA CANDIDATA`.

Resultado da 12F1:
- Criado plano principal `docs/review/PLANO_FASE_12F1_NORMALIZACAO_PROTOCOLOS_V2.md`.
- Criadas evidencias 12F1 para protocolos, itens, ProductClassGroups, rotationRule e sourceRefs por campo.
- 10 protocolos normalizados.
- 19 itens normalizados.
- 4 ProductClassGroups antiparasitarios fechados.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional, migration, seed, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

---

## 0.2 Resultado anterior — Fase 12F0

Fase 12F0 — Estruturacao curatorial dos Protocolos Sanitarios v2 — executada localmente como fase documental.

Decisao: `FASE 12F0 CONCLUIDA COMO CATALOGO CURATORIAL CANDIDATO`.

Resultado da 12F0:
- Criado plano principal `docs/review/PLANO_FASE_12F0_ESTRUTURACAO_CURATORIAL_PROTOCOLOS_SANITARIOS_V2.md`.
- Criadas evidencias 12F0 para protocolos, itens e mapa de fontes/gaps.
- 10 protocolos candidatos classificados.
- 19 itens candidatos estruturados.
- `productRequirementKind` definido por item.
- ProductClass/ProductClassGroup mapeados.
- Nenhum item recebeu `agenda_allowed`.
- Nenhum codigo funcional, migration, seed, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

---

## 0.2 Resultado anterior — Fase 12E5

Fase 12E5 — Hardening final offline/sync sanitario v2 — executada localmente.

Decisao: `PROSSEGUIR PARA 12F APOS VALIDACOES DE GATE`.

Resultado da 12E5:
- Criada store Dexie v26 `sync_pull_cursors`.
- Pull incremental por `updated_at` implementado para Agenda Sanitaria v2, ProductClass v2 e catalogos tecnicos sanitarios v2 que possuem `updated_at`.
- Full fetch inicial preservado quando cursor nao existe.
- Cursor local e por tabela/store/escopo e nao usa `created_at`.
- Tombstones `deleted_at` continuam sendo baixados e preservados localmente.
- Pull global continua sem filtro tenant por `fazenda_id`; pull tenant/fazenda continua com `fazenda_id`.
- `sanitario_produto_fontes_v2` segue em full fetch/merge por nao possuir `updated_at` no contrato implementado.
- Retry de rede de closure preserva `queue_ops` para replay.
- Closure aplicada sai de `queue_ops`; closure rejeitada cria `queue_rejections` com `reason_code`.
- Sucesso parcial de closures mantem aceitas sincronizadas, rejeitadas rastreaveis e roda reconciliacao por `pullSanitarioAgendaV2`.
- Conflito de closure duplicada segue mapeado para `sanitario_agenda_closure_already_exists`.
- `catalog_*` e `state_*` ficam bloqueados como superficie direta de push.
- Agenda v2 e agenda_animais v2 seguem sem push; closures seguem pushaveis apenas sem execucao.
- Nenhum protocolo real, seed, UI, migration, evento executado, estoque, carencia ativa ou liberacao operacional foi criado.

Patch da 12E5:
- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/__tests__/sanitarioIncrementalPullCursor.test.ts`
- `src/lib/offline/__tests__/sanitarioAgendaV2Sync.test.ts`
- `supabase/functions/sync-batch/rules.test.ts`
- docs ativos de fase/status/roadmap/dominio

Validacao:
- `git diff --check`: passou.
- `pnpm test -- src/lib/offline`: passou (26 arquivos, 90 testes).
- `pnpm test -- supabase/functions/sync-batch`: passou antes e depois de `supabase db reset` (3 arquivos, 31 testes).
- `pnpm test -- src/lib/sanitario`: passou (77 arquivos, 849 testes).
- `pnpm run lint`: passou.
- `pnpm run build`: passou com warnings conhecidos de Browserslist/chunks.
- `supabase db reset`: passou.
- `node scripts/codex/validate-supabase-baseline-functional.mjs`: passou.

Proxima execucao recomendada:
- `12F — Estruturacao curatorial dos Protocolos Sanitarios v2`, se o gate 12F permanecer verde.

---

## 0.1 Resultado anterior — Fase 12E4

Fase 12E4 — Agenda Sanitaria v2 offline/sync em escopo controlado — executada localmente.

Decisao: `PROSSEGUIR COM ESCOPO CONTROLADO`.

Resultado da 12E4:
- Criadas stores Dexie v25 `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2` e `ops_sanitario_agenda_closures_v2`.
- Criados tipos locais minimos para as 3 tabelas reais da migration da Agenda Sanitaria v2.
- `tableMap` passou a mapear as tabelas remotas da Agenda v2 para stores locais `ops_*`.
- Implementado pull remoto -> Dexie local em `pullSanitarioAgendaV2(fazenda_id)`.
- Pull usa filtro tenant explicito por `fazenda_id` e nao executa pull global.
- Pull respeita ordem de dependencia: agenda -> animais -> closures.
- Dados sao aplicados por merge/upsert, preservando `updated_at`, `deleted_at`, metadata, `agenda_id`, `animal_id` e `client_op_id`.
- `pullInitialData` passou a executar o pull da Agenda v2 apos ProductClass v2 e catalogo tecnico sanitario v2.
- `createGesture` bloqueia `queue_ops` para `catalog_*`, `sanitario_agenda_v2` e `sanitario_agenda_animais_v2`.
- Push controlado foi habilitado somente para `sanitario_agenda_closures_v2`.
- `sync-batch` reconhece as tabelas da Agenda v2 como tenant-scoped e depende do RLS existente.
- Conflito de closure ativa duplicada e normalizado como `sanitario_agenda_closure_already_exists`.
- Sucesso parcial de gestures compostas apenas por closures preserva closures aceitas e mantem rejeitadas em `queue_ops` com erro rastreavel.
- Reconciliacao pos-sync da Agenda v2 executa novo pull por fazenda.
- ProductClass v2 e catalogo tecnico sanitario v2 permanecem pull-only.
- Nenhuma UI, migration, seed, protocolo estruturado, evento sanitario executado, baixa de estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Patch da 12E4:
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

Validacao:
- `git diff --check`: passou.
- `pnpm test -- src/lib/offline`: passou.
- `pnpm test -- supabase/functions/sync-batch`: passou antes e depois de `supabase db reset`.
- `pnpm test -- src/lib/sanitario`: passou.
- `pnpm run lint`: passou.
- `pnpm run build`: passou com warnings conhecidos de Browserslist/chunks.
- `supabase db reset`: passou.
- `node scripts/codex/validate-supabase-baseline-functional.mjs`: passou.

Proxima execucao recomendada:
- `12E5 — Hardening offline/sync` ou `12F — Estruturacao curatorial dos protocolos`, conforme decisao de gate.

---

## 0.1 Resultado anterior — Fase 12E3

Fase 12E3 — Catalogo tecnico sanitario v2 ampliado em Dexie com pull remoto — executada localmente em escopo reduzido.

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12E3:
- Criadas stores Dexie v24 para as 7 tabelas autorizadas do catalogo tecnico sanitario v2.
- Criados tipos locais minimos para fontes tecnicas, cobertura por campo, produtos, autorizacao por especie, produto-fonte, regras de dose e regras catalogadas de carencia.
- `tableMap` passou a mapear essas 7 tabelas remotas para stores locais `catalog_*`.
- Implementado pull remoto -> Dexie local em `pullSanitarioTechnicalCatalogV2`.
- Pull de fontes tecnicas globais usa `scope = 'global'` e `fazenda_id is null`.
- Pull de fontes tecnicas da fazenda usa `scope = 'fazenda'` e `fazenda_id`, alinhado ao enum real da migration ativa.
- Demais 6 tabelas autorizadas sao baixadas sem filtro tenant artificial por `fazenda_id`.
- Aplicacao local respeita ordem de dependencia e usa merge, preservando `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON.
- Catalogo tecnico sanitario v2 permanece pull-only: nenhum push, nenhuma `queue_ops` e nenhuma chamada de sync-batch foi adicionada.
- `sanitario_produto_carencia_fontes_v2`, protocolos v2 e itens versionados ficaram fora do escopo da 12E3.
- Nenhuma UI, migration, seed, protocolo estruturado, agenda real, estoque, evento real, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Patch da 12E3:
- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Store.test.ts`
- `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Pull.test.ts`
- `src/lib/offline/__tests__/sanitarioProductClassV2Store.test.ts`
- docs ativos de fase/status/roadmap/dominio

Validacao inicial:
- `pnpm test -- src/lib/offline`: passou.

Proxima execucao recomendada:
- `12E4 — Agenda Sanitaria v2 offline/sync em escopo controlado`.

---

## 0.1 Resultado anterior — Fase 12E2

Fase 12E2 — Pull remoto ProductClass v2 para Dexie local — executada localmente em escopo reduzido.

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12E2:
- Implementado pull remoto -> Dexie local para as 4 tabelas ProductClass v2.
- Pull global separado usa `scope = 'global'` e `fazenda_id is null`, sem filtro tenant por fazenda.
- Pull tenant separado usa `scope = 'tenant'` e `fazenda_id` da fazenda atual.
- Aplicacao local respeita ordem de dependencia: classes, grupos, memberships e regras default.
- Dados sao gravados em stores `catalog_*` em modo merge, preservando `deleted_at`, `updated_at`, `metadata`, arrays e JSON.
- ProductClass v2 permanece pull-only: nenhum push, nenhuma `queue_ops` e nenhuma chamada de sync-batch foi adicionada.
- `DEFAULT_REMOTE_TABLES` continua sem ProductClass v2 para impedir filtro tenant padrao em catalogo global.
- `pullInitialData` executa o pull ProductClass v2 apos o pull padrao.
- Baseline P1 ajustado: o validador funcional nao escreve mais agenda sanitaria legada em `agenda_itens`; a etapa sanitaria cria evento/detalhe sanitario diretamente.
- Nenhuma UI, migration, seed, protocolo estruturado, agenda real, estoque, carencia ativa, venda, abate, leite ou aptidao operacional foi implementada.

Patch da 12E2:
- `src/lib/offline/pull.ts`
- `src/lib/offline/__tests__/sanitarioProductClassV2Pull.test.ts`
- `src/lib/offline/__tests__/baselineValidatorContract.test.ts`
- `scripts/codex/validate-supabase-baseline-functional.mjs`
- docs ativos de fase/status/roadmap/dominio

Validacao inicial:
- `pnpm test -- src/lib/offline/__tests__/sanitarioProductClassV2Pull.test.ts`: passou.
- `pnpm test -- src/lib/offline`: passou apos ajuste de mock do teste novo.

Proxima execucao recomendada:
- `12E3 — Catalogo tecnico sanitario v2 ampliado`.

---

## 0.2 Resultado anterior — Fase 12E0

Fase 12E0 — Offline/sync da Fundação Sanitária v2, incluindo ProductClass e Agenda Sanitária v2 (Diagnóstico e Contrato) — executada localmente como patch documental.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12E0:
- Elaborado o diagnóstico técnico e o contrato de offline/sincronização em `docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md`.
- Proposto o mapeamento das 17 estruturas sanitárias v2 do Supabase para novas stores correspondentes no Dexie/IndexedDB (Versão 23).
- Definida a conduta de pull e de push para registros globais (pull-only) e registros tenant (`scope = 'tenant'`).
- Definida a estratégia para soft-delete (com coluna `deleted_at`) e tratamento de conflitos no Sync Worker.
- Mapeado o mecanismo de idempotência por `client_op_id` em caso de re-tentativas de sincronização.
- Recomendada a ordem de subfases curtas: 12E1 (ProductClass Dexie) -> 12E2 (ProductClass sync/P1) -> 12E3 (Catálogo ampliado) -> 12E4 (Agenda Sanitária v2 Dexie/sync).
- Classificada a P1 (baseline do script de validação funcional legada) para ser resolvida na Fase 12E2.
- Nenhum código funcional, UI, Dexie, migrations ou sync-batch foi alterado nesta subfase.

Patch da 12E0:
- `docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md` (novo)

Próxima execução recomendada:
- `12E1 — Dexie schema/stores para ProductClass v2`.

---

## 0.2 Resultado anterior — Fase 12D6

Fase 12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass — executada como migration física Postgres no Supabase em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D6:
- Migration física de banco de dados criada em `supabase/migrations/20260610203500_sanitario_product_class_v2.sql`.
- Tabelas criadas: `sanitario_product_classes_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2` e `sanitario_product_class_default_rules_v2`.
- CHECK constraints de integridade e cardinalidade, tipos de enumerados e JSONB estrutural implementados.
- RLS habilitada em todas as tabelas com policies explícitas de `SELECT` (reutilizando `has_membership`) e de `INSERT`/`UPDATE` com `WITH CHECK` restrito a `owner`/`manager`.
- Triggers `BEFORE INSERT OR UPDATE` para memberships e default rules executando validação e derivação determinística, bloqueando FKs inativas (`deleted_at is not null`).
- Privilégios de DELETE omitidos nos grants; soft-deletion via UPDATE exigido.
- Sem inserção de dados curatoriais, seeds de produto ou UI/Dexie integrados.
- Alterações em sanitaryClassificationsV2.ts e sanitaryProductClassV2.test.ts foram correções mínimas de build/lint, sem mudança de regra sanitária, sem Dexie, sem sync, sem UI e sem alteração de contrato da 12D5.

Patch da 12D6:
- `supabase/migrations/20260610203500_sanitario_product_class_v2.sql` (novo)

Próxima execução recomendada:
- `12E0 — Diagnóstico técnico e contrato de implementação para offline/sync da Fundação Sanitária v2`.

---

## 0.3 Resultado anterior — Fase 12D5

Fase 12D5 — Contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy — executada como implementação funcional pura em TypeScript em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D5:
- Contratos TypeScript de `ProductClassV2` e `ProductClassGroupV2` definidos em `sanitaryProductClassV2.ts`.
- Enums `SanitaryCurationStatusV2`, `SanitaryAutomationStatusV2` e `ExecutionProductPolicyV2` criados.
- Union discriminada estruturada `SanitaryProductRequirementRuleV2` modelada.
- Guards de tipo, validadores puros (`validateProductRequirementRuleV2`, `validateProductClassGroupV2`, `validateProductClassV2`) criados e validados.
- `fixed_by_protocol` bloqueado em nível de validador runtime para `product_class` e `product_class_group`.
- Item de protocolo versionado (`SanitaryProtocolItemVersionV2`) estendido com o campo opcional estruturado `productRequirementRule` em `sanitaryProtocolV2.ts`.
- Validador do item versionado estendido para validar a integridade de `productRequirementRule`, bloquear mismatches com `productRequirementKind` e exigir regra quando kind for `product_class_group`.
- Adicionada validação de coerência profunda entre campos legados (`productClass`, `productId`) e os campos equivalentes dentro da regra estruturada `productRequirementRule`.
- Versionamento semântico (`requiresNewProtocolItemVersionV2`) estendido para detectar alterações estruturadas na regra de produto.
- 18 testes unitários novos criados cobrindo todas as validações, mismatches, versionamento e guards de tipo em `sanitaryProductClassV2.test.ts` e `sanitaryProtocolV2.test.ts`.
- Suíte completa de 900+ testes passou com sucesso absoluto e build limpo executado.

Patch da 12D5:
- `src/lib/sanitario/rules/sanitaryProductClassV2.ts` (novo)
- `src/lib/sanitario/rules/__tests__/sanitaryProductClassV2.test.ts` (novo)
- `src/lib/sanitario/rules/sanitaryProtocolV2.ts` (alterado)
- `src/lib/sanitario/rules/__tests__/sanitaryProtocolV2.test.ts` (alterado)

Não houve:
- migration SQL ou alteração de RLS;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- criação de agenda real, evento real ou baixa de estoque.

---

## 0.2 Resultado anterior — Fase 12D4

Fase 12D4 — Rebaseline conceitual das matrizes sanitárias v2: ProductClass, status curatorial e política de execução — executada como patch documental em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D4:

- modelo canônico `SanitaryProtocol → ProductClass → SanitaryProduct` documentado e aplicado às matrizes;
- `ProductClass` como entidade conceitual central — o item exige uma classe, não um produto;
- `ProductClassDefaultRule` separada com `can_validate_execution = false` e `requires_executed_product_for_withdrawal = true` invariáveis;
- `SanitaryProduct` como exemplo/configuração/execução — nunca obrigatório do protocolo;
- enums canônicos aplicados: `CurationStatus`, `AutomationStatus`, `ExecutionProductPolicy`;
- `approved_for_seed` removido; `approved_for_catalog` substituiu;
- `requires_product_at_execution` saiu de `automation_status`; virou `execution_product_policy`;
- linguagem de bulas corrigida: produto-específica com `scope_note` explícito;
- matriz de produtos separada em Seção A/B/C;
- 12 `ProductClass` definidas; 19 defaults; 4 produtos exemplo;
- relatório de rebaseline 12D4 criado;
- critério de inclusão na matriz de fontes;
- nenhum protocolo promovido para `approved_for_catalog`;
- carência continua atributo do `SanitaryProduct` executado;
- bubalino não herdou bovino.

Patch da 12D4:

- `docs/review/evidence/RELATORIO_REVISAO_12D4_PRODUCT_CLASS_E_STATUS.md` (novo);
- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md` (reescrito);
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md` (reescrito);
- `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` (reescrito);
- `docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md` (reescrito);
- `docs/review/evidence/README_CURADORIA_SANITARIA_V2.md` (reescrito);
- docs ativos de fase, status, decisão e domínio.

Não houve:

- migration SQL ou alteração de RLS;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- alteração de contratos TypeScript 12D1/12D2;
- seed/carga curatorial final;
- criação de agenda, fechamento, evento, baixa de estoque ou carência ativa;
- venda, abate, aptidão operacional, SISBOV, GTA, PNIB ou rastreabilidade animal.

Próxima execução recomendada:

- `12D5 — Schema/contratos ProductClass, defaults e memberships`.

---

## 0.2 Resultado anterior — Fase 12D3

Fase 12D3 — Extração curatorial de protocolos sanitários candidatos v2 para revisão — executada como patch documental em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D3:

- guideline curatorial localizado e consumido como fonte curatorial de casos e estrutura;
- 4 matrizes revisáveis criadas para revisão humana;
- 21 protocolos candidatos com status curatorial e de automação declarados;
- 23 itens versionáveis com dose, via, janela, espécie e limitações classificados;
- 14 produtos/classes candidatos com carências e status de autorização;
- 15 fontes técnicas identificadas — todas `PRECISA_VALIDAR` (nenhuma fonte forte disponível no workspace);
- README curatorial criado para guiar sequência de revisão;
- bubalino não herdou autorização bovina;
- itens experimentais/alerta ficaram bloqueados como `not_automatable_alert`;
- carência zero apenas candidata onde guideline cita explicitamente com norma/bula indicada;
- nenhuma carência foi liberada sem fonte forte;
- nenhuma linha é seed final;
- nenhuma agenda automática foi criada.

Patch da 12D3:

- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md`;
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md`;
- `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md`;
- `docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md`;
- `docs/review/evidence/README_CURADORIA_SANITARIA_V2.md`;
- docs ativos de fase, status, decisão e domínio.

Não houve:

- migration SQL ou alteração de RLS;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- alteração de contratos TypeScript 12D1/12D2;
- seed/carga curatorial final;
- criação de agenda, fechamento, evento, baixa de estoque ou carência ativa;
- venda, abate, aptidão operacional, SISBOV, GTA, PNIB ou rastreabilidade animal.

Próxima execução recomendada:

- `12D4 — Revisão técnico-veterinária das matrizes curatoriais`.

---

## 0.1 Resultado anterior — Fase 12D2

Fase 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2 — executada em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D2:

- builders puros criados para `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot`;
- adapter puro criado para preparar payload técnico futuro de `sanitario_agenda_v2.protocol_item_snapshot` e `sanitario_agenda_v2.produto_snapshot`;
- builders compõem validadores da 12D1 e normalizam fontes por `field_key`;
- snapshot de agenda preserva intenção planejada e não carrega carência ativa;
- snapshot de evento exige produto executado real, dose, via e snapshot de carência;
- produto planejado não vira produto executado automaticamente;
- guideline isolado não valida campo crítico;
- fonte forte precisa cobrir `field_key`;
- bubalino não herda autorização bovina;
- `NAO_AUTORIZADO`, `PRECISA_VALIDAR`, `EXTRAPOLADO`, carência zero, `unknown` e `not_permitted` seguem bloqueados/limitados por contrato;
- testes sentinela dos builders/adapters foram adicionados.

Patch da 12D2:

- `src/lib/sanitario/rules/sanitarySnapshotBuildersV2.ts`;
- `src/lib/sanitario/rules/sanitaryAgendaBridgeV2.ts`;
- `src/lib/sanitario/rules/__tests__/sanitarySnapshotBuildersV2.test.ts`;
- `src/lib/sanitario/rules/__tests__/sanitaryAgendaBridgeV2.test.ts`;
- docs ativos de fase, status, decisão e domínio.

Não houve:

- migration SQL ou alteração de RLS;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- seed/carga curatorial;
- criação de agenda, fechamento, evento, baixa de estoque ou carência ativa;
- venda, abate, aptidão operacional, SISBOV, GTA, PNIB ou rastreabilidade animal.

Próxima execução recomendada:

- 12E — Offline/sync da Fundação Sanitária v2, incluindo ProductClass e Agenda Sanitária v2.

---

Fase 12D1 — Schema e contratos mínimos de Produto, Protocolo e Fonte Técnica v2 — executada em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D1:

- diagnóstico local obrigatório executado com worktree limpo no início;
- guideline curatorial Markdown localizado e usado apenas como referência de casos/estrutura;
- dependências ativas de `produtos_veterinarios`, `protocolos_sanitarios`, `protocolos_sanitarios_itens`, `catalogo_protocolos_oficiais` e `catalogo_protocolos_oficiais_itens` confirmadas em UI/offline/sync/testes;
- legado de produto/protocolo não foi resetado nem limpo;
- migration SQL nova criou persistência v2 em paralelo para fontes técnicas, cobertura por campo, produtos, autorização por espécie, dose/via, carência, protocolos e itens versionados;
- RLS, policies, grants, constraints, índices e comentários foram criados para as estruturas v2;
- contratos TypeScript puros criados para `SanitarySourceRefV2`, `SanitaryProductV2`, `WithdrawalRuleV2`, `SanitaryProtocolV2`, `SanitaryProtocolItemVersionV2`, `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot`;
- validadores puros criados para fonte técnica, cobertura de campo crítico, produto, autorização por espécie, carência, protocolo, item versionado e snapshots;
- testes sentinela cobrem guideline isolado, fonte forte por field_key, carência zero, carência unknown, not_permitted, bubalino sem herança bovina, item alerta/bloqueado, `NAO_AUTORIZADO`, `PRECISA_VALIDAR`, `EXTRAPOLADO`, produto planejado vs executado e snapshots.

Patch da 12D1:

- `supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql`;
- `src/lib/sanitario/rules/sanitarySourceV2.ts`;
- `src/lib/sanitario/rules/sanitaryProductV2.ts`;
- `src/lib/sanitario/rules/sanitaryProtocolV2.ts`;
- `src/lib/sanitario/rules/sanitarySnapshotsV2.ts`;
- testes v2 em `src/lib/sanitario/rules/__tests__/`;
- docs ativos de fase, status, decisão e domínio.

Não houve:

- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- seed/carga curatorial completa;
- criação de agenda, fechamento, evento, baixa de estoque ou carência ativa;
- venda, abate, aptidão operacional, SISBOV, GTA, PNIB ou rastreabilidade animal.

Próxima execução recomendada:

- 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2.

---

Fase 12D0 — Modelo canônico de Protocolo Sanitário v2, Produto e Fonte Técnica — executada documentalmente em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12D0:

- diagnóstico local obrigatório executado com worktree limpo;
- 12B confirmada no histórico local em `555662b`;
- 12C confirmada no histórico local em `06bdf82`;
- guideline curatorial localizado como Markdown em `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`;
- o PDF citado no prompt não foi localizado no workspace;
- guideline usado como fonte de casos reais e matriz estrutural, não como seed final, protocolo automático ou fonte única de campo crítico;
- modelo canônico definido para fonte técnica, produto sanitário, carência, protocolo sanitário, item versionado, elegibilidade, janela operacional e snapshots técnicos;
- regra bovino/bubalino definida: bubalino não herda autorização de bovino por padrão e exige bula, norma ou limitação explícita;
- estados `SIM_BULA`, `SIM_NORMA`, `PRECISA_VALIDAR`, `NAO_AUTORIZADO` e `EXTRAPOLADO` documentados;
- campos críticos como dose, via, carência, espécie autorizada e obrigatoriedade legal exigem fonte forte por campo;
- casos mínimos do guideline registrados para validar o modelo: febre aftosa condicional por UF/zona, brucelose B19, raiva regional, clostridial core, ivermectina com carência, eprinomectina com carência zero, RB51 em bubalinas e Toxocara vitulorum como alerta;
- próxima fase recomendada redefinida para 12D1 — migration/contrato persistido de produto, protocolo e fonte técnica, antes de offline/sync.

Patch da 12D0:

- `docs/review/PLANO_FASE_12D_MODELO_CANONICO_PROTOCOLO_SANITARIO_V2.md`;
- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/context/PROJECT_STATUS.md`;
- `docs/product/DECISION_LOG.md`;
- `docs/domain/SANITARIO.md`.

Não houve:

- migration SQL;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- seed/carga de produtos ou protocolos;
- criação de agenda, evento, baixa de estoque ou carência ativa;
- venda, abate ou aptidão operacional.

Próxima execução recomendada:

- 12D1 — Migration/contrato persistido de produto, protocolo e fonte técnica.

---

Fase 12C — Migration clean da Agenda Sanitária v2 e reset controlado do legado sanitário — executada em escopo reduzido SQL/RLS.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12C:

- diagnóstico local obrigatório executado com worktree limpo;
- 12B confirmada no histórico local em `HEAD 555662b`;
- migration SQL nova criada sem alterar a baseline `00000000000000_rebuild_base_schema_sanitario.sql`;
- criados enums v2 sem reutilizar `agenda_status_enum` e sem status `concluido`;
- criadas `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- criadas constraints mínimas de janela/data, dedup, execução com evento, fechamento sem execução, cancelamento/dispensa com motivo, parcial com payload distinguindo executados e não executados, animal executado com evento e animal não executado com motivo;
- criadas FKs compostas com `fazenda_id` para relações tenant-scoped;
- RLS habilitada e policies por membership criadas;
- grants mínimos para `authenticated` criados nas tabelas/tipos v2;
- `agenda_itens` com `dominio='sanitario'` foi resetado por soft-delete operacional;
- trigger bloqueia nova escrita sanitária legada em `agenda_itens`;
- `sanitario_recompute_agenda_core` foi tornado no-op com validação de membership, impedindo repovoamento sanitário legado;
- fatos executados em `eventos`, `eventos_sanitario` e `insumo_movimentacoes` não foram apagados nem alterados.

Patch da 12C:

- `supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql`;
- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/context/PROJECT_STATUS.md`;
- `docs/product/DECISION_LOG.md`;
- `docs/domain/SANITARIO.md`.

Não houve:

- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- alteração de seed funcional;
- criação de evento real;
- baixa de estoque;
- cálculo de carência ativa;
- venda, abate ou aptidão operacional.

Próxima execução recomendada:

- 12D — Contrato offline/sync da Agenda Sanitária v2, com stores/intents e sentinelas de sync antes de conectar UI/Registrar/Agenda.

---

Fase 12B — Modelagem clean da persistência sanitária v2 com liberdade de reset — executada documentalmente em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12B:

- diagnóstico local obrigatório executado com worktree limpo;
- 12A confirmada no histórico local em `HEAD dd441b0`;
- decisão clean/reset registrada como substituição da direção transitória da 12A;
- modelo recomendado definido com estruturas dedicadas para agenda sanitária v2, animais planejados e closures administrativos;
- `agenda_itens` sanitário classificado como legado descartável, não como superfície sanitária alvo;
- `state_agenda_itens` sanitário, filas antigas incompatíveis, payload/dedup/status sanitário legado e seeds/demo sanitários obsoletos classificados como resetáveis;
- `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, protocolos históricos e catálogos técnicos usados por eventos reais classificados como preservação obrigatória;
- idempotência definida por `agenda_intent`, `event_execution_intent`, `agenda_closure_intent`, `client_op_id` e `dedup_key`;
- requisitos RLS/multi-tenant, Dexie/offline-first e sync-batch futuro documentados;
- testes sentinela futuros definidos para retry, replay, conflitos, reset e preservação de fatos.

Patch da 12B:

- `docs/review/PLANO_FASE_12B_MODELAGEM_CLEAN_PERSISTENCIA_SANITARIA_V2.md`;
- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/context/PROJECT_STATUS.md`;
- `docs/product/DECISION_LOG.md`.

Não houve:

- migration;
- alteração de enum/tabela/FK/RLS/RPC/Edge Function;
- alteração de sync-batch;
- alteração de Dexie;
- alteração de UI;
- alteração de seed;
- evento real;
- baixa de estoque;
- cálculo de carência ativa;
- venda, abate ou aptidão operacional.

Próxima execução recomendada:

- 12C — Migration clean da Agenda Sanitária v2 e reset controlado do legado sanitário, sem UI ampla, sem Dexie completo e sem sync-batch completo.

---

Fase 12A — Auditoria do fluxo legado e decisão de schema da Agenda Sanitária v2 — executada documentalmente em escopo reduzido.

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Resultado da 12A:

- diagnóstico local obrigatório executado com worktree limpo;
- 11.5J confirmada no histórico local em `HEAD 5ab4adb`;
- fluxo legado confirmado: `protocolos_sanitarios_itens -> sanitario_recompute_agenda_core -> agenda_itens/state_agenda_itens -> conclusão/registro -> eventos -> eventos_sanitario -> insumo_movimentacoes`;
- `agenda_itens` confirmado como superfície mista de domínios, com `status='agendado'|'concluido'|'cancelado'`;
- `source_evento_id` confirmado como vínculo factual de agenda encerrada por execução real;
- `status='concluido'` confirmado como ambíguo e insuficiente para `completed` sanitário v2;
- baixa de estoque confirmada como derivada de evento real via `insumo_movimentacoes`, não de agenda;
- contratos 11.5 (`agenda_intent`, `event_execution_intent`, `agenda_closure_intent`) confirmados como core puro sem persistência real;
- decisão de schema recomendada: criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória;
- matriz de dados legados, requisitos de idempotência, RLS/multi-tenant, Dexie/offline-first e testes sentinela futuros documentados.

Patch da 12A:

- `docs/review/PLANO_FASE_12A_AUDITORIA_FLUXO_LEGADO_SCHEMA_SANITARIO.md`;
- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/context/PROJECT_STATUS.md`;
- `docs/product/DECISION_LOG.md`.

Não houve:

- migration;
- alteração de enum/tabela/FK/RLS/RPC/Edge Function;
- alteração de sync-batch;
- alteração de Dexie;
- alteração de UI;
- alteração de seed;
- evento real;
- baixa de estoque;
- cálculo de carência ativa;
- venda, abate ou aptidão operacional.

Próxima execução recomendada à época:

- 12B — Desenho técnico persistido. A diretriz posterior da 12B autorizou modelagem clean/reset sem compatibilidade reversa com a agenda sanitária legada.

---

Fase 11.5J — Rebaseline Estratégico do Roadmap Técnico — executada documentalmente.

Resultado da 11.5J:

- roadmap técnico reordenado após a consolidação da Agenda Sanitária v2;
- Fase 12 redefinida como Fundação Sanitária v2: Persistência, Sync, Schema e Rollout;
- Fase 13 definida como Reprodução Operacional v1;
- Compra/Venda Operacional movida para Fase 14;
- Relatórios/KPIs Operacionais Read-only Ampliados movidos para Fase 15;
- Financeiro Gerencial Explícito movido para Fase 16;
- Motor de Decisão Assistida movido para Fase 17;
- Beta Externo / SLC / Hardening de Produto movido para Fase 18;
- Fase 12 permanece não iniciada.

Justificativa técnica:

- Compra/Venda não deve avançar antes da aplicação real dos contratos sanitários v2;
- Reprodução é domínio estrutural ausente e deve anteceder KPIs, financeiro e decisão assistida;
- KPIs e financeiro dependem de fontes consolidadas, períodos e limitações explícitas;
- decisão assistida depende de dados confiáveis e limites claros de não autorização automática.

Trilhas residuais contínuas:

- higiene test/build/DX;
- hardening sanitário residual das Fases 5/6;
- docs reconciliation;
- compliance regulatório avançado;
- performance de eventos/paginação;
- UX incremental sem regra crítica.

Validações locais da 11.5J:

```txt
git status --short --untracked-files=all: passou antes do patch; worktree limpo.
git status -sb: main...origin/main [ahead 4].
git log --oneline -8: HEAD f9532a8; 11.5G, 11.5H e 11.5I confirmadas no histórico recente.
git rev-parse --short HEAD: f9532a8.
git diff --check: passou antes do patch.
git diff --cached --check: passou antes do patch.
```

Validações pós-patch:

```txt
git diff --check: passou.
git diff --cached --check: passou.
git status --short --untracked-files=all: passou, com apenas documentos permitidos alterados.
```

Próxima execução:

- Preparar Fase 12 — Fundação Sanitária v2 somente em nova rodada, após commit da 11.5J e atualização explícita do plano ativo.

---

Fase 11.5H — Fechamento e handoff — concluída localmente como etapa documental e de validação.

Resultado da 11.5H:

- Fase 11.5 consolidada como fechada localmente;
- contratos 11.5A, 11.5B0, 11.5B1, 11.5B1.1, 11.5C, 11.5D, 11.5E, 11.5F e 11.5G preservados como concluídos;
- contrato final `Protocolo -> regra/produto com fonte técnica -> janela -> elegibilidade -> demanda -> preview -> agenda_intent -> event_execution_intent -> agenda_closure_intent` registrado como core puro/documental;
- Agenda preservada como intenção/tarefa futura;
- Evento preservado como fato histórico executado;
- fechamento administrativo preservado como estado da intenção, sem criar histórico sanitário;
- `completed` sanitário preservado como dependente de evento compatível;
- baixa de estoque preservada como dependente de evento real;
- carência preservada como dependente de produto executado e fonte técnica explícita;
- venda, abate e aptidão operacional continuam bloqueados sem fonte técnica explícita;
- persistência real, sync, schema, RLS, RPC, Edge Functions, Dexie, UI e seed permaneceram fora da 11.5H;
- Fase 12 não foi iniciada.

Riscos residuais aceitos:

- contratos core ainda não estão conectados à persistência real;
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` ainda não são aplicados em Supabase/Dexie/sync;
- fluxo legado de agenda precisa ser auditado antes de migration/constraint;
- `status='concluido'` legado permanece semanticamente ambíguo até futura migração;
- integração offline-first exigirá idempotência real, replay, rollback e sucesso parcial;
- RLS/multi-tenant precisam ser validados antes de qualquer persistência remota;
- estoque e carência precisam continuar derivados de evento real/produto executado, não de agenda.

Critério para preparar Fase 12:

- worktree limpo;
- 11.5H commitada;
- plano ativo apontando para Fase 12;
- novo diagnóstico local;
- auditoria do fluxo legado de agenda;
- decisão explícita sobre schema/migrations, Dexie/local-first, sync-batch, Supabase/RLS, RPC/Edge Function, UI, rollback/replay, idempotência real e tratamento de dados existentes/reset.

Validações locais da 11.5H:

```txt
git status --short --untracked-files=all: passou; worktree limpo antes do patch.
git status -sb: main...origin/main [ahead 2].
git log --oneline -5: HEAD 178c592 e commits 11.5C-11.5G confirmados.
git rev-parse --short HEAD: 178c592.
git diff --check: passou antes do patch.
git diff --cached --check: passou antes do patch.
```

Validações pós-patch:

```txt
git diff --check: passou.
pnpm test -- src/lib/sanitario: passou, 70 arquivos, 769 testes.
pnpm test: primeira execução estourou timeout do runner em ~183s e morreu com EPIPE, sem falha de teste conclusiva; repetida com timeout maior e passou, 268 arquivos, 1880 testes.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite desatualizado e chunks grandes.
git status --short --untracked-files=all: passou, com apenas documentos da 11.5H alterados.
```

Próxima execução:

- Preparar Fase 12 somente em nova rodada, após commit da 11.5H e atualização explícita do plano ativo.

---

Fase 11.5G — Semântica final de fechamento da agenda — concluída localmente em core puro.

Resultado da 11.5G:

- core puro criado em `src/lib/sanitario/agenda/sanitaryAgendaClosure.ts`;
- testes focados criados em `src/lib/sanitario/agenda/__tests__/sanitaryAgendaClosure.test.ts`;
- `createSanitaryAgendaClosureCommand` gera comando/intenção `agenda_closure_intent`;
- fechamento administrativo cobre execução total com evento, execução parcial com evento, fechamento sem execução, cancelamento e dispensa;
- execução total/parcial exige `SanitaryEventExecutionCommand` compatível com `agendaCommand.dedupKey`;
- execução total exige todos os animais planejados executados;
- execução parcial preserva animais planejados não executados com motivo;
- fechamento sem execução, cancelamento e dispensa rejeitam evento informado por engano;
- fechamento executado rejeita animal executado fora do escopo planejado;
- fechamento parcial rejeita execução total classificada como parcial;
- fechamento sem execução, cancelamento e dispensa exigem motivo;
- `closedAt` é obrigatório, validado e recebido por parâmetro;
- `dedupKey` é determinística e não usa `productName` nem `loteName`;
- resultado declara `createsEvent: false`, `persistsEvent: false`, `createsHistoricalFact: false`, `createsInventoryMovement: false` e `calculatesWithdrawal: false`;
- não houve Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch, seed, persistência de agenda/evento, fechamento real no banco, baixa de estoque, carência ativa ou autorização de venda/abate.

Validação local da 11.5G:

```txt
pnpm test -- src/lib/sanitario/agenda: passou, 34 testes.
pnpm test -- src/lib/sanitario: passou, 769 testes.
pnpm test: passou, 1880 testes.
pnpm run lint: passou.
pnpm run build: passou.
```

Próxima execução:

- 11.5H — Fechamento e handoff.

---

Fase 11.5F — Execução sanitária como evento — concluída localmente em escopo reduzido.

Resultado da 11.5F:

- core puro criado em `src/lib/sanitario/execution/sanitaryEventExecution.ts`;
- testes focados criados em `src/lib/sanitario/execution/__tests__/sanitaryEventExecution.test.ts`;
- `createSanitaryEventExecutionCommand` gera comando/intenção `event_execution_intent` para execução sanitária como evento futuro;
- contrato aceita vínculo com agenda materializada ou execução manual com protocolo explícito;
- `occurredAt` é obrigatório e rejeita data/data-hora inválida;
- animais executados são deduplicados e ordenados;
- execução parcial exige motivo para animais planejados não executados;
- execução vinculada rejeita animal fora do escopo planejado;
- `dedupKey` é determinística, considera `productId`/`productClass` e não depende de `productName` ou `loteName`;
- vínculo com `agendaDedupKey`, `previewGroupId` e `sourceDemandKey` é preservado quando houver origem;
- resultado declara `createsEvent: true`, `persistsEvent: false`, `createsAgenda: false`, `closesAgenda: false` e `createsInventoryMovement: false`;
- não houve Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch, seed, persistência de evento, fechamento de agenda, baixa de estoque, carência ativa ou autorização de venda/abate.

Validação local da 11.5F:

```txt
pnpm test -- src/lib/sanitario/execution: passou.
pnpm test -- src/lib/sanitario: passou.
pnpm test: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
git diff --check: passou.
git status --short --untracked-files=all: passou, com arquivos da 11.5F criados/alterados.
```

Próxima execução:

- 11.5G — Semântica final de fechamento da agenda.

---

Fase 11.5D — Preview operacional editável — concluída localmente.

Resultado da 11.5D:

- core puro criado em `src/lib/sanitario/preview/sanitaryOperationalPreview.ts`;
- testes focados criados em `src/lib/sanitario/preview/__tests__/sanitaryOperationalPreview.test.ts`;
- `createSanitaryOperationalPreview` consome demanda agrupada já recebida por parâmetro;
- preview gera grupos operacionais apenas quando há `actionableAnimalIds`;
- `insufficient_data` é preservado como bloqueio/cadastro pendente;
- bloqueios preservam identidade operacional por protocolo, item, produto, classe, ação, lote e janela;
- `not_applicable` não entra como item operacional;
- `previewGroupId` separa `productId` e `productClass` para evitar colisão;
- data sugerida respeita `referenceDate`, `windowStart` e `windowEnd` quando possível;
- campos editáveis são declarados sem persistir agenda, evento ou operação;
- saída é determinística e não muta inputs;
- preview permanece simulação derivada, com `materialization: "none"`;
- não houve Supabase, Dexie, React, UI, storage, RPC, `Date.now()`, migration, schema, RLS, sync-batch, seed, agenda, evento, baixa de estoque, carência ativa ou autorização de venda/abate.

Validação local da 11.5D:

```txt
pnpm test -- src/lib/sanitario/preview: passou.
pnpm test: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
git diff --check: passou.
git status --short --untracked-files=all: passou, com arquivos da 11.5D criados/alterados.
```

Próxima execução:

- 11.5E — Materialização idempotente da agenda sanitária.

---

Fase 11.5C — Demanda sanitária agrupada — concluída localmente.

Resultado da 11.5C:

- core puro criado em `src/lib/sanitario/demand/sanitaryDemand.ts`;
- testes focados criados em `src/lib/sanitario/demand/__tests__/sanitaryDemand.test.ts`;
- `createSanitaryDemandGroupsFromEligibilityResults` agrupa resultados já calculados de elegibilidade;
- `computeSanitaryDemandGroups` pode chamar `computeSanitaryEligibility`, mantendo core puro e `referenceDate` por parâmetro;
- demanda é agrupada por protocolo, item/produto/classe, ação, lote, janela e status derivado;
- nomes de produto e lote foram mantidos como exibição e removidos da identidade primária do grupo para evitar fragmentação por rename/cache offline;
- `insufficient_data` é preservado como pendência de cadastro;
- `not_applicable` é contado, mas excluído de `actionableAnimalIds`;
- limitações agregadas são deduplicadas;
- saída é determinística e não muta inputs;
- demanda permanece leitura derivada, não agenda nem evento, com `materialization: "none"`;
- não houve Supabase, Dexie, React, UI, storage, RPC, `Date.now()`, migration, schema, RLS, sync-batch, seed, agenda, evento, baixa de estoque, carência ativa ou autorização de venda/abate.

Validação local da 11.5C:

```txt
pnpm test -- src/lib/sanitario/demand: passou.
pnpm test: passou.
pnpm run lint: passou.
pnpm run build: passou com warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
git diff --check: passou.
git status --short --untracked-files=all: passou, com arquivos da 11.5C criados/alterados.
```

Próxima execução:

- 11.5D — Preview operacional editável.

---

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

---

Fase 11.5B1.1 — Hardening de elegibilidade por dose múltipla e âncora por evento — concluída localmente.

Resultado da 11.5B1.1:

- `requiredDoseCount > 1` não retorna `completed` por contagem genérica de eventos compatíveis;
- enquanto não houver validação explícita de sequência de doses, o motor retorna `unsupported_required_dose_count`;
- janela com âncora `"evento"` exige `anchorEventCriteria` efetivo;
- `anchorEventCriteria: {}` é tratado como critério ausente e retorna `missing_anchor_event_criteria`;
- inputs seguem imutáveis nos testes.

Validação local da 11.5B1.1:

```txt
pnpm test -- src/lib/sanitario/eligibility: passou.
pnpm test: passou.
pnpm run lint: passou.
pnpm run build: passou.
git diff --check: passou.
git status --short --untracked-files=all: passou.
```

Próxima execução:

- 11.5C — Demanda sanitária agrupada.

---

Fase 11.5B1 — Motor puro de elegibilidade sanitária por janela — concluída localmente.

Resultado da 11.5B1:

- motor puro criado em `src/lib/sanitario/eligibility/sanitaryEligibility.ts`;
- testes focados criados em `src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts`;
- `computeSanitaryEligibility` consome animal, `SanitaryProtocolRule`, eventos executados, `referenceDate` e thresholds;
- status cobrem `not_applicable`, `insufficient_data`, `not_yet_eligible`, `eligible_soon`, `in_action_window`, `near_deadline`, `overdue` e `completed`;
- `completed` depende apenas de evento sanitário compatível, executado, não cancelado/deletado, do mesmo animal e não futuro;
- ausência de dados críticos retorna limitações explícitas em vez de inferir histórico;
- agenda, Supabase, Dexie, React, UI, storage, RPC, `Date.now()` e persistência não foram usados.

Validação local da 11.5B1:

```txt
pnpm test -- src/lib/sanitario/eligibility: passou.
pnpm test: passou.
pnpm run lint: passou.
pnpm run build: passou.
git diff --check: passou.
git status --short --untracked-files=all: passou.
```

Próxima execução:

- 11.5B1.1 — Hardening de elegibilidade por dose múltipla e âncora por evento.

---

Fase 11.5B0 — Contrato bibliográfico de regra sanitária e produto — concluída localmente.

Resultado da 11.5B0:

- contratos puros criados em `src/lib/sanitario/rules/sanitaryProtocolRule.ts`;
- contratos cobrem `SourceRef`, `SanitaryProduct`, `WithdrawalRule`, `SanitaryProtocolRule` e `WithdrawalSnapshotOnEvent`;
- validações puras cobrem fonte explícita em regra crítica, guideline isolado, carência do produto, exigência de produto e conclusão por evento executado;
- testes focados criados em `src/lib/sanitario/rules/__tests__/sanitaryProtocolRule.test.ts`;
- não houve motor de elegibilidade, demanda, preview, materialização, evento, cálculo runtime de carência, UI, migration, schema, RLS, sync-batch, seed, RPC, persistência, Supabase ou Dexie.

Validação local da 11.5B0:

```txt
pnpm test -- src/lib/sanitario/rules: passou.
pnpm run lint: passou.
pnpm run build: passou.
git diff --check: passou.
git status --short --untracked-files=all: passou.
```

Próxima execução:

- 11.5B1 — Motor puro de elegibilidade sanitária por janela.

---

Fase 11.5A — Diagnóstico + contrato alvo + teste sentinela de retry/offline/sync — concluída localmente.

Resultado da 11.5A:

- diagnosticar o contrato atual `Protocolo -> Agenda -> Evento`;
- mapear tabelas, stores, tipos, hooks, telas e testes afetados;
- definir contrato alvo da Agenda Sanitária v2;
- registrar decisão sobre substituição/descarte da agenda sanitária antiga;
- definir critérios de idempotência;
- reforçar teste sentinela de retry/offline/sync em `supabase/functions/sync-batch/rules.test.ts`;
- não implementar UI, motor de elegibilidade, preview, materialização, migration, schema ou RPC nesta subfase.

Validação local da 11.5A:

```txt
git diff --check: passou.
git status --short --untracked-files=all: passou.
```

Próxima execução:

- 11.5B0 — Contrato bibliográfico de regra sanitária e produto.

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

Após fechamento da Fase 11, foi criada a Fase 11.5 como etapa extra antes da Fase 12 para redesenho da Agenda Sanitária v2.

A Fase 12 permanece preparada, mas não iniciada.
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
