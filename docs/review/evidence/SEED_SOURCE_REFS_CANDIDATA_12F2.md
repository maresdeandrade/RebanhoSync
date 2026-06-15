# Seed Candidata — SourceRefs Field Level — 12F2

Atualizado em: 2026-06-14
Destino futuro candidato: `sanitario_source_refs_field_level_v2`

Artefato documental/importavel candidato. `sourceRef` e fonte tecnica real ou lacuna explicita. Politica de produto executado fica em `sourcePolicy`.

```json
{
  "artifact": "sanitario_source_refs_field_level_v2_seed_candidate",
  "artifact_version": "12F2.0-candidate",
  "policy": {
    "source_gap_blocks_agenda_allowed": true,
    "critical_gap_blocks_import_activation": true,
    "withdrawal_requires_executed_product": true,
    "bubaline_requires_explicit_source": true,
    "sourceRef_is_not_sourcePolicy": true
  },
  "rows": [
    {
      "id": "ssrfl_b19_femeas_3_8_meses",
      "protocol_key": "brucelose_b19",
      "item_key": "b19_femeas_3_8_meses",
      "fieldSourceRefs": {
        "eligibility": "SRC_PNCEBT_BRUCELOSE",
        "species": "SRC_PNCEBT_BRUCELOSE",
        "sex": "SRC_PNCEBT_BRUCELOSE",
        "age": "SRC_PNCEBT_BRUCELOSE",
        "dose": "SRC_BULA_ABORVAC_B19",
        "route": "SRC_BULA_ABORVAC_B19",
        "recurrence": "SRC_BULA_ABORVAC_B19",
        "restrictions": "SRC_PNCEBT_BRUCELOSE"
      },
      "sourceGaps": ["requires_mv_habilitado", "requires_official_record_flow", "requires_marking_when_applicable", "requires_executed_product_snapshot", "requires_product_catalog_validation"]
    },
    {"id": "ssrfl_clostridial_primovac_dose1", "protocol_key": "clostridioses", "item_key": "clostridial_primovac_dose1", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_FORTRESS7", "route": "SRC_BULA_FORTRESS7", "recurrence": null, "withdrawal": "SRC_BULA_FORTRESS7", "restrictions": null}, "sourceGaps": ["source_gap_age_product", "source_gap_bubalino"]},
    {"id": "ssrfl_clostridial_primovac_dose2", "protocol_key": "clostridioses", "item_key": "clostridial_primovac_dose2", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_FORTRESS7", "route": "SRC_BULA_FORTRESS7", "recurrence": "SRC_BULA_FORTRESS7", "withdrawal": "SRC_BULA_FORTRESS7", "restrictions": null}, "sourceGaps": ["interval_not_generalizable", "source_gap_bubalino"]},
    {"id": "ssrfl_clostridial_reforco_anual", "protocol_key": "clostridioses", "item_key": "clostridial_reforco_anual", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_FORTRESS7", "route": "SRC_BULA_FORTRESS7", "recurrence": "SRC_BULA_FORTRESS7", "withdrawal": "SRC_BULA_FORTRESS7", "restrictions": null}, "sourceGaps": ["source_gap_context", "source_gap_bubalino"]},
    {"id": "ssrfl_raiva_area_risco_anual", "protocol_key": "raiva_herbivoros", "item_key": "raiva_area_risco_anual", "fieldSourceRefs": {"eligibility": "SRC_MAPA_RAIVA_VACINA", "dose": "SRC_PNCRH_RAIVA", "route": "SRC_PNCRH_RAIVA", "recurrence": "SRC_PNCRH_RAIVA", "withdrawal": null, "restrictions": "SRC_PNCRH_RAIVA"}, "sourceGaps": ["requires_risk_area_overlay", "requires_focus_or_perifocus_context", "source_gap_product_withdrawal_snapshot"]},
    {"id": "ssrfl_lepto_primovac_dose1", "protocol_key": "leptospirose", "item_key": "lepto_primovac_dose1", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_LEPTOFERM5", "route": "SRC_BULA_LEPTOFERM5", "recurrence": "SRC_BULA_LEPTOFERM5", "withdrawal": "SRC_BULA_LEPTOFERM5", "restrictions": null}, "sourceGaps": ["source_gap_risk_product", "source_gap_bubalino"]},
    {"id": "ssrfl_lepto_primovac_dose2", "protocol_key": "leptospirose", "item_key": "lepto_primovac_dose2", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_POLIGUARD", "route": "SRC_BULA_POLIGUARD", "recurrence": "SRC_BULA_POLIGUARD", "withdrawal": null, "restrictions": "SRC_BULA_BOVIGEN"}, "sourceGaps": ["source_gap_product_requires_dose2", "source_gap_product_withdrawal_snapshot"]},
    {"id": "ssrfl_lepto_reforco_anual_semestral", "protocol_key": "leptospirose", "item_key": "lepto_reforco_anual_semestral", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_LEPTOFERM5", "route": "SRC_BULA_LEPTOFERM5", "recurrence": "SRC_BULA_LEPTOFERM5", "withdrawal": "SRC_BULA_LEPTOFERM5", "restrictions": "SRC_BULA_BOVIGEN"}, "sourceGaps": ["source_gap_risk_mv"]},
    {"id": "ssrfl_ibr_bvd_primovac_dose1", "protocol_key": "ibr_bvd", "item_key": "ibr_bvd_primovac_dose1", "fieldSourceRefs": {"eligibility": "SRC_BULA_POLIGUARD", "dose": "SRC_BULA_POLIGUARD", "route": "SRC_BULA_POLIGUARD", "recurrence": "SRC_BULA_POLIGUARD", "withdrawal": null, "restrictions": "SRC_BULA_BOVIGEN"}, "sourceGaps": ["source_gap_bubalino", "source_gap_product_withdrawal_snapshot"]},
    {"id": "ssrfl_ibr_bvd_primovac_dose2", "protocol_key": "ibr_bvd", "item_key": "ibr_bvd_primovac_dose2", "fieldSourceRefs": {"eligibility": "SRC_BULA_POLIGUARD", "dose": "SRC_BULA_POLIGUARD", "route": "SRC_BULA_POLIGUARD", "recurrence": "SRC_BULA_POLIGUARD", "withdrawal": null, "restrictions": "SRC_BULA_BOVIGEN"}, "sourceGaps": ["intervalo_produto_especifico", "source_gap_product_withdrawal_snapshot"]},
    {"id": "ssrfl_recria_maio", "protocol_key": "controle_parasitario_recria_5_7_9", "item_key": "recria_maio", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": "SRC_EMBRAPA_VERMINOSE", "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"], "sourcePolicy": "dose, via, carencia e restricoes dependem da bula do produto executado no evento"},
    {"id": "ssrfl_recria_julho", "protocol_key": "controle_parasitario_recria_5_7_9", "item_key": "recria_julho", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": "SRC_EMBRAPA_VERMINOSE", "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"], "sourcePolicy": "dose, via, carencia e restricoes dependem da bula do produto executado no evento"},
    {"id": "ssrfl_recria_setembro", "protocol_key": "controle_parasitario_recria_5_7_9", "item_key": "recria_setembro", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": "SRC_EMBRAPA_VERMINOSE", "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "requires_weight", "requires_real_product"], "sourcePolicy": "dose, via, carencia e restricoes dependem da bula do produto executado no evento"},
    {"id": "ssrfl_pre_desmama_situacional", "protocol_key": "vermifugacao_pre_desmama", "item_key": "pre_desmama_situacional", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": null, "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "source_gap_mv_decision"], "sourcePolicy": "dose, via, carencia e restricoes dependem da bula do produto executado no evento"},
    {"id": "ssrfl_pre_confinamento_dose_unica", "protocol_key": "vermifugacao_pre_confinamento_pasto_vedado", "item_key": "pre_confinamento_dose_unica", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": null, "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "requires_slaughter_withdrawal_review"], "sourcePolicy": "dose, via, carencia e restricoes dependem da bula do produto executado no evento"},
    {"id": "ssrfl_matrizes_pre_parto_antiparasitario", "protocol_key": "matrizes_pre_parto", "item_key": "matrizes_pre_parto_antiparasitario", "fieldSourceRefs": {"eligibility": "SRC_EMBRAPA_VERMINOSE", "dose": null, "route": null, "recurrence": null, "withdrawal": null, "restrictions": null}, "sourceGaps": ["source_gap_executed_product_label", "source_gap_label_or_mv"], "sourcePolicy": "dose, via, carencia, leite, gestacao e lactacao dependem da bula do produto executado e/ou decisao MV auditavel"},
    {"id": "ssrfl_matrizes_pre_parto_lepto_reforco_situacional", "protocol_key": "matrizes_pre_parto", "item_key": "matrizes_pre_parto_lepto_reforco_situacional", "fieldSourceRefs": {"eligibility": null, "dose": "SRC_BULA_POLIGUARD", "route": "SRC_BULA_POLIGUARD", "recurrence": "SRC_BULA_BOVIGEN", "withdrawal": null, "restrictions": "SRC_BULA_BOVIGEN"}, "sourceGaps": ["source_gap_risk_mv", "source_gap_product_withdrawal_snapshot"]},
    {"id": "ssrfl_fmd_historico_contingencia", "protocol_key": "febre_aftosa", "item_key": "fmd_historico_contingencia", "fieldSourceRefs": {"eligibility": "SRC_PNEFA_MAPA", "dose": null, "route": null, "recurrence": "SRC_PNEFA_MAPA", "withdrawal": null, "restrictions": "SRC_PNEFA_MAPA"}, "sourceGaps": ["blocked_archived", "future_use_requires_normative_update"], "restrictions": ["productRequirementKind_none"]},
    {"id": "ssrfl_fmd_bloqueio_vacinacao_rotina", "protocol_key": "febre_aftosa", "item_key": "fmd_bloqueio_vacinacao_rotina", "fieldSourceRefs": {"eligibility": "SRC_PNEFA_MAPA", "dose": null, "route": null, "recurrence": null, "withdrawal": null, "restrictions": "SRC_PNEFA_MAPA"}, "sourceGaps": ["blocked_archived"], "restrictions": ["productRequirementKind_none"]}
  ]
}
```
