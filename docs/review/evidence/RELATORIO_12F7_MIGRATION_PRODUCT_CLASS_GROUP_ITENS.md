# Relatorio 12F7 — Migration ProductClassGroup em Itens

## Decisao

`PASS — 12F7 concluida como migration controlada`.

## Patch tecnico

Migration criada:

- `supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql`

Contrato TS atualizado:

- `src/lib/sanitario/rules/sanitaryProtocolV2.ts`
- `src/lib/sanitario/rules/__tests__/sanitaryProtocolV2.test.ts`

Docs atualizados:

- `docs/review/PLANO_FASE_12F7_MIGRATION_PRODUCT_CLASS_GROUP_ITENS.md`
- `docs/review/evidence/RELATORIO_12F7_MIGRATION_PRODUCT_CLASS_GROUP_ITENS.md`
- docs ativos de fase/status/roadmap/dominio

## Resultado da migration

Implementado:

- enum `sanitario_product_requirement_kind_v2_enum` aceita `product_class_group`;
- coluna `product_class_group_id` criada;
- FK para `sanitario_product_class_groups_v2(id)` criada com `on delete restrict`;
- CHECK de requisito de produto substituido por versao com quatro modalidades;
- indice parcial para `product_class_group_id`;
- trigger de validacao de grupo ativo/escopo/status.

## Regras de escopo implementadas

- Protocolo `global` ou `pack`: aceita apenas ProductClassGroup `global`.
- Protocolo `fazenda`: aceita ProductClassGroup `global` ou `tenant` da mesma fazenda.
- ProductClassGroup deletado bloqueia insert/update.
- ProductClassGroup `blocked`/`archived` bloqueia `allows_agenda_auto=true`.

## Testes

Resultados:

```txt
pnpm test -- src/lib/sanitario/rules
8 arquivos, 111 testes: passou

supabase db reset
passou

pnpm test -- supabase/functions/sync-batch
3 arquivos, 31 testes: passou

pnpm run lint
passou

pnpm run build
passou com warnings conhecidos de Browserslist/chunks
```

## Bloqueios preservados

- Nenhum seed/import real aplicado.
- Nenhum protocolo aprovado.
- Nenhum item promovido para `agenda_allowed`.
- Nenhuma agenda criada.
- Nenhum evento criado.
- Nenhum estoque movimentado.
- Nenhuma carencia ativa criada.
- Nenhum ProductClass criado.
- Nenhum `class_id` inventado.
- Nenhuma conversao de `product_class_group` para `product_class`, `specific_product` ou `none`.

## Riscos remanescentes

- 12F8 ainda precisa revalidar o adapter 12F4/12F5 contra o schema atualizado.
- ProductClassGroup members continuam dependentes de ProductClass reais e `class_id`.
- Seed/import real permanece bloqueado ate fase explicita posterior.

## Proxima fase

`12F8 — Revalidar adapter 12F4/12F5 contra schema atualizado e tentar adaptar os 6 itens antiparasitarios antes rejeitados, ainda sem seed/import real`.
