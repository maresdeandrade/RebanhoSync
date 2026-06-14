# RotationRules Antiparasitários — 12F1

Atualizado em: 2026-06-14

Artefato documental candidato. RotationRule não cria agenda, não recomenda produto e não substitui decisão MV.

## Regra padrão

```json
{
  "rotationRuleKey": "rr_antiparasitario_chemical_class_rotation_v1",
  "kind": "chemical_class_rotation",
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
  ]
}
```

## Bloqueios

| condição | decisão |
|---|---|
| mesma classe química consecutiva sem justificativa | bloquear para automação; exigir MV |
| combinação sem bula própria | bloquear |
| produto sem carência para aptidão | bloquear execução candidata |
| leite sem bula explícita | bloquear |
| gestação/lactação sem bula ou MV | bloquear |
| bubalino sem fonte explícita | bloquear ou `needs_review` |
| dose sem peso quando dose é por kg | bloquear execução candidata |

## SourceRefs mínimos

| campo | sourceRefs |
|---|---|
| eligibility | `SRC_EMBRAPA_VERMINOSE` |
| dose | `source_gap_executed_product_label` |
| route | `source_gap_executed_product_label` |
| recurrence | `SRC_EMBRAPA_VERMINOSE` ou MV |
| withdrawal | `source_gap_executed_product_label` |
| restrictions | `source_gap_executed_product_label_or_mv` |

## SourcePolicy

```json
{
  "dose": "requires_executed_product_label",
  "route": "requires_executed_product_label",
  "withdrawal": "requires_executed_product_label",
  "restrictions": "requires_executed_product_label_or_mv",
  "combination_products": "requires_own_label",
  "repeat_class": "requires_mv_override"
}
```

## Observação

Rotação é regra curatorial de segurança e resistência. Ela não libera venda, abate, leite, aptidão operacional ou carência.
