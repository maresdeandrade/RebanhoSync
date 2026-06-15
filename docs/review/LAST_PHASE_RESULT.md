# Last Phase Result - RebanhoSync

Atualizado em: 2026-06-15

## Resultado mais recente

Fase 12G - Importador controlado dos Protocolos Sanitarios v2 - concluida localmente.

Decisao: `12G_IMPORTADOR_CONTROLADO_PROTOCOLS_SANITARIOS_V2_COM_PAYLOAD_12F10`.

## Resultado

- Criado `scripts/codex/import-sanitario-protocols-v2.mjs`.
- O script consome somente `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.
- Implementados modos `--validate`, `--dry-run` e `--apply`.
- `--apply` exige `ALLOW_SANITARIO_IMPORT=1` e falha sem essa variavel.
- Members de ProductClassGroup continuam bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- Criado o relatorio unico `docs/review/evidence/RELATORIO_12G_IMPORTADOR_SANITARIO_V2.md`.

## Validacao

- `node scripts/codex/import-sanitario-protocols-v2.mjs --validate`: passou.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run`: passou com 33 `create`, 0 `update`, 0 `skip`, 16 `reject`.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --apply` sem flag: bloqueado com erro explicito.

## Nao executado

- import real com `ALLOW_SANITARIO_IMPORT=1`;
- migration, schema, RLS, UI, Dexie, sync ou Edge Function;
- agenda, evento, estoque, carencia ativa ou liberacao operacional;
- ProductClassGroup members.

## Fonte final

Import futuro deve continuar usando exclusivamente:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`

## Proximo passo possivel

Executar `--apply` apenas se houver autorizacao operacional explicita para carga real e ambiente Supabase validado.
