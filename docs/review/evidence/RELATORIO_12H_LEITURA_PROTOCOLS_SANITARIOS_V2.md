# Relatorio 12H - Leitura read-only dos Protocolos Sanitarios v2

## 1. Decisao

12H concluida como leitura read-only dos Protocolos Sanitarios v2 importados pela 12G.

A camada criada consulta as tabelas reais `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2` e `sanitario_product_class_groups_v2`. Ela nao le o JSON canonico 12F10 em runtime e nao cria agenda, evento, estoque, carencia ativa ou liberacao operacional.

## 2. Arquivos alterados

- `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`
- `src/lib/sanitario/catalog/__tests__/sanitaryProtocolCatalogV2.test.ts`
- `docs/review/evidence/RELATORIO_12H_LEITURA_PROTOCOLS_SANITARIOS_V2.md`
- docs vivos de fase/status/roadmap/dominio.

## 3. Leitura implementada

- `listSanitaryProtocolsV2`
- `getSanitaryProtocolV2WithItems`
- `listSanitaryProtocolItemsV2`
- `listSanitaryProductClassGroupsV2`
- `readSanitaryProtocolCatalogV2`
- `buildSanitaryProtocolCatalogSummaryV2`
- `validateSanitaryProtocolCatalogReadOnlyInvariantsV2`

## 4. Resultado esperado da leitura

- 10 protocolos.
- 19 itens.
- 4 ProductClassGroups.
- 16 members ainda bloqueados fora do banco.
- B19 nacional para femeas bovinas e bubalinas de 3 a 8 meses.
- Aftosa `retired`/bloqueada, sem produto.
- 6 itens antiparasitarios usando `product_class_group` com `product_class_group_id`.
- Nenhum item com `allows_agenda_auto=true`.
- Nenhum protocolo aprovado para catalogo.

## 5. Testes e validacoes

- `node scripts/codex/import-sanitario-protocols-v2.mjs --validate`: passou.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run`: passou com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`.
- `pnpm test -- src/lib/sanitario/catalog/__tests__/sanitaryProtocolCatalogV2.test.ts`: passou.
- `pnpm test -- src/lib/sanitario`: passou com 78 arquivos e 860 testes.
- `pnpm run lint`: passou.
- `pnpm run build`: passou, mantendo warnings conhecidos de Browserslist/caniuse-lite e chunks grandes.
- `git diff --check`: passou.

## 6. Rejeicoes mantidas

Os 16 ProductClassGroup members permanecem bloqueados por ausencia de `class_id` real. A 12H nao importou members, nao criou ProductClass e nao usou principio ativo como FK.

## 7. Riscos

- A leitura remota depende de RLS e da carga 12G presente no banco alvo.
- A camada ainda nao foi conectada a UI nem a cache offline.
- `memberImportBlockedCount` permanece resumo de validacao, nao fonte de verdade persistida.

## 8. Proximo passo

Conectar esta leitura a uma superficie read-only ou a pull offline objetivo, listando protocolos e itens sem agenda automatica.
