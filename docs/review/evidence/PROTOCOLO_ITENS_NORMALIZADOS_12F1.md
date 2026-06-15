# Itens de Protocolo Normalizados — 12F1

Atualizado em: 2026-06-14

Artefato documental candidato. Nenhum item é `agenda_allowed`.

## Schema candidato

```json
{
  "item_key": "string",
  "protocol_key": "string",
  "item_version": "0.3-normalized-candidate",
  "action": "vacinacao|vermifugacao|alerta",
  "productRequirementKind": "none|specific_product|product_class|product_class_group",
  "executionProductPolicy": "required_at_execution|not_required",
  "eligibilityRule": {},
  "operationalWindowRule": {},
  "recurrenceRule": {},
  "rotationRuleKey": null,
  "tolerance": {
    "min_interval_days": null,
    "ideal_interval_days": null,
    "max_interval_days": null,
    "grace_window_days": null
  },
  "fieldSourceRefs": {},
  "sourceGaps": [],
  "restrictions": [],
  "automationStatus": "manual_only|preview_allowed|blocked"
}
```

## Itens normalizados

| item_key | protocol_key | productRequirementKind | classe/grupo | executionProductPolicy | operationalWindowRule | recurrenceRule | tolerance | automationStatus |
|---|---|---|---|---|---|---|---|---|
| `b19_femeas_3_8_meses` | `brucelose_b19` | `product_class` | `vacina_brucelose_b19` | `required_at_execution` | `age`, birth+3m a birth+8m, `hard_window=true` | `single_lifetime_dose` | n/a | `manual_only` |
| `clostridial_primovac_dose1` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `required_at_execution` | `hybrid`, idade/produto/MV | `primary_series_dose_1` | n/a | `preview_allowed` |
| `clostridial_primovac_dose2` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `required_at_execution` | `anchor_event`, dose1 executada | `primary_series_dose_2` | min:28, ideal:28-42, max:42, grace:null | `preview_allowed` |
| `clostridial_reforco_anual` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `required_at_execution` | `anchor_event`, última dose | `annual` | min:null, ideal:365, max:null, grace:null | `preview_allowed` |
| `raiva_area_risco_anual` | `raiva_herbivoros` | `product_class` | `vacina_antirrabica_inativada` | `required_at_execution` | `hybrid`, foco/risco/região | `annual_or_campaign` | min:30 para reforço inicial quando aplicável; demais null | `manual_only` |
| `lepto_primovac_dose1` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `required_at_execution` | `hybrid`, produto/risco | `product_defined` | n/a | `manual_only` |
| `lepto_primovac_dose2` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `required_at_execution` | `anchor_event`, dose1 se produto exigir | `product_defined_dose_2` | min:21, ideal:21-30, max:30, grace:null | `manual_only` |
| `lepto_reforco_anual_semestral` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `required_at_execution` | `anchor_event`, última dose/risco | `annual_or_semiannual_by_product_risk` | nulls até produto/MV | `manual_only` |
| `ibr_bvd_primovac_dose1` | `ibr_bvd` | `product_class` | `vacina_ibr_bvd_combinada` | `required_at_execution` | `hybrid`, idade/produto | `primary_series_dose_1` | n/a | `preview_allowed` |
| `ibr_bvd_primovac_dose2` | `ibr_bvd` | `product_class` | `vacina_ibr_bvd_combinada` | `required_at_execution` | `anchor_event`, dose1 | `primary_series_dose_2` | min:21, ideal:21-30, max:30, grace:null | `preview_allowed` |
| `recria_maio` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `calendar`, maio | `strategic_calendar_may_july_september` | n/a | `preview_allowed` |
| `recria_julho` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `calendar`, julho | `strategic_calendar_may_july_september` | n/a | `preview_allowed` |
| `recria_setembro` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `calendar`, setembro | `strategic_calendar_may_july_september` | n/a | `preview_allowed` |
| `pre_desmama_situacional` | `vermifugacao_pre_desmama` | `product_class_group` | `pcg_antiparasitarios_bezerros_pre_desmama` | `required_at_execution` | `hybrid`, evento/manejo/MV | `situational` | n/a | `manual_only` |
| `pre_confinamento_dose_unica` | `vermifugacao_pre_confinamento_pasto_vedado` | `product_class_group` | `pcg_antiparasitarios_pre_confinamento` | `required_at_execution` | `anchor_event`, entrada confinamento/pasto vedado | `single_or_product_defined` | n/a | `manual_only` |
| `matrizes_pre_parto_antiparasitario` | `matrizes_pre_parto` | `product_class_group` | `pcg_antiparasitarios_matrizes_pre_parto` | `required_at_execution` | `hybrid`, pré-parto/periparto/MV | `season_or_product_defined` | n/a | `manual_only` |
| `matrizes_pre_parto_lepto_reforco_situacional` | `matrizes_pre_parto` | `product_class` | `bacterina_leptospirose` | `required_at_execution` | `hybrid`, risco/produto/MV | `product_defined` | nulls até produto | `manual_only` |
| `fmd_historico_contingencia` | `febre_aftosa` | `none` | n/a, contingência SVO documental bloqueada | `not_required` | `hybrid`, contingência normativa | `contingency_only` | n/a | `blocked` |
| `fmd_bloqueio_vacinacao_rotina` | `febre_aftosa` | `none` | n/a, nenhum produto sugerido na rotina | `not_required` | `hybrid`, status sanitário | `none` | n/a | `blocked` |

## Normalização específica — Brucelose B19

Brucelose B19 possui regra normativa nacional consolidada para fêmeas bovinas e bubalinas de 3 a 8 meses.

```json
{
  "item_key": "b19_femeas_3_8_meses",
  "protocol_key": "brucelose_b19",
  "curationStatus": "needs_review",
  "automationStatus": "manual_only",
  "allowsAgendaAuto": false,
  "agenda_allowed": false,
  "eligibilityRule": {
    "species": ["bovino", "bubalino"],
    "sex": "femea",
    "age_min_months": 3,
    "age_max_months": 8,
    "legal_scope": "nacional"
  },
  "operationalWindowRule": {
    "type": "age",
    "anchor": "birth",
    "min_offset_months": 3,
    "max_offset_months": 8,
    "hard_window": true
  },
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
  "sourceGaps": [
    "requires_mv_habilitado",
    "requires_official_record_flow",
    "requires_marking_when_applicable",
    "requires_executed_product_snapshot",
    "requires_product_catalog_validation"
  ],
  "statusReason": "A regra nacional permite elegibilidade documental, mas a execução operacional ainda exige MV habilitado/responsável, fluxo oficial, marcação quando aplicável, produto real e snapshot técnico."
}
```

## Regras comuns

```json
{
  "allowsAgendaAuto": false,
  "completionRule": "executed_event_compatible_only",
  "withdrawalRule": "informational_until_executed_product_snapshot",
  "freeTextProduct": false,
  "bubalinoRequiresExplicitSource": true
}
```
