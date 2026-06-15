# Rejeicoes de payloads — 12F4

## Decisao

Rejeicoes sao bloqueios de adapter para impedir import semantica ou tecnicamente incorreto. Elas nao sao incidentes de runtime e nao aplicam seed/import.

## Resumo

| Tipo | Quantidade | Reason code |
|---|---:|---|
| Itens de protocolo | 6 | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| ProductClassGroup members | 16 | `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER` |

## Itens rejeitados

```json
[
  {"id": "spiv2_recria_maio_12f2", "item_key": "recria_maio", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"},
  {"id": "spiv2_recria_julho_12f2", "item_key": "recria_julho", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"},
  {"id": "spiv2_recria_setembro_12f2", "item_key": "recria_setembro", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"},
  {"id": "spiv2_pre_desmama_situacional_12f2", "item_key": "pre_desmama_situacional", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"},
  {"id": "spiv2_pre_confinamento_dose_unica_12f2", "item_key": "pre_confinamento_dose_unica", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"},
  {"id": "spiv2_matrizes_pre_parto_antiparasitario_12f2", "item_key": "matrizes_pre_parto_antiparasitario", "reason": "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"}
]
```

Justificativa: `sanitario_protocolo_itens_versions_v2.product_requirement_kind` aceita apenas `specific_product`, `product_class` e `none`. Converter `product_class_group` para outro valor causaria perda semantica.

## ProductClassGroup members rejeitados

```json
{
  "reason": "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER",
  "blocked_member_count": 16,
  "required_resolution": "resolver class_key para sanitario_product_classes_v2.id antes de qualquer import"
}
```

Justificativa: `sanitario_product_class_group_members_v2` exige `group_id` e `class_id`. O adapter nao inventa UUID e nao cria ProductClass.

## Nao rejeitados

- 10 protocolos: adaptaveis.
- 13 itens sem ProductClassGroup: adaptaveis.
- 4 ProductClassGroups: adaptaveis parcialmente.

## Bloqueios sanitarios preservados

- carencia exige produto real executado;
- dose exige peso + produto real;
- leite exige bula;
- gestacao/lactacao exige bula ou MV;
- bubalino exige fonte explicita;
- repetir classe exige justificativa/MV;
- combinacao exige bula propria.

