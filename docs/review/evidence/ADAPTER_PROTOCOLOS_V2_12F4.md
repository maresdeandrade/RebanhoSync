# Adapter protocolos v2 — 12F4

## Decisao

Todos os 10 protocolos 12F2 sao adaptaveis para `sanitario_protocolos_v2`, desde que passem pelo adapter e nao sejam aplicados como seed nesta fase.

## Payload adaptado proposto

```json
{
  "artifact": "sanitario_protocolos_v2_adapted_candidate",
  "artifact_version": "12F4.0-candidate",
  "execute_import": false,
  "defaults": {
    "scope": "global",
    "fazenda_id": null,
    "version": 1,
    "status": "draft",
    "approval_status": "draft"
  },
  "rows": [
    {
      "family_code": "brucelose_b19",
      "name": "Brucelose B19",
      "scope": "global",
      "fazenda_id": null,
      "species_scope": ["bovino", "bubalino"],
      "jurisdiction_scope": {"country": "BR", "legal_scope": "nacional"},
      "legal_status": "obrigatorio_norma",
      "version": 1,
      "status": "draft",
      "approval_status": "draft",
      "source_refs_snapshot": [
        {"field": "eligibility", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
        {"field": "species", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
        {"field": "sex", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
        {"field": "age", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
        {"field": "dose", "source_ref": "SRC_BULA_ABORVAC_B19"},
        {"field": "route", "source_ref": "SRC_BULA_ABORVAC_B19"},
        {"field": "recurrence", "source_ref": "SRC_BULA_ABORVAC_B19"},
        {"field": "restrictions", "source_ref": "SRC_PNCEBT_BRUCELOSE"}
      ],
      "metadata": {
        "curationStatus": "needs_review",
        "automationStatus": "manual_only",
        "agenda_allowed": false,
        "approved_for_catalog": false,
        "target_sex": "femea",
        "target_aptitudes": ["corte", "leite", "mista"],
        "sourceGaps": ["requires_mv_habilitado", "requires_official_record_flow", "requires_marking_when_applicable", "requires_executed_product_snapshot", "requires_product_catalog_validation"],
        "restrictions": ["execution_requires_enabled_veterinarian", "execution_requires_official_record", "execution_requires_marking_when_applicable", "execution_requires_real_product_snapshot"]
      }
    },
    {"family_code": "clostridioses", "name": "Clostridioses", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "recomendado_tecnico", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "dose", "source_ref": "SRC_BULA_FORTRESS7"}, {"field": "route", "source_ref": "SRC_BULA_FORTRESS7"}, {"field": "recurrence", "source_ref": "SRC_BULA_FORTRESS7"}, {"field": "withdrawal", "source_ref": "SRC_BULA_FORTRESS7"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false, "sourceGaps": ["source_gap_age_product", "source_gap_bubalino"], "restrictions": ["product_specific_label_required", "do_not_generalize_class"]}},
    {"family_code": "raiva_herbivoros", "name": "Raiva dos herbivoros", "scope": "global", "fazenda_id": null, "species_scope": ["bovino", "bubalino"], "jurisdiction_scope": {"requires_regional_overlay": true}, "legal_status": "condicional", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_MAPA_RAIVA_VACINA"}, {"field": "dose", "source_ref": "SRC_PNCRH_RAIVA"}, {"field": "route", "source_ref": "SRC_PNCRH_RAIVA"}, {"field": "recurrence", "source_ref": "SRC_PNCRH_RAIVA"}, {"field": "restrictions", "source_ref": "SRC_PNCRH_RAIVA"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "original_legal_status": "condicional_regional", "sourceGaps": ["requires_risk_area_overlay", "requires_focus_or_perifocus_context", "source_gap_product_withdrawal_snapshot"], "restrictions": ["regional_risk_context_required", "no_agenda_auto"]}},
    {"family_code": "leptospirose", "name": "Leptospirose", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "recomendado_tecnico", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "dose", "source_ref": "SRC_BULA_LEPTOFERM5"}, {"field": "route", "source_ref": "SRC_BULA_LEPTOFERM5"}, {"field": "recurrence", "source_ref": "SRC_BULA_LEPTOFERM5"}, {"field": "withdrawal", "source_ref": "SRC_BULA_LEPTOFERM5"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "sourceGaps": ["source_gap_risk_product", "source_gap_bubalino", "source_gap_product_withdrawal_snapshot"]}},
    {"family_code": "ibr_bvd", "name": "IBR/BVD", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "recomendado_tecnico", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_BULA_POLIGUARD"}, {"field": "dose", "source_ref": "SRC_BULA_POLIGUARD"}, {"field": "route", "source_ref": "SRC_BULA_POLIGUARD"}, {"field": "recurrence", "source_ref": "SRC_BULA_POLIGUARD"}, {"field": "restrictions", "source_ref": "SRC_BULA_BOVIGEN"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false, "sourceGaps": ["source_gap_product_withdrawal_snapshot", "source_gap_bubalino"]}},
    {"family_code": "controle_parasitario_recria_5_7_9", "name": "Controle parasitario estrategico recria 5/7/9", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {"requires_regional_context": true}, "legal_status": "recomendado_tecnico", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_EMBRAPA_VERMINOSE"}, {"field": "recurrence", "source_ref": "SRC_EMBRAPA_VERMINOSE"}, {"field": "restrictions", "source_ref": "SRC_EMBRAPA_VERMINOSE"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "preview_allowed", "agenda_allowed": false, "approved_for_catalog": false, "original_legal_status": "recomendado_tecnico_regional", "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product", "requires_rotation_context", "source_gap_bubalino"]}},
    {"family_code": "vermifugacao_pre_desmama", "name": "Vermifugacao pre-desmama", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "condicional", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_EMBRAPA_VERMINOSE"}, {"field": "restrictions", "source_ref": "SRC_EMBRAPA_VERMINOSE"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "original_legal_status": "situacional_tecnico", "sourceGaps": ["source_gap_executed_product_label", "source_gap_mv_decision", "source_gap_bubalino"]}},
    {"family_code": "vermifugacao_pre_confinamento_pasto_vedado", "name": "Vermifugacao pre-confinamento ou pasto vedado", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "recomendado_tecnico", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_EMBRAPA_VERMINOSE"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "sourceGaps": ["source_gap_executed_product_label", "requires_slaughter_withdrawal_review", "source_gap_bubalino"]}},
    {"family_code": "matrizes_pre_parto", "name": "Matrizes pre-parto", "scope": "global", "fazenda_id": null, "species_scope": ["bovino"], "jurisdiction_scope": {}, "legal_status": "condicional", "version": 1, "status": "draft", "approval_status": "draft", "source_refs_snapshot": [{"field": "eligibility", "source_ref": "SRC_EMBRAPA_VERMINOSE"}], "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false, "original_legal_status": "situacional_tecnico", "target_sex": "femea", "sourceGaps": ["source_gap_executed_product_label", "source_gap_label_or_mv", "source_gap_bubalino"]}},
    {"family_code": "febre_aftosa", "name": "Febre aftosa", "scope": "global", "fazenda_id": null, "species_scope": ["bovino", "bubalino"], "jurisdiction_scope": {"future_use_requires_normative_update": true}, "legal_status": "bloqueado", "version": 1, "status": "retired", "approval_status": "draft", "source_refs_snapshot": [{"field": "restrictions", "source_ref": "SRC_PNEFA_MAPA"}], "metadata": {"curationStatus": "archived", "automationStatus": "blocked", "agenda_allowed": false, "approved_for_catalog": false, "archived": true, "sourceGaps": ["blocked_archived", "future_use_requires_normative_update"], "restrictions": ["routine_vaccination_blocked", "contingency_only", "productRequirementKind_none"]}}
  ]
}
```

## Validacoes

- `agenda_allowed`: zero true.
- `approved_for_catalog`: zero true.
- B19 nacional preservada.
- Aftosa sem produto sugerido e com `status = retired`.

