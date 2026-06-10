# Relatório 12D4 — ProductClass, Status Curatorial e Política de Execução

Atualizado em: 2026-06-09
Fase: 12D4+bulas — Rebaseline conceitual e curadoria de bulas reais via OCR
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

`PROSSEGUIR COM ESCOPO REDUZIDO`

Diagnóstico de entrada:

- HEAD: `9fa993d` (commit 12D3)
- branch: `main`
- worktree: limpo
- matrizes 12D3: todas presentes em `docs/review/evidence/`
- docs ativos: apontam para 12D3 concluída
- sem SQL pendente; sem TS pendente; sem staged inesperado

---

## Alterações conceituais aplicadas

### 1. SanitaryProtocol como entidade final (não "candidato" como tipo)

**Antes (12D3):**
- A matriz se chamava "Matriz de Protocolos Candidatos" e usava "candidato" como tipo conceitual.
- Colunas: `protocol_family`, `doenca_alvo`, `status_curatorial`.

**Depois (12D4):**
- A entidade é `SanitaryProtocol` com estado curatorial.
- "Candidato" é um valor de `curation_status`, não um tipo.
- Colunas renomeadas: `family_code`, `target_condition`, `curation_status`.

### 2. ProductClass como entidade central

**Antes (12D3):**
- A matriz de produtos era uma lista plana de produtos comerciais candidatos.
- Produto era quase equivalente ao item do protocolo.

**Depois (12D4):**
- `ProductClass` é a entidade conceitual que o item do protocolo exige.
- `SanitaryProduct` é a concretização que satisfaz uma `ProductClass` na execução.
- `ProductClassDefaultRule` são defaults operacionais (sugestão, pré-preenchimento) — nunca validação de execução.
- A matriz de produtos/classes foi separada em três seções: A (ProductClass), B (ProductClassDefaultRule), C (SanitaryProduct exemplos).

### 3. Produto comercial não é item do protocolo

**Antes (12D3):**
- Item tinha coluna `product_candidate` (nome comercial candidato).
- Bulas eram citadas como referência de produto para o item.

**Depois (12D4):**
- Item tem `product_class_key` (classe/tipo sanitário).
- Item tem `execution_product_policy` (política de produto na execução).
- Produto comercial é exemplo/configuração/execução — nunca identidade do item.
- Bulas são fontes produto-específicas, não representantes universais da classe.

### 4. Bula comercial não cria catálogo nacional obrigatório

**Antes (12D3):**
- Bulas eram citadas de forma que podiam ser lidas como fontes de classe.
- Ex: "Bovilis® RB-51 cita apenas bovinos" era usado como regra geral da classe.

**Depois (12D4):**
- Bulas são fontes produto-específicas com escopo explícito.
- "Bovilis® RB-51 cita apenas bovinos" é evidência para esse produto específico.
- Outros produtos RB51 podem ter bulas diferentes.
- Frase padrão adicionada: "Fonte forte apenas para o produto comercial citado. Usada como evidência produto-específica e como prova de variabilidade por bula. Não cria produto obrigatório, não representa toda a classe e não fixa carência no protocolo."

### 5. ProductClassDefaultRule é default operacional, não regra crítica

**Regras fixas aplicadas:**
- `can_validate_execution = false` (invariável)
- `requires_executed_product_for_withdrawal = true` (invariável)
- `can_prefill_agenda = true` (padrão para a maioria)
- `can_suggest_at_execution = true` (padrão para a maioria)

**O que default pode fazer:**
- pré-preencher preview
- pré-preencher agenda
- sugerir dose/via na execução

**O que default não pode fazer:**
- validar evento executado
- substituir bula do produto
- calcular carência
- liberar venda, abate, leite ou aptidão operacional
- transformar ausência de carência em carência zero

### 6. Produto planejado ≠ produto executado

`execution_product_policy = required_at_agenda` → produto planejado na agenda.

Não significa:
- produto executado
- carência gerada
- baixa de estoque
- histórico sanitário
- aptidão para venda/abate/leite

Padrão seguro para vacinas e produtos com carência variável: `required_at_execution`.

---

## De/para de CurationStatus (status curatorial)

| Status 12D3 | Status 12D4 | Justificativa |
|---|---|---|
| `draft_from_guideline` | `candidate` | Candidato extraído/rascunho |
| `needs_official_source` | `needs_review` | Falta fonte normativa |
| `needs_product_label` | `needs_review` | Falta bula/produto |
| `needs_mv_validation` | `needs_review` | Falta decisão MV |
| `validated_for_review` | `needs_review` | Nenhuma linha chegou a approved nesta fase |
| `blocked_alert_only` | `blocked` | Bloqueado |
| `not_automatable` | `blocked` | Bloqueado |
| `approved_for_seed` | ❌ **não usar** | Substituído por `approved_for_catalog` |

**Status 12D4 canônicos:**

| CurationStatus | Significado |
|---|---|
| `candidate` | Extraído/rascunho curatorial |
| `needs_review` | Falta fonte, revisão técnica ou decisão veterinária |
| `approved_for_catalog` | Pode compor catálogo curado/controlado |
| `blocked` | Não usar para carga, agenda ou execução sugerida |
| `archived` | Histórico/inativo |

---

## De/para de AutomationStatus

| Status 12D3 | Status 12D4 | Justificativa |
|---|---|---|
| `candidate_only` | `manual_only` | Uso apenas manual/documental |
| `review_required` | `preview_allowed` ou `manual_only` | Conforme nível de completude da linha |
| `blocked_missing_source` | `blocked` | Bloqueado por ausência de fonte |
| `blocked_bubaline_unclear` | `blocked` | Bloqueado por ausência de fonte bubalino |
| `blocked_off_label` | `blocked` | Bloqueado por uso fora de bula/norma |
| `blocked_experimental` | `blocked` | Bloqueado por experimental |
| `not_automatable_alert` | `blocked` | Bloqueado permanente |
| `requires_product_at_execution` | ❌ **movido** | Virou `execution_product_policy = required_at_execution` |
| `eligible_for_agenda` | `agenda_allowed` | Pode gerar intenção futura |

**Status 12D4 canônicos:**

| AutomationStatus | Significado |
|---|---|
| `manual_only` | Uso apenas manual/documental |
| `preview_allowed` | Pode aparecer em preview operacional, sem agenda automática |
| `agenda_allowed` | Pode gerar intenção futura após catálogo curado |
| `blocked` | Não pode gerar preview/agenda operacional |

---

## ExecutionProductPolicy — novo campo no item

| Valor | Significado | Regra |
|---|---|---|
| `not_required` | Item não depende de produto | Exame, alerta, manejo sem produto |
| `required_at_agenda` | Agenda precisa registrar produto planejado | Não vira produto executado |
| `required_at_execution` | Produto obrigatório apenas no evento | Padrão mais seguro |
| `fixed_by_protocol` | Protocolo exige produto específico | Usar só com fonte forte |

Padrão para vacinas, vermífugos e produtos com carência variável: `required_at_execution`.

---

## ProductClass como entidade conceitual

Chaves de ProductClass definidas nesta fase (documental):

| product_class_key | class_name | product_type | Protocolos que usam |
|---|---|---|---|
| `vacina_fmd_inativada` | Vacina Inativada contra FMD | vacina_inativada | febre_aftosa |
| `vacina_brucelose_b19` | Vacina Viva Atenuada B19 | vacina_viva | brucelose |
| `vacina_brucelose_rb51` | Vacina Viva Atenuada RB51 | vacina_viva | brucelose |
| `vacina_antirrabica_inativada` | Vacina Inativada contra Raiva | vacina_inativada | raiva |
| `vacina_clostridial_multivalente` | Vacina Toxoide Clostridial Multivalente (7V/8V) | vacina_toxoide | clostridioses |
| `bacterina_leptospirose` | Bacterina contra Leptospirose (5–6 sorogrupos) | bacterina | leptospirose |
| `vacina_ibr_bvd_combinada` | Vacina Combinada IBR/BVD/PI3/BRSV | vacina_combinada | ibr_bvd_pi3_brsv |
| `bacterina_campylobacter` | Bacterina contra Campylobacteriose | bacterina | campylobacteriose |
| `endectocida_ivermectina_injetavel` | Endectocida Injetável (Ivermectina 1%) | endectocida_injetavel | controle_parasitario |
| `endectocida_ivermectina_pour_on` | Endectocida Pour-On (Ivermectina 0,5%) | endectocida_pour_on | controle_parasitario |
| `endectocida_eprinomectina_pour_on` | Endectocida Pour-On Lactante (Eprinomectina) | endectocida_pour_on | controle_parasitario |
| `antielmintico_albendazol` | Anti-helmíntico Oral (Albendazol 10%) | antielmintico_oral | controle_parasitario |

---

## ProductClassDefaultRule — defaults operacionais

Regras fixas para toda `ProductClassDefaultRule`:

```
can_validate_execution = false    (invariável)
requires_executed_product_for_withdrawal = true    (invariável)
```

Padrão: dose/via extraídas do guideline como default de classe. Carência NÃO entra aqui.

---

## Produto comercial como exemplo/configuração/execução

`membership_status` dos produtos na Seção C:

| membership_status | Significado |
|---|---|
| `candidate` | Extraído do guideline; não validado |
| `validated` | Bula confirmada; pronto para configuração |
| `blocked` | Uso bloqueado por bula/norma |
| `example_only` | Citado apenas como exemplo da classe |

**Dois produtos foram promovidos a `validated` após processamento de OCR dos PDFs:**
- `leptoferm5_zoetis` (Zoetis): bula confirmada via OCR, dose 2 mL IM, carência abate 21 dias.
- `anticarbunculosa_labovet` (Labovet): bula confirmada via OCR, dose 2 mL SC (bovinos), carência não citada.

Os demais produtos extraídos do guideline permanecem como `candidate` ou `example_only` aguardando as respectivas bulas completas.

---

## Regras de carência (reafirmadas)

1. Carência não entra em `SanitaryProtocol`, `SanitaryProtocolItemVersion`, `ProductClass` ou `ProductClassDefaultRule`.
2. Carência é atributo de `WithdrawalRule` no `SanitaryProduct` real.
3. Carência ativa só é calculada a partir de evento sanitário com produto executado real.
4. Carência zero exige fonte explícita (bula ou norma oficial) — nunca inferida por ausência.
5. Produto planejado na agenda não gera carência.
6. Default de classe não gera carência.

---

## Impacto nas matrizes

| Matriz | Alterações aplicadas |
|---|---|
| `MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md` | Renomeada para "Matriz de SanitaryProtocol v2"; colunas atualizadas para nomenclatura canônica; status migrados |
| `MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md` | Colunas atualizadas; `product_class_key` adicionado; `execution_product_policy` adicionado; `product_candidate` removido como coluna principal |
| `MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | Separada em Seção A (ProductClass), B (ProductClassDefaultRule), C (SanitaryProduct exemplos) |
| `MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md` | Critério de inclusão adicionado; linguagem de bulas corrigida para produto-específica |
| `README_CURADORIA_SANITARIA_V2.md` | Modelo canônico adicionado; ProductClass documentada como entidade central |

---

## Itens ainda bloqueados após 12D4

Nenhuma linha foi promovida para `approved_for_catalog` nesta fase.

Itens permanentemente bloqueados (`blocked`):
- Febre aftosa em zona livre sem vacinação — proibido por norma
- RB51 em bubalinas — NAO_AUTORIZADO por bula
- Toxocara vitulorum bubalino — sem produto registrado
- Vacina Bm86 (Gavac) — experimental/restrito
- Salmonella autógena — uso restrito por MV + diagnóstico obrigatório

Itens com `needs_review` pendente (dependem de bula ou norma):
- Todos os demais — aguardam curadoria de normas e bulas

---

## Critério para 12D5

A fase 12D5 pode ser iniciada se:

- [ ] Esta fase 12D4 tiver passado em revisão humana;
- [ ] O modelo conceitual ProductClass → SanitaryProduct estiver validado pelo comitê;
- [ ] Pelo menos uma `ProductClass` tiver `approved_for_catalog` por decisão explícita;
- [ ] A política de execução (`execution_product_policy`) estiver revisada por pelo menos um protocolo;
- [ ] Nenhuma carência tiver sido liberada nesta fase.

Escopo da 12D5:
- migration expand-only: criar `sanitario_product_classes_v2`, `sanitario_product_class_defaults_v2`, `sanitario_product_class_memberships_v2`;
- ajustar contratos TypeScript;
- validar snapshots;
- sem seed funcional;
- sem UI;
- sem sync amplo.

---

## Próxima fase recomendada

`12D5 — Schema/contratos ProductClass, defaults e memberships`

---

_Versão: 12D4+bulas | Rebaseline documental e curadoria de bulas via OCR | Sem SQL | Sem TS | Sem seed_
