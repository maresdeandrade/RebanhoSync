# Mapa validado de fluxos e contratos — RebanhoSync

Atualizado em: 2026-08-23
Code baseline original: `main@9db4bb9ffeb0bc4d1bc07305cde48132cd638721`
Candidate worktree: baseline original + patches consolidados validados de P1 factual, P2 bulk e P2 exclusão
Document revision: working tree até existir commit de oficialização
Classificação: documento derivado de auditoria
Estado: **APTO PARA BASELINE OFICIAL**, sem divergências P0/P1/P2 ativas no escopo validado

> Este documento corrige o relatório “Mapa Oficial de Fluxos e Contratos”. Ele não altera código, migrations, RLS, RPCs ou rollout. O mapa original não deve ser oficializado sem estas correções.

## 1. Baseline e limite da validação

Comandos registrados antes da análise:

```txt
git status -sb
## main...origin/main
 M docs/context/PROJECT_STATUS.md
 M docs/review/ACTIVE_PHASE_PLAN.md
 M docs/review/CURRENT_PHASE_HANDOFF.md
 M docs/review/LAST_PHASE_RESULT.md
 M docs/technical/OFFLINE_SYNC.md
 M docs/technical/TESTING_GATES.md
 M src/components/manejo/AdicionarAnimaisLote.tsx
 M src/lib/offline/pull.ts
 M src/lib/offline/syncWorker.ts
 M src/lib/offline/tableMap.ts
?? docs/review/evidence/MAPA_FLUXOS_CONTRATOS_REBANHOSYNC_VALIDADO.md
?? docs/review/evidence/PARECER_VALIDACAO_MAPA_FLUXOS_CONTRATOS.md
?? src/components/manejo/__tests__/AdicionarAnimaisLote.test.tsx
?? src/lib/offline/__tests__/animalDeletionFlow.test.ts
?? src/lib/offline/__tests__/factualDetailsPull.test.ts
?? src/lib/offline/__tests__/factualDetailsSyncRefresh.test.ts
?? src/pages/__tests__/AnimalEditarDelete.test.tsx

git rev-parse HEAD
9db4bb9ffeb0bc4d1bc07305cde48132cd638721

git log --oneline -1
9db4bb9 graphify

git diff --check
(sem saída; aprovado)
```

O `HEAD` inspecionado continua sendo `9db4bb9ffeb0bc4d1bc07305cde48132cd638721`, em `main`, alinhado a `origin/main`. Esse é o **CODE BASELINE ORIGINAL**. O **CANDIDATE WORKTREE** acrescenta os patches ainda não commitados e já validados em gate consolidado: pull/refresh de `eventos_ecc`, `eventos_pesagem` e `eventos_financeiro`; contagem real em `AdicionarAnimaisLote`; e regressão persistente da exclusão de animal. Nenhum hash é atribuído a esses patches antes de um commit real. A **DOCUMENT REVISION** permanece working tree.

As alterações documentais preexistentes foram preservadas. Esta oficialização altera somente este mapa e `docs/architecture/OPERATIONAL_FLOWS.md`.

O escopo complementar cobriu exclusivamente as lacunas solicitadas: exclusões de animal/lote/pasto, ECC, pesagem, nutrição, financeiro, compra, venda individual, venda em lote, operações bulk e importações de animais/lotes/pastos. Contratos anteriormente validados não foram revalidados.

## 2. Contratos fundamentais

| Conceito | Contrato validado |
|---|---|
| Agenda | Intenção ou tarefa futura; fechamento administrativo não prova execução. |
| Evento + detalhe | Fato histórico executado e sua evidência de domínio. |
| `state_*` | Estado atual/read model; não substitui histórico factual. |
| Protocolo | Regra/configuração; não prova execução. |
| Tags, sinais e insights | Auxiliares de UX; não são fonte crítica. |
| Fazenda ativa | Toda leitura operacional deve demonstrar pertencimento à fazenda ativa, por filtro na consulta ou validação imediata após lookup por chave. |

## 3. Escrita, offline e reload

O pipeline operacional padrão é:

```txt
UI/orquestração
  → builder/command
  → createGesture
  → transação Dexie local
  → queue_gestures + queue_ops
  → sync-batch
  → resultado por operação
  → reconcile/pull
  → read models e consumidores
```

Mutações operacionais padrão usam `createGesture` e writers canônicos. Isso não autoriza writes diretos em UI/domínio. Fluxos especializados devem documentar sua composição, identidade e garantias; não devem ser chamados de bypass apenas por terem um orquestrador próprio.

No reload offline do mesmo dispositivo, Dexie preserva estado e fila. A UI pode reconstruir read models já materializados sem depender de pull. Quando a conectividade retorna, worker, pull e reconciliação convergem somente para as tabelas efetivamente incluídas. O worker corrente é client-side e roda em intervalo de 5 segundos enquanto o shell da aplicação está ativo.

Contrato corrigido no candidate worktree: `DEFAULT_REMOTE_TABLES` e o refresh pós-sync incluem `eventos_ecc`, `eventos_pesagem` e `eventos_financeiro`. `APPLIED` e `APPLIED_ALTERED` convergem; pending local é protegido em merge e replace; ECC usa `event_id`, enquanto pesagem e financeiro usam `evento_id`. O isolamento por `fazenda_id` permanece obrigatório. `eventos_nutricao` já integrava o pull padrão.

## 4. Resultados de sync e reconciliação

| Resultado | Semântica validada |
|---|---|
| `APPLIED` | Operação confirmada; removida da fila e nunca revertida por outro resultado da mesma gesture. |
| `APPLIED_ALTERED` | Operação confirmada com resultado canônico alterado/no-op de deduplicação; tratada como aplicada e seguida de pull para convergência. |
| `RETRYABLE` | Resultado transitório; identidade é preservada para retry. |
| `REJECTED` | Resultado terminal; evidência operacional é registrada e rollback considera apenas a operação não confirmada. |
| `CONFLICT` | Resultado terminal conforme o fluxo. |
| `BLOCKED_DEPENDENCY` | Terminal apenas quando a dependência concreta terminou em rejeição/conflito; caso contrário permanece retryable. |

`APPLIED_ALTERED` é produzido explicitamente por `sync-batch`, inclusive em deduplicação `collision_noop`; é reconhecido por `syncWorker.ts` e `syncReconciliation.ts`. O teste `syncPartialBatch.test.ts` cobre `APPLIED + REJECTED + APPLIED_ALTERED`, preservação do resultado por operação e pull canônico.

### Identidade e idempotência

O contrato comprovado é baseado em identidade estável:

- retry/reload do mesmo comando preserva `client_tx_id` e `client_op_id`;
- o helper genérico remoto reconhece replay quando ambos os identificadores coincidem com os persistidos;
- INSERT sobre chave primária existente com identidade diferente é rejeitado como `OPERATION_IDENTITY_CONFLICT`;
- fluxos especializados podem aplicar comparações adicionais de conteúdo.

Limite importante: `isPersistedOperationReplay` não compara hash ou conteúdo completo do fato. Portanto, a documentação não deve afirmar genericamente que “todo conteúdo incompatível com os mesmos IDs é rejeitado”. O contrato de uso continua sendo: IDs estáveis representam o mesmo comando; correção factual cria nova identidade/evento conforme o domínio.

## 5. Importação V2

`persistImportV2Preview` é um orquestrador especializado, mas não contorna `createGesture`. Para cada chunk ele chama `createGesture`, fornece `clientTxId` e `clientOpIds` determinísticos e mantém sucesso parcial explícito.

Classificação correta: **composição especializada sobre o writer canônico**, com preview, chunks e identidades determinísticas. Não há evidência, nesse caminho, de bypass da fila padrão, de RLS ou do contrato offline-first.

## 6. Isolamento por fazenda

O contrato não exige um único formato de consulta. As telas de detalhe usam lookup por chave e validam `record.fazenda_id === activeFarmId` em `detailFarmIsolation.ts`; outras leituras filtram por `fazenda_id` na consulta.

Os testes confirmam animal, lote e pasto cross-farm, troca de `activeFarmId` e reload com URL cruzada. Sem consumidor concreto que contorne essa fronteira, o risco cross-farm deve permanecer como invariante preventiva, não divergência P1.

## 7. Occupancy

O read model de occupancy combina:

- `state_animais` e `state_lotes/state_pastos` para estado corrente;
- `event_eventos` + `event_eventos_movimentacao` para períodos factuais;
- `event_eventos_pesagem` para peso e GMD;
- `event_eventos_ecc` para ECC.

O pipeline canônico é:

```txt
buildAnimalOccupancyTimeline
  → AnimalOccupancyPeriod
  → buildWeightGainForOccupancy
  → buildEccMetricsForOccupancy
  → buildLoteOccupancyMetrics / buildPastoOccupancyMetrics
```

`AnimalOccupancyPeriod` exige `weightStatus` e `eccStatus`, com estados `empty`, `partial`, `complete` ou `bloqueado`. Ausência de peso/ECC não deve quebrar a reconstrução nem virar zero factual.

## 8. Movimentações e consumidores

| Superfície | Builder/writer | Fato e estado | Consumidores principais |
|---|---|---|---|
| `AdicionarAnimaisLote.tsx` | `buildEventGesture` + `createGesture` | movimento factual + `state_animais.lote_id` | `LoteDetalhe`, occupancy, detalhe do animal |
| `MoverAnimalLote.tsx` | `buildEventGesture` + `createGesture` | origem/destino de lote + estado atual | `AnimalDetalhe`, `LoteDetalhe`, occupancy |
| `MudarPastoLote.tsx` | `buildEventGesture` + `createGesture` | origem/destino de pasto + `state_lotes.pasto_id` | `LoteDetalhe`, `PastoDetalhe`, occupancy |
| `TrocarTouroLote.tsx` | atualização cadastral do lote | `state_lotes.touro_id` | `LoteDetalhe` |

As lacunas de remoções, ECC, pesagem, nutrição, financeiro e operações bulk são fechadas nas seções 13 a 19.

## 9. Exclusão de animal

O termo “soft-delete” isolado é impreciso para o fluxo da tela:

- `createGesture` registra ação `DELETE` e marca `deleted_at` no store local;
- `sync-batch` implementa o DELETE remoto como `UPDATE deleted_at`;
- `AnimalEditar.tsx` remove fisicamente a linha local logo após criar a gesture.

Formulação correta: **exclusão lógica no contrato remoto, com remoção física imediata da projeção local pela tela atual**. O harness dirigido confirmou reload offline, rollback de rejeição, aplicação remota seguida de pull e timeout/retry; o candidate worktree transformou esses cenários em testes persistentes.

No candidate worktree, esse risco foi encerrado pelos testes persistentes `AnimalEditarDelete.test.tsx` e `animalDeletionFlow.test.ts`, que protegem o handler, Dexie, filas, `before_snapshot`, reload, rejeição/rollback, aplicação/pull, timeout/retry, identidade, tombstone e isolamento por fazenda.

## 10. Venda, abate e aptidão

O sistema não pode declarar aptidão operacional, sanitária ou regulatória para venda/abate sem fonte técnica explícita. Isso não equivale a bloquear todo registro comercial: a própria UI declara que compra e venda são registros manuais e não validam aptidão comercial.

A existência de uma venda factual não representa, por si só, declaração de conformidade ou liberação sanitária.

## 11. Rejeições e auditabilidade

`queue_rejections` é evidência operacional temporária para retry, reconciliação, suporte e exportação JSON. `purgeRejections` remove itens com mais de 7 dias e o worker agenda essa limpeza periodicamente.

Logo:

```txt
queue_rejections = DLQ/evidência operacional temporária
queue_rejections ≠ histórico factual permanente do domínio
```

“Não remover evidência de REJECTED” significa preservá-la durante retry/reconciliação e respeitar a política de retenção, não retenção eterna.

## 12. Testes como contrato

Classificação usada: `unit` para regra/builder isolado; `component` para UI renderizada; `integration` para Dexie/queue/pull/worker; `hotspot` para cenário dirigido de alto risco; `smoke` para travessia mínima; `ausente` quando não existe teste específico persistido.

| Fluxo | Teste específico existente | Classe | Resultado desta finalização |
|---|---|---|---|
| Excluir animal | `AnimalEditarDelete.test.tsx`; `animalDeletionFlow.test.ts`; `syncPartialBatch.test.ts` | `component`, `integration` | fluxo persistente aprovado: local, reload, REJECTED, APPLIED/pull e retry |
| Excluir lote | Não existe ação; `LoteEditarData.test.ts` não testa exclusão | `ausente` | NÃO APLICÁVEL |
| Excluir pasto | Não existe ação; `PastosP2.test.tsx` não testa exclusão | `ausente` | NÃO APLICÁVEL |
| ECC | `nonFinancialFinalize.effect.test.ts`; `eventos_ecc_sync.test.ts`; `sync_eventos_ecc.test.ts` | `unit`, `hotspot`, `integration` | aprovado |
| Pull factual ECC/pesagem/financeiro | `factualDetailsPull.test.ts`; `factualDetailsSyncRefresh.test.ts` | `integration` | pull limpo, pending, farm isolation, APPLIED e APPLIED_ALTERED aprovados |
| Pesagem | `buildEventGesture.test.ts`; `factualDetailsPull.test.ts`; testes de occupancy | `unit`, `integration` | aprovado |
| Nutrição | `validators.test.ts`; `consumoGesture.test.ts`; `sync_insumo_movimentacoes.test.ts` | `unit`, `integration` | aprovado |
| Financeiro | `transactions.test.ts`; `createRegistrarFinalizeController.test.ts`; `financePull.test.ts` | `unit`, `hotspot`, `integration` | aprovado |
| Compra comercial | `commercialOperationCommandV2.test.ts`; `animalPurchaseGesture.test.ts`; `commercialPurchaseSyncWorker.test.ts`; `commercialPurchasePull.test.ts` | `unit`, `integration`, `hotspot` | aprovado |
| Venda individual | `commercialOperationCommandV2.test.ts` — compra individual e atualização de venda; `commercialPurchaseSyncWorker.test.ts` — rollback de venda | `unit`, `integration` | aprovado |
| Venda em lote | `commercialOperationCommandV2.test.ts` — N animais/um fato, composição congelada e limite 500; `commercialPurchasePull.test.ts` | `unit`, `integration`, `hotspot` | aprovado |
| Operações bulk | `AdicionarAnimaisLote.test.tsx`; `DialogAccessibility.test.ts` | `component`, `integration` | 10/10, 8/10, 0/5 e descartados sem ops aprovados |
| Importar animais | `importV2.test.ts`; `importV2Persistence.test.ts`; `importV2CreateGesture.test.ts`; `AnimaisImportar.e2e.test.tsx` | `unit`, `integration`, `component`/`smoke` | aprovado |
| Importar lotes | `importV2.test.ts`; `importV2Persistence.test.ts`; `LotesImportar.e2e.test.tsx` | `unit`, `component`/`smoke` | aprovado |
| Importar pastos | `importV2.test.ts`; `importV2Persistence.test.ts`; `PastosImportar.e2e.test.tsx` | `unit`, `component`/`smoke` | aprovado |

Gate consolidado do candidate worktree: 24 arquivos e 115 testes focados aprovados, além de integration 29/29, hotspots 570/570 e smoke 5/5. Os totais de execuções anteriores possuem sobreposição e não devem ser somados.

## 13. Exclusões

### 13.1 Excluir animal

```txt
AÇÃO: confirmar “Excluir animal”
→ UI: AnimalEditar.tsx
→ handler: handleDelete
→ validação: animal carregado + confirmação do usuário
→ builder/service: NÃO APLICÁVEL
→ createGesture/writer: createGesture(fazenda_id, [DELETE animais])
→ OperationInput: { table: "animais", action: "DELETE", record: { id } }
→ Dexie: applyOpLocal captura before_snapshot e marca deleted_at; depois a UI remove state_animais[id]
→ Evento: NÃO APLICÁVEL
→ state_*: state_animais perde fisicamente a projeção local
→ queue: uma gesture + uma queue_op DELETE, com before_snapshot
→ sync-batch: converte DELETE em UPDATE remoto de deleted_at com IDs do comando
→ remoto: animais mantém tombstone
→ reconcile/pull: REJECTED restaura before_snapshot; APPLIED remove a op; pull materializa o tombstone
→ read model: consultas de animais ativos não exibem o registro
→ consumidores: Animais, AnimalDetalhe, lotes/pastos, dashboards e seletores
→ reload: offline mantém ausência + fila; após rejeição restaura; após pull aplicado mantém tombstone
```

O harness dirigido original foi convertido em regressão persistente:

| Cenário | Evidência |
|---|---|
| Exclusão local | `AnimalEditarDelete.test.tsx` e `animalDeletionFlow.test.ts` confirmam gesture, DELETE, snapshot e remoção operacional |
| Reload offline | `animalDeletionFlow.test.ts` fecha/reabre Dexie e preserva ausência, fila e snapshot |
| Rejeição remota + rollback | snapshot original restaurado, rejeição registrada e op APPLIED preservada |
| Aplicação remota + pull | op consumida, tombstone materializado e consulta operacional sem ressurreição |
| Timeout/retry | gesture `PENDING`, mesmos `client_tx_id`/`client_op_id` e convergência sem duplicação |

Estado: **RESOLVIDO**. O handler e o pipeline Dexie/queue/worker/pull possuem proteção persistente complementar.

### 13.2 Excluir lote

```txt
AÇÃO: NÃO APLICÁVEL — não há ação de exclusão localizada
→ UI: LoteEditar.tsx oferece edição, não exclusão
→ handler: NÃO APLICÁVEL
→ validação: NÃO APLICÁVEL
→ builder/service: NÃO APLICÁVEL
→ createGesture/writer: NÃO APLICÁVEL
→ OperationInput: NÃO APLICÁVEL
→ Dexie: NÃO APLICÁVEL
→ Evento: NÃO APLICÁVEL
→ state_*: NÃO APLICÁVEL para exclusão
→ queue: NÃO APLICÁVEL
→ sync-batch: NÃO APLICÁVEL
→ remoto: NÃO APLICÁVEL
→ reconcile/pull: NÃO APLICÁVEL
→ read model/consumidores/reload: NÃO APLICÁVEL ao fluxo inexistente
```

### 13.3 Excluir pasto

```txt
AÇÃO: NÃO APLICÁVEL — não há ação de exclusão localizada
→ UI: PastoEditar.tsx oferece edição, não exclusão
→ handler: NÃO APLICÁVEL
→ validação: NÃO APLICÁVEL
→ builder/service: NÃO APLICÁVEL
→ createGesture/writer: NÃO APLICÁVEL
→ OperationInput: NÃO APLICÁVEL
→ Dexie: NÃO APLICÁVEL
→ Evento: NÃO APLICÁVEL
→ state_*: NÃO APLICÁVEL para exclusão
→ queue: NÃO APLICÁVEL
→ sync-batch: NÃO APLICÁVEL
→ remoto: NÃO APLICÁVEL
→ reconcile/pull: NÃO APLICÁVEL
→ read model/consumidores/reload: NÃO APLICÁVEL ao fluxo inexistente
```

## 14. ECC, pesagem e nutrição

### 14.1 ECC

```txt
AÇÃO: Registrar → ECC → finalizar
→ UI: RegistrarEccSection.tsx em Registrar/index.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: actionStepIssues/finalize guards + escala/valor por animal
→ builder/service: resolveRegistrarNonFinancialFinalizePlan → buildRegistrarEventInput → buildEventGesture
→ createGesture/writer: runRegistrarFinalizeGestureEffect; uma gesture para a seleção
→ OperationInput: por animal preenchido, INSERT eventos + INSERT eventos_ecc
→ Dexie: event_eventos + event_eventos_ecc
→ Evento: um fato ECC por animal preenchido; vazios não geram fato
→ state_*: NÃO APLICÁVEL; ECC corrente é derivado de eventos
→ queue: uma gesture, duas ops por fato
→ sync-batch: processamento genérico por op, com dependência base/detalhe
→ remoto: eventos + eventos_ecc
→ reconcile/pull: por op; eventos_ecc está no pull padrão e no refresh pós-sync; pending local é protegido por event_id
→ read model: último ECC e métricas de occupancy
→ consumidores: Registrar, AnimalDetalhe, Home, LoteDetalhe e PastoDetalhe
→ reload: preserva no mesmo Dexie; instalação limpa/outro dispositivo recompõe o detalhe pelo pull padrão
```

Bulk ECC: uma gesture; uma dupla de ops e um evento por animal preenchido; resultados remotos podem ser parciais por op; rollback usa `before_snapshot` apenas quando aplicável; retry preserva IDs das ops pendentes; a UI conta animais com ECC preenchido.

### 14.2 Pesagem

```txt
AÇÃO: Registrar → Pesagem → finalizar
→ UI: RegistrarPesagemSection.tsx em Registrar/index.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: peso por animal + validators do evento
→ builder/service: resolveRegistrarNonFinancialFinalizePlan → buildRegistrarEventInput → buildEventGesture
→ createGesture/writer: uma gesture para a seleção
→ OperationInput: por animal, INSERT eventos + INSERT eventos_pesagem
→ Dexie: event_eventos + event_eventos_pesagem
→ Evento: um fato de pesagem por animal
→ state_*: NÃO APLICÁVEL; peso histórico/read model deriva de eventos
→ queue: uma gesture, duas ops por animal
→ sync-batch: processamento genérico por op
→ remoto: eventos + eventos_pesagem
→ reconcile/pull: por op; eventos_pesagem está no pull padrão e no refresh pós-sync; pending local é protegido por evento_id
→ read model: peso recente, GMD e occupancy
→ consumidores: AnimalDetalhe, Animais, Eventos, Dashboard, Relatorios, Home, LoteDetalhe e PastoDetalhe
→ reload: preserva localmente; instalação limpa/outro dispositivo recompõe o detalhe pelo pull padrão
```

Bulk pesagem: uma gesture, uma dupla de ops/um evento por animal; sucesso parcial, rollback e retry são por op; contagem de UI usa os animais selecionados com peso válido.

### 14.3 Nutrição

```txt
AÇÃO: Registrar → Nutrição → finalizar
→ UI: RegistrarNutricaoSection.tsx + RegistrarInventorySection.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: alimento, quantidade e, se houver baixa, insumo/lote/unidade
→ builder/service: resolveRegistrarNonFinancialFinalizePlan → buildRegistrarEventInput → buildEventGesture → buildConsumoMovimentacaoOp opcional
→ createGesture/writer: uma gesture para a seleção
→ OperationInput: por alvo, INSERT eventos + INSERT eventos_nutricao + INSERT insumo_movimentacoes opcional
→ Dexie: event_eventos + event_eventos_nutricao + state_insumo_movimentacoes
→ Evento: um fato nutricional por alvo
→ state_*: movimento de insumo alimenta o read model de estoque; não há state_nutricao
→ queue: uma gesture, ops genéricas por fato/movimento
→ sync-batch: processamento por op
→ remoto: eventos + eventos_nutricao + insumo_movimentacoes
→ reconcile/pull: por op; pós-sync de consumo puxa insumo_lotes e insumo_movimentacoes; eventos_nutricao está no pull padrão
→ read model: histórico nutricional e saldo de estoque
→ consumidores: Eventos, Insumos e AnimalCriaInicial
→ reload: Dexie preserva; pull padrão recompõe eventos_nutricao e estoque
```

Bulk nutrição: uma gesture; um evento por alvo e, quando habilitada, uma baixa por evento; sucesso parcial/rollback/retry são por op; a UI usa a quantidade de alvos selecionados.

## 15. Financeiro

```txt
AÇÃO: Registrar → Financeiro → compra/venda → finalizar
→ UI: RegistrarFinanceiroSection.tsx em Registrar/index.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: natureza, animais, contraparte, preço, peso e checklist aplicável
→ builder/service: resolveRegistrarFinancialFinalizePlan → buildFinancialTransaction → buildEventGesture
→ createGesture/writer: runRegistrarFinalizeGestureEffect; uma gesture
→ OperationInput: INSERT eventos + eventos_financeiro; compra inclui N INSERT animais e pesagens opcionais; venda inclui N UPDATE animais
→ Dexie: event_eventos, event_eventos_financeiro, state_animais e event_eventos_pesagem opcional
→ Evento: um fato financeiro por transação; pesagens adicionais são fatos próprios
→ state_*: animais comprados/vendidos mudam estado; NÃO cria finance_transactions neste fluxo
→ queue: ops genéricas dentro de uma gesture
→ sync-batch: processamento por op; pode haver resultado parcial
→ remoto: eventos, eventos_financeiro, animais e eventos_pesagem opcional
→ reconcile/pull: por op; animais, eventos_financeiro e pesagem são reconciliáveis pelo pull padrão; pending factual local é protegido
→ read model: histórico financeiro factual + estado dos animais
→ consumidores: Financeiro, Home, Eventos, Relatorios e Contrapartes
→ reload: preserva localmente; detalhe financeiro/pesagem é recomposto pelo pull padrão em instalação limpa
```

Unidades bulk: uma gesture; uma operação de estado por animal; um evento financeiro por transação, não por animal; pesagem opcional por animal. O sync genérico admite sucesso parcial por op, rollback seletivo e retry com IDs preservados. A UI apresenta a quantidade de animais derivada da seleção/rascunhos.

`finance_transactions` é outro read model financeiro, com pull e proteção de pendência próprios; o builder acima não o escreve. O fluxo comercial da seção 16 também não cria automaticamente `finance_transactions` nem `eventos_financeiro`.

## 16. Compra e venda comercial

### 16.1 Compra

```txt
AÇÃO: Registrar → Comercial → Compra → finalizar
→ UI: RegistrarComercialSection.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: preflight + composição/quantidade/preço; máximo de 500 animais
→ builder/service: resolveRegistrarNonFinancialFinalizePlan → buildCommercialOperationGesture
→ createGesture/writer: uma gesture; createGesture reconhece o comando composto
→ OperationInput: N INSERT animais + INSERT eventos + INSERT eventos_comercial
→ Dexie: state_animais + event_eventos + event_eventos_comercial, atomicamente
→ Evento: exatamente um fato comercial por operação, com IDs congelados
→ state_*: N animais ativos
→ queue: uma op remota commercial_operation_v2, mais auxiliares somente quando aplicáveis
→ sync-batch: handler especializado aplica o comando como unidade
→ remoto: animais + eventos + eventos_comercial
→ reconcile/pull: pull das três tabelas; proteção enquanto o comando está pendente
→ read model: animais ativos + histórico comercial
→ consumidores: Animais, AnimalDetalhe, Eventos, Home/Relatorios e superfícies comerciais
→ reload: preserva comando/estado local; pull é idempotente após consumo
```

Unidades: uma gesture, uma op remota composta, um evento comercial. Não há sucesso parcial por animal. Falha local reverte animais/fato/fila integralmente; conflito remoto preserva histórico e comando para resolução; retry transitório reenvia o mesmo comando. A UI conta `newAnimals.length` e o comando exige igualdade com `declaredQuantity`.

### 16.2 Venda individual

```txt
AÇÃO: Registrar → Comercial → Venda individual → finalizar
→ UI/handler/validação: RegistrarComercialSection → handleFinalize → controller/preflight
→ builder/service: buildCommercialOperationGesture com um ID congelado
→ createGesture/writer: uma gesture composta
→ OperationInput: UPDATE do animal + INSERT eventos + INSERT eventos_comercial
→ Dexie: state_animais.status vendido/lote nulo + dois stores de evento
→ Evento: um fato comercial
→ state_*: um animal vendido
→ queue/sync-batch/remoto: uma commercial_operation_v2 atômica
→ reconcile/pull: animais + eventos + eventos_comercial, com proteção de pendência
→ read model/consumidores: estado de venda e histórico comercial
→ reload: preserva localmente e converge pelo pull especializado
```

Unidades: uma gesture, uma op, um evento, um animal. Sucesso parcial por animal: NÃO APLICÁVEL. Rollback/retry seguem o comando composto. Contagem exibida: um animal selecionado.

### 16.3 Venda em lote

```txt
AÇÃO: Registrar → Comercial → Venda em lote → congelar snapshot → finalizar
→ UI: RegistrarComercialSection.tsx
→ handler: handleFinalize → createRegistrarFinalizeController
→ validação: snapshot do lote, elegibilidade, composição inalterada, quantidade, preço e limite 500
→ builder/service: buildCommercialOperationGesture
→ createGesture/writer: uma gesture composta
→ OperationInput: N UPDATE animais + INSERT eventos + INSERT eventos_comercial
→ Dexie: N estados vendidos + um fato/base, atomicamente
→ Evento: um fato da venda em lote com todos os IDs congelados
→ state_*: N animais vendidos e removidos do lote
→ queue/sync-batch/remoto: uma commercial_operation_v2 atômica
→ reconcile/pull: animais + eventos + eventos_comercial; pendências locais protegidas
→ read model/consumidores: lote/animais refletem saída; histórico mantém o snapshot
→ reload: preserva localmente e converge pelo pull especializado
```

Unidades: uma gesture, uma op remota, um evento. Não há sucesso parcial por animal. Falha local reverte tudo; conflito remoto mantém histórico/comando; retry mantém identidade e conteúdo. A UI mostra `saleSnapshotIds.length` (“Snapshot congelado”) e o builder falha fechado se a composição divergir.

## 17. Operações bulk genéricas

### 17.1 Adicionar animais a lote

```txt
AÇÃO → AdicionarAnimaisLote.tsx → handleConfirm
→ validação: seleção, fazenda, alerta sanitário, existência e elegibilidade atual
→ builder: buildEventGesture(movimentacao) por animal elegível
→ createGesture: uma gesture agregada
→ OperationInput: eventos + eventos_movimentacao + UPDATE animais por animal
→ Dexie: fatos de movimento + state_animais.lote_id
→ Evento: um por animal processado
→ queue/sync-batch/remoto: ops genéricas por registro; resultado parcial possível
→ reconcile/pull: rollback/retry por op; pull de animais/eventos conforme tabelas tocadas
→ read model/consumidores: LoteDetalhe, AnimalDetalhe e occupancy
→ reload: estado/fila preservados em Dexie; convergência pelo worker/pull
```

Unidades: uma gesture, três ops e um evento por animal processado. Falha local reverte toda a transação; falha remota pode ser parcial e o rollback é seletivo. O contrato de resultado é `selected → revalidate → processedAnimalIds → operations → feedback(processedAnimalIds.length)`. Selecionado, elegível, processado, aplicado remotamente e rejeitado são quantidades distintas. Os testes cobrem 10/10, 8/10, 0/5 e ausência de ops para descartados.

### 17.2 Transições coletivas de animais

```txt
AÇÃO → AnimaisTransicoes.tsx → handleApplySelected
→ validação: seleção, fazenda, alertas, regras regulatórias e destino
→ builder: payload de lifecycle + buildEventGesture quando há troca de lote
→ createGesture: uma gesture agregada
→ OperationInput: UPDATE animais por seleção + evento/detalhe de movimentação quando o lote muda
→ Dexie: state_animais e stores de evento/movimentação
→ Evento: um por animal somente quando ocorre mudança de lote
→ queue/sync-batch/remoto: ops genéricas por registro; resultado parcial possível
→ reconcile/pull: rollback/retry por op
→ read model/consumidores: Animais, detalhes, lotes e occupancy
→ reload: estado/fila preservados e convergidos pelo pipeline genérico
```

Unidades: uma gesture; uma UPDATE por animal; zero ou um evento por animal. Sucesso parcial/rollback/retry são por op. A UI usa `selectedRows.length` antes e depois do enqueue.

## 18. Importações V2

Contrato comum: preview determinístico, limite/chunks de 100 linhas, uma gesture por chunk, uma op por linha válida e IDs derivados de fazenda/import/chunk/linha. Erros estruturais não entram na fila. Falha de um chunk não desfaz chunks já importados; retry reutiliza IDs. Não há Evento.

### 18.1 Importar animais

```txt
AÇÃO → AnimaisImportar.tsx → handleImport
→ validação: previewAnimalsImportV2 (template, campos, duplicidades, RFID e referências)
→ builder/service: preview → persistImportV2Preview
→ createGesture/writer: uma gesture por chunk
→ OperationInput: INSERT animais por linha válida
→ Dexie/state_*: state_animais
→ Evento: NÃO APLICÁVEL
→ queue/sync-batch/remoto: uma op por animal → animais
→ reconcile/pull: parcial por op; rollback/retry por linha
→ read model/consumidores: Animais, detalhes, lotes/pastos e dashboards
→ reload: linhas/filas persistem; remoto converge por pull de animais
```

### 18.2 Importar lotes

```txt
AÇÃO → LotesImportar.tsx → handleImport
→ validação: previewLotesImportV2 (template, nome, duplicidade e referência de pasto)
→ builder/service: preview → persistImportV2Preview
→ createGesture/writer: uma gesture por chunk
→ OperationInput: INSERT lotes por linha válida
→ Dexie/state_*: state_lotes
→ Evento: NÃO APLICÁVEL
→ queue/sync-batch/remoto: uma op por lote → lotes
→ reconcile/pull: parcial por op; rollback/retry por linha
→ read model/consumidores: Lotes, LoteDetalhe, pastos e occupancy
→ reload: linhas/filas persistem; remoto converge por pull de lotes
```

### 18.3 Importar pastos

```txt
AÇÃO → PastosImportar.tsx → handleImport
→ validação: previewPastosImportV2 (template, nome, área, manejo e duplicidade)
→ builder/service: preview → persistImportV2Preview
→ createGesture/writer: uma gesture por chunk
→ OperationInput: INSERT pastos por linha válida
→ Dexie/state_*: state_pastos
→ Evento: NÃO APLICÁVEL
→ queue/sync-batch/remoto: uma op por pasto → pastos
→ reconcile/pull: parcial por op; rollback/retry por linha
→ read model/consumidores: Pastos, PastoDetalhe, lotes e occupancy
→ reload: linhas/filas persistem; remoto converge por pull de pastos
```

Contagem das três importações: preview separa válidas, rejeitadas e conflitos; persistência reporta importadas, `retryable` e `skipped`. A unidade apresentada é linha/registro; o resultado por chunk preserva sucesso parcial entre chunks.

## 19. Divergências resolvidas após o baseline original

### P1 original — detalhes de ECC, pesagem e financeiro ausentes do pull padrão

- **Problema original:** no code baseline original, `eventos_ecc`, `eventos_pesagem` e `eventos_financeiro` não integravam `DEFAULT_REMOTE_TABLES` nem o refresh pós-sync genérico.
- **Causa:** o contrato de detalhes factuais padrão não centralizava essas três superfícies nem suas chaves heterogêneas.
- **Contrato corrigido:** as três tabelas integram o pull padrão e o refresh pós-sync; `APPLIED` e `APPLIED_ALTERED` convergem; pending local é protegido em merge e replace; ECC usa `event_id`; pesagem e financeiro usam `evento_id`; o filtro por fazenda permanece obrigatório.
- **Arquivos alterados:** `src/lib/offline/tableMap.ts`, `src/lib/offline/pull.ts`, `src/lib/offline/syncWorker.ts`.
- **Testes:** `factualDetailsPull.test.ts` e `factualDetailsSyncRefresh.test.ts`.
- **Estado:** **RESOLVIDO**.

### P2 original — contagem de sucesso do bulk “Adicionar animais ao lote”

- **Problema original:** selecionados descartados na revalidação podiam ser contados no feedback de sucesso.
- **Causa:** o toast usava `selectedAnimais.size`, enquanto as operações eram construídas somente para elegíveis atuais.
- **Contrato corrigido:** `selected → revalidate → processedAnimalIds → operations → feedback(processedAnimalIds.length)`; descartados não geram ops; zero processados não gera falso sucesso.
- **Arquivo alterado:** `src/components/manejo/AdicionarAnimaisLote.tsx`.
- **Teste:** `AdicionarAnimaisLote.test.tsx`, com 10/10, 8/10, 0/5 e descartados sem operações.
- **Estado:** **RESOLVIDO**.

### P2 original — regressão persistente ausente para exclusão de animal

- **Problema original:** o comportamento estava aprovado somente em harness dirigido efêmero.
- **Causa:** inexistência de teste versionado que combinasse handler, remoção local, reload, rollback, pull e retry.
- **Contrato protegido:** `handleDelete → createGesture → DELETE animais → before_snapshot → deleted_at otimista → remoção da projeção → queue → tombstone remoto → reconcile/pull`.
- **Código produtivo alterado:** nenhum.
- **Testes:** `AnimalEditarDelete.test.tsx` e `animalDeletionFlow.test.ts`.
- **Estado:** **RESOLVIDO**.

### Divergências ativas

Não foram confirmadas outras divergências no escopo do mapa:

- P0: 0;
- P1: 0;
- P2: 0;
- P3: 0.

A ausência de exclusão de lote/pasto permanece `NÃO APLICÁVEL`. `eventos_movimentacao` não aparece diretamente no pull padrão, enquanto reprodução e `eventos_animais` usam caminhos especializados; isso é uma **LIMITAÇÃO CONHECIDA** de convergência por superfície, não uma divergência P1/P2 sem evidência adicional de defeito.

## 20. Fechamento e veredito

| Item | Resultado |
|---|---|
| Fluxos completados | 14/14 solicitados |
| Fluxos ainda incompletos | 0 no escopo solicitado |
| Camadas inexistentes | Marcadas explicitamente como `NÃO APLICÁVEL` |
| Testes focados consolidados | 24 arquivos, 115 testes aprovados |
| Exclusão persistente | 6/6 testes novos aprovados, além das regressões relacionadas |
| Gates globais do candidate worktree | lint, build, integration 29/29, hotspots 570/570, smoke 5/5 e gates:docs aprovados |
| Divergências ativas | 0 P0; 0 P1; 0 P2; 0 P3 |
| Code baseline original | `main@9db4bb9ffeb0bc4d1bc07305cde48132cd638721` (`9db4bb9 graphify`) |
| Estado funcional candidato | baseline original + patches consolidados validados no worktree |

O mapa mantém a evidência das divergências existentes no baseline original e registra a resolução no candidate worktree sem atribuir hash inexistente aos patches ainda não commitados. O documento arquitetural canônico derivado desta auditoria é `docs/architecture/OPERATIONAL_FLOWS.md`.

**APTO PARA BASELINE OFICIAL**
