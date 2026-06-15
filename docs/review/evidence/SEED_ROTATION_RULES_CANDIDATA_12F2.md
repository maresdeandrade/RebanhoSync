# Seed Candidata — RotationRules Antiparasitarios — 12F2

Atualizado em: 2026-06-14
Destino futuro candidato: `sanitario_rotation_rules_v2`

Artefato documental/importavel candidato. RotationRule nao cria agenda, nao substitui produto real e nao libera execucao.

```json
{
  "artifact": "sanitario_rotation_rules_v2_seed_candidate",
  "artifact_version": "12F2.0-candidate",
  "rows": [
    {
      "id": "srrv2_rr_antiparasitario_chemical_class_rotation_v1",
      "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
      "version": "12F2.0-candidate",
      "kind": "chemical_class_rotation",
      "curationStatus": "needs_review",
      "automationStatus": "manual_only",
      "approved_for_catalog": false,
      "agenda_allowed": false,
      "avoid_same_class_consecutively": true,
      "allow_combination_products": true,
      "requires_mv_override_for_repeat_class": true,
      "requires_resistance_context": true,
      "combination_requires_own_label": true,
      "applies_to": [
        "pcg_antiparasitarios_recria_estrategicos",
        "pcg_antiparasitarios_bezerros_pre_desmama",
        "pcg_antiparasitarios_pre_confinamento",
        "pcg_antiparasitarios_matrizes_pre_parto"
      ],
      "fieldSourceRefs": {
        "eligibility": "SRC_EMBRAPA_VERMINOSE",
        "dose": null,
        "route": null,
        "recurrence": "SRC_EMBRAPA_VERMINOSE",
        "withdrawal": null,
        "restrictions": null
      },
      "sourcePolicy": {
        "dose": "requires_executed_product_label",
        "route": "requires_executed_product_label",
        "withdrawal": "requires_executed_product_label",
        "restrictions": "requires_executed_product_label_or_mv",
        "combination_products": "requires_own_label",
        "repeat_class": "requires_mv_override"
      },
      "sourceGaps": [
        "requires_real_product",
        "requires_weight_when_dose_by_kg",
        "requires_resistance_context",
        "requires_mv_override_for_repeat_class"
      ],
      "restrictions": [
        "same_class_consecutively_requires_mv",
        "combination_requires_own_label",
        "milk_requires_label",
        "gestation_lactation_requires_label_or_mv",
        "bubaline_requires_explicit_source"
      ]
    }
  ]
}
```
