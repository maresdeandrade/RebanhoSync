# Relatorio 12G - Importador Sanitario v2

## 1. Decisao

Implementado importador controlado dos Protocolos Sanitarios v2 usando exclusivamente `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.

## 2. Arquivos alterados

- `scripts/codex/import-sanitario-protocols-v2.mjs`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`
- `docs/domain/SANITARIO.md`
- `docs/review/evidence/RELATORIO_12G_IMPORTADOR_SANITARIO_V2.md`

## 3. Modos implementados

- `--validate`: somente leitura, valida payload 12F10 e invariantes sanitarias.
- `--dry-run`: consulta banco para lookups reais e emite plano deterministico sem escrita.
- `--apply`: executa upsert transacional somente com `ALLOW_SANITARIO_IMPORT=1`.

## 4. Resultado de validate

`node scripts/codex/import-sanitario-protocols-v2.mjs --validate`: passou.

Confirmado: 10 protocolos, 19 itens, 4 ProductClassGroups, 16 rejeicoes de members e `execute_import=false`.

## 5. Resultado de dry-run

`node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run`: passou.

Dry-run inicial antes do apply: 33 `create`, 0 `update`, 0 `skip`, 16 `reject`.

Dry-run pos-apply: 0 `create`, 0 `update`, 33 `skip`, 16 `reject`.

## 6. Resultado de apply

Apply real executado com `ALLOW_SANITARIO_IMPORT=1`.

Resumo: 33 `create`, 0 `update`, 0 `skip`, 16 `reject`.

O apply preservou `approval_status='draft'`, `allows_agenda_auto=false`, `agenda_allowed=false` e `approved_for_catalog=false`.

## 7. Rejeicoes mantidas

Os 16 members de `sanitario_product_class_group_members_v2` seguem rejeitados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

## 8. Riscos

- A carga aplicada esta no banco local; `supabase db reset` remove esses 33 registros e volta o dry-run para 33 `create`.
- A proxima leitura deve permanecer read-only e sem agenda automatica.
- ProductClassGroup members continuam pendentes ate existirem `class_id` reais.

## 9. Proximo passo

Conectar leitura read-only dos protocolos sanitarios v2 ao catalogo/local/offline: listar protocolos, listar itens por protocolo e confirmar B19, aftosa e antiparasitarios sem agenda automatica.
