# Regras de validacao do adapter — 12F5

## Flags proibidas

Falhar se qualquer JSON documental contiver:

- `"agenda_allowed": true`;
- `"approved_for_catalog": true`;
- `"allows_agenda_auto": true`;
- `"allowsAgendaAuto": true`;
- `"execute_import": true`;
- `"creates_agenda": true`;
- `"creates_event": true`;
- `"creates_stock_movement": true`;
- `"creates_active_withdrawal": true`;
- `"allows_operational_release": true`.

## Contagens

Valores esperados:

- `protocols.adapted = 10`;
- `protocols.rejected = 0`;
- `items.adapted = 13`;
- `items.rejected = 6`;
- `productClassGroups.adapted = 4`;
- `productClassGroups.rejected = 0`;
- `productClassGroupMembers.adapted = 0`;
- `productClassGroupMembers.rejected = 16`.

## Enums

Protocolos:

- `legal_status`: `obrigatorio_norma`, `recomendado_tecnico`, `condicional`, `estrategico`, `experimental_alerta`, `bloqueado`;
- `status`: `draft`, `active`, `retired`;
- `approval_status`: `draft`, `pending_review`, `approved`, `rejected`;
- `scope`: `global`, `pack`, `fazenda`.

Itens:

- `item_status`: `obrigatorio`, `recomendado`, `condicional`, `estrategico`, `somente_alerta`, `bloqueado`;
- `action_type`: `vacinacao`, `vermifugacao`, `tratamento`, `exame`, `manejo_sanitario`, `alerta`;
- `product_requirement_kind`: `specific_product`, `product_class`, `none`;
- `status`: `draft`, `active`, `retired`.

## B19

Validar:

- `family_code = brucelose_b19`;
- `species_scope` contem `bovino` e `bubalino`;
- `legal_status = obrigatorio_norma`;
- `jurisdiction_scope.legal_scope = nacional`;
- `status = draft`;
- `approval_status = draft`;
- `metadata.target_sex = femea`;
- source refs oficiais para eligibility/species/sex/age/dose/route/recurrence/restrictions;
- item `b19_femeas_3_8_meses` com 3 a 8 meses, janela rigida e `requires_mv_responsavel=true`.

## Aftosa

Validar:

- `family_code = febre_aftosa`;
- `legal_status = bloqueado`;
- `status = retired`;
- `metadata.archived = true`;
- `automationStatus = blocked`;
- itens de aftosa com `product_requirement_kind = none`;
- sem produto sugerido.

## ProductClassGroup

Validar:

- itens `product_class_group` rejeitados;
- members sem `class_id` rejeitados;
- nenhum `class_id` ou `group_id` inventado;
- principios ativos apenas como metadata/documentacao candidata;
- grupos com `scope=global`, `fazenda_id=null`, `requires_mv_for_other_class=true`.

## SourceRefs e RotationRules

Validar:

- SourceRefs em `source_refs_snapshot` ou `source_refs_by_field`;
- SourceGaps em `limitations`, `snapshot_template` ou `metadata`;
- SourcePolicy em `snapshot_template.sourcePolicy` ou `metadata.sourcePolicy`;
- RotationRule em JSONB;
- sem tabela nova.

## Sanitário

Validar invariantes:

- Agenda = intencao futura;
- Evento = fato executado;
- Protocolo = regra/configuracao;
- carencia ativa = somente evento + produto executado + snapshot;
- ProductClassGroup nao valida execucao;
- ProductClass nao valida dose/carencia;
- bubalino exige fonte explicita.

