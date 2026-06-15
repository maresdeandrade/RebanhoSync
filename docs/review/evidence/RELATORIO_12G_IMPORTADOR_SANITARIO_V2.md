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

Resumo local: 33 `create`, 0 `update`, 0 `skip`, 16 `reject`.

## 6. Resultado de apply

`node scripts/codex/import-sanitario-protocols-v2.mjs --apply` sem `ALLOW_SANITARIO_IMPORT=1`: bloqueado com erro explicito.

Apply real nao foi executado nesta rodada.

## 7. Rejeicoes mantidas

Os 16 members de `sanitario_product_class_group_members_v2` seguem rejeitados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

## 8. Riscos

- Apply real ainda depende de decisao operacional explicita e ambiente Supabase validado.
- Registros globais escritos pelo importador exigem caminho administrativo controlado.
- ProductClassGroup members continuam pendentes ate existirem `class_id` reais.

## 9. Proximo passo

Executar `--apply` somente com autorizacao operacional explicita e `ALLOW_SANITARIO_IMPORT=1`.
