# Relatorio - UI read-only do Catalogo Sanitario v2

## Decisao

Criada superficie UI minima para visualizar os Protocolos Sanitarios v2 sincronizados localmente via Dexie.

## Patch

- `src/pages/SanitarioCatalogoV2.tsx`
- `src/pages/__tests__/SanitarioCatalogoV2.test.tsx`
- rota `/protocolos-sanitarios/catalogo-v2`
- entrada read-only na tela existente de Protocolos Sanitarios
- fixtures de teste do catalogo alinhadas aos `family_code` reais da carga 12F10/12G

## UI read-only

A tela usa exclusivamente `readLocalSanitaryProtocolCatalogV2` e `buildSanitaryProtocolCatalogSummaryV2`.

Nao le JSON 12F10 em runtime, nao chama Supabase direto e nao cria agenda, evento, estoque, carencia ativa, demanda, preview ou automacao operacional.

## Validacoes

- B19 nacional/manual_only exibido.
- Aftosa bloqueada/retired exibida.
- Seis itens com `product_class_group` exibidos no resumo e no detalhe por protocolo.
- CTAs operacionais proibidos nao sao renderizados.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --validate`: passou.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run`: `summary {"create":0,"update":0,"skip":33,"reject":16}`.

## Testes

- `pnpm test -- src/lib/sanitario/catalog`: passou.
- `pnpm test -- src/lib/offline`: passou.
- `pnpm test -- src/pages`: passou.
- `pnpm run lint`: passou.
- `pnpm run build`: passou com avisos conhecidos de Browserslist/caniuse-lite e chunks grandes.
- `git diff --check`: passou.

## Riscos

- A tela depende do pull 12I ja ter preenchido o Dexie local.
- ProductClassGroup members continuam bloqueados por ausencia de `class_id` real.

## Proximo passo

Validar a navegacao no app em runtime com Dexie populado e manter a superficie como consulta read-only.
