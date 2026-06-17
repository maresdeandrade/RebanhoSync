# Relatorio 12I - Catalogo Sanitario v2 offline read-only

## 1. Decisao

Decisao: `12I_CATALOGO_SANITARIO_V2_OFFLINE_READ_ONLY`.

A Fase 12I conectou os Protocolos Sanitarios v2 ja importados pela 12G ao offline-first Dexie em modo pull-only/read-only.

## 2. Arquivos alterados

- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/pull.ts`
- `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`
- testes focados em `src/lib/offline/__tests__/` e `src/lib/sanitario/catalog/__tests__/`
- docs vivos autorizados

## 3. Offline/read-only implementado

- Stores Dexie v27 para `catalog_sanitario_protocolos_v2` e `catalog_sanitario_protocolo_itens_versions_v2`.
- Indices ampliados de `catalog_sanitario_product_class_groups_v2`.
- Pull `pullSanitarioProtocolCatalogV2` para protocolos, itens e ProductClassGroups globais.
- Leitura local Dexie para listar protocolos, itens por protocolo, ProductClassGroups e resumo read-only.

## 4. Validacoes

- Diagnostico inicial confirmou carga 12G aplicada.
- `--validate`: passou.
- `--dry-run`: `summary {"create":0,"update":0,"skip":33,"reject":16}`.
- Testes confirmam 10 protocolos, 19 itens, 4 ProductClassGroups e 16 members bloqueados.
- B19 permanece nacional.
- Aftosa permanece retired/bloqueada.
- Seis itens antiparasitarios usam ProductClassGroup.

## 5. Testes

- `pnpm test -- src/lib/offline/__tests__/sanitarioProtocolCatalogV2Store.test.ts src/lib/offline/__tests__/sanitarioProtocolCatalogV2Pull.test.ts src/lib/offline/__tests__/sanitarioIncrementalPullCursor.test.ts src/lib/sanitario/catalog`: passou.
- `pnpm test -- src/lib/offline`: passou, 28 arquivos e 96 testes.
- `pnpm test -- src/lib/sanitario`: passou, 79 arquivos e 862 testes.
- `pnpm run lint`: passou.
- `pnpm run build`: passou com avisos conhecidos de Browserslist/caniuse-lite e chunks grandes.

## 6. Nao implementado

- Migration, schema, RLS ou Edge Function.
- Novo import, payload ou seed.
- UI ampla.
- Push ou sync-batch de escrita para catalogos.
- `queue_ops` para protocolos, itens ou ProductClassGroups.
- Agenda, evento, estoque, carencia ativa ou liberacao operacional.

## 7. Riscos

- A validacao do pull foi coberta por testes com cliente Supabase mockado; a execucao visual do app ainda deve confirmar o carregamento local em runtime.
- ProductClassGroup members seguem bloqueados ate existir `class_id` real.

## 8. Proximo passo

Conectar o catalogo local a uma superficie UI read-only ou validar o pull no fluxo existente do app, sem agenda automatica.
