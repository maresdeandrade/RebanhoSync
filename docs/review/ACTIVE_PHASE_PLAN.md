# ACTIVE_PHASE_PLAN - Fase 12E3

**Status:** Fase 12E3 concluida localmente - catalogo tecnico sanitario v2 ampliado em Dexie com pull remoto.
**Foco:** Base local e pull-only das 7 estruturas autorizadas do catalogo tecnico sanitario v2.
**Criado:** 2026-06-12
**Atualizado:** 2026-06-12
**Plano base:** 12E3 - Catalogo tecnico sanitario v2 ampliado

---

## Objetivo em 1 paragrafo

Executar a Fase 12E3 implementando apenas stores Dexie e pull remoto -> Dexie local para as 7 estruturas autorizadas do catalogo tecnico sanitario v2: fontes tecnicas, cobertura por campo, produtos, autorizacao por especie, vinculo produto-fonte, regras de dose e regras catalogadas de carencia. A fase mantem o catalogo como leitura/cache pull-only, preserva `updated_at`, `deleted_at`, `metadata`, `limitations` e JSON/arrays, e nao implementa push, `queue_ops`, sync-batch, UI, migration, seed, protocolo estruturado, agenda, evento, estoque, carencia ativa, venda, abate, leite ou aptidao operacional.

---

## Decisao 12E3

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementado nesta fase:
- stores Dexie v24 para as 7 tabelas do catalogo tecnico sanitario v2 autorizadas;
- tipos locais minimos para espelhar os campos reais da migration ativa;
- `tableMap` remoto -> local para as 7 estruturas `catalog_*`;
- pull especifico `pullSanitarioTechnicalCatalogV2`;
- pull de `sanitario_fontes_tecnicas_v2` separado por `scope = 'global'` com `fazenda_id is null` e `scope = 'fazenda'` com `fazenda_id` da fazenda atual, conforme enum real da migration;
- pull das demais 6 tabelas sem filtro tenant artificial por `fazenda_id`, delegando leitura acessivel ao RLS e aos vinculos do catalogo;
- aplicacao local em modo merge, sem apagar fisicamente tombstones;
- chamada do pull tecnico sanitario v2 apos ProductClass v2 em `pullInitialData`.

Nao implementado nesta fase:
- `sanitario_produto_carencia_fontes_v2`;
- `sanitario_protocolos_v2`;
- `sanitario_protocolo_itens_versions_v2`;
- push remoto, `queue_ops`, sync-batch, UI, migration, seed, protocolo estruturado, agenda real, evento real, baixa de estoque, carencia ativa, venda, abate, leite ou aptidao operacional.

---

## Evidencia tecnica

Arquivos gerados/alterados:
- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Store.test.ts`
- `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Pull.test.ts`
- `src/lib/offline/__tests__/sanitarioProductClassV2Store.test.ts`
- docs ativos de fase/status/roadmap/dominio

---

## Criterios de aceitacao da fase

- [x] Stores Dexie do catalogo tecnico sanitario v2 criadas.
- [x] Versionamento Dexie atualizado para v24.
- [x] Pull remoto das 7 tabelas autorizadas implementado.
- [x] Pull global de fontes tecnicas nao depende de `fazenda_id`.
- [x] Pull de fonte da fazenda usa `scope = 'fazenda'` e `fazenda_id`.
- [x] Pull respeita ordem de dependencia do catalogo autorizado.
- [x] `deleted_at` e `updated_at` preservados localmente.
- [x] Metadata, limitations, arrays e JSON preservados.
- [x] Bubalino nao herda autorizacao bovina no cache local.
- [x] Nenhum push implementado.
- [x] Nenhum `queue_ops` criado para catalogo tecnico sanitario v2.
- [x] Nenhum sync-batch alterado.
- [x] Nenhuma UI alterada.
- [x] Nenhuma migration criada.
- [x] Nenhum seed criado.
- [x] Nenhum protocolo estruturado, agenda, evento ou carencia ativa criado.
- [x] Testes focados passaram.

## Proxima fase segura

`12E4 - Agenda Sanitaria v2 offline/sync em escopo controlado`
