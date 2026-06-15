# Plano Fase 12F4 — Adapter dos payloads candidatos para schema real

Atualizado em: 2026-06-14

## 1. Decisao executiva

Decisao: `FASE 12F4 CONCLUIDA COMO ADAPTER/NORMALIZER CANDIDATO DOCUMENTAL`.

A 12F4 definiu o adapter nao destrutivo dos payloads 12F2 para o shape real auditado na 12F3. O resultado nao e seed, nao e import e nao escreve no banco.

Resultado:

- 10 protocolos podem gerar payload adaptado para `sanitario_protocolos_v2`.
- 13 itens podem gerar payload adaptado para `sanitario_protocolo_itens_versions_v2`.
- 6 itens antiparasitarios foram rejeitados para payload adaptado por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.
- 4 ProductClassGroups podem gerar payload adaptado parcial para `sanitario_product_class_groups_v2`.
- 16 ProductClassGroup members foram bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- SourceRefs e RotationRules foram direcionados para JSONB existente, sem tabela nova.
- B19 nacional foi preservada.
- Aftosa foi preservada como archived/blocked com `legal_status = bloqueado` e `status = retired`.
- `agenda_allowed` permaneceu zero.
- `approved_for_catalog` permaneceu zero.

## 2. Escopo e nao escopo

Escopo:

- documentar adapter payload -> coluna real;
- documentar payloads adaptaveis;
- documentar rejeicoes e motivos;
- definir JSONB final proposto;
- definir destino de SourceRefs e RotationRules;
- definir criterios para 12F5.

Nao escopo:

- seed/import aplicado;
- migration;
- alteracao de schema;
- runtime, Dexie, sync, UI ou Edge Function;
- agenda, evento, estoque, carencia ativa ou liberacao operacional;
- promocao para `approved_for_catalog` ou `agenda_allowed`.

## 3. Adapter de protocolos

Destino futuro: `sanitario_protocolos_v2`.

Defaults:

```json
{
  "scope": "global",
  "fazenda_id": null,
  "version": 1,
  "status": "draft",
  "approval_status": "draft",
  "metadata": {
    "agenda_allowed": false,
    "approved_for_catalog": false,
    "adapter_version": "12F4.0-candidate"
  }
}
```

Mapeamento:

| Payload | Coluna real |
|---|---|
| `protocol_key` | `family_code` |
| `name` | `name` |
| `target_species` | `species_scope` |
| `legal_status` | `legal_status` normalizado |
| `version` textual | `version = 1` |
| `fieldSourceRefs` | `source_refs_snapshot` array de objetos |
| `sourceGaps` | `metadata.sourceGaps` |
| `restrictions` | `metadata.restrictions` |
| `curationStatus` | `metadata.curationStatus` |
| `automationStatus` | `metadata.automationStatus` |
| `agenda_allowed` | `metadata.agenda_allowed = false` |
| `approved_for_catalog` | `approval_status = draft` e metadata |

Mapeamento de `legal_status`:

| Curatorial | SQL real | Preservacao |
|---|---|---|
| `obrigatorio_norma_nacional` | `obrigatorio_norma` | `legal_scope=nacional` em `jurisdiction_scope` e metadata |
| `recomendado_tecnico` | `recomendado_tecnico` | sem perda |
| `condicional_regional` | `condicional` | regionalidade em `jurisdiction_scope` |
| `recomendado_tecnico_regional` | `recomendado_tecnico` | regionalidade em `jurisdiction_scope` |
| `situacional_tecnico` | `condicional` | contexto situacional em metadata |
| `archived` | `bloqueado` | `metadata.archived=true`, `status=retired` |

## 4. Adapter de itens

Destino futuro: `sanitario_protocolo_itens_versions_v2`.

Defaults:

```json
{
  "version": 1,
  "status": "draft",
  "allows_agenda_auto": false
}
```

Mapeamento:

| Payload | Coluna real |
|---|---|
| `protocol_key` | `protocol_id` por lookup logico de `family_code` |
| `item_key` | `logical_item_key` |
| `item_version` textual | `version = 1` |
| `action` | `action_type` |
| `productRequirementKind` | `product_requirement_kind` |
| `productClassKey` | `product_class` |
| `eligibilityRule` | `eligibility_rule` |
| `operationalWindowRule` | `operational_window_rule` |
| `recurrenceRule` + `tolerance` | `booster_rule` e `snapshot_template` |
| `fieldSourceRefs` | `source_refs_by_field` |
| `sourceGaps` + `restrictions` | `limitations` e `snapshot_template` |
| `allowsAgendaAuto` | `allows_agenda_auto = false` |
| `automationStatus` | `snapshot_template.metadata.automationStatus` |
| `executionProductPolicy` | `snapshot_template.executionProductPolicy` |
| `rotationRuleKey` | `snapshot_template.rotationRuleKey` |

Itens com `productRequirementKind = product_class_group` sao rejeitados para payload adaptado de item. O adapter nao converte grupo para classe, produto especifico ou `none`.

## 5. Adapter de ProductClassGroups

Destino futuro:

- `sanitario_product_class_groups_v2`;
- `sanitario_product_class_group_members_v2`.

Grupos:

- `group_key` -> `group_key`;
- `name` -> `name`;
- `scope = global`;
- `fazenda_id = null`;
- `curationStatus` -> `curation_status`;
- `automationStatus` -> `automation_status`;
- `restrictions` -> `limitations`;
- `usage`, `agenda_allowed=false` e `approved_for_catalog=false` -> `metadata`.

Members:

- bloqueados sem `class_id` real;
- `class_key` vira lookup pendente;
- principios ativos vao para `metadata.principios_ativos_candidatos`;
- `associacoes_antiparasitarias` permanece `reserved_candidate`;
- motivo: `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

## 6. SourceRefs e RotationRules

Nao criar tabela.

Destino:

- protocolos: `source_refs_snapshot`;
- itens: `source_refs_by_field`;
- sourceGaps: `limitations`, `snapshot_template.sourceGaps` ou `metadata.sourceGaps`;
- sourcePolicy: `snapshot_template.sourcePolicy` ou `metadata.sourcePolicy`;
- rotationRule: `snapshot_template.rotationRule` nos itens antiparasitarios rejeitados/documentais e `metadata.rotationRule` nos grupos.

Nao entram em sourceRefs:

- `null`;
- `n/a`;
- `source_gap_*`;
- politica textual;
- decisao MV.

## 7. B19

Adapter preserva:

- `family_code = brucelose_b19`;
- `species_scope = ["bovino", "bubalino"]`;
- `legal_status = obrigatorio_norma`;
- `jurisdiction_scope.legal_scope = nacional`;
- `status = draft`;
- `approval_status = draft`;
- item `b19_femeas_3_8_meses` com `item_status = obrigatorio`;
- `allows_agenda_auto = false`;
- idade 3 a 8 meses e janela rigida.

## 8. Aftosa

Adapter preserva:

- `family_code = febre_aftosa`;
- `legal_status = bloqueado`;
- `status = retired`;
- `metadata.archived = true`;
- itens com `product_requirement_kind = none`;
- `item_status = bloqueado`;
- `allows_agenda_auto = false`;
- sem produto sugerido.

## 9. Antiparasitarios

Protocolos e grupos podem ser adaptados como catalogo candidato.

Itens antiparasitarios com ProductClassGroup ficam rejeitados para tabela de itens porque o SQL atual nao aceita `product_class_group`. Essa rejeicao evita perda semantica e impede conversao indevida para `product_class`, `specific_product` ou `none`.

RotationRule fica documentada em JSONB de grupo/payload rejeitado, sem execucao.

## 10. Rejeicoes

Rejeicoes obrigatorias:

- `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`;
- `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

Essas rejeicoes bloqueiam seed/import real ate 12F5/12F6 decidir validacao automatizada, schema futuro ou catalogo ProductClass previo.

## 11. Criterios para 12F5

12F5 pode avancar para validacao automatizada do adapter, ainda sem aplicar seed/import, se:

- validar que nenhum payload adaptado contem `agenda_allowed=true`;
- validar que nenhum payload adaptado contem `approved_for_catalog=true`;
- validar legal_status contra enum SQL real;
- validar item `product_requirement_kind` contra enum SQL real;
- rejeitar `product_class_group` em itens sem conversao semantica;
- rejeitar ProductClassGroup members sem `class_id`;
- validar JSONB object/array conforme constraints reais;
- produzir relatorio deterministicamente.

## 12. Criterios de aceite

- Nenhuma seed/import foi aplicada.
- Nenhuma migration foi criada.
- Nenhum schema foi alterado.
- Nenhum runtime foi alterado.
- Nenhuma UI foi alterada.
- Nenhuma agenda/evento/estoque/carencia ativa foi criada.
- Payloads adaptados foram documentados.
- Rejeicoes foram listadas.
- ProductClassGroup nao foi convertido indevidamente.
- ProductClassGroup members sem `class_id` foram bloqueados.
- B19 nacional foi preservada.
- Aftosa archived/blocked foi preservada.
- `agenda_allowed` continua zero.
- `approved_for_catalog` continua zero.

