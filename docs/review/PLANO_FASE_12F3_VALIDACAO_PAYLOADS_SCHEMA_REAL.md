# Plano Fase 12F3 — Validacao dos payloads candidatos contra schema real

Atualizado em: 2026-06-14

## 1. Decisao executiva

Decisao: `FASE 12F3 CONCLUIDA COMO VALIDACAO TECNICA DOCUMENTAL`.

Os payloads candidatos da 12F2 foram avaliados contra o schema SQL e contratos TypeScript existentes. A conclusao tecnica e que os artefatos podem avancar para uma fase 12F4 de adapter/normalizer, mas nao podem ser importados diretamente.

Bloqueios principais para import bruto:

- `sanitario_protocolos_v2.legal_status` nao aceita valores curatoriais como `obrigatorio_norma_nacional`, `archived`, `recomendado_tecnico_regional` ou `situacional_tecnico`.
- `sanitario_protocolo_itens_versions_v2.product_requirement_kind` nao aceita `product_class_group`.
- itens exigem `protocol_id` UUID, `version` inteiro, `species_authorization` array e `source_refs_by_field` objeto no shape real.
- ProductClassGroup members reais exigem `group_id` e `class_id`, nao arrays de principios ativos.
- RotationRules e SourceRefs field-level nao possuem tabela propria no schema real auditado; continuam documentais ou JSONB de destino.
- RLS permite escrita comum apenas em escopo `fazenda` para protocolos; import global/pack futuro exige caminho privilegiado controlado.

Nenhum seed/import foi aplicado. Nenhuma migration, schema, runtime, Dexie, sync, UI, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

## 2. Escopo e nao escopo

Escopo executado:

- validar payloads 12F2 contra tabelas reais;
- mapear payload -> tabela;
- mapear campo payload -> coluna real;
- identificar divergencias de enum, coluna, JSONB, FK, constraints e RLS;
- preservar B19 nacional;
- preservar aftosa `archived/blocked`;
- confirmar `agenda_allowed = false` e `approved_for_catalog = false`.

Nao escopo preservado:

- seed/import real;
- migration ou alteracao de schema;
- alteracao de runtime, Dexie, sync, UI ou Edge Function;
- criacao de agenda, evento, estoque ou carencia ativa;
- promocao para `approved_for_catalog` ou `agenda_allowed`.

## 3. Tabelas reais encontradas

Encontradas em `supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql`:

- `sanitario_protocolos_v2`;
- `sanitario_protocolo_itens_versions_v2`;
- `sanitario_produtos_v2`;
- `sanitario_fontes_tecnicas_v2`;
- tabelas auxiliares de produto/fonte/dose/carencia.

Encontradas em `supabase/migrations/20260610203500_sanitario_product_class_v2.sql`:

- `sanitario_product_classes_v2`;
- `sanitario_product_class_groups_v2`;
- `sanitario_product_class_group_members_v2`;
- `sanitario_product_class_default_rules_v2`.

Nao encontradas como tabelas reais:

- `sanitario_rotation_rules_v2`;
- `sanitario_source_refs_field_level_v2`.

## 4. Payloads avaliados

- `docs/review/evidence/SEED_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
- `docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
- `docs/review/evidence/SEED_PRODUCT_CLASS_GROUPS_CANDIDATA_12F2.md`;
- `docs/review/evidence/SEED_ROTATION_RULES_CANDIDATA_12F2.md`;
- `docs/review/evidence/SEED_SOURCE_REFS_CANDIDATA_12F2.md`.

## 5. Matriz payload -> tabela real

| Payload 12F2 | Destino real | Resultado 12F3 |
|---|---|---|
| Protocolos | `sanitario_protocolos_v2` | exige adapter; import bruto bloqueado |
| Itens | `sanitario_protocolo_itens_versions_v2` | exige adapter; import bruto bloqueado |
| ProductClassGroups | `sanitario_product_class_groups_v2` | grupos adaptaveis; members bloqueados sem `class_id` |
| ProductClassGroup members | `sanitario_product_class_group_members_v2` | bloqueado ate ProductClass previa/mapeada |
| RotationRules | sem tabela real | documental ou JSONB em item/metadata |
| SourceRefs field-level | sem tabela propria | JSONB em protocolo/item ou documental |

## 6. Matriz campo payload -> coluna real

| Campo payload | Coluna real | Decisao |
|---|---|---|
| `protocol_key` | `family_code` | adapter direto |
| `name` | `name` | direto |
| `scope` ausente | `scope` | adapter deve definir `global`, `pack` ou `fazenda` |
| `target_species` | `species_scope` | adapter para JSONB array |
| `legal_status` | `legal_status` | exige normalizacao para enum real |
| `curationStatus` | sem coluna em protocolos | preservar em `metadata` |
| `automationStatus` | sem coluna em protocolos | preservar em `metadata` |
| `approved_for_catalog` | `approval_status` | `false` -> `draft` ou `pending_review` |
| `agenda_allowed` | sem coluna em protocolos | preservar em `metadata`, sempre false |
| `fieldSourceRefs` | `source_refs_snapshot` | adapter para array/objeto aceito |
| `item_key` | `logical_item_key` | adapter direto |
| `item_version` string | `version` integer | adapter obrigatorio |
| `action` | `action_type` | mapear para enum real |
| `productRequirementKind` | `product_requirement_kind` | `product_class_group` bloqueado no SQL atual |
| `eligibilityRule` | `eligibility_rule` | JSONB object compativel |
| `operationalWindowRule` | `operational_window_rule` | JSONB object compativel |
| `doseRule` | `dose_rule` | JSONB object ou null |
| `routeRule` | `route_rule` | JSONB object ou null |
| `recurrenceRule`/`tolerance` | `booster_rule` ou `snapshot_template` | adapter |
| `sourceGaps`/`restrictions` | `limitations`/`snapshot_template` | adapter |
| `allowsAgendaAuto` | `allows_agenda_auto` | direto, deve permanecer false |
| `requires_mv_responsavel` | `requires_mv_responsavel` | direto quando existir no payload |
| `productClassGroupKey` | sem coluna em itens | P0 ate schema/adapter resolver |
| `rotationRuleKey` | sem coluna real | metadata/snapshot ou documental |

## 7. Enums compativeis

Compativeis com ProductClass SQL:

- `curationStatus`: `candidate`, `needs_review`, `approved_for_catalog`, `blocked`, `archived`;
- `automationStatus`: `manual_only`, `preview_allowed`, `agenda_allowed`, `blocked`.

Compativeis com itens/protocolos apos adapter:

- `scope`: `global`, `pack`, `fazenda`;
- `action_type`: `vacinacao`, `vermifugacao`, `tratamento`, `exame`, `manejo_sanitario`, `alerta`;
- `status`: `draft`, `active`, `retired`;
- `approval_status`: `draft`, `pending_review`, `approved`, `rejected`.

## 8. Enums incompativeis

| Valor payload | Enum real afetado | Decisao |
|---|---|---|
| `obrigatorio_norma_nacional` | `sanitario_protocol_legal_status_v2_enum` | mapear para `obrigatorio_norma` e preservar `legal_scope=nacional` em JSONB |
| `archived` em `legal_status` | `sanitario_protocol_legal_status_v2_enum` | mapear para `bloqueado` e `status=retired`/metadata |
| `recomendado_tecnico_regional` | `sanitario_protocol_legal_status_v2_enum` | mapear para `recomendado_tecnico` ou `condicional` com detalhe em JSONB |
| `situacional_tecnico` | `sanitario_protocol_legal_status_v2_enum` | mapear para `estrategico` ou `condicional` |
| `product_class_group` | `sanitario_product_requirement_kind_v2_enum` | P0: SQL aceita apenas `specific_product`, `product_class`, `none` |
| `manual_only` em item | sem coluna enum de item | metadata/snapshot; `status` continua `draft` |
| `preview_allowed` em item | sem coluna enum de item | metadata/snapshot; nao habilita agenda |

## 9. Campos JSONB compativeis

Podem permanecer JSONB no destino real com adapter:

- `eligibilityRule` -> `eligibility_rule`;
- `operationalWindowRule` -> `operational_window_rule`;
- `doseRule` -> `dose_rule`;
- `routeRule` -> `route_rule`;
- `recurrenceRule` e `tolerance` -> `booster_rule` ou `snapshot_template`;
- `fieldSourceRefs` -> `source_refs_by_field` ou `source_refs_snapshot`;
- `sourceGaps`, `sourcePolicy`, `executionProductPolicy`, `rotationRule`, `restrictions` -> `limitations`, `snapshot_template` ou `metadata`;
- metadados curatoriais -> `metadata`.

## 10. Campos que exigem adapter

- camelCase para snake_case;
- ids semanticos para UUID/FK;
- `protocol_key` para `protocol_id`;
- `item_version` textual para `version` inteiro;
- source refs string/null para shape real de `SanitarySourceRefV2`;
- legal status curatorial para enum SQL real;
- ProductClassGroup em item, pois nao ha coluna nem enum SQL compativel;
- membros de grupo por principios ativos para `class_id`.

## 11. Campos sem destino real

- `agenda_allowed` no protocolo;
- `approved_for_catalog` como boolean bruto;
- `automationStatus` no item;
- `curationStatus` no item;
- `rotationRuleKey` como coluna;
- `productClassGroupKey` como coluna em item;
- `sourcePolicy` como coluna propria;
- `requires_executed_product_for_withdrawal` como coluna de item;
- artefato `sanitario_rotation_rules_v2`;
- artefato `sanitario_source_refs_field_level_v2`.

## 12. FKs logicas pendentes

- `protocol_id` para itens depende de protocolo real criado/selecionado por `family_code`.
- `product_id` em item `specific_product` depende de produto real catalogado.
- `product_class` em item `product_class` depende de `sanitario_product_classes_v2.class_key`.
- `group_id` e `class_id` em ProductClassGroup members dependem de grupos/classes reais.
- membros antiparasitarios dependem de ProductClass previa para `lactonas_macrociclicas`, `benzimidazois`, `imidazotiazoleis` e `associacoes_antiparasitarias`.

## 13. ProductClassGroup: decisao 12F3

Decisao: grupos podem ser mantidos como candidatos, mas membros nao podem ser importados sem reconciliacao contra `class_id`.

Regras:

- principios ativos ficam em `metadata.principios_ativos_candidatos` ou `sourcePolicy`, nao em `sanitario_product_class_group_members_v2`;
- `sanitario_product_class_group_members_v2` deve receber apenas `group_id` e `class_id`;
- nao inventar FK;
- nao criar ProductClass nova na 12F3;
- impedir seed/import ate ProductClass existir e adapter resolver as FKs.

## 14. SourceRefs: destino real ou artefato documental

Nao ha tabela real `sanitario_source_refs_field_level_v2`.

Destino permitido futuro:

- protocolo: `source_refs_snapshot`;
- item: `source_refs_by_field`;
- lacunas: `limitations`, `snapshot_template` ou `metadata`.

O adapter deve separar fonte real (`SRC_*`) de `sourceGaps` e `sourcePolicy`. `null` em `fieldSourceRefs` nao pode virar fonte tecnica.

## 15. RotationRules: destino real ou artefato documental

Nao ha tabela real `sanitario_rotation_rules_v2`.

Destino permitido futuro:

- `snapshot_template.rotationRule`;
- `metadata.rotationRule`;
- ou tabela futura, se houver migration explicita em outra fase.

Enquanto nao houver destino real, RotationRules continuam documentais e nao validam execucao.

## 16. Validacao B19

Confirmado no contrato 12F3:

- B19 permanece regra normativa nacional;
- alvo: femeas bovinas e bubalinas;
- idade: 3 a 8 meses;
- `legal_scope = nacional`;
- janela operacional por idade, ancora `birth`, `hard_window = true`;
- `agenda_allowed = false`;
- `approved_for_catalog = false`;
- `curationStatus = needs_review`;
- `automationStatus = manual_only`.

Adapter obrigatorio:

- `legal_status = obrigatorio_norma_nacional` deve virar `legal_status = obrigatorio_norma`;
- escopo nacional deve ser preservado em `jurisdiction_scope`/`metadata`, nao como enum inexistente.

## 17. Validacao febre aftosa

Confirmado:

- aftosa permanece `archived/blocked`;
- itens usam `productRequirementKind = none`;
- `agenda_allowed = false`;
- `approved_for_catalog = false`;
- sem produto sugerido para rotina.

Adapter obrigatorio:

- `archived` nao pode entrar como `legal_status`;
- usar `legal_status = bloqueado`, `status = retired` e metadata de arquivamento/bloqueio.

## 18. Validacao antiparasitarios

Confirmado:

- ProductClassGroup e obrigatorio no payload curatorial;
- `rotationRuleKey` esta presente;
- `executionProductPolicy = required_at_execution`;
- sourceGaps preservam produto real, peso, bula, carencia, gestacao/lactacao e bubalino;
- grupo nao valida execucao;
- carencia e dose nao nascem do grupo.

Bloqueio:

- SQL de item ainda nao aceita `product_class_group`; seed/import bruto bloqueado.

## 19. Validacao de carencia e agenda

Confirmado:

- nenhum payload cria `activeWithdrawal`;
- carencia ativa permanece exclusiva de evento executado + produto real + snapshot tecnico;
- `withdrawal` aparece somente como fonte, gap ou politica;
- `agenda_allowed = false` em todos os payloads candidatos;
- `allowsAgendaAuto = false` nos itens;
- nenhum payload cria agenda, demanda, preview runtime, evento, estoque ou liberacao.

## 20. Bloqueios P0

| P0 | Motivo | Decisao |
|---|---|---|
| ProductClassGroup em item | SQL enum nao aceita `product_class_group` | 12F4 precisa adapter ou fase futura de schema |
| members por principios ativos | tabela real exige `class_id` | bloquear seed ate ProductClass existir |
| legal_status curatorial | enum real nao aceita varios valores | normalizar antes de import |
| SourceRefs string/null | shape real exige JSONB tecnico consistente | adapter obrigatorio |
| import global/pack comum | RLS nao autoriza escrita comum | caminho privilegiado futuro, fora da 12F3 |

## 21. Pendencias P1/P2

P1:

- definir se `product_class_group` sera suportado por schema futuro ou convertido por adapter conservador;
- definir formato final de `source_refs_by_field`;
- definir onde persistir `executionProductPolicy` para item.

P2:

- padronizar nomenclatura camelCase/snake_case antes de 12F4;
- documentar exemplos pequenos de adapter por tabela;
- decidir se RotationRules viram metadata ou tabela futura.

## 22. Criterios para 12F4

12F4 pode ser autorizada como adapter/normalizer, ainda sem aplicar seed/import, se:

- converter payloads para shape real sem escrever no banco;
- rejeitar `agenda_allowed` e `approved_for_catalog`;
- mapear legal_status para enum SQL real;
- bloquear ou resolver `product_class_group` sem criar execucao;
- resolver `protocol_id` e FKs apenas como plano ou lookup simulado;
- separar `sourceRefs`, `sourceGaps` e `sourcePolicy`;
- gerar relatorio de payload adaptado e de registros bloqueados.

