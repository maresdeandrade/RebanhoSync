# Rejeicoes Remanescentes — 12F8

## Decisao

Os 6 itens antiparasitarios antes rejeitados por enum SQL foram reavaliados e agora possuem payload adaptado candidato com `product_class_group_id` por lookup.

Permanece rejeicao dos 16 ProductClassGroup members por ausencia de `class_id` real.

```json
{
  "artifact": "rejeicoes_remanescentes_12f8",
  "artifact_version": "12F8.0-candidate",
  "execute_import": false,
  "items": {
    "rejected": 0,
    "old_reason_count": {
      "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM": 0
    },
    "conditional_reason_if_lookup_unresolved": "PRODUCT_CLASS_GROUP_ID_LOOKUP_UNRESOLVED"
  },
  "productClassGroupMembers": {
    "rejected": 16,
    "reason": "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER",
    "required_resolution": "resolver class_key para sanitario_product_classes_v2.id real antes de qualquer import"
  },
  "blocked_member_keys": [
    "spcgmem_recria_lactonas",
    "spcgmem_recria_benzimidazois",
    "spcgmem_recria_imidazotiazoleis",
    "spcgmem_recria_associacoes",
    "spcgmem_pre_desmama_lactonas",
    "spcgmem_pre_desmama_benzimidazois",
    "spcgmem_pre_desmama_imidazotiazoleis",
    "spcgmem_pre_desmama_associacoes",
    "spcgmem_pre_confinamento_lactonas",
    "spcgmem_pre_confinamento_benzimidazois",
    "spcgmem_pre_confinamento_imidazotiazoleis",
    "spcgmem_pre_confinamento_associacoes",
    "spcgmem_matrizes_lactonas",
    "spcgmem_matrizes_benzimidazois",
    "spcgmem_matrizes_imidazotiazoleis",
    "spcgmem_matrizes_associacoes"
  ]
}
```

## Regras de rejeicao preservadas

O adapter deve rejeitar:

- grupo ausente;
- grupo ambiguo;
- grupo deletado;
- grupo fora de escopo;
- grupo `blocked`/`archived` se houver `allows_agenda_auto=true`;
- ausencia de `productClassGroupKey`;
- tentativa de usar principio ativo como FK;
- tentativa de usar `class_key` como `class_id`;
- tentativa de criar UUID artificial.

## Impacto

Sem seed/import real. Sem insercao em banco. Sem ProductClass criado. Sem ProductClassGroup member criado.
