# ACTIVE_PHASE_PLAN - Fase 12E1

**Status:** Fase 12E1 concluida localmente — Dexie schema/stores para ProductClass v2.
**Foco:** Armazenamento local IndexedDB/Dexie das 4 estruturas ProductClass v2, sem sincronizacao remota.
**Criado:** 2026-06-12
**Atualizado:** 2026-06-12
**Plano base:** 12E1 — Dexie ProductClass v2 local storage

---

## Objetivo em 1 paragrafo

Executar a Fase 12E1 criando apenas a base local Dexie/IndexedDB para armazenar offline as entidades de ProductClass v2 criadas na Fase 12D6: classes, grupos, memberships e regras default. A fase prepara cache local `catalog_*` para leitura futura, preservando `scope`, `fazenda_id`, `updated_at`, `deleted_at`, arrays e JSON/metadados, sem implementar pull, push, sync-batch, UI, migration, seed, protocolos, agenda, evento ou carencia ativa.

---

## Decisao 12E1

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementacao autorizada nesta fase:
- adicionar stores Dexie `catalog_sanitario_product_classes_v2`, `catalog_sanitario_product_class_groups_v2`, `catalog_sanitario_product_class_group_members_v2` e `catalog_sanitario_product_class_default_rules_v2`;
- atualizar versionamento Dexie para v23;
- criar tipos locais minimos espelhando as tabelas ProductClass v2;
- mapear remoto -> local no `tableMap` sem incluir no pull inicial;
- criar teste focado de armazenamento local global/tenant.

Implementacao nao autorizada nesta fase:
- alteracao da Edge Function `sync-batch`;
- implementacao de pull remoto ou push remoto;
- alteracao de UI, agenda, evento, estoque ou fluxos operacionais;
- criacao de migrations, seeds ou protocolos reais;
- calculo de carencia ativa ou liberacao de venda, abate, leite ou aptidao operacional.

---

## Evidencia tecnica

Arquivos gerados/alterados:
- `src/lib/offline/db.ts` (alterado)
- `src/lib/offline/types.ts` (alterado)
- `src/lib/offline/tableMap.ts` (alterado)
- `src/lib/offline/__tests__/sanitarioProductClassV2Store.test.ts` (novo)
- `docs/review/ACTIVE_PHASE_PLAN.md` (alterado)
- `docs/review/CURRENT_PHASE_HANDOFF.md` (alterado)
- `docs/review/LAST_PHASE_RESULT.md` (alterado)
- `docs/context/PROJECT_STATUS.md` (alterado)
- `docs/product/ROADMAP.md` (alterado)
- `docs/domain/SANITARIO.md` (alterado)

---

## Criterios de aceitacao da fase

- [x] Stores Dexie/ProductClass v2 criadas.
- [x] Versionamento Dexie atualizado para v23.
- [x] Registros global e tenant sao representaveis localmente.
- [x] `deleted_at` e `updated_at` preservados.
- [x] `metadata`, `limitations`, `species_scope` e `source_refs` preservados localmente.
- [x] Nenhum push implementado.
- [x] Nenhum pull remoto implementado.
- [x] Nenhum sync-batch alterado.
- [x] Nenhuma UI alterada.
- [x] Nenhuma migration criada.
- [x] Nenhum seed criado.
- [x] Nenhum protocolo estruturado, agenda, evento ou carencia ativa criado.
- [x] Teste focado passou.

## Proxima fase segura

`12E2 — Sync/Pull ProductClass v2 e correcao do baseline P1`
