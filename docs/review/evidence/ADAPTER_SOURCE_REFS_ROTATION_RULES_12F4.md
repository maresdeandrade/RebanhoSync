# Adapter SourceRefs e RotationRules — 12F4

## Decisao

SourceRefs e RotationRules nao possuem tabela real propria no schema auditado. A 12F4 define destino JSONB, sem migration e sem seed/import.

## SourceRefs

Destino:

- `sanitario_protocolos_v2.source_refs_snapshot`;
- `sanitario_protocolo_itens_versions_v2.source_refs_by_field`.

Formato proposto para protocolos:

```json
[
  {"field": "eligibility", "source_ref": "SRC_PNCEBT_BRUCELOSE"},
  {"field": "dose", "source_ref": "SRC_BULA_ABORVAC_B19"}
]
```

Formato proposto para itens:

```json
{
  "eligibility": [{"source_ref": "SRC_PNCEBT_BRUCELOSE"}],
  "dose": [{"source_ref": "SRC_BULA_ABORVAC_B19"}],
  "route": [{"source_ref": "SRC_BULA_ABORVAC_B19"}]
}
```

## SourceGaps e SourcePolicy

Destino:

- `limitations`;
- `snapshot_template.sourceGaps`;
- `snapshot_template.sourcePolicy`;
- `metadata.sourceGaps`;
- `metadata.sourcePolicy`.

Nao permitido em sourceRefs:

- `null`;
- `n/a`;
- `source_gap_*`;
- decisao MV;
- politica textual;
- produto executado como politica sem fonte.

## RotationRules

Destino:

- itens antiparasitarios rejeitados: `rejection.payload_context.snapshot_template.rotationRule`;
- grupos antiparasitarios: `metadata.rotationRule`;
- payload adaptado documental agregado: `rotationRules`.

Objeto preservado:

```json
{
  "kind": "chemical_class_rotation",
  "avoid_same_class_consecutively": true,
  "allow_combination_products": true,
  "requires_mv_override_for_repeat_class": true,
  "requires_resistance_context": true
}
```

## Regras sanitarias preservadas

- RotationRule nao cria agenda.
- RotationRule nao cria evento.
- RotationRule nao calcula dose.
- RotationRule nao calcula carencia ativa.
- ProductClassGroup nao valida execucao.
- Produto real executado continua obrigatorio para carencia.

