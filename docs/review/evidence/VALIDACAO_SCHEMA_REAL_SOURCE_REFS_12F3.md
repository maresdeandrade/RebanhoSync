# Validacao schema real — SourceRefs e RotationRules 12F3

## Decisao

`SEED_SOURCE_REFS_CANDIDATA_12F2` e `SEED_ROTATION_RULES_CANDIDATA_12F2` continuam artefatos documentais candidatos. Nao foram encontradas tabelas reais `sanitario_source_refs_field_level_v2` nem `sanitario_rotation_rules_v2`.

## Destinos reais disponiveis

Protocolos:

- `sanitario_protocolos_v2.source_refs_snapshot jsonb`;
- `sanitario_protocolos_v2.metadata jsonb`.

Itens:

- `sanitario_protocolo_itens_versions_v2.source_refs_by_field jsonb`;
- `sanitario_protocolo_itens_versions_v2.limitations jsonb`;
- `sanitario_protocolo_itens_versions_v2.snapshot_template jsonb`.

Catalogo tecnico:

- `sanitario_fontes_tecnicas_v2`;
- `sanitario_fonte_cobertura_campos_v2`;
- vinculos produto/fonte/dose/carencia existentes no schema sanitario v2.

## Separacao obrigatoria

12F4 deve manter separado:

- `fieldSourceRefs`: somente referencias reais, preferencialmente `SRC_*` ou objeto equivalente;
- `sourceGaps`: lacunas e bloqueios, nunca fonte;
- `sourcePolicy`: regra de dependencia, por exemplo produto executado, bula ou MV;
- `restrictions`: limitacoes operacionais/regulatorias.

`null`, `n/a`, `source_gap_*` e politicas nao podem ser convertidos em fonte tecnica.

## Campos criticos

SourceRefs por campo devem cobrir, quando aplicavel:

- `eligibility`;
- `species`;
- `sex`;
- `age`;
- `dose`;
- `route`;
- `recurrence`;
- `withdrawal`;
- `restrictions`.

Campo sem fonte suficiente deve gerar `sourceGap` e impedir agenda automatica.

## RotationRules

RotationRules antiparasitarios permanecem documentais ou JSONB:

```json
{
  "kind": "chemical_class_rotation",
  "avoid_same_class_consecutively": true,
  "allow_combination_products": true,
  "requires_mv_override_for_repeat_class": true,
  "requires_resistance_context": true
}
```

Destino futuro permitido:

- `snapshot_template.rotationRule`;
- `metadata.rotationRule`;
- tabela futura somente mediante migration explicita em outra fase.

RotationRule nao cria agenda, evento, dose, carencia, baixa de estoque ou autorizacao operacional.

## Bloqueios preservados

- carencia exige produto real executado;
- dose exige peso + produto real;
- leite exige bula;
- gestacao/lactacao exige bula ou MV;
- bubalino exige fonte explicita;
- repetir classe exige justificativa/MV;
- combinacao exige bula propria;
- sourceGap critico impede `agenda_allowed`.

