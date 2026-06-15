# Plano Fase 12F2 — Seed Candidata Protocolos Sanitarios v2

Atualizado em: 2026-06-14
Fase: 12F2
Escopo: artefatos importaveis candidatos, sem import aplicado

---

## Decisao executiva

Decisao: `FASE 12F2 CONCLUIDA COMO ARTEFATO IMPORTAVEL CANDIDATO`.

A 12F2 converte a normalizacao 12F1 em payloads tecnicos candidatos para futura seed/importacao. Esta fase nao executa seed, nao cria migration, nao altera schema, runtime, Dexie, sync ou UI, e nao cria agenda, evento, estoque, carencia ativa ou liberacao operacional.

Resultado:

- payload candidato para `sanitario_protocolos_v2`;
- payload candidato para `sanitario_protocolo_itens_versions_v2`;
- payload candidato para `sanitario_product_class_groups_v2`;
- payload candidato para `sanitario_product_class_group_members_v2`;
- artefato documental candidato para `sanitario_rotation_rules_v2`;
- artefato documental candidato para `sanitario_source_refs_field_level_v2`;
- 10 protocolos em payload candidato;
- 19 itens versionados em payload candidato;
- 4 ProductClassGroups antiparasitarios fechados;
- 0 `agenda_allowed`;
- 0 `approved_for_catalog`.

---

## Artefatos criados

| artefato | destino futuro candidato |
|---|---|
| `docs/review/evidence/SEED_PROTOCOLOS_V2_CANDIDATA_12F2.md` | `sanitario_protocolos_v2` |
| `docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md` | `sanitario_protocolo_itens_versions_v2` |
| `docs/review/evidence/SEED_PRODUCT_CLASS_GROUPS_CANDIDATA_12F2.md` | `sanitario_product_class_groups_v2` e `sanitario_product_class_group_members_v2` |
| `docs/review/evidence/SEED_ROTATION_RULES_CANDIDATA_12F2.md` | `sanitario_rotation_rules_v2` documental candidato |
| `docs/review/evidence/SEED_SOURCE_REFS_CANDIDATA_12F2.md` | `sanitario_source_refs_field_level_v2` documental candidato |

---

## Contratos preservados

- Agenda = intencao futura, nunca historico.
- Evento = fato executado, nunca inferido.
- `state_*` = read model, nunca push.
- Protocolo = regra/configuracao, nunca execucao.
- Carencia = exclusivamente produto executado em evento, nunca protocolo, ProductClass ou ProductClassGroup.
- Bubalino nao herda bovino por analogia.
- SourceGap critico impede `agenda_allowed`.
- ProductClassGroup nao valida execucao sozinho e exige produto real.
- Antiparasitario exige rotacao quimica.

---

## Regra B19 preservada

Brucelose B19 possui regra normativa nacional consolidada para femeas bovinas e bubalinas de 3 a 8 meses.

Payload candidato:

```json
{
  "protocol_key": "brucelose_b19",
  "legal_status": "obrigatorio_norma_nacional",
  "curationStatus": "needs_review",
  "automationStatus": "manual_only",
  "approved_for_catalog": false,
  "agenda_allowed": false,
  "eligibilityRule": {
    "species": ["bovino", "bubalino"],
    "sex": "femea",
    "age_min_months": 3,
    "age_max_months": 8,
    "legal_scope": "nacional"
  },
  "operationalWindowRule": {
    "type": "age",
    "anchor": "birth",
    "min_offset_months": 3,
    "max_offset_months": 8,
    "hard_window": true
  }
}
```

Bloqueios operacionais:

- `requires_mv_habilitado`;
- `requires_official_record_flow`;
- `requires_marking_when_applicable`;
- `requires_executed_product_snapshot`;
- `requires_product_catalog_validation`.

---

## Criterios de aceite

- [x] Zero `agenda_allowed`.
- [x] Zero `approved_for_catalog`.
- [x] Zero seed executada.
- [x] Zero migration.
- [x] Zero runtime alterado.
- [x] B19 corrigida nacionalmente.
- [x] Aftosa `archived/blocked`.
- [x] Grupos antiparasitarios fechados.
- [x] Rotacao quimica presente.
- [x] SourceRefs por campo preservados.
- [x] SourceGap critico preservado.

---

## Fragilidades bloqueantes para 12F3

| Ponto | Risco | Decisao 12F2 |
|---|---|---|
| `ideal_interval_days` como intervalo textual | quebra se o schema exigir numero | substituido por `ideal_interval_min_days` e `ideal_interval_max_days` nos payloads candidatos |
| `type = antiparasitario|vacina` em `matrizes_pre_parto` | enum invalido se schema aceitar valor unico | normalizado para `type = manejo_sanitario` e `category = manejo_sanitario_composto` |
| membros de ProductClassGroup com array de principios ativos | pode nao bater com `group_members` real se a tabela exigir `class_id` | manter candidato e reconciliar contra schema real na 12F3 |
| `n/a` e `source_gap_*` dentro de `fieldSourceRefs` | mistura fonte real com politica/lacuna | `fieldSourceRefs` usa `SRC_*` ou `null`; lacunas ficam em `sourceGaps` e politicas em `sourcePolicy` |
| 19 itens na 12F2 versus historico de 22 itens | pode parecer perda de escopo | registrar changelog de itens removidos/mesclados antes de qualquer import real |

---

## Changelog de itens 22 -> 19

A 12F2 preserva 19 itens normalizados vindos da 12F1. A diferenca frente ao historico de 22 itens da fase curatorial inicial fica registrada como consolidacao documental, nao como exclusao operacional aplicada.

| origem 12F0 | decisao 12F1/12F2 | motivo |
|---|---|---|
| itens auxiliares de controle parasitario sem regra propria de execucao | mesclados nos itens principais de ProductClassGroup | evitar duplicar regra sem produto real, peso e bula |
| variações de reforco por produto em vacinas tecnicas | mantidas como `product_defined` no item principal | dose/reforco depende de bula do produto executado |
| sinais/observacoes curatoriais sem item executavel | preservados como `sourceGaps`, `restrictions` ou `sourcePolicy` | protocolo continua regra/configuracao, nao execucao |

12F3 deve reconciliar o delta contra o schema real e contra a matriz curatorial se houver duvida antes de qualquer import.

---

## Proxima fase segura

`12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real`, ainda sem aplicar seed/import, sem ativacao automatica e sem promover `agenda_allowed` ou `approved_for_catalog`.
