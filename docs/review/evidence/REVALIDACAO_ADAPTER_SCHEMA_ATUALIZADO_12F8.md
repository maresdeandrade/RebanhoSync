# Revalidacao Adapter contra Schema Atualizado — 12F8

## Decisao

`PASS — adapter 12F4/12F5 revalidado contra schema 12F7`.

## Schema 12F7 confirmado

Migration validada:

- `supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql`.

Elementos confirmados:

- enum SQL aceita `product_class_group`;
- coluna `product_class_group_id` existe em `sanitario_protocolo_itens_versions_v2`;
- FK aponta para `sanitario_product_class_groups_v2(id)`;
- CHECK valida exatamente uma modalidade de requisito;
- trigger `trg_validate_protocol_item_product_class_group_v2` valida grupo ativo, escopo e bloqueio de agenda automatica quando grupo esta `blocked`/`archived`.

## Resultado da revalidacao

```json
{
  "artifact": "revalidacao_adapter_schema_atualizado_12f8",
  "artifact_version": "12F8.0-candidate",
  "execute_import": false,
  "creates_migration": false,
  "creates_runtime_change": false,
  "creates_agenda": false,
  "creates_event": false,
  "creates_stock_movement": false,
  "creates_active_withdrawal": false,
  "allows_operational_release": false,
  "before": {
    "protocols": {"adapted": 10, "rejected": 0},
    "items": {"adapted": 13, "rejected": 6},
    "productClassGroups": {"adapted": 4, "rejected": 0},
    "productClassGroupMembers": {"adapted": 0, "rejected": 16}
  },
  "after": {
    "protocols": {"adapted": 10, "rejected": 0},
    "items": {"adapted": 19, "rejected": 0},
    "productClassGroups": {"adapted": 4, "rejected": 0},
    "productClassGroupMembers": {"adapted": 0, "rejected": 16}
  },
  "agenda_allowed_count": 0,
  "approved_for_catalog_count": 0,
  "allows_agenda_auto_count": 0
}
```

## Lookups ProductClassGroup

Lookups documentais inequivocos:

| `productClassGroupKey` | Saida candidata |
|---|---|
| `pcg_antiparasitarios_recria_estrategicos` | `{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_recria_estrategicos}}` |
| `pcg_antiparasitarios_bezerros_pre_desmama` | `{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_bezerros_pre_desmama}}` |
| `pcg_antiparasitarios_pre_confinamento` | `{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_pre_confinamento}}` |
| `pcg_antiparasitarios_matrizes_pre_parto` | `{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_matrizes_pre_parto}}` |

Nenhum UUID real foi inventado.

## Bloqueios preservados

- ProductClassGroup members continuam rejeitados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- Principios ativos permanecem metadata/documentacao candidata, nao FK.
- `class_key` nao foi convertido em `class_id`.
- ProductClassGroup nao foi convertido para `product_class`, `specific_product` ou `none`.
- Nenhum payload cria carencia ativa.
