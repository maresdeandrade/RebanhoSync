# Payloads adaptados para schema real — 12F4

## Decisao

Este artefato consolida o resultado do adapter 12F4. Ele e candidato/documental e nao deve ser executado como seed/import.

## Resumo

```json
{
  "artifact": "sanitario_protocolos_v2_schema_real_adapted_bundle",
  "artifact_version": "12F4.0-candidate",
  "execute_import": false,
  "creates_migration": false,
  "creates_runtime_change": false,
  "creates_agenda": false,
  "creates_event": false,
  "creates_stock_movement": false,
  "creates_active_withdrawal": false,
  "allows_operational_release": false,
  "agenda_allowed_count": 0,
  "approved_for_catalog_count": 0,
  "protocols": {"adapted": 10, "rejected": 0},
  "items": {"adapted": 13, "rejected": 6},
  "productClassGroups": {"adapted": 4, "rejected": 0},
  "productClassGroupMembers": {"adapted": 0, "rejected": 16}
}
```

## Payloads adaptaveis

Protocolos:

- `brucelose_b19`;
- `clostridioses`;
- `raiva_herbivoros`;
- `leptospirose`;
- `ibr_bvd`;
- `controle_parasitario_recria_5_7_9`;
- `vermifugacao_pre_desmama`;
- `vermifugacao_pre_confinamento_pasto_vedado`;
- `matrizes_pre_parto`;
- `febre_aftosa`.

Itens:

- `b19_femeas_3_8_meses`;
- `clostridial_primovac_dose1`;
- `clostridial_primovac_dose2`;
- `clostridial_reforco_anual`;
- `raiva_area_risco_anual`;
- `lepto_primovac_dose1`;
- `lepto_primovac_dose2`;
- `lepto_reforco_anual_semestral`;
- `ibr_bvd_primovac_dose1`;
- `ibr_bvd_primovac_dose2`;
- `matrizes_pre_parto_lepto_reforco_situacional`;
- `fmd_historico_contingencia`;
- `fmd_bloqueio_vacinacao_rotina`.

Grupos:

- `pcg_antiparasitarios_recria_estrategicos`;
- `pcg_antiparasitarios_bezerros_pre_desmama`;
- `pcg_antiparasitarios_pre_confinamento`;
- `pcg_antiparasitarios_matrizes_pre_parto`.

## Payloads rejeitados

Itens:

- `recria_maio`;
- `recria_julho`;
- `recria_setembro`;
- `pre_desmama_situacional`;
- `pre_confinamento_dose_unica`;
- `matrizes_pre_parto_antiparasitario`.

Members:

- todos os 16 members 12F2, ate resolucao de `class_id`.

## JSONB final proposto

Protocolos:

- `species_scope`: array de especies;
- `jurisdiction_scope`: objeto de escopo legal/regional;
- `source_refs_snapshot`: array de `{field, source_ref}`;
- `metadata`: status curatoriais, flags, gaps, restrictions, tipo/categoria e preservacao semantica.

Itens:

- `eligibility_rule`: objeto;
- `operational_window_rule`: objeto;
- `booster_rule`: objeto com `recurrenceRule` e `tolerance`;
- `species_authorization`: array com especie e fonte;
- `source_refs_by_field`: objeto campo -> lista de fontes;
- `limitations`: array;
- `snapshot_template`: objeto com policy, gaps, restrictions, rotationRule quando aplicavel e metadata.

ProductClassGroups:

- `limitations`: array de restricoes operacionais;
- `metadata`: uso, flags, rotationRule e principios ativos candidatos quando usados apenas para auditoria.

## Proxima fase

12F5 pode seguir como validacao automatizada do adapter, ainda sem aplicar seed/import. Se 12F5 exigir import real de itens antiparasitarios, ha necessidade previa de decisao estrutural sobre suporte SQL a ProductClassGroup em itens ou outra representacao sem perda semantica.

