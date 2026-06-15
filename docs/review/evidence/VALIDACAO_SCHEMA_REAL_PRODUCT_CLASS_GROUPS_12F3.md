# Validacao schema real — ProductClassGroups 12F3

## Decisao

Os grupos candidatos antiparasitarios podem ser adaptados para `sanitario_product_class_groups_v2`, mas os membros nao podem ser importados sem ProductClass previa e resolucao para `class_id`.

## Schema real auditado

Tabelas:

- `sanitario_product_classes_v2`;
- `sanitario_product_class_groups_v2`;
- `sanitario_product_class_group_members_v2`;
- `sanitario_product_class_default_rules_v2`.

`sanitario_product_class_groups_v2` usa:

- `id uuid`;
- `fazenda_id uuid`;
- `scope text` com `global|tenant`;
- `group_key text`;
- `name text`;
- `requires_mv_for_other_class boolean`;
- `curation_status text`;
- `automation_status text`;
- `limitations text[]`;
- `metadata jsonb`;
- timestamps e `deleted_at`.

`sanitario_product_class_group_members_v2` usa:

- `group_id uuid not null`;
- `class_id uuid not null`;
- `is_allowed boolean`;
- `requires_mv_override boolean`;
- `limitations text[]`;
- `metadata jsonb`.

## Grupos candidatos 12F2

- `pcg_antiparasitarios_recria_estrategicos`;
- `pcg_antiparasitarios_bezerros_pre_desmama`;
- `pcg_antiparasitarios_pre_confinamento`;
- `pcg_antiparasitarios_matrizes_pre_parto`.

Status:

- grupos: adaptaveis;
- membros: bloqueados ate ProductClass existir.

## Classes esperadas

Classes candidatas:

- `lactonas_macrociclicas`;
- `benzimidazois`;
- `imidazotiazoleis`;
- `associacoes_antiparasitarias`.

`associacoes_antiparasitarias` permanece `reserved_candidate` e nao deve validar execucao sem bula propria.

## Incompatibilidade critica

Payload atual expressa membros com chaves e arrays de principios ativos, por exemplo:

```json
{
  "class_key": "lactonas_macrociclicas",
  "members": ["ivermectina", "doramectina", "moxidectina", "eprinomectina"]
}
```

Tabela real exige:

```json
{
  "group_id": "uuid",
  "class_id": "uuid"
}
```

Decisao:

- principios ativos devem ir para `metadata.principios_ativos_candidatos`;
- membros reais devem referenciar ProductClass por `class_id`;
- seed/import deve ser bloqueado enquanto nao houver ProductClass real/mapeada;
- nao criar ProductClass nem FK inventada na 12F3.

## Regras preservadas

- ProductClassGroup nao valida execucao sozinho.
- Produto real e exigido na execucao.
- Dose exige peso + produto real.
- Carencia exige produto executado + evento + snapshot.
- Leite exige bula.
- Gestacao/lactacao exige bula ou MV.
- Bubalino exige fonte explicita.
- Repetir classe exige justificativa/MV.
- Combinacao exige bula propria.

## RLS e escopo

ProductClass v2 usa `scope = global|tenant`.

Adapter futuro deve:

- manter grupos globais sem `fazenda_id`;
- manter grupos tenant com `fazenda_id`;
- respeitar constraints de escopo;
- nao transformar grupo em regra de execucao operacional.

