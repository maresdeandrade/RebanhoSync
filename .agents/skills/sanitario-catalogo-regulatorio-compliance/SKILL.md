---
name: sanitario-catalogo-regulatorio-compliance
description: Use para catálogo sanitário oficial, regras e fontes regulatórias, overlays, compliance, feed-ban, suspeita notificável, biossegurança, checklists contextuais, read models e guards. Não usar como skill principal para registro rotineiro de aplicação, dose, estoque ou conclusão operacional de agenda.
role: domain
---

# Sanitário Catálogo Regulatório Compliance

## Mission

Protect the separation between official sanitary regulatory catalog, farm overlay/configuration, compliance, clinical suspicion, biosafety, and operational sanitary execution.

This skill is for regulatory/compliance intelligence, not routine manual sanitary registration.

---

## When to use

Use when task touches:

- Catálogo oficial sanitário;
- Base regulatória oficial;
- Overlay estadual;
- Compliance sanitário;
- Feed-ban;
- Doença notificável;
- Suspeita clínica;
- Checklist documental;
- Biossegurança;
- Alerta regulatório;
- Terapia/protocolo clínico não recorrente;
- Bloqueio regulatório;
- Regulatory read model;
- Farm sanitary configuration;
- Regulatory overlay runtime;
- Compliance guards;
- Checklist contextual vs pendência acionável.

---

## Do not use when

Do not use as primary skill when task is only about:

- Registro de vacinação/tratamento;
- Dose/produto/lote de estoque;
- Baixa de estoque;
- Finalização de agenda sanitária;
- Custo de aplicação;
- Correção de evento sanitário executado.

Use `sanitario-registro-operacional` for those cases.

---

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `docs/domain/SANITARIO.md`;
6. arquivos-alvo e testes diretamente relacionados;
7. `.agents/rules/rtk.md`, se houver comandos ou validação.

Carregar `docs/context/SOURCE_OF_TRUTH.md` para decisões críticas, carência, elegibilidade ou conflito entre fato e read model. Fontes legais ou técnicas específicas devem ser explícitas; guideline isolada não autoriza regra crítica.

## Restrições

- Não alterar schema, migration, RLS, RPC ou seed sem autorização explícita e sem usar `migrations-rls-contracts` como skill principal ou única skill de apoio.
- Não executar reset de banco, deploy ou operação destrutiva por padrão.
- Não atualizar Graphify automaticamente; seguir `.agents/rules/GRAPHIFY_USAGE.md`.
- Não transformar catálogo, overlay ou checklist em fato, pendência ou bloqueio sem runtime e fonte explícitos.
- Não usar esta skill como fonte superior ao código e aos documentos normativos ativos.

---

## Core separation

Regulatory/compliance objects are not the same as operational facts.

| Conceito | Papel |
|---|---|
| Catálogo oficial | Base regulatória global |
| Overlay da fazenda | Configuração/contexto tenant |
| Checklist regulatório | Contexto ou apoio documental |
| Runtime de compliance | Estado explícito registrado |
| Pendência acionável | Ação real pendente |
| Evento sanitário | Fato executado |
| Ocorrência de biossegurança | Evento contextual real |
| Suspeita notificável | Ocorrência/caso vinculado |

---

## Non-negotiable rules

- Critical sanitary rule requires explicit technical source.
- Guideline alone is not a sufficient single source for critical decisions.
- Withdrawal/carência must be linked to the executed product and explicit source.
- Regulatory catalog activated ≠ pending task.
- Checklist available ≠ mandatory routine task.
- Missing runtime ≠ non-compliance.
- No disease suspicion ≠ pending task.
- Biosafety default = `sem_ocorrencia_informada`.
- `sem_ocorrencia_informada` is not “conforme”.
- Notifiable disease requires concrete suspicion/case.
- Suspicion must link to animal, animals, lot or event.
- Corrective pending action must link to real occurrence/event.
- Protocol is rule/configuration, not execution.
- Agenda is future intention, not historical proof.
- Demand, preview and agenda do not calculate active withdrawal.
- `agenda_closure_intent` is administrative closure, not sanitary history.
- Sale/slaughter/operational eligibility remains blocked without explicit technical source.
- Tags/signals are not primary truth.

---

## Overlay actionability

Compliance/read models must distinguish:

```ts
RegulatoryOverlayActionability = "contextual" | "actionable"

```

Rules:

* no `overlay_runtime` → `contextual`;
* runtime conforme → `contextual`;
* runtime pendente → `actionable`;
* runtime `ajuste_necessario` → `actionable`;
* occurrence/case/notificação real → `actionable`;
* technical block explicitly defined → may be `actionable`.

Contextual entries must not:

* count as operational pending;
* appear as overdue;
* block routine handling;
* generate agenda automatically;
* be treated as proof of non-compliance.

### Biosafety

Biosafety must be modeled as contextual occurrence.

Routine state:
`sem_ocorrencia_informada`

Allowed states:

* `sem_ocorrencia_informada`
* `ocorrencia_registrada`
* `ocorrencia_com_pendencia`

Do not use conforme as default.

Biosafety form/wizard should open only by explicit user action.

Biosafety may generate pending action only when:

* real occurrence exists;
* `gera_pendencia=true`;
* correction deadline exists or explicit rule requires one.

### Notifiable diseases

Notifiable diseases must not be generated as a general farm pending task.

Allowed behavior:

* no suspicion → no pending task;
* suspicion with animal → `alerta_sanitario` and `sanitario_casos`, when available;
* suspicion with multiple animals → event payload preserves `animal_ids`;
* suspicion with lot and no animal → event/payload until lot-level case exists;
* notification pending → specific pending action linked to occurrence/event.

Never create a task for “confirming absence of disease”.

### Checklists

Checklist can be:

* contextual;
* tied to transport/movement;
* tied to product use;
* tied to occurrence;
* tied to feed-ban;
* tied to corrective action.

Checklist must not be:

* generic farm pending task by default;
* universal compliance proof;
* replacement for event record;
* source of withdrawal;
* source of commercial eligibility.

### Feed-ban and hard regulatory blocks

Feed-ban may be treated as a specific regulatory guard when a technical rule exists.

Do not generalize feed-ban behavior to all checklists.

A hard block must declare:

* source;
* rule;
* affected operation;
* how user resolves it;
* whether it creates a specific pending action.

### Clinical suspicion and non-recurring clinical protocol

Clinical suspicion is not routine recurring protocol by default.

Use:

* event/case;
* occurrence;
* alert;
* optional corrective pending action.

Do not use:

* automatic general agenda;
* checklist to confirm absence;
* protocol execution without event.

### Correction and reconciliation

Compliance corrections must preserve auditability.

Allowed:

* event of resolution;
* event of cancellation;
* event of correction/complement;
* linked agenda completion/cancellation.

Forbidden:

* destructive update of original fact;
* deleting evidence silently;
* turning contextual overlay into historical fact.

### Tests expected

When changing compliance behavior, test:

* contextual overlay does not count as pending;
* no runtime does not mean non-compliance;
* biosafety checklist available does not block handling;
* disease notification checklist does not create farm-level pending task;
* suspicion without clinical link is blocked;
* suspicion with animal/lot is accepted;
* runtime pending becomes actionable;
* occurrence with pending creates specific agenda;
* checklist contextual does not create agenda.

## Validation

Seguir `.agents/rules/rtk.md`.

Mínimo para alteração de governança ou documentação regulatória:

```bash
git status --short --untracked-files=all
git diff --check
```

Para patch funcional de compliance, executar testes focados e adicionar lint/build somente quando proporcionais ao risco. Se tocar Supabase, schema, RLS, RPC, migration ou sync-batch, executar a validação funcional indicada em `rtk.md` e coordenar com `migrations-rls-contracts`.

Operações destrutivas exigem autorização explícita, necessidade técnica demonstrada e compatibilidade simultânea com `rtk.md` e `migrations-rls-contracts`. Graphify só pode ser atualizado quando `.agents/rules/GRAPHIFY_USAGE.md` classificar a mudança como estrutural relevante.

## Output expected

Report:

* Files changed.
* Regulatory/compliance rule changed.
* Whether entry is contextual or actionable.
* Whether agenda/event/protocol contract was affected.
* Tests added/updated.
* Validation commands and results.
* Risks remaining.
