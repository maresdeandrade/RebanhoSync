# SourceRefs por Campo — 12F1

Atualizado em: 2026-06-14

Artefato documental candidato. Campo crítico sem fonte explícita permanece `sourceGap`.

`sourceRef` é referência técnica real ou lacuna explícita. Política como "produto executado" não é fonte; quando aplicável, fica em `sourcePolicy`.

## Campos obrigatórios

- `eligibility`
- `dose`
- `route`
- `recurrence`
- `withdrawal`
- `restrictions`

## Mapa por protocolo/item

| protocol_key | item_key | eligibility | dose | route | recurrence | withdrawal | restrictions | sourceGaps |
|---|---|---|---|---|---|---|---|---|
| `brucelose_b19` | `b19_femeas_3_8_meses` | `SRC_PNCEBT_BRUCELOSE` | `SRC_BULA_ABORVAC_B19` | `SRC_BULA_ABORVAC_B19` | `SRC_BULA_ABORVAC_B19` | `source_gap_product_withdrawal_snapshot` | `SRC_PNCEBT_BRUCELOSE` | MV/registro oficial/marcação/produto comercial/snapshot |
| `clostridioses` | `clostridial_primovac_dose1` | `source_gap_age_product` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | n/a | `SRC_BULA_FORTRESS7` | `source_gap_bubalino` | produto específico não fixado |
| `clostridioses` | `clostridial_primovac_dose2` | `source_gap_age_product` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `source_gap_bubalino` | intervalo não generalizável |
| `clostridioses` | `clostridial_reforco_anual` | `source_gap_context` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `SRC_BULA_FORTRESS7` | `source_gap_bubalino` | calendário fazenda |
| `raiva_herbivoros` | `raiva_area_risco_anual` | `SRC_MAPA_RAIVA_VACINA` | `SRC_PNCRH_RAIVA` | `SRC_PNCRH_RAIVA` | `SRC_PNCRH_RAIVA` | `source_gap_product_withdrawal_snapshot` | `SRC_PNCRH_RAIVA` | overlay regional/foco/perifoco |
| `leptospirose` | `lepto_primovac_dose1` | `source_gap_risk_product` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `source_gap_bubalino` | sorovar/produto |
| `leptospirose` | `lepto_primovac_dose2` | `source_gap_product_requires_dose2` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `source_gap_product_withdrawal_snapshot` | `SRC_BULA_BOVIGEN` | nem todo produto exige dose 2 |
| `leptospirose` | `lepto_reforco_anual_semestral` | `source_gap_risk_mv` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_LEPTOFERM5` | `SRC_BULA_BOVIGEN` | semestralidade por risco/MV |
| `ibr_bvd` | `ibr_bvd_primovac_dose1` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `source_gap_product_withdrawal_snapshot` | `SRC_BULA_BOVIGEN` | bubalino sem fonte |
| `ibr_bvd` | `ibr_bvd_primovac_dose2` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `source_gap_product_withdrawal_snapshot` | `SRC_BULA_BOVIGEN` | intervalo produto-específico |
| `controle_parasitario_recria_5_7_9` | `recria_maio` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label_or_mv` | produto/peso/carência |
| `controle_parasitario_recria_5_7_9` | `recria_julho` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label_or_mv` | produto/peso/carência |
| `controle_parasitario_recria_5_7_9` | `recria_setembro` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label_or_mv` | produto/peso/carência |
| `vermifugacao_pre_desmama` | `pre_desmama_situacional` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `source_gap_mv_decision` | `source_gap_executed_product_label` | `source_gap_executed_product_label_or_mv` | não universal |
| `vermifugacao_pre_confinamento_pasto_vedado` | `pre_confinamento_dose_unica` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `source_gap_product_or_mv` | `source_gap_executed_product_label` | `source_gap_executed_product_label_or_mv` | carência abate |
| `matrizes_pre_parto` | `matrizes_pre_parto_antiparasitario` | `SRC_EMBRAPA_VERMINOSE` | `source_gap_executed_product_label` | `source_gap_executed_product_label` | `source_gap_product_or_mv` | `source_gap_executed_product_label` | `source_gap_label_or_mv` | gestação/lactação/leite |
| `matrizes_pre_parto` | `matrizes_pre_parto_lepto_reforco_situacional` | `source_gap_risk_mv` | `SRC_BULA_POLIGUARD` | `SRC_BULA_POLIGUARD` | `SRC_BULA_BOVIGEN` | `source_gap_product_withdrawal_snapshot` | `SRC_BULA_BOVIGEN` | regra pré-parto não universal |
| `febre_aftosa` | `fmd_historico_contingencia` | `SRC_PNEFA_MAPA` | n/a | n/a | `SRC_PNEFA_MAPA` | n/a | `SRC_PNEFA_MAPA` | uso rotineiro bloqueado; `productRequirementKind=none` |
| `febre_aftosa` | `fmd_bloqueio_vacinacao_rotina` | `SRC_PNEFA_MAPA` | n/a | n/a | n/a | n/a | `SRC_PNEFA_MAPA` | blocked/archived |

## SourcePolicy separada

| protocol_key | item_key | policy |
|---|---|---|
| `controle_parasitario_recria_5_7_9` | `recria_maio` | dose, via, carência e restrições dependem da bula do produto executado no evento |
| `controle_parasitario_recria_5_7_9` | `recria_julho` | dose, via, carência e restrições dependem da bula do produto executado no evento |
| `controle_parasitario_recria_5_7_9` | `recria_setembro` | dose, via, carência e restrições dependem da bula do produto executado no evento |
| `vermifugacao_pre_desmama` | `pre_desmama_situacional` | dose, via, carência e restrições dependem da bula do produto executado no evento |
| `vermifugacao_pre_confinamento_pasto_vedado` | `pre_confinamento_dose_unica` | dose, via, carência e restrições dependem da bula do produto executado no evento |
| `matrizes_pre_parto` | `matrizes_pre_parto_antiparasitario` | dose, via, carência, leite, gestação e lactação dependem da bula do produto executado e/ou decisão MV auditável |

## Regras

```json
{
  "guideline_alone_promotes_critical_field": false,
  "source_gap_blocks_agenda_allowed": true,
  "withdrawal_requires_executed_product": true,
  "bubaline_requires_explicit_source": true
}
```
