# Validacao schema real — Itens de protocolo 12F3

## Decisao

`SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2` nao e importavel diretamente em `sanitario_protocolo_itens_versions_v2`. A maior incompatibilidade e `productRequirementKind = product_class_group`, que existe no contrato TypeScript curatorial, mas nao no enum SQL da tabela de itens.

## Schema real auditado

Tabela: `sanitario_protocolo_itens_versions_v2`.

Colunas principais:

- `id uuid`;
- `protocol_id uuid not null`;
- `logical_item_key text not null`;
- `version integer not null`;
- `item_status sanitario_protocol_item_status_v2_enum not null`;
- `action_type sanitario_action_type_v2_enum not null`;
- `product_requirement_kind sanitario_product_requirement_kind_v2_enum not null`;
- `product_id uuid`;
- `product_class text`;
- `eligibility_rule jsonb not null`;
- `operational_window_rule jsonb not null`;
- `dose_rule jsonb`;
- `route_rule jsonb`;
- `booster_rule jsonb`;
- `species_authorization jsonb not null`;
- `source_refs_by_field jsonb not null`;
- `limitations jsonb not null`;
- `snapshot_template jsonb not null`;
- `allows_agenda_auto boolean not null default true`;
- `requires_mv_responsavel boolean not null default false`;
- `status sanitario_protocol_status_v2_enum not null default 'draft'`;
- `created_at`, `updated_at`, `deleted_at`.

Enums reais:

- `item_status`: `obrigatorio`, `recomendado`, `condicional`, `estrategico`, `somente_alerta`, `bloqueado`;
- `action_type`: `vacinacao`, `vermifugacao`, `tratamento`, `exame`, `manejo_sanitario`, `alerta`;
- `product_requirement_kind`: `specific_product`, `product_class`, `none`;
- `status`: `draft`, `active`, `retired`.

## Matriz de campos

| Payload | Coluna real | Status |
|---|---|---|
| `protocol_key` | `protocol_id` | exige lookup por protocolo |
| `item_key` | `logical_item_key` | compativel via adapter |
| `item_version` | `version integer` | converter para inteiro |
| `acao sanitaria`/`action` | `action_type` | mapear enum real |
| `eligibilityRule` | `eligibility_rule` | JSONB compativel |
| `operationalWindowRule` | `operational_window_rule` | JSONB compativel |
| `recurrenceRule` | `booster_rule`/`snapshot_template` | adapter |
| `tolerance` | `booster_rule`/`snapshot_template` | adapter |
| `productRequirementKind` | `product_requirement_kind` | bloqueado para `product_class_group` |
| `productClassKey` | `product_class` | compativel quando kind for `product_class` |
| `productClassGroupKey` | sem coluna | P0 |
| `fieldSourceRefs` | `source_refs_by_field` | adapter de shape |
| `sourceGaps` | `limitations`/`snapshot_template` | adapter |
| `restrictions` | `limitations`/`snapshot_template` | adapter |
| `allowsAgendaAuto` | `allows_agenda_auto` | direto, deve ser false |
| `agenda_allowed` | sem coluna | metadata, sempre false |
| `automationStatus` | sem coluna | metadata |
| `executionProductPolicy` | sem coluna de item | snapshot/metadata |

## ProductRequirement

SQL atual aceita:

- `specific_product`;
- `product_class`;
- `none`.

SQL atual nao aceita:

- `product_class_group`.

Consequencia:

- itens antiparasitarios com ProductClassGroup devem ficar bloqueados para import bruto;
- 12F4 deve decidir adapter conservador ou exigir alteracao de schema em fase propria;
- nao converter grupo em produto, dose, carencia ou execucao.

## JSONB

Campos JSONB compativeis se forem objetos/arrays corretos:

- `eligibility_rule`: object;
- `operational_window_rule`: object;
- `dose_rule`: object ou null;
- `route_rule`: object ou null;
- `booster_rule`: object ou null;
- `species_authorization`: array;
- `source_refs_by_field`: object;
- `limitations`: array;
- `snapshot_template`: object.

Adapter deve sintetizar `species_authorization` a partir de elegibilidade e fontes explicitas, sem heranca bovino -> bubalino.

## B19

Confirmar no adapter futuro:

```json
{
  "species": ["bovino", "bubalino"],
  "sex": "femea",
  "age_min_months": 3,
  "age_max_months": 8,
  "legal_scope": "nacional"
}
```

Janela:

```json
{
  "type": "age",
  "anchor": "birth",
  "min_offset_months": 3,
  "max_offset_months": 8,
  "hard_window": true
}
```

Status operacional:

- `allows_agenda_auto = false`;
- `status = draft`;
- `item_status = obrigatorio`;
- bloqueios operacionais preservados em `limitations`/`snapshot_template`.

## Aftosa

Confirmar:

- `product_requirement_kind = none`;
- `allows_agenda_auto = false`;
- `item_status = bloqueado` ou `somente_alerta`;
- `status = retired` ou `draft` bloqueado por metadata, conforme decisao do adapter;
- sem produto sugerido.

## Carencia e agenda

Confirmado como contrato:

- nenhum item cria carencia ativa;
- `withdrawal` permanece fonte/gap/politica;
- nenhum item cria agenda;
- `allowsAgendaAuto=false` deve mapear para `allows_agenda_auto=false`.

