# ProductClassGroups Normalizados — 12F1

Atualizado em: 2026-06-14

Artefato documental candidato. Grupos não são produtos comerciais e não validam execução.

## Membros químicos normalizados

```json
{
  "lactonas_macrociclicas": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"],
  "benzimidazois": ["albendazol", "fenbendazol", "oxfendazol"],
  "imidazotiazoleis": ["levamisol"],
  "associacoes_antiparasitarias": {
    "status": "reserved_candidate",
    "members": [],
    "execution_validation": false,
    "requires_own_label": true
  }
}
```

## Grupos

| group_key | member_groups | usage | automationStatus | restrictions |
|---|---|---|---|---|
| `pcg_antiparasitarios_recria_estrategicos` | lactonas_macrociclicas; benzimidazois; imidazotiazoleis; associacoes_antiparasitarias | recria maio/julho/setembro | `preview_allowed` | produto real, peso, carência por produto, rotação química |
| `pcg_antiparasitarios_bezerros_pre_desmama` | lactonas_macrociclicas; benzimidazois; imidazotiazoleis; associacoes_antiparasitarias | pré-desmama situacional | `manual_only` | idade/peso mínimos por bula, MV/manejo, produto real |
| `pcg_antiparasitarios_pre_confinamento` | lactonas_macrociclicas; benzimidazois; imidazotiazoleis; associacoes_antiparasitarias | pré-confinamento/pasto vedado | `manual_only` | abate/carência, produto real, peso, destino |
| `pcg_antiparasitarios_matrizes_pre_parto` | lactonas_macrociclicas; benzimidazois; imidazotiazoleis; associacoes_antiparasitarias | matrizes pré-parto/periparto | `manual_only` | leite, gestação/lactação, produto real, MV quando necessário |

## Bloqueios estruturais

```json
{
  "withdrawal_requires_executed_product": true,
  "dose_requires_weight_and_executed_product": true,
  "milk_requires_label": true,
  "gestation_lactation_requires_label_or_mv": true,
  "bubaline_requires_explicit_source": true,
  "repeat_class_requires_mv_justification": true,
  "combination_requires_own_label": true,
  "associations_status": "reserved_candidate",
  "associations_validate_execution_without_label": false,
  "class_group_can_validate_execution": false
}
```

## Status

Nenhum grupo está `approved_for_catalog` na 12F1. Todos permanecem candidatos normalizados para futura revisão/importação.
