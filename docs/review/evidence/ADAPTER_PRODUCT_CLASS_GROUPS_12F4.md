# Adapter ProductClassGroups — 12F4

## Decisao

Os 4 grupos antiparasitarios sao adaptaveis para `sanitario_product_class_groups_v2`.

Os 16 members sao bloqueados para `sanitario_product_class_group_members_v2` ate existir `class_id` real para cada `class_key`.

## Grupos adaptados

```json
{
  "artifact": "sanitario_product_class_groups_v2_adapted_candidate",
  "artifact_version": "12F4.0-candidate",
  "execute_import": false,
  "rows": [
    {
      "group_key": "pcg_antiparasitarios_recria_estrategicos",
      "name": "Antiparasitarios recria estrategicos",
      "scope": "global",
      "fazenda_id": null,
      "requires_mv_for_other_class": true,
      "curation_status": "needs_review",
      "automation_status": "preview_allowed",
      "limitations": ["requires_real_product", "requires_weight", "withdrawal_by_executed_product", "chemical_class_rotation_required"],
      "metadata": {"usage": "recria maio/julho/setembro", "agenda_allowed": false, "approved_for_catalog": false}
    },
    {
      "group_key": "pcg_antiparasitarios_bezerros_pre_desmama",
      "name": "Antiparasitarios bezerros pre-desmama",
      "scope": "global",
      "fazenda_id": null,
      "requires_mv_for_other_class": true,
      "curation_status": "needs_review",
      "automation_status": "manual_only",
      "limitations": ["requires_real_product", "requires_weight_or_label", "requires_mv_or_management_context", "chemical_class_rotation_required"],
      "metadata": {"usage": "pre-desmama situacional", "agenda_allowed": false, "approved_for_catalog": false}
    },
    {
      "group_key": "pcg_antiparasitarios_pre_confinamento",
      "name": "Antiparasitarios pre-confinamento ou pasto vedado",
      "scope": "global",
      "fazenda_id": null,
      "requires_mv_for_other_class": true,
      "curation_status": "needs_review",
      "automation_status": "manual_only",
      "limitations": ["requires_real_product", "requires_weight", "slaughter_withdrawal_requires_executed_product", "chemical_class_rotation_required"],
      "metadata": {"usage": "pre-confinamento/pasto vedado", "agenda_allowed": false, "approved_for_catalog": false}
    },
    {
      "group_key": "pcg_antiparasitarios_matrizes_pre_parto",
      "name": "Antiparasitarios matrizes pre-parto",
      "scope": "global",
      "fazenda_id": null,
      "requires_mv_for_other_class": true,
      "curation_status": "needs_review",
      "automation_status": "manual_only",
      "limitations": ["requires_real_product", "milk_requires_label", "gestation_lactation_requires_label_or_mv", "chemical_class_rotation_required"],
      "metadata": {"usage": "matrizes pre-parto/periparto", "agenda_allowed": false, "approved_for_catalog": false}
    }
  ]
}
```

## Members bloqueados

Todos os members abaixo geram rejeicao `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`:

- `spcgmem_recria_lactonas`;
- `spcgmem_recria_benzimidazois`;
- `spcgmem_recria_imidazotiazoleis`;
- `spcgmem_recria_associacoes`;
- `spcgmem_pre_desmama_lactonas`;
- `spcgmem_pre_desmama_benzimidazois`;
- `spcgmem_pre_desmama_imidazotiazoleis`;
- `spcgmem_pre_desmama_associacoes`;
- `spcgmem_pre_confinamento_lactonas`;
- `spcgmem_pre_confinamento_benzimidazois`;
- `spcgmem_pre_confinamento_imidazotiazoleis`;
- `spcgmem_pre_confinamento_associacoes`;
- `spcgmem_matrizes_lactonas`;
- `spcgmem_matrizes_benzimidazois`;
- `spcgmem_matrizes_imidazotiazoleis`;
- `spcgmem_matrizes_associacoes`.

## Metadata candidata para lookup futuro

```json
{
  "lactonas_macrociclicas": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"],
  "benzimidazois": ["albendazol", "fenbendazol", "oxfendazol"],
  "imidazotiazoleis": ["levamisol"],
  "associacoes_antiparasitarias": {
    "member_status": "reserved_candidate",
    "execution_validation": false,
    "requires_own_label": true
  }
}
```

## Regras preservadas

- grupo nao valida execucao;
- produto real obrigatorio na execucao;
- dose exige peso + produto real;
- carencia exige evento + produto executado + snapshot;
- combinacao exige bula propria;
- repetir classe exige justificativa/MV.

