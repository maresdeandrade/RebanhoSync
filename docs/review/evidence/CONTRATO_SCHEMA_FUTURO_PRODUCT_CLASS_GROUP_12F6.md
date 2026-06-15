# Contrato de Schema Futuro ProductClassGroup — 12F6

Este documento descreve a migration futura recomendada. Nao e migration aplicada.

## Tabela impactada

Destino futuro:

```txt
public.sanitario_protocolo_itens_versions_v2
```

## Enum futuro

Adicionar ao enum existente:

```txt
sanitario_product_requirement_kind_v2_enum += product_class_group
```

Valores esperados apos 12F7:

- `specific_product`;
- `product_class`;
- `product_class_group`;
- `none`.

## Coluna futura

Adicionar:

```txt
product_class_group_id uuid null
```

FK:

```txt
product_class_group_id references public.sanitario_product_class_groups_v2(id) on delete restrict
```

## CHECK futuro de requisito de produto

Regra: exatamente uma modalidade coerente.

| `product_requirement_kind` | `product_id` | `product_class` | `product_class_group_id` |
|---|---|---|---|
| `specific_product` | not null | null | null |
| `product_class` | null | not null e nao vazio | null |
| `product_class_group` | null | null | not null |
| `none` | null | null | null |

## Adapter futuro

Entrada candidata:

```json
{
  "productRequirementKind": "product_class_group",
  "productClassGroupKey": "pcg_antiparasitarios_recria_estrategicos"
}
```

Saida futura:

```json
{
  "product_requirement_kind": "product_class_group",
  "product_class_group_id": "<uuid real resolvido por lookup>",
  "product_id": null,
  "product_class": null
}
```

## Regras de lookup

O lookup deve:

- buscar por `group_key`;
- exigir `deleted_at is null`;
- respeitar escopo;
- rejeitar ausente, ambiguo ou fora de escopo;
- nao criar grupo;
- nao criar member;
- nao inventar UUID.

## Regras de escopo

Regras recomendadas:

- protocolo `global`/`pack`: aceita apenas grupo `global` enquanto nao houver grupo pack-scoped;
- protocolo `fazenda`: aceita grupo `global` ou grupo `tenant` da mesma fazenda;
- grupo `tenant` de outra fazenda deve bloquear import;
- grupo `archived` ou `blocked` nao habilita agenda automatica.

## RLS futura

RLS de item continua baseada no protocolo. RLS de ProductClassGroup continua governando leitura/escrita do grupo.

Para import de catalogo global, a 12F7 deve definir caminho privilegiado ou seed controlada em fase propria. Usuario autenticado comum nao deve escrever catalogo global.

## Offline/sync futuro

Esta decisao nao altera Dexie ou sync. Se protocolos v2 entrarem no catalogo offline em fase futura, o novo campo deve ser tratado como FK pull-only de catalogo, sem push e sem `queue_ops`.

## Testes sentinela futuros

12F7 deve cobrir:

- enum aceita `product_class_group`;
- item `product_class_group` exige `product_class_group_id`;
- `product_class_group` rejeita `product_id` e `product_class`;
- `specific_product`, `product_class` e `none` rejeitam `product_class_group_id`;
- FK rejeita grupo inexistente;
- lookup rejeita grupo deletado, ambiguo ou fora de escopo;
- item bloqueado/somente alerta preserva `allows_agenda_auto=false`;
- grupo nao gera dose, carencia, estoque ou liberacao operacional.
