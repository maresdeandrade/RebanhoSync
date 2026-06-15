# Payloads Adaptados ProductClassGroup — 12F8

## Decisao

Os 6 itens antiparasitarios antes rejeitados podem gerar payload adaptado candidato para `sanitario_protocolo_itens_versions_v2` apos a 12F7, sem converter `product_class_group` para outra modalidade.

Este artefato e documental/candidato. Nao executar como seed/import.

```json
{
  "artifact": "sanitario_protocolo_itens_versions_v2_product_class_group_adapted_candidate",
  "artifact_version": "12F8.0-candidate",
  "execute_import": false,
  "creates_migration": false,
  "creates_runtime_change": false,
  "creates_agenda": false,
  "creates_event": false,
  "creates_stock_movement": false,
  "creates_active_withdrawal": false,
  "allows_operational_release": false,
  "counts": {
    "protocols": {"adapted": 10, "rejected": 0},
    "items": {"adapted": 19, "rejected": 0},
    "productClassGroups": {"adapted": 4, "rejected": 0},
    "productClassGroupMembers": {"adapted": 0, "rejected": 16}
  },
  "lookup_policy": {
    "product_class_group_id": "lookup sanitario_product_class_groups_v2.id by group_key",
    "no_uuid_invention": true,
    "no_group_creation": true,
    "no_member_creation": true
  },
  "rows": [
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=controle_parasitario_recria_5_7_9}}",
      "logical_item_key": "recria_maio",
      "version": 1,
      "item_status": "estrategico",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_recria_estrategicos}}",
      "eligibility_rule": {"species": ["bovino"], "category": "recria"},
      "operational_window_rule": {"type": "calendar", "calendar_months": [5]},
      "booster_rule": {"recurrenceRule": {"kind": "strategic_calendar_may_july_september"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}],
        "recurrence": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "requires_weight",
        "requires_real_product",
        "chemical_class_rotation_required",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "dose": "by_executed_product_and_weight"},
        "restrictions": ["chemical_class_rotation_required", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": false,
      "status": "draft"
    },
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=controle_parasitario_recria_5_7_9}}",
      "logical_item_key": "recria_julho",
      "version": 1,
      "item_status": "estrategico",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_recria_estrategicos}}",
      "eligibility_rule": {"species": ["bovino"], "category": "recria"},
      "operational_window_rule": {"type": "calendar", "calendar_months": [7]},
      "booster_rule": {"recurrenceRule": {"kind": "strategic_calendar_may_july_september"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}],
        "recurrence": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "requires_weight",
        "requires_real_product",
        "chemical_class_rotation_required",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "dose": "by_executed_product_and_weight"},
        "restrictions": ["chemical_class_rotation_required", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": false,
      "status": "draft"
    },
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=controle_parasitario_recria_5_7_9}}",
      "logical_item_key": "recria_setembro",
      "version": 1,
      "item_status": "estrategico",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_recria_estrategicos}}",
      "eligibility_rule": {"species": ["bovino"], "category": "recria"},
      "operational_window_rule": {"type": "calendar", "calendar_months": [9]},
      "booster_rule": {"recurrenceRule": {"kind": "strategic_calendar_may_july_september"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}],
        "recurrence": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "requires_weight",
        "requires_real_product",
        "chemical_class_rotation_required",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "dose": "by_executed_product_and_weight"},
        "restrictions": ["chemical_class_rotation_required", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": false,
      "status": "draft"
    },
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=vermifugacao_pre_desmama}}",
      "logical_item_key": "pre_desmama_situacional",
      "version": 1,
      "item_status": "condicional",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_bezerros_pre_desmama}}",
      "eligibility_rule": {"species": ["bovino"], "category": "bezerro", "requires_mv_or_management_context": true},
      "operational_window_rule": {"type": "hybrid", "anchor": "manual_context"},
      "booster_rule": {"recurrenceRule": {"kind": "situational"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "source_gap_mv_decision",
        "not_universal",
        "requires_real_product",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "source_gap_mv_decision"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "dose": "by_executed_product_label_or_mv"},
        "restrictions": ["not_universal", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": true,
      "status": "draft"
    },
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=vermifugacao_pre_confinamento_pasto_vedado}}",
      "logical_item_key": "pre_confinamento_dose_unica",
      "version": 1,
      "item_status": "estrategico",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_pre_confinamento}}",
      "eligibility_rule": {"species": ["bovino"], "requires_destination_context": true},
      "operational_window_rule": {"type": "anchor_event", "anchor": "manual_context"},
      "booster_rule": {"recurrenceRule": {"kind": "single_or_product_defined"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "requires_slaughter_withdrawal_review",
        "requires_destination_context",
        "requires_real_product",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "requires_slaughter_withdrawal_review"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "slaughter": "requires_executed_product_withdrawal_review"},
        "restrictions": ["withdrawal_requires_executed_product", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "item_status_decision": "estrategico por ser dose unica pre-confinamento/pasto vedado; continua sem agenda automatica"}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": false,
      "status": "draft"
    },
    {
      "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code=matrizes_pre_parto}}",
      "logical_item_key": "matrizes_pre_parto_antiparasitario",
      "version": 1,
      "item_status": "condicional",
      "action_type": "vermifugacao",
      "product_requirement_kind": "product_class_group",
      "product_id": null,
      "product_class": null,
      "product_class_group_id": "{{lookup sanitario_product_class_groups_v2.id by group_key=pcg_antiparasitarios_matrizes_pre_parto}}",
      "eligibility_rule": {"species": ["bovino"], "sex": "femea", "requires_pregnancy_or_peripartum_context": true},
      "operational_window_rule": {"type": "hybrid", "anchor": "parturition"},
      "booster_rule": {"recurrenceRule": {"kind": "season_or_product_defined"}, "tolerance": null},
      "species_authorization": [{"species": "bovino", "source_ref": "SRC_EMBRAPA_VERMINOSE"}],
      "source_refs_by_field": {
        "eligibility": [{"source_ref": "SRC_EMBRAPA_VERMINOSE"}]
      },
      "limitations": [
        "source_gap_executed_product_label",
        "source_gap_label_or_mv",
        "gestation_lactation_requires_label_or_mv",
        "milk_requires_label",
        "requires_real_product",
        "class_group_does_not_validate_execution",
        "withdrawal_by_executed_product"
      ],
      "snapshot_template": {
        "executionProductPolicy": "required_at_execution",
        "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
        "sourceGaps": ["source_gap_executed_product_label", "source_gap_label_or_mv"],
        "sourcePolicy": {"withdrawal": "by_executed_product_snapshot", "milk": "requires_executed_product_label", "gestation_lactation": "requires_label_or_mv"},
        "restrictions": ["gestation_lactation_requires_label_or_mv", "milk_requires_label", "class_group_does_not_validate_execution"],
        "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false}
      },
      "allows_agenda_auto": false,
      "requires_mv_responsavel": true,
      "status": "draft"
    }
  ]
}
```

## Observacoes de adapter

- `pre_confinamento_dose_unica` ficou `estrategico` porque representa manejo pre-confinamento/pasto vedado em dose unica; permanece `draft` e `allows_agenda_auto=false`.
- SourceGaps foram preservados em `limitations` e `snapshot_template.sourceGaps`.
- SourcePolicy foi preservada em `snapshot_template.sourcePolicy`.
- RotationRule foi preservada em `snapshot_template.rotationRuleKey`.
- `source_refs_by_field` contem apenas fontes tecnicas, sem `null`, `n/a`, `source_gap_*`, politica textual ou decisao MV.
