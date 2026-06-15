# Resultado Validacao — 12F8

## Comando

```bash
node scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs
```

## Saida consolidada

```txt
12F8 sanitario adapter validation
PASS: 167
WARNING: 0
FAIL: 0
```

Execucao final apos atualizacao dos docs vivos:

```txt
12F8 sanitario adapter validation
PASS: 195
WARNING: 0
FAIL: 0
```

## PASS principais

- Migration 12F7 existe e contem enum `product_class_group`.
- Coluna `product_class_group_id` confirmada.
- FK para `sanitario_product_class_groups_v2(id)` confirmada.
- CHECK das quatro modalidades confirmado.
- Trigger de validacao de ProductClassGroup confirmada.
- 4 ProductClassGroups candidatos possuem lookup documental inequivoco por `group_key`.
- 6 itens antiparasitarios antes rejeitados foram adaptados com `product_class_group_id` por lookup.
- `product_id` e `product_class` permanecem `null` nos itens com grupo.
- `allows_agenda_auto=false` em todos os itens adaptados.
- SourceRefs nao contem `null`, `n/a`, `source_gap_*`, politica textual ou decisao MV.
- RotationRule, SourceGaps e SourcePolicy foram preservados em `snapshot_template`.
- ProductClassGroup members continuam bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- B19 e aftosa preservadas.
- Nenhum seed/import, migration nova, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa foi criado.

## Decisao

12F8 aprovada como revalidacao nao destrutiva.

Proxima fase: `12F9 — Gerar payload JSON completo importavel candidato para protocolos/itens/grupos, ainda sem executar import`.
