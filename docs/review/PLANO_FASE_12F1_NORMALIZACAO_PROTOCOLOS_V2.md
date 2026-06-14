# Plano Fase 12F1 — Normalização dos Protocolos Sanitários v2

Atualizado em: 2026-06-14
Fase: 12F1
Escopo: artefato técnico estruturado para futura seed/importação candidata

---

## Decisão executiva

Decisão: `FASE 12F1 CONCLUÍDA COMO NORMALIZAÇÃO TÉCNICA CANDIDATA`.

A 12F1 transforma a curadoria 12F0 em artefatos documentais estruturados para futura importação/seed candidata. Não há seed real, migration, runtime, UI, Dexie, sync, agenda, evento, estoque, carência ativa ou liberação operacional.

Resultado:

- 10 protocolos normalizados.
- 19 itens normalizados.
- 4 `ProductClassGroup` antiparasitários fechados.
- `rotationRule` antiparasitário normalizado.
- `sourceRefs` por campo crítico.
- `sourceGaps` explícitos.
- 0 itens `agenda_allowed`.
- Febre aftosa preservada como `archived` + `blocked`.

---

## Escopo permitido

- normalizar protocolos;
- normalizar itens;
- normalizar `ProductClassGroup`;
- normalizar `eligibilityRule`;
- normalizar `operationalWindowRule`;
- normalizar `recurrenceRule`;
- normalizar `rotationRule` para antiparasitários;
- normalizar `sourceRefs` por campo;
- normalizar `sourceGaps`;
- definir `executionProductPolicy`;
- definir `restrictions`.

---

## Fora de escopo

- migration;
- seed SQL real;
- Dexie;
- sync;
- UI;
- agenda;
- evento;
- estoque;
- carência ativa;
- venda, abate, leite ou aptidão operacional;
- promoção para `agenda_allowed`.

---

## Artefatos entregues

| Arquivo | Conteúdo |
|---|---|
| `docs/review/evidence/PROTOCOLOS_SANITARIOS_V2_NORMALIZADOS_12F1.md` | protocolos normalizados em formato técnico candidato |
| `docs/review/evidence/PROTOCOLO_ITENS_NORMALIZADOS_12F1.md` | itens normalizados com regras, janelas, recorrência, tolerância e policies |
| `docs/review/evidence/PRODUCT_CLASS_GROUPS_NORMALIZADOS_12F1.md` | grupos antiparasitários normalizados |
| `docs/review/evidence/ROTATION_RULES_ANTIPARASITARIOS_12F1.md` | regras de rotação e bloqueios de repetição/associação |
| `docs/review/evidence/SOURCE_REFS_FIELD_LEVEL_12F1.md` | `sourceRefs` por campo crítico e `sourceGaps` |

---

## Invariantes 12F1

```json
{
  "protocol_is_execution": false,
  "agenda_is_history": false,
  "event_is_executed_fact": true,
  "active_withdrawal_requires_event_product_snapshot": true,
  "product_class_is_commercial_product": false,
  "free_text_product_requirement_allowed": false,
  "agenda_allowed_count": 0,
  "seed_created": false,
  "migration_created": false,
  "runtime_changed": false
}
```

---

## ProductRequirement normalizado

Valores permitidos:

- `none`
- `specific_product`
- `product_class`
- `product_class_group`

Uso de `none`:

- permitido somente para alerta/bloqueio arquivado sem execução operacional, como febre aftosa em rotina/contingência documental bloqueada;
- não permite agenda, evento, produto, estoque ou carência ativa.

Proibido:

- produto textual livre;
- inferir produto por protocolo;
- `none` em item executável com produto.

Política:

- vacinas: `executionProductPolicy = required_at_execution`;
- antiparasitários: `executionProductPolicy = required_at_execution`;
- carência aplicável: sempre depende de produto executado no evento.

---

## OperationalWindowRule normalizada

Tipos permitidos:

- `age`: janela por idade.
- `calendar`: janela por calendário.
- `anchor_event`: janela ancorada em evento.
- `hybrid`: combinação auditável de idade, calendário, evento e/ou contexto regional.

Campos mínimos:

```json
{
  "type": "age|calendar|anchor_event|hybrid",
  "anchor": "birth|calendar_month|previous_event|parturition|regional_overlay|manual_context",
  "min_offset_days": null,
  "ideal_offset_days": null,
  "max_offset_days": null,
  "calendar_months": [],
  "requires_regional_overlay": false,
  "requires_mv_context": false
}
```

---

## Tolerância

Obrigatória em protocolos multi-dose:

```json
{
  "min_interval_days": null,
  "ideal_interval_days": null,
  "max_interval_days": null,
  "grace_window_days": null
}
```

Quando não houver fonte forte, o campo fica `null` e o item permanece `needs_review`/`manual_only` ou `preview_allowed` sem agenda.

---

## RotationRule antiparasitária

Obrigatória para todos os itens com `productRequirementKind = product_class_group` e grupo antiparasitário:

```json
{
  "kind": "chemical_class_rotation",
  "avoid_same_class_consecutively": true,
  "allow_combination_products": true,
  "requires_mv_override_for_repeat_class": true,
  "requires_resistance_context": true,
  "combination_requires_own_label": true
}
```

---

## ProductClassGroup antiparasitários fechados

Grupos normalizados:

- `pcg_antiparasitarios_recria_estrategicos`
- `pcg_antiparasitarios_bezerros_pre_desmama`
- `pcg_antiparasitarios_pre_confinamento`
- `pcg_antiparasitarios_matrizes_pre_parto`

Membros mínimos:

- `lactonas_macrociclicas`
  - `ivermectina`
  - `doramectina`
  - `moxidectina`
  - `eprinomectina`
- `benzimidazois`
  - `albendazol`
  - `fenbendazol`
  - `oxfendazol`
- `imidazotiazoleis`
  - `levamisol`
- `associacoes_antiparasitarias`
  - status: `reserved_candidate`
  - não valida execução sem bula própria.

Bloqueios:

- carência exige produto real;
- dose exige peso + produto real;
- leite exige bula;
- gestação/lactação exige bula ou MV;
- bubalino exige fonte explícita;
- repetir classe exige justificativa/MV;
- combinação exige bula própria.

---

## Decisões específicas

Brucelose B19:

- bovino fêmea;
- bubalino fêmea;
- 3–8 meses;
- normativa consolidada por `SRC_PNCEBT_BRUCELOSE`;
- protocolo nacional; UF/estado não é `sourceGap` de elegibilidade;
- produto executado ainda obrigatório;
- bloqueios operacionais: MV, registro oficial, marcação, produto real e snapshot técnico;
- `automationStatus = manual_only`.

Febre aftosa:

- `curationStatus = archived`;
- `automationStatus = blocked`;
- `productRequirementKind = none`;
- sem campanha operacional;
- sem produto sugerido;
- sem agenda.

Bubalino:

- nunca herda bovino por analogia;
- exige fonte explícita por norma, bula ou decisão MV auditável.

---

## Critérios de aceite

- [x] Protocolos normalizados.
- [x] Itens normalizados.
- [x] ProductClassGroups antiparasitários fechados.
- [x] RotationRule definido.
- [x] SourceRefs por campo.
- [x] SourceGaps explícitos.
- [x] Nenhum `agenda_allowed`.
- [x] Nenhuma automação operacional.
- [x] Nenhuma seed real.
- [x] Nenhuma migration.
- [x] Nenhuma UI.
- [x] Nenhuma alteração de runtime.

---

## Bloqueios para 12F2

12F2, se autorizada, deve tratar apenas seed/import real candidata se:

- houver decisão explícita para artefato importável;
- os arquivos 12F1 forem revisados;
- `agenda_allowed` continuar bloqueado;
- campos com `sourceGap` crítico não forem promovidos;
- a importação permanecer desativada por padrão;
- não houver trigger/scheduler/agenda automática.
