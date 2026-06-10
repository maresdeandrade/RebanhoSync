# PLANO FASE 12D3 — Rebaseline Completo de `src/lib/sanitario`

> **Escopo**: Somente análise e documentação.
> **Nenhuma linha de código foi alterada.**
> **Decisão: alteração isolada em `rules/` permanece bloqueada.**
> **Próxima etapa possível: contrato canônico do item sanitário (12D5 ou 12E), não patch direto em `rules/`.**

---

## 1. Diagnóstico local inicial

```
Repositório: C:\Users\mares\dyad-apps\GestaoAgro
Branch: main...origin/main [behind 1]
Commit atual: 9fa993d
Mensagem: docs(sanitario): extract v2 sanitary protocol candidates into reviewable matrices

Worktree — arquivos modificados (não commitados):
  M docs/context/PROJECT_STATUS.md
  M docs/domain/SANITARIO.md
  M docs/product/DECISION_LOG.md
  M docs/review/ACTIVE_PHASE_PLAN.md
  M docs/review/CURRENT_PHASE_HANDOFF.md
  M docs/review/LAST_PHASE_RESULT.md
  M docs/review/evidence/Guideline_Atualizado_...
  M docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md
  M docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md
  M docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md
  M docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md
  M docs/review/evidence/README_CURADORIA_SANITARIA_V2.md
 ?? docs/review/PLANO_FASE_12D3_REBASELINE_SRC_LIB_SANITARIO.md
 ?? docs/review/evidence/RELATORIO_REVISAO_12D4_PRODUCT_CLASS_E_STATUS.md

git diff --check: trailing whitespace em README_CURADORIA_SANITARIA_V2.md (apenas doc).
src/lib/sanitario: OK — diretório existe e é acessível.
```

**Fase ativa confirmada**: 12D4 — concluída como patch documental.
**Próxima fase recomendada antes deste rebaseline**: 12D5 — Schema/contratos ProductClass.
**Nenhum código TypeScript foi alterado desde 12D2.**

---

## 2. Mapa de subpastas — inventário completo

| Subpasta | Arquivos principais | Responsabilidade |
|---|---|---|
| `AGENTS.md` | — | Invariantes operacionais locais da lib |
| `catalog/` | `baseProtocols.ts`, `officialCatalog.ts`, `products.ts` | Protocolos e produtos estáticos — declarativo, read-only |
| `engine/` | `calendar.ts`, `regimen.ts`, `protocolLayers.ts`, `protocolRules.ts` | Motor puro de cálculo: calendário, regimen, milestones |
| `rules/` | `sanitaryProtocolRule.ts`, `sanitarySourceV2.ts`, `sanitaryProductV2.ts`, `sanitaryProtocolV2.ts`, `sanitarySnapshotsV2.ts`, `sanitarySnapshotBuildersV2.ts`, `sanitaryAgendaBridgeV2.ts` | Contratos e validadores de fonte, produto, protocolo, snapshot |
| `eligibility/` | `sanitaryEligibility.ts` | Motor puro de elegibilidade por animal e janela operacional |
| `demand/` | `sanitaryDemand.ts` | Agrupamento de demanda sanitária por protocolo/item/lote |
| `preview/` | `sanitaryOperationalPreview.ts` | Preview operacional derivado da demanda — sem persistência |
| `agenda/` | `sanitaryAgendaMaterialization.ts`, `sanitaryAgendaClosure.ts` | Comandos de intenção de agenda e closure administrativo |
| `execution/` | `sanitaryEventExecution.ts` | Comando de intenção de execução sanitária como fato futuro |
| `reconciliation/` | `sanitaryExceptions.ts`, `sanitaryCorrections.ts` | Exceções e correções sanitárias append-only |
| `compliance/` | `biosecurityOccurrence.ts`, `biosecurityReadModel.ts` | Ocorrências de biossegurança e read-model de sinais |
| `customization/` | `customization.ts` | CRUD de protocolos customizados da fazenda e drafts |
| `models/` | `executionPayload.ts` | Payload de execução sanitária (produto, metadados, regimen) |
| `operations/` | `agendaDiagnostics.ts` | Diagnósticos de agenda legada e status operacional |
| `infrastructure/` | `agendaSchedule.ts`, `executionBoundary.ts`, `service.ts` | Integração com Supabase RPC, pullDataForFarm, boundary de execução |
| `hooks/` | `useWithdrawal.ts` | Hook React de carência para UI |
| `__tests__/` | 60 arquivos de teste | Testes unitários e de caracterização por camada |
| `__fixtures__/` | fixtures por domínio | Dados de teste reutilizáveis |

### 2.1 Arquivos em `rules/` — papel e status

| Arquivo | Papel | Status de edição |
|---|---|---|
| `sanitaryProtocolRule.ts` | Tipos legado: `SourceRef`, `WithdrawalRule`, `SanitaryProduct`, `SanitaryProtocolRule`, `WithdrawalSnapshotOnEvent` + validators | BLOQUEADO — consumido por eligibility/demand/preview/agenda |
| `sanitarySourceV2.ts` | Tipos v2: `SanitarySourceRefV2`, `hasStrongSourceCoveringFieldV2`, `SANITARY_CRITICAL_FIELD_KEYS_V2` | BLOQUEADO — núcleo de governance |
| `sanitaryProductV2.ts` | Tipos v2: `SanitaryProductV2`, `WithdrawalRuleV2`, `SpeciesAuthorizationV2` | BLOQUEADO |
| `sanitaryProtocolV2.ts` | Tipos v2: `SanitaryProtocolV2`, `SanitaryProtocolItemVersionV2` | BLOQUEADO — contém `operationalWindowRule: unknown` (dívida) |
| `sanitarySnapshotsV2.ts` | Tipos v2: `AgendaTechnicalSnapshot`, `EventTechnicalSnapshot` | BLOQUEADO |
| `sanitarySnapshotBuildersV2.ts` | Builders v2: `buildAgendaTechnicalSnapshot`, `buildEventTechnicalSnapshot` | BLOQUEADO |
| `sanitaryAgendaBridgeV2.ts` | Bridge: adapta builders v2 para payload de `sanitario_agenda_v2` | BLOQUEADO |

---

## 3. Responsabilidade de cada módulo

### `catalog/` — Declarativo/estático
- `baseProtocols.ts`: define `SanitaryBaseProtocol`, `SanitaryBaseProtocolItem` e `buildBaseProtocolItemPayload`. É a base do catálogo local, usa `engine/regimen.ts` e `engine/calendar.ts` para montar payload canônico de cada item.
- `officialCatalog.ts`: pack oficial materializado. Consome `baseProtocols` e gera operações de INSERT para `protocolos_sanitarios` e `protocolos_sanitarios_itens`.
- `products.ts`: `VeterinaryProduct`, seleção e metadados de produto veterinário.

**Não deve conter lógica de runtime.** É declaração de dados bem-conhecidos.

### `engine/` — Motor puro de cálculo
- `calendar.ts`: modos de calendário (`campaign`, `age_window`, `rolling_interval`, `immediate`, `clinical_protocol`), âncoras, `buildSanitaryBaseCalendarPayload`, `readSanitaryBaseCalendar`.
- `regimen.ts`: `SanitaryRegimen`, `SanitaryRegimenMilestone`, `inferSanitaryRegimenMilestone`, `buildSanitaryRegimenPayload`. Cálcula milestones e sequência.
- `protocolLayers.ts`: normalização de `familyCode`, layers de protocolo.
- `protocolRules.ts`: `getAnimalAgeInDays` — função utilitária de idade.

**Deve ser preservado.** É motor puro de cálculo, sem IO. Não deve ser descontinuado antes de o contrato canônico substituir formalmente suas funções.

### `rules/` — Contratos e validadores
- Dupla camada: `sanitaryProtocolRule.ts` (legado — 11.5B0) e os 6 arquivos V2 (12D1/12D2).
- A camada legada é o contrato operacional consumido por eligibility/demand/preview/agenda.
- A camada V2 é o contrato canônico futuro: fonte forte, espécies, snapshots, bubalino, carência.
- As duas coexistem sem integração formal entre si. **Esta é a maior dívida arquitetural do módulo.**

### `eligibility/` — Motor de elegibilidade
- `computeSanitaryEligibility`: puro, sem IO, recebe `SanitaryProtocolRule` (legado) e eventos executados, retorna status de elegibilidade.
- Consome `SanitaryProtocolRule.eligibilityWindow` com âncoras `nascimento | evento | entrada_lote | manual`.
- Status possíveis: `not_applicable`, `insufficient_data`, `not_yet_eligible`, `eligible_soon`, `in_action_window`, `near_deadline`, `overdue`, `completed`.
- `completed` depende exclusivamente de evento executado compatível — não de agenda.

### `demand/` — Agrupamento
- `createSanitaryDemandGroupsFromEligibilityResults`: puro, sem IO.
- `SanitaryDemandGroup` agrupa por protocolo, item/produto/classe, ação, lote, janela.
- Preserva `insufficient_data` como pendência de cadastro.
- Não carrega `logicalItemKey` — dívida de §7.2.

### `preview/` — Simulação
- `createSanitaryOperationalPreview`: puro, sem IO.
- Converte demanda acionável em `SanitaryPreviewGroup` com data sugerida.
- `materialization: "none"` — nunca persiste nada.

### `agenda/` — Comandos de intenção
- `sanitaryAgendaMaterialization.ts`: `SanitaryAgendaMaterializationCommand` — intenção de agenda. `createsEvent: false`.
- `sanitaryAgendaClosure.ts`: `SanitaryAgendaClosureCommand` — fechamento administrativo. Não cria histórico.
- `dedupKey` é determinístico — não usa `productName` nem `loteName`.

### `execution/` — Intenção de execução
- `createSanitaryEventExecutionCommand`: intenção de evento futuro. `createsEvent: true`, `persistsEvent: false`.
- Exige `occurredAt` real e animais explícitos.

### `reconciliation/` — Auditoria
- `sanitaryExceptions.ts`: detecta exceções por animal (`hasStructuredProduct`, `bubalino_requires_explicit_authorization`, `unknown_withdrawal_blocks_clearance`, `not_permitted_blocks_declared_use`, `extrapolated_execution_requires_mv`).
- `sanitaryCorrections.ts`: correção via contra-lançamento. Append-only.

### `compliance/` — Biossegurança
- `biosecurityOccurrence.ts`: draft, validação, criação de `EventInput` de biossegurança ou suspeita notificável.
- `biosecurityReadModel.ts`: projeção, sinais e relatório de ocorrências.

### `customization/` — Protocolo da fazenda
- CRUD de `SanitaryProtocolDraft` e `SanitaryProtocolItemDraft`.
- Consome `engine/calendar.ts` e `engine/regimen.ts` para montar payload.
- Guarda `checagem de segurança` de deleção via `checkSanitaryProtocolDeletionSafety`.

### `models/` — Payload de execução
- `buildSanitaryExecutionPayload`: resolve produto, metadados e regimen para uso em evento de execução.
- Consome `catalog/products.ts` e `engine/regimen.ts`.

### `operations/` — Diagnósticos
- `buildSanitaryAgendaDiagnostics`: diagnóstico de por que a agenda não foi gerada (legado: consome `ProtocoloSanitarioItem` de Dexie).
- `buildSanitaryOperationalStatuses`: status operacional do protocolo.

### `infrastructure/` — Integração
- `service.ts`: RPC `sanitario_complete_agenda_with_event`, views `vw_sanitario_pendencias`, `vw_sanitario_historico`, `vw_sanitario_upcoming`. **Camada legada** — usa `agenda_itens` diretamente.
- `executionBoundary.ts`: orquestração de conclusão sanitária com fallback para timeout de rede.
- `agendaSchedule.ts`: tipos de agendamento sanitário.

### `hooks/`
- `useWithdrawal.ts`: hook React de read model de carência, derivado de eventos reais.

---

## 4. Contratos públicos existentes

### 4.1 Tipos exportados — legado (11.5B0, `sanitaryProtocolRule.ts`)

```ts
SourceRef, SourceRefKind
WithdrawalApplicability, WithdrawalRule
SanitaryProduct
SanitaryProtocolRule        // CONTRATO OPERACIONAL ATIVO — consumido por eligibility/demand/preview/agenda
WithdrawalSnapshotOnEvent
SanitaryRuleValidationResult
validateSanitaryProduct()
validateSanitaryProtocolRule()
validateWithdrawalSnapshotOnEvent()
```

### 4.2 Tipos exportados — v2 (12D1/12D2)

```ts
// sanitarySourceV2.ts
SanitarySourceRefV2, SanitarySourceKindV2, SanitarySourceStrengthV2
SanitaryEvidenceStatusV2    // SIM_BULA | SIM_NORMA | PRECISA_VALIDAR | NAO_AUTORIZADO | EXTRAPOLADO
SANITARY_CRITICAL_FIELD_KEYS_V2
hasStrongSourceCoveringFieldV2()  // GUARDIÃO CENTRAL DE GOVERNANCE

// sanitaryProductV2.ts
SanitaryProductV2, WithdrawalRuleV2, SpeciesAuthorizationV2

// sanitaryProtocolV2.ts
SanitaryProtocolV2, SanitaryProtocolItemVersionV2  // operationalWindowRule: unknown — DÍVIDA

// sanitarySnapshotsV2.ts
AgendaTechnicalSnapshot, EventTechnicalSnapshot

// sanitarySnapshotBuildersV2.ts
buildAgendaTechnicalSnapshot(), buildEventTechnicalSnapshot()

// sanitaryAgendaBridgeV2.ts
adaptSnapshotForAgendaV2()
```

### 4.3 Tipos exportados — operacionais (11.5C–11.5G)

```ts
// eligibility/sanitaryEligibility.ts
SanitaryEligibilityResult, computeSanitaryEligibility()

// demand/sanitaryDemand.ts
SanitaryDemandGroup, createSanitaryDemandGroupsFromEligibilityResults()

// preview/sanitaryOperationalPreview.ts
SanitaryPreviewGroup, createSanitaryOperationalPreview()

// agenda/sanitaryAgendaMaterialization.ts
SanitaryAgendaMaterializationCommand, createSanitaryAgendaMaterializationCommands()

// agenda/sanitaryAgendaClosure.ts
SanitaryAgendaClosureCommand, createSanitaryAgendaClosureCommand()

// execution/sanitaryEventExecution.ts
SanitaryEventExecutionCommand, createSanitaryEventExecutionCommand()
```

---

## 5. Fonte única da verdade por conceito

| Conceito | Fonte primária real | Observação |
|---|---|---|
| Intenção sanitária | `sanitario_agenda_v2` (SQL, 12C) + `SanitaryAgendaMaterializationCommand` (core) | Mutável, cancelável, fechável |
| Execução sanitária | `eventos` + `eventos_sanitario` + `EventTechnicalSnapshot` (futuro) | Append-only. Fonte primária de `completed` |
| Protocolo | `protocolos_sanitarios` (Dexie) + `SanitaryProtocolV2` (futuro) | `SanitaryProtocolV2` ainda não é fonte persistida ativa |
| Item/fase | `protocolos_sanitarios_itens` (Dexie) + `SanitaryProtocolItemVersionV2` (futuro) | `logicalItemKey` compartilhado mas sem integração formal |
| Regra de elegibilidade | `SanitaryProtocolRule.eligibilityWindow` (legado ativo) | `SanitaryEligibilityRuleCanonical` ainda não implementado |
| Janela operacional | `SanitaryProtocolRule.eligibilityWindow` / `engine/calendar.ts` | `SanitaryOperationalWindowRuleCanonical` ainda não implementado |
| Sequência/reforço | `SanitaryProtocolRule.doseIntervals`, `boosters`, `engine/regimen.ts` | `SanitarySequenceRuleCanonical` ainda não implementado |
| Produto | `SanitaryProduct` (legado) + `SanitaryProductV2` (futuro) + `protocolos_sanitarios_itens.produto` (Dexie) | Três representações coexistindo |
| Dose/via geral | `protocolos_sanitarios_itens` (Dexie) | Deve ser: item, se fonte forte auditada |
| Dose/via produto-específica | `SanitaryProduct.dose`/`route` (legado) + `SanitaryProductV2` (futuro) | Produto, com bula auditada |
| Carência geral auditada | `SanitaryProtocolRule` (legado) + `SanitaryProductV2` (futuro) | Regra — não gera carência ativa |
| Carência produto-específica | `WithdrawalRule`/`WithdrawalRuleV2` no produto | Produto, com bula auditada |
| Carência aplicada | `WithdrawalSnapshotOnEvent`/`EventTechnicalSnapshot` | Snapshot congelado no evento — não recalcular |
| Conformidade/rastreabilidade | `eventos` + `eventos_sanitario` + read models | Não agenda |
| ProductClass | Conceitual (12D4) — sem contrato TypeScript ainda | Próxima etapa: 12D5 |
| `logicalItemKey` | `protocolos_sanitarios_itens.logical_item_key` (Dexie) | Propagado para snapshot, mas não para demand/preview |

---

## 6. Relação entre camadas

```
catalog/baseProtocols.ts
  └── engine/regimen.ts (inferSanitaryRegimenMilestone)
  └── engine/calendar.ts (buildSanitaryBaseCalendarPayload)
  └── catalog/officialCatalog.ts

engine/ (motor puro — preservar)
  calendar.ts → modos/âncoras de calendário
  regimen.ts → milestones e sequência de regimen
  protocolLayers.ts → normalização de familyCode
  protocolRules.ts → getAnimalAgeInDays (utilitário)

rules/ (camada de contratos e validadores)
  LEGADO: sanitaryProtocolRule.ts
    ^ consumido por: eligibility, demand (via SanitaryProtocolRule)
  V2: sanitarySourceV2.ts (hasStrongSourceCoveringFieldV2 — guardião de governance)
    ^ consumido por: sanitarySnapshotBuildersV2.ts, sanitaryProtocolV2.ts
  V2: sanitaryProductV2.ts
    ^ consumido por: sanitarySnapshotBuildersV2.ts
  V2: sanitaryProtocolV2.ts
    ^ consumido por: sanitarySnapshotBuildersV2.ts
  V2: sanitarySnapshotsV2.ts
    ^ consumido por: sanitarySnapshotBuildersV2.ts, sanitaryAgendaBridgeV2.ts
  V2: sanitarySnapshotBuildersV2.ts
    ^ consumido por: sanitaryAgendaBridgeV2.ts
  V2: sanitaryAgendaBridgeV2.ts
    ^ consumido por: (ponto de integração futuro com sanitario_agenda_v2)

eligibility/sanitaryEligibility.ts
  ^ depende de: rules/sanitaryProtocolRule.ts (SanitaryProtocolRule — LEGADO)
  ^ depende de: engine/protocolRules.ts (getAnimalAgeInDays)
  ^ consumido por: demand/sanitaryDemand.ts

demand/sanitaryDemand.ts
  ^ depende de: eligibility/sanitaryEligibility.ts
  ^ consumido por: preview/sanitaryOperationalPreview.ts

preview/sanitaryOperationalPreview.ts
  ^ depende de: demand/sanitaryDemand.ts
  ^ consumido por: agenda/sanitaryAgendaMaterialization.ts

agenda/sanitaryAgendaMaterialization.ts
  ^ depende de: preview/sanitaryOperationalPreview.ts
  ^ consumido por: agenda/sanitaryAgendaClosure.ts
  ^ consumido por: execution/sanitaryEventExecution.ts

agenda/sanitaryAgendaClosure.ts + execution/sanitaryEventExecution.ts
  ^ output: SanitaryAgendaClosureCommand, SanitaryEventExecutionCommand
  ^ ainda desconectados de Dexie/Supabase/sync

reconciliation/sanitaryExceptions.ts + sanitaryCorrections.ts
  ^ depende de: eventos reais (Dexie state_eventos/event_eventos)

compliance/biosecurityOccurrence.ts
  ^ output: EventInput de biossegurança/suspeita
  ^ consumido por: compliance/biosecurityReadModel.ts

customization/customization.ts
  ^ depende de: engine/calendar.ts, engine/regimen.ts, engine/protocolLayers.ts
  ^ output: operações CRUD de protocolos_sanitarios/itens

models/executionPayload.ts
  ^ depende de: catalog/products.ts, engine/regimen.ts
  ^ consumido por: infrastructure/executionBoundary.ts (indireto)

operations/agendaDiagnostics.ts
  ^ depende de: engine/protocolRules.ts (getAnimalAgeInDays)
  ^ depende de: Dexie types (ProtocoloSanitarioItem, AgendaItem)
  ^ LEGADO — diagnostica agenda_itens com dominio=sanitario

infrastructure/service.ts
  ^ LEGADO — RPC sanitario_complete_agenda_with_event, views vw_sanitario_*
  ^ depende de: agenda_itens (resolvida pelo trigger de bloqueio do 12C)

infrastructure/executionBoundary.ts
  ^ orquestra: infrastructure/service.ts + pullDataForFarm
  ^ LEGADO — ainda usa concluirPendenciaSanitaria

hooks/useWithdrawal.ts
  ^ LEGADO — lê eventos reais para carência via hook React
```

---

## 7. Onde há duplicidade ou conflito

### 7.1 CONFLITO CENTRAL: dois modelos de "item de protocolo"

**Modelo A — Legado (operacional)**:
- Tipo: `SanitaryProtocolRule` em `sanitaryProtocolRule.ts`
- Campos-chave: `eligibilityWindow`, `doseIntervals`, `boosters`, `completionCriteria`, `productRequirement`
- Consumido por: `eligibility → demand → preview → agenda → execution`
- Origem: Fase 11.5B0

**Modelo B — V2 (conformidade)**:
- Tipo: `SanitaryProtocolItemVersionV2` em `sanitaryProtocolV2.ts`
- Campos-chave: `logicalItemKey`, `version`, `eligibilityRule`, `operationalWindowRule (unknown)`, `sequenceRule`, `productRequirementRule`
- Consumido por: `sanitarySnapshotBuildersV2 → sanitaryAgendaBridgeV2`
- Origem: Fase 12D1

**Conflito**: os dois modelos coexistem sem bridge formal. `eligibility` consome Modelo A. `snapshotBuilders` consome Modelo B. Um animal que passa por `computeSanitaryEligibility` usa regras do Modelo A. O snapshot de agenda usa regras do Modelo B. Podem divergir silenciosamente.

**Decisão recomendada (não implementar ainda)**:
- `SanitaryProtocolItemVersionV2` deve se tornar o contrato canônico.
- `SanitaryProtocolRule` deve ser mantido como adaptador de compatibilidade transitória.
- Um bridge formal `protocolRuleBridge.ts` será necessário para converter Modelo B → Modelo A até que o pipeline operacional (eligibility/demand/preview/agenda) seja migrado.

### 7.2 `logicalItemKey` — propagação incompleta

| Ponto | Tem `logicalItemKey`? | Observação |
|---|---|---|
| `protocolos_sanitarios_itens.logical_item_key` (Dexie) | ✅ | Campo de banco presente |
| `SanitaryProtocolItemVersionV2.logicalItemKey` | ✅ | Contrato v2 |
| `AgendaTechnicalSnapshot.logicalItemKey` | ✅ | Snapshot de agenda |
| `EventTechnicalSnapshot` | ✅ via `protocol_item_logical_key` | Payload de execução |
| `SanitaryProtocolRule` (legado) | ❌ | Não tem — usa apenas `id` |
| `SanitaryDemandGroup` | ❌ | Não tem — usa `protocolItemId` |
| `SanitaryPreviewGroup` | ❌ | Herdado de demand |
| `SanitaryAgendaMaterializationCommand.dedupKey` | ❌ | Não inclui `logicalItemKey` |
| `SanitaryEventExecutionCommand.dedupKey` | Parcial | Inclui `productId`/`productClass` mas não `logicalItemKey` |

**Campos concorrentes de identidade de item**:
- `item_code` — em `SanitaryProtocolRule.productRequirement` e em `protocolos_sanitarios_itens`
- `protocolItemId` — id da linha em `protocolos_sanitarios_itens`
- `logical_item_key` — chave semântica versionada
- `protocol_item_logical_key` — payload de execução (models/executionPayload.ts)
- `protocol_item_version_id` — FK para linha específica (versionada)

**Regra proposta (não implementar ainda)**: `logicalItemKey` é o identificador semântico canônico. `protocolItemId` é o identificador de versão específica. Ambos devem existir. O `dedupKey` de agenda deve incluir `logicalItemKey`.

### 7.3 `dedupKey` de agenda — campo faltante

`buildDedupKey` em `sanitaryAgendaMaterialization.ts` usa:
`protocolRuleId + protocolItemId + productId + productClass + actionType + loteId + date + animaisOrdenados`

Não inclui `logicalItemKey`. Em revisão semântica de item (nova versão, mesmo `logical_item_key`), o `dedupKey` com `protocolItemId` (nova versão) não colide com o da versão anterior, o que é correto. Porém, em rollback parcial offline, pode gerar duplicidade se `protocolItemId` for reutilizado.

**Decisão recomendada (não implementar ainda)**: incluir `logicalItemKey` no `dedupKey`. Como há liberdade de reset (12B), a quebra de agendas offline existentes é aceitável — sem migration Dexie necessária.

### 7.4 `operationalWindowRule: unknown` em `SanitaryProtocolItemVersionV2`

Campo crítico sem tipo estruturado. Qualquer validação downstream que tente usar `operationalWindowRule` precisa fazer cast manual de `unknown`, sem garantia de segurança.

**Regra proposta (não implementar ainda)**: tipo `SanitaryOperationalWindowRuleCanonical` (ver §11) substituirá `unknown`.

### 7.5 Produto textual vs. produto estruturado

`hasStructuredProduct` em `sanitaryExceptions.ts` verifica apenas `produto_veterinario_id`. Produto digitado manualmente (campo `produto` textual, sem ID) gera exceção `evento_sanitario_sem_produto` de severidade `critical`, mesmo sendo registro válido.

**Regra proposta (não implementar ainda)**:
- Produto textual em evento histórico antigo = `warning` apenas.
- Evento novo sem produto estruturado = `critical`.
- Evento usado para carência/conformidade/exportação sem produto estruturado = `critical`.

### 7.6 Dose, via e carência — onde vivem hoje

| Campo | Local atual | Regra proposta |
|---|---|---|
| Dose geral auditada | `protocolos_sanitarios_itens.dose_num` + item `SanitaryProtocolRule` | Item, se fonte forte auditada |
| Dose produto-específica | `SanitaryProduct.dose` / `SanitaryProductV2` | Produto, com bula auditada |
| Via geral auditada | `protocolos_sanitarios_itens.payload.route` | Item, se fonte forte auditada |
| Via produto-específica | `SanitaryProduct.route` | Produto, com bula auditada |
| Carência geral auditada | `SanitaryProtocolRule` (legado) | Item, se fonte forte — não gera carência ativa |
| Carência produto-específica | `WithdrawalRule` / `WithdrawalRuleV2` no produto | Produto, com bula auditada |
| Carência aplicada | `WithdrawalSnapshotOnEvent` / `EventTechnicalSnapshot` | Snapshot do evento — nunca recalcular |

**Invariante**: agenda nunca gera carência ativa. Carência ativa somente a partir de evento executado com snapshot aplicável.

### 7.7 `operations/agendaDiagnostics.ts` — legado sem migração

`buildSanitaryAgendaDiagnostics` consome diretamente `ProtocoloSanitarioItem` de Dexie (modelo legado), `AgendaItem` com `status='concluido'` e `FazendaSanidadeConfig`. Esta camada de diagnóstico não conhece os contratos v2. Após 12D5+, precisará ser migrada ou substituída.

---

## 8. O que deve ser preservado

```
✅ Invariante: Agenda = intenção futura. Evento = fato executado. Não inverter.
✅ Invariante: `completed` sanitário depende somente de evento executado compatível.
✅ Invariante: carência ativa somente de evento real com snapshot.
✅ Invariante: bubalino não herda autorização de bovino.
✅ Invariante: guideline de apoio isolado não valida campo crítico.
✅ Invariante: NAO_AUTORIZADO, PRECISA_VALIDAR, EXTRAPOLADO bloqueiam uso comercial/conformidade.
✅ Invariante: Correção = novo evento append-only — nunca update destrutivo.
✅ Invariante: read model / state_* = derivado, nunca fonte primária.
✅ Invariante: snapshot = evidência histórica congelada — não recalcular.

✅ Código preservado:
  - engine/ completo (motor puro de cálculo)
  - eligibility/ (motor puro de elegibilidade)
  - demand/ (agrupamento puro)
  - preview/ (simulação pura)
  - agenda/ (intenções puras)
  - execution/ (intenção pura)
  - rules/sanitaryProtocolRule.ts (enquanto eligibility depende)
  - rules/*V2.ts (contratos canônicos futuros)
  - reconciliation/ (auditoria append-only)
  - compliance/ (biossegurança)
  - customization/ (CRUD fazenda)
  - models/executionPayload.ts
  - hooks/useWithdrawal.ts
  - infrastructure/service.ts (enquanto UI legada usar RPC)
  - infrastructure/executionBoundary.ts

✅ Dados preservados (nunca resetar):
  - eventos, eventos_sanitario, insumo_movimentacoes
  - protocolos historicamente usados em eventos reais
  - catálogos técnicos usados em eventos reais
```

---

## 9. O que pode ser resetado

```
🔄 Resetável (com controle):
  - agenda_itens com dominio='sanitario' (já resetado em 12C por soft-delete)
  - state_agenda_itens sanitário
  - payload/dedup/status sanitário legado em agenda_itens
  - seeds/demo sanitários obsoletos

❌ Não resetar sem decisão explícita:
  - protocolos_sanitarios (em uso ativo em UI/offline)
  - protocolos_sanitarios_itens (em uso ativo em UI/offline/sync)
  - catalogo_protocolos_oficiais / catalogo_protocolos_oficiais_itens (referência histórica)
```

---

## 10. Riscos de regressão por camada

| Camada | Risco | Severidade |
|---|---|---|
| `rules/sanitaryProtocolRule.ts` | Qualquer mudança de tipo quebra eligibility → demand → preview → agenda → execution | CRÍTICA |
| `engine/regimen.ts` | Mudança de milestone/regimen quebra catalog, customization e executionPayload | ALTA |
| `engine/calendar.ts` | Mudança de modos/âncoras quebra catalog, customization e agendaDiagnostics | ALTA |
| `agenda/sanitaryAgendaMaterialization.ts` | Mudança de dedupKey quebra deduplicação offline | ALTA |
| `rules/sanitarySnapshotBuildersV2.ts` | Quebra de `hasStrongSourceCoveringFieldV2` desativa governance | CRÍTICA |
| `reconciliation/sanitaryExceptions.ts` | Rebaixamento indevido de `critical` → `warning` libera uso não auditado | ALTA |
| `infrastructure/service.ts` | Depende de `sanitario_complete_agenda_with_event` RPC (legado) | MÉDIA — RPC pode ser descontinuado após 12E |
| `operations/agendaDiagnostics.ts` | Usa `status='concluido'` em `agenda_itens` (bloqueado por trigger 12C) | MÉDIA |
| `compliance/biosecurityReadModel.ts` | `readAgendaSourceEventId` tem 3 fallbacks sem log de path | BAIXA |
| `customization/customization.ts` | `checkSanitaryProtocolDeletionSafety` busca `payload?.protocolo_id` sem validação de schema | BAIXA |

---

## 11. Testes existentes por camada

| Camada | Arquivos de teste | Cobertura confirmada |
|---|---|---|
| `rules/` legado | `protocolRules.test.ts`, `domain.test.ts`, `draft.test.ts`, `draft.advanced.test.ts` | Validadores legado, produto, carência, janela |
| `rules/` v2 | `sanitarySnapshotBuildersV2.test.ts`, `sanitaryAgendaBridgeV2.test.ts` (na pasta `rules/__tests__`) | Builders v2, bridge, bubalino, EXTRAPOLADO |
| `catalog/` | `baseProtocols.test.ts`, `officialCatalog.test.ts`, `officialCatalogOps.test.ts`, `seedCatalog.test.ts` | Estrutura do catálogo, payload de item, ops de INSERT |
| `engine/` | `calendar.test.ts`, `calendarEngine.test.ts`, `regimen.test.ts`, `protocolLayers.test.ts` | Modos de calendário, milestones, sequência |
| `eligibility/` | `schedulerAgendaEligibility.test.ts`, `schedulerSequence.test.ts`, `scheduler.test.ts` | Elegibilidade por janela, sequência de doses |
| `demand/` | (coberto em testes de integração do scheduler) | Agrupamento de demanda |
| `preview/` | (coberto em testes de integração) | Preview operacional |
| `agenda/` | `sanitarioRecomputeAgendaCore.test.ts` (45 KB) | Fluxo completo de materialização e recompute |
| `execution/` | `executionBoundary.test.ts`, `executionPreflight.test.ts`, `executionPayload.test.ts` | Boundary, preflight, payload |
| `reconciliation/` | `complianceGuards.test.ts`, `compliance.test.ts`, `complianceAttention.test.ts` | Exceções, guards, atenção |
| `compliance/` | `biosecurityOccurrence.test.ts` | Ocorrências de biossegurança |
| `customization/` | `customization.test.ts`, `customization.characterization.test.ts` | CRUD de protocolo fazenda |
| `operations/` | `agendaDiagnostics.test.ts` | Diagnósticos de agenda legada |
| `infrastructure/` | `agendaSchedule.test.ts`, `service.test.ts` | Agendamento, service |
| `hooks/` | `withdrawalReadModel.test.ts`, `activeWithdrawal.test.ts`, `withdrawal_sql_parity.test.ts` | Carência, read model, paridade SQL |

**Smoke test crítico antes de qualquer patch**: `sanitarioRecomputeAgendaCore.test.ts` (45 KB, fluxo completo).

---

## 12. Proposta de contrato canônico futuro do item sanitário

> Não implementar ainda. Avaliar alinhamento com tipos existentes antes de criar.

### 12.1 Regra de elegibilidade

```ts
type SanitaryEligibilityRuleCanonical = {
  species: Array<"bovino" | "bubalino">;
  sex: "M" | "F" | "todos" | null;
  ageStartDays: number | null;
  ageEndDays: number | null;
  categoryKeys?: string[];
  aptitude?: Array<"corte" | "leite" | "mista" | "all">;
  excludeAnimalStatuses: Array<"morto" | "vendido" | "transferido" | "inativo">;
  acquisitionMode?: "all" | "born_on_farm" | "acquired";
};
```

**Alinhamento atual**: `SanitaryProtocolRule.eligibilityWindow` cobre `start.anchor` e `offsetDays`, mas não cobre `species`, `aptitude` ou `acquisitionMode` de forma estruturada. `SanitaryProtocolItemVersionV2.eligibilityRule` é o campo destinado, mas não tem tipo concreto.

### 12.2 Janela operacional

```ts
type SanitaryOperationalWindowRuleCanonical = {
  triggerModel:
    | "age_based"
    | "event_based"
    | "calendar_based"
    | "risk_based"
    | "hybrid";

  anchor:
    | "birth_date"
    | "farm_entry"
    | "previous_item_completion"
    | "last_family_completion"
    | "weaning"
    | "expected_calving"
    | "calendar_month"
    | "manual"
    | "clinical_event";

  targetOffsetDays: number | null;
  windowStartOffsetDays: number | null;
  windowEndOffsetDays: number | null;

  hardWindow: boolean;
  missedWindowPolicy: "block" | "allow_late_with_warning" | "manual_review";

  materializationStrategy:
    | "exact_date"
    | "group_inside_window"
    | "next_handling_inside_window"
    | "manual_review";

  preferredMonths?: number[];
};
```

**Alinhamento atual**: `engine/calendar.ts` cobre `mode` (`campaign`, `age_window`, `rolling_interval`, `immediate`, `clinical_protocol`) e `anchor`. O tipo canônico proposto é mais expressivo. `SanitaryProtocolItemVersionV2.operationalWindowRule` é `unknown` — este tipo o substituiria.

### 12.3 Regra de sequência

```ts
type SanitarySequenceRuleCanonical = {
  sequenceOrder: number;
  dependsOnItemKey: string | null;

  scheduleKind:
    | "calendar_base"
    | "after_previous_completion"
    | "rolling_from_last_completion";

  interval: {
    minDays: number | null;
    targetDays: number | null;
    maxDays: number | null;
  } | null;

  nextItemKeys: string[];

  recurrence?: {
    enabled: boolean;
    everyDays: number;
    anchor: "last_valid_completion";
  };
};
```

**Alinhamento atual**: `engine/regimen.ts` cobre `sequenceOrder`, `milestoneCode`, `dependsOnMilestone`, `scheduleKind`. O tipo canônico proposto consolida e enriquece. `SanitaryProtocolItemVersionV2.sequenceRule` é o campo destinado.

### 12.4 Requisito de produto

```ts
type SanitaryProductRequirementRuleCanonical = {
  kind: "none" | "specific_product" | "product_class" | "product_class_group";

  productId?: string | null;
  productClass?: string | null;

  productClassGroup?: {
    key: string;
    allowedProductClasses: string[];
    requiresMvForOtherClass: boolean;
  } | null;

  executionProductPolicy:
    | "not_required"
    | "required_at_execution"
    | "required_at_agenda"
    | "fixed_by_protocol";
};
```

**Alinhamento atual**: `SanitaryProtocolRule.productRequirement.kind` cobre `specific_product` e `product_class`, mas não `product_class_group`. `ExecutionProductPolicy` (12D4) mapeia para `executionProductPolicy`. `SanitaryProtocolItemVersionV2.productRequirementRule` é o campo destinado.

### 12.5 Relação com tipos existentes

| Contrato canônico proposto | Tipo existente mais próximo | Gap |
|---|---|---|
| `SanitaryEligibilityRuleCanonical` | `SanitaryProtocolRule.eligibilityWindow` | Não cobre `species`, `aptitude`, `acquisitionMode` |
| `SanitaryOperationalWindowRuleCanonical` | `SanitaryBaseCalendarRule` (engine/calendar.ts) | Não cobre `hardWindow`, `missedWindowPolicy`, `materializationStrategy` |
| `SanitarySequenceRuleCanonical` | `SanitaryRegimenMilestone` (engine/regimen.ts) | Não cobre `interval.minDays/maxDays`, `recurrence` |
| `SanitaryProductRequirementRuleCanonical` | `SanitaryProtocolRule.productRequirement` | Não cobre `product_class_group`, `executionProductPolicy` |
| — | `SanitaryProtocolItemVersionV2` | Contém todos os campos acima como `unknown` ou ausentes |

---

## 13. Plano incremental para ajustar `rules/` após rebaseline

> Executar somente após aprovação explícita de cada etapa.

| Etapa | Descrição | Escopo |
|---|---|---|
| **13.1** | Tipar `operationalWindowRule` em `SanitaryProtocolItemVersionV2` | `rules/sanitaryProtocolV2.ts` — sem quebra de contrato |
| **13.2** | Tipar `eligibilityRule`, `sequenceRule`, `productRequirementRule` em `SanitaryProtocolItemVersionV2` | `rules/sanitaryProtocolV2.ts` — sem quebra de contrato |
| **13.3** | Criar bridge de leitura `rules/protocolRuleBridge.ts` | Adaptador `SanitaryProtocolItemVersionV2` → `SanitaryProtocolRule` — sem remover legado |
| **13.4** | Adicionar `logicalItemKey` a `SanitaryDemandGroup` e `SanitaryPreviewGroup` | `demand/`, `preview/` — campo opcional, retrocompatível |
| **13.5** | Incluir `logicalItemKey` no `dedupKey` de agenda | `agenda/sanitaryAgendaMaterialization.ts` — avaliar impacto em estado offline |
| **13.6** | Ajustar `hasStructuredProduct` para aceitar produto textual como `warning` em eventos históricos | `reconciliation/sanitaryExceptions.ts` |
| **13.7** | Migrar `operations/agendaDiagnostics.ts` para contratos v2 | Após 12D5 estabilizar `ProductClass` |
| **13.8** | Descontinuar `infrastructure/service.ts` RPC legado | Após 12E integrar sanitario_agenda_v2 com Dexie/sync |

**Smoke test obrigatório antes de cada etapa**: `sanitarioRecomputeAgendaCore.test.ts`.

---

## 14. Critérios de aceite para avançar para ajuste de código

O documento 12D3 está pronto. Os critérios abaixo definem quando uma etapa de código pode ser iniciada:

1. **Quais módulos existem** — ✅ mapeados em §2.
2. **Responsabilidade de cada um** — ✅ descrita em §3.
3. **Fonte da verdade por conceito** — ✅ mapeada em §5.
4. **Duplicidade entre catalog, engine, rules, eligibility** — ✅ descrita em §7.
5. **O que deve ser preservado** — ✅ listado em §8.
6. **O que pode ser resetado** — ✅ listado em §9.
7. **Contrato canônico futuro do item** — ✅ proposto em §12.
8. **Sexo, idade, janela, tolerância, dependência, sequência, recorrência** — ✅ mapeados em §12.
9. **Dose/via/carência entre item, produto e evento** — ✅ resolvidos em §7.6.
10. **Produto textual legado** — ✅ regra proposta em §7.5.
11. **`logicalItemKey`, `itemVersion` e `dedupKey`** — ✅ auditados em §7.2 e §7.3.
12. **Patches bloqueados até aprovação** — ✅ declarados abaixo.

---

## 15. Patches bloqueados (decisão final)

```
BLOQUEADO até aprovação explícita de cada etapa em §13:

- Não alterar código em src/lib/sanitario/rules/**
- Não alterar eligibility/, demand/, preview/, agenda/, execution/
- Não criar migration SQL
- Não alterar RLS, policies ou RPCs
- Não alterar Dexie/offline stores
- Não alterar sync-batch
- Não criar UI ou fluxo operacional novo
- Não importar como seed ou carga final
- Não criar agenda automática
- Não criar evento ou baixar estoque
- Não calcular carência ativa
- Não rebaixar exceção de produto textual ainda (etapa 13.6)
- Não corrigir dedupKey ainda (etapa 13.5)
- Não descomissionar engine/
- Não migrar catalog/ para rules/
- Não criar bridge antes do contrato canônico dos tipos (etapas 13.1–13.2)
- Não marcar fase como concluída sem validação
```

---

## 16. Decisão

```
ALTERAÇÃO ISOLADA EM rules/ CONTINUA BLOQUEADA.

PRÓXIMA ETAPA SEGURA:
  12D5 — Schema/contratos TypeScript de ProductClass, ProductClassDefaultRule e ProductClassMembership
  (sem seed, sem UI, sem sync amplo)

  OU

  13.1 — Tipar operationalWindowRule em SanitaryProtocolItemVersionV2
  (patch cirúrgico em rules/sanitaryProtocolV2.ts, sem quebra de contrato)

  Escolher uma das duas antes de qualquer patch direto em rules/.
```

---

*Documento gerado: 2026-06-10*
*Commit de referência: 9fa993d*
*Nenhuma linha de código foi alterada na elaboração deste documento.*
*Diagnóstico local confirmado: repo_ok, sanitario_ok, git diff --check passou para código.*
