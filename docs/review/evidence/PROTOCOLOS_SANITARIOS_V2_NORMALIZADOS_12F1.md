# Protocolos Sanitários v2 Normalizados — 12F1

Atualizado em: 2026-06-14

Artefato documental candidato. Não é seed, migration, import aplicado, agenda ou automação.

## Schema candidato

```json
{
  "protocol_key": "string",
  "name": "string",
  "category": "controle_doencas|imunizacao|controle_parasitario|manejo_sanitario|alerta",
  "type": "vacina|antiparasitario|manejo_sanitario|alerta",
  "target_species": [],
  "target_aptitudes": [],
  "legal_status": "obrigatorio_norma|condicional_regional|recomendado_tecnico|situacional_tecnico|archived",
  "curationStatus": "candidate|needs_review|approved_for_catalog|blocked|archived",
  "automationStatus": "manual_only|preview_allowed|agenda_allowed|blocked",
  "is_core": false,
  "is_conditional": false,
  "is_legal_required": false,
  "fieldSourceRefs": {},
  "sourceGaps": [],
  "restrictions": []
}
```

## Protocolos

| protocol_key | type | target_species | legal_status | curationStatus | automationStatus | fieldSourceRefs principais | restrictions |
|---|---|---|---|---|---|---|---|
| `brucelose_b19` | `vacina` | `bovino_femea`, `bubalino_femea` | `obrigatorio_norma` | `needs_review` | `manual_only` | eligibility:`SRC_PNCEBT_BRUCELOSE`; dose:`SRC_BULA_ABORVAC_B19`; route:`SRC_BULA_ABORVAC_B19`; recurrence:`SRC_BULA_ABORVAC_B19`; restrictions:`SRC_PNCEBT_BRUCELOSE` | nacional para fêmeas bovinas e bubalinas 3-8 meses; bloqueios operacionais: MV, registro oficial, marcação, produto real e snapshot |
| `clostridioses` | `vacina` | `bovino`; bubalino `needs_review` | `recomendado_tecnico` | `needs_review` | `preview_allowed` | dose:`SRC_BULA_FORTRESS7`; route:`SRC_BULA_FORTRESS7`; recurrence:`SRC_BULA_FORTRESS7`; withdrawal:`SRC_BULA_FORTRESS7` | fonte produto-específica; não generalizar classe |
| `raiva_herbivoros` | `vacina` | `bovino`, `bubalino` por mapeamento de bovídeos | `condicional_regional` | `needs_review` | `manual_only` | eligibility:`SRC_MAPA_RAIVA_VACINA`; dose:`SRC_PNCRH_RAIVA`; route:`SRC_PNCRH_RAIVA`; recurrence:`SRC_PNCRH_RAIVA`; restrictions:`SRC_PNCRH_RAIVA` | exige foco/perifoco/área de risco e overlay regional |
| `leptospirose` | `vacina` | `bovino`; bubalino `needs_review` | `recomendado_tecnico` | `needs_review` | `manual_only` | dose:`SRC_BULA_LEPTOFERM5`; route:`SRC_BULA_LEPTOFERM5`; recurrence:`SRC_BULA_LEPTOFERM5`; withdrawal:`SRC_BULA_LEPTOFERM5` | esquema varia por produto/sorovar; não criar regra única |
| `ibr_bvd` | `vacina` | `bovino`; bubalino `blocked_without_source` | `recomendado_tecnico` | `needs_review` | `preview_allowed` | eligibility:`SRC_BULA_POLIGUARD`; dose:`SRC_BULA_POLIGUARD`; route:`SRC_BULA_POLIGUARD`; recurrence:`SRC_BULA_POLIGUARD`; restrictions:`SRC_BULA_BOVIGEN` | gestação e composição dependem do produto |
| `controle_parasitario_recria_5_7_9` | `antiparasitario` | `bovino`; bubalino se fonte | `recomendado_tecnico_regional` | `needs_review` | `preview_allowed` | eligibility:`SRC_EMBRAPA_VERMINOSE`; dose:`SRC_BULA_EPRIFORT`; withdrawal:`SRC_BULA_EPRIFORT`; restrictions:`SRC_EMBRAPA_VERMINOSE` | 5/7/9 = maio/julho/setembro; requer produto real, peso e rotação |
| `vermifugacao_pre_desmama` | `antiparasitario` | `bovino`; bubalino se fonte | `situacional_tecnico` | `needs_review` | `manual_only` | eligibility:`SRC_EMBRAPA_VERMINOSE`; restrictions:`SRC_EMBRAPA_VERMINOSE` | não universal; exige manejo/MV/produto real |
| `vermifugacao_pre_confinamento_pasto_vedado` | `antiparasitario` | `bovino`; bubalino se fonte | `recomendado_tecnico` | `needs_review` | `manual_only` | eligibility:`SRC_EMBRAPA_VERMINOSE`; dose:`SRC_BULA_SUPRAMEC`; withdrawal:`SRC_BULA_SUPRAMEC`; restrictions:`SRC_BULA_VALBAZEN` | risco de abate; carência exige produto executado |
| `matrizes_pre_parto` | `antiparasitario|vacina` | `bovino_femea`; bubalino se fonte | `situacional_tecnico` | `needs_review` | `manual_only` | eligibility:`SRC_EMBRAPA_VERMINOSE`; dose:`SRC_BULA_EPRIFORT`; withdrawal:`SRC_BULA_EPRIFORT`; restrictions:`SRC_BULA_VALBAZEN` | gestação/lactação exigem bula ou MV |
| `febre_aftosa` | `alerta` | `bovino`, `bubalino` | `archived` | `archived` | `blocked` | restrictions:`SRC_PNEFA_MAPA` | vacinação rotina bloqueada; contingência normativa apenas |

## Garantias

```json
{
  "agenda_allowed_protocols": [],
  "approved_for_catalog_protocols": [],
  "blocked_protocols": ["febre_aftosa"],
  "manual_only_or_preview_only": true
}
```
