# Resultado validacao payload JSON 12F9

Data: 2026-06-15

## Comando principal

```powershell
node scripts/codex/validate-sanitario-complete-payloads-12f9.mjs
```

Resultado:

```text
Resultado 12F9: 543 PASS, 0 WARNING, 0 FAIL
```

## Validacoes cobertas

- JSON parseavel para protocolos, itens, groups e rejeicoes;
- `execute_import=false` em todos os artefatos;
- flags proibidas nao aparecem como `true`;
- contagens 10/19/4/16;
- schema 12F7 presente com `product_class_group`, `product_class_group_id`, FK e trigger;
- B19 preservada;
- aftosa preservada como bloqueada/retired/sem produto;
- 6 itens ProductClassGroup usam `product_class_group_id` por lookup;
- ProductClassGroup members seguem rejeitados sem `class_id`;
- nenhum UUID artificial nas rejeicoes;
- sourceRefs tecnicas sem `null`, `n/a`, `source_gap_*`, politica textual ou decisao MV;
- carencia ativa nao criada.

## Status

12F9 validada localmente como pacote JSON candidato. Nao houve seed/import.

## Gates complementares

```powershell
git diff --check
pnpm test -- src/lib/sanitario/rules
pnpm run lint
pnpm run build
supabase db reset
```

Resultados:

- `git diff --check`: passou;
- `pnpm test -- src/lib/sanitario/rules`: passou, 8 arquivos e 111 testes;
- `pnpm run lint`: passou;
- `pnpm run build`: passou com warnings conhecidos de Browserslist/caniuse-lite desatualizado e chunks grandes;
- `supabase db reset`: passou e aplicou a migration 12F7.
