# Adapter itens de protocolos v2 — 12F4

## Decisao

13 de 19 itens podem gerar payload adaptado para `sanitario_protocolo_itens_versions_v2`.

6 itens com `productRequirementKind = product_class_group` foram rejeitados para evitar perda semantica.

## Defaults do adapter

```json
{
  "version": 1,
  "status": "draft",
  "allows_agenda_auto": false,
  "protocol_id": "{{lookup sanitario_protocolos_v2.id by family_code}}"
}
```

## Itens adaptaveis

| Item | `item_status` | `action_type` | `product_requirement_kind` |
|---|---|---|---|
| `b19_femeas_3_8_meses` | `obrigatorio` | `vacinacao` | `product_class` |
| `clostridial_primovac_dose1` | `recomendado` | `vacinacao` | `product_class` |
| `clostridial_primovac_dose2` | `recomendado` | `vacinacao` | `product_class` |
| `clostridial_reforco_anual` | `recomendado` | `vacinacao` | `product_class` |
| `raiva_area_risco_anual` | `condicional` | `vacinacao` | `product_class` |
| `lepto_primovac_dose1` | `condicional` | `vacinacao` | `product_class` |
| `lepto_primovac_dose2` | `condicional` | `vacinacao` | `product_class` |
| `lepto_reforco_anual_semestral` | `condicional` | `vacinacao` | `product_class` |
| `ibr_bvd_primovac_dose1` | `recomendado` | `vacinacao` | `product_class` |
| `ibr_bvd_primovac_dose2` | `recomendado` | `vacinacao` | `product_class` |
| `matrizes_pre_parto_lepto_reforco_situacional` | `condicional` | `vacinacao` | `product_class` |
| `fmd_historico_contingencia` | `bloqueado` | `alerta` | `none` |
| `fmd_bloqueio_vacinacao_rotina` | `bloqueado` | `alerta` | `none` |

## Exemplo B19 adaptado

```json
{
  "protocol_id": "{{lookup:brucelose_b19}}",
  "logical_item_key": "b19_femeas_3_8_meses",
  "version": 1,
  "item_status": "obrigatorio",
  "action_type": "vacinacao",
  "product_requirement_kind": "product_class",
  "product_id": null,
  "product_class": "vacina_brucelose_b19",
  "eligibility_rule": {
    "species": ["bovino", "bubalino"],
    "sex": "femea",
    "age_min_months": 3,
    "age_max_months": 8,
    "legal_scope": "nacional"
  },
  "operational_window_rule": {
    "type": "age",
    "anchor": "birth",
    "min_offset_months": 3,
    "max_offset_months": 8,
    "hard_window": true
  },
  "booster_rule": {"recurrenceRule": {"kind": "single_lifetime_dose"}, "tolerance": null},
  "species_authorization": [
    {"species": "bovino", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
    {"species": "bubalino", "source_ref": "SRC_PNCEBT_BRUCELOSE"}
  ],
  "source_refs_by_field": {
    "eligibility": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}],
    "species": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}],
    "sex": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}],
    "age": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}],
    "dose": [{"source_ref": "SRC_BULA_ABORVAC_B19"}],
    "route": [{"source_ref": "SRC_BULA_ABORVAC_B19"}],
    "recurrence": [{"source_ref": "SRC_BULA_ABORVAC_B19"}],
    "restrictions": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}]
  },
  "limitations": [
    "requires_mv_habilitado",
    "requires_official_record_flow",
    "requires_marking_when_applicable",
    "requires_executed_product_snapshot",
    "requires_product_catalog_validation"
  ],
  "snapshot_template": {
    "executionProductPolicy": "required_at_execution",
    "sourceGaps": ["requires_mv_habilitado", "requires_official_record_flow", "requires_marking_when_applicable", "requires_executed_product_snapshot", "requires_product_catalog_validation"],
    "restrictions": ["execution_requires_enabled_veterinarian", "execution_requires_official_record", "execution_requires_real_product_snapshot"],
    "metadata": {"curationStatus": "needs_review", "automationStatus": "manual_only", "agenda_allowed": false, "approved_for_catalog": false}
  },
  "allows_agenda_auto": false,
  "requires_mv_responsavel": true,
  "status": "draft"
}
```

## Exemplo aftosa adaptado

```json
{
  "protocol_id": "{{lookup:febre_aftosa}}",
  "logical_item_key": "fmd_bloqueio_vacinacao_rotina",
  "version": 1,
  "item_status": "bloqueado",
  "action_type": "alerta",
  "product_requirement_kind": "none",
  "product_id": null,
  "product_class": null,
  "eligibility_rule": {"species": ["bovino", "bubalino"], "archived": true},
  "operational_window_rule": {"type": "hybrid", "anchor": "manual_context"},
  "booster_rule": {"recurrenceRule": {"kind": "none"}, "tolerance": null},
  "species_authorization": [
    {"species": "bovino", "source_ref": "SRC_PNEFA_MAPA"},
    {"species": "bubalino", "source_ref": "SRC_PNEFA_MAPA"}
  ],
  "source_refs_by_field": {
    "eligibility": [{"source_ref": "SRC_PNEFA_MAPA"}],
    "restrictions": [{"source_ref": "SRC_PNEFA_MAPA"}]
  },
  "limitations": ["blocked_archived", "routine_vaccination_blocked", "no_product_requirement"],
  "snapshot_template": {
    "executionProductPolicy": "not_required",
    "sourceGaps": ["blocked_archived"],
    "metadata": {"curationStatus": "archived", "automationStatus": "blocked", "agenda_allowed": false, "approved_for_catalog": false, "archived": true}
  },
  "allows_agenda_auto": false,
  "requires_mv_responsavel": false,
  "status": "draft"
}
```

## Itens rejeitados

| Item | Motivo |
|---|---|
| `recria_maio` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| `recria_julho` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| `recria_setembro` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| `pre_desmama_situacional` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| `pre_confinamento_dose_unica` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |
| `matrizes_pre_parto_antiparasitario` | `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` |

## Politica de rejeicao

O adapter nao converte `product_class_group` para `product_class`, `specific_product` ou `none`. Essa conversao perderia semantica sanitaria e poderia sugerir validacao indevida de execucao.

