# F24.2C0 — Auditoria de ACK, state machine da fila e recovery após crash

## Decisão e escopo

```text
F24.2C0 = READY_FOR_REVIEW
F24.2C1 = NOT_STARTED
F24.2C = NOT_COMPLETED
F24.2 = IN_PROGRESS
```

Auditoria read-only sobre `main@2f40be7a889c40311057e0b947a273923973983a`. Nenhum runtime, teste, schema Dexie, migration, RPC, Edge Function, retry ou backoff foi alterado. O contrato da F24.2B permanece fechado: replay com a mesma identidade persiste a mesma execução; esta auditoria trata de liveness, acknowledgement e recovery.

## Conclusões executivas

| Questão                                                  | Classificação | Conclusão baseada em evidência                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYNCING` é persistido?                                  | **CONFIRMED** | `processGesture` grava `queue_gestures.status = "SYNCING"` antes de obter sessão e antes do `fetch` (`src/lib/offline/syncWorker.ts:1020-1048`).                                                                                                                           |
| `SYNCING` é recuperado após restart?                     | **CONFIRMED** | Não. O tick seleciona exclusivamente `PENDING`; recovery de startup seleciona `ERROR`; não há `SYNCING -> PENDING`, lease, owner ou watchdog (`syncWorker.ts:110-123`, `593-618`).                                                                                         |
| ACK de `queue_ops` e `queue_gestures` é sempre atômico?  | **CONFIRMED** | Não. O ACK sanitário canônico e a reconciliação genérica mista usam transação conjunta; o sucesso genérico total apaga ops antes de pull e só depois abre outra transação para atualizar o gesture (`syncWorker.ts:529-587`, `802-872`, `1160-1284`).                      |
| Existe `op` finalizada/ausente com gesture não terminal? | **CONFIRMED** | Sim: no sucesso genérico total, `bulkDelete(queue_ops)` commita antes do `gesture = DONE`; crash deixa `SYNCING` sem ops (`syncWorker.ts:1160-1162`, `1247-1284`).                                                                                                         |
| Partial success sobrevive ao crash?                      | **PARTIAL**   | Depois do commit da transação de reconciliação, sim. Antes dela, um crash deixa o gesture `SYNCING`, portanto sem retomada automática. O caminho sanitário canônico também é atômico no ACK local, mas a reconciliação ocorre depois (`syncWorker.ts:529-589`, `802-927`). |
| Response-lost é replay-safe e retomado?                  | **PARTIAL**   | A identidade é preservada conforme F24.2B e o catch em processo vivo volta a `PENDING`; crash antes do catch persistir a reversão deixa `SYNCING`, que o startup ignora (`syncWorker.ts:1514-1548`).                                                                       |

```text
ACK_ATOMICITY = GAP_CONFIRMED
SYNCING_RECOVERY = GAP_CONFIRMED
```

## Inventário da fila

### `queue_gestures`

| Campo                     | Evidência                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| arquivo/schema            | `src/lib/offline/db.ts:98-103`, schema atual em `db.ts:651`                                                                                              |
| PK                        | `client_tx_id`                                                                                                                                           |
| vínculo gesture-op        | vínculo lógico `queue_ops.client_tx_id`; IndexedDB/Dexie não declara FK                                                                                  |
| statuses possíveis        | tipo: `PENDING`, `SYNCING`, `DONE`, `ERROR`, `SYNCED`, `REJECTED` (`types.ts:19-25`); `SYNCED` é legado/apresentação e não é atribuído pelo worker atual |
| quem cria                 | `createGesture` e writers sanitários, inicialmente `PENDING` (`ops.ts:224-230`, `sanitarioV2Cutover.ts:537-547`)                                         |
| quem altera               | `processGesture`, recovery de `ERROR`, recovery sanitário bloqueado e retry de rejeição (`syncWorker.ts`, `ops.ts:540-591`)                              |
| quem remove               | nenhum caminho normal do worker localizado; reset explícito por fazenda inclui a store (`reset.ts:25-35`)                                                |
| transação Dexie envolvida | criação genérica inclui gesture, ops e apply otimista numa única transação (`ops.ts:364-396`); ACK varia por caminho                                     |
| sobrevive reload?         | sim, tabela Dexie/IndexedDB                                                                                                                              |
| elegível ao worker        | somente `PENDING` no loop (`syncWorker.ts:116-123`)                                                                                                      |
| recovery de startup       | `ERROR` com marcador textual recuperável volta a `PENDING`; `SYNCING` não é consultado (`syncWorker.ts:57-68`, `593-618`)                                |
| estado terminal           | `DONE`, `REJECTED` e `ERROR` na prática; `ERROR` pode ser reaberto se o marcador for recuperável                                                         |
| retry limit               | genérico: `MAX_RETRIES = 3` por execução (`syncWorker.ts:55-56`, `1514-1556`); recovery de startup zera contador para erros reconhecidos                 |
| orphan detection          | `inspectQueueLifecycleHealth` e `inspectOrphanedQueueOperations`; saneamento somente com lista externamente verificada (`queueLifecycle.ts:22-137`)      |
| testes                    | `queueLifecycle.test.ts`, `syncWorkerRecovery.test.ts`, `syncWorkerHttp403.test.ts`, suites de worker listadas em “Cobertura”                            |

### `queue_ops`

| Campo                     | Evidência                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| arquivo/schema            | `src/lib/offline/db.ts:99-103`, schema atual em `db.ts:652`                                                                                                                                                       |
| PK                        | `client_op_id`                                                                                                                                                                                                    |
| vínculo gesture-op        | `client_tx_id`, sem FK física (`types.ts:625-651`)                                                                                                                                                                |
| statuses possíveis        | `sync_state`: `PENDING`, `RETRYABLE`, `REJECTED`, `BLOCKED_DEPENDENCY`; operações genéricas antigas/normais podem ter `sync_state` ausente, que é tratada como pronta (`types.ts:43-47`, `syncWorker.ts:295-300`) |
| quem cria                 | `createGesture`; writers sanitários (`ops.ts:232-345`, `sanitarioV2Cutover.ts:494-547`)                                                                                                                           |
| quem altera               | worker para retry/rejeição/bloqueio; `retryRejectedOperation`; recovery de dependência sanitária                                                                                                                  |
| quem remove               | ACK aplicado, reconciliação parcial, remoção manual de órfã verificada (`syncWorker.ts:529-587`, `810-853`, `1160-1162`; `queueLifecycle.ts:106-137`)                                                             |
| transação Dexie envolvida | criação genérica é atômica com gesture e estado local; ACK canônico/misto é atômico; sucesso genérico total não é atômico com o gesture                                                                           |
| sobrevive reload?         | sim, tabela Dexie/IndexedDB                                                                                                                                                                                       |
| elegível ao worker        | op não `REJECTED`, não `BLOCKED_DEPENDENCY` e cujo `next_attempt_at` venceu (`syncWorker.ts:295-300`, `970-977`)                                                                                                  |
| recovery de startup       | `BLOCKED_DEPENDENCY` sanitário pode voltar a `PENDING`; demais ops dependem de o gesture estar elegível                                                                                                           |
| estado terminal           | a op aplicada é removida; rejeitada permanece com `sync_state = REJECTED`; não há estado local `APPLIED` persistido                                                                                               |
| retry limit               | backoff por op sanitária é exponencial até 5 min, sem limite explícito neste helper; retry genérico é contado no gesture (`syncWorker.ts:279-292`)                                                                |
| orphan detection          | op cujo `client_tx_id` não possui gesture é detectada; remoção não é automática (`queueLifecycle.ts:67-137`)                                                                                                      |
| testes                    | `queueLifecycle.test.ts`, `syncPartialBatch.test.ts`, `sanitarioV2Worker.test.ts`, `sanitarioAgendaV2Sync.test.ts`                                                                                                |

## State machine real

### Classificação dos estados

| Estado     | Papel efetivo                              | Observação                                                                            |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `PENDING`  | `EXECUTABLE`, `RECOVERABLE`                | único estado selecionado pelo loop                                                    |
| `SYNCING`  | `INTERMEDIATE`, `POTENTIALLY_STUCK`        | persistido antes da rede; não selecionado por recovery                                |
| `DONE`     | `TERMINAL`                                 | pode significar ACK remoto concluído; não prova que pull/reconcile concluiu           |
| `REJECTED` | `TERMINAL`, manualmente recuperável por op | retry explícito reabre gesture/op na mesma transação                                  |
| `ERROR`    | `TERMINAL` ou `RECOVERABLE` conforme texto | somente marcadores enumerados são reabertos no startup                                |
| `SYNCED`   | `TERMINAL` legado                          | aceito por queries/UI, mas nenhuma atribuição no runtime offline atual foi localizada |

### Transições confirmadas

| FROM → TO                         | Função/condição                                                                         | Persistência e boundary                                                                                     | Crash/recovery                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| inexistente → `PENDING`           | `createGesture` / enqueue sanitário                                                     | mesma transação que ops e apply local no writer público (`ops.ts:364-396`; `sanitarioV2Cutover.ts:550-560`) | criação normal é atômica                                                    |
| `PENDING` → `SYNCING`             | `processGesture`, há ao menos uma op pronta                                             | update Dexie isolado, antes de sessão/fetch (`syncWorker.ts:970-1048`)                                      | **não recuperável automaticamente após crash**                              |
| `SYNCING` → `DONE`                | tudo aplicado                                                                           | canônico: mesma transação do delete; genérico: delete e pulls antes de transação posterior do gesture       | canônico seguro no ACK; genérico possui janela confirmada                   |
| `SYNCING` → `PENDING`             | erro retryable dentro do processo, resultado retryable/missing, ou ops ainda aguardando | updates persistidos; parcial genérico/canônico usa transação conjunta                                       | recuperável se o update commitar                                            |
| `SYNCING` → `REJECTED`            | rejeição terminal                                                                       | genérico misto/canônico é conjunto; caminho comercial/closure legado possui writes separados                | terminal auditável, mas nem todos os subcaminhos são atomicamente compostos |
| `SYNCING` → `ERROR`               | 403, máximo de retries, bloqueio sanitário                                              | update do gesture; ops permanecem                                                                           | apenas alguns textos de erro reabrem no startup                             |
| `ERROR` → `PENDING`               | `recoverErroredGesturesOnce` e marcador recuperável                                     | update por gesture, executado uma vez por start do worker                                                   | automático somente para marcadores listados                                 |
| `ERROR` → `PENDING`               | recovery de dependência sanitária                                                       | transação conjunta ops+gestures (`syncWorker.ts:626-666`)                                                   | automático no startup para bloqueios localizados                            |
| `REJECTED` → `PENDING`            | `retryRejectedOperation`                                                                | transação conjunta: reaplica local, op e gesture (`ops.ts:540-591`)                                         | explícito/manual                                                            |
| `PENDING` → `DONE/REJECTED/ERROR` | nenhuma op pronta                                                                       | recomputa apenas ao executar `processGesture` (`syncWorker.ts:979-1016`)                                    | um `SYNCING` equivalente nunca chega a essa recomputação pelo loop          |

Nenhuma transição `SYNCING -> PENDING` de startup, timeout, lease ou watchdog foi localizada.

## Respostas específicas sobre `SYNCING`

1. O gesture passa a `SYNCING` em `processGesture` após carregar as ops prontas e antes de obter sessão (`syncWorker.ts:970-1027`). Ops não recebem estado `SYNCING`.
2. A mudança é um `db.queue_gestures.update`, portanto persiste em IndexedDB.
3. O `fetch` ocorre depois da persistência (`syncWorker.ts:1048-1052`).
4. Nenhuma query executora seleciona `SYNCING`; o loop usa `.where("status").equals("PENDING")`.
5. Startup recovery não seleciona `SYNCING`; seleciona `ERROR` e ops sanitárias `BLOCKED_DEPENDENCY`.
6. Não existe reset `SYNCING -> PENDING` localizado.
7. Não existe timeout, lease ou watchdog. O `fetch` não usa `AbortSignal` (`syncWorker.ts:711-729`).
8. Não existe owner/lease persistido do processamento.
9. Não existe heartbeat ou campo que distinga worker vivo de processo morto.
10. Um registro pode permanecer `SYNCING` indefinidamente, inclusive após reinícios.

```text
SYNCING_RECOVERY = GAP_CONFIRMED
```

## Ordem exata do ACK

### Sucesso genérico total (`APPLIED` / `APPLIED_ALTERED`)

```text
1. response.ok
2. response.json + validação de results
3. cálculo do reconciliation plan
4. queue_ops.bulkDelete(...)                         COMMIT isolado
5. pull(s) pós-push, com falhas capturadas e ignoradas
6. transaction(queue_gestures, queue_ops):
   6.1 relê ops remanescentes
   6.2 grava gesture DONE/REJECTED/PENDING + audit
7. métrica de sucesso
```

Evidência: `syncWorker.ts:1097-1125`, `1148-1284`. A identidade/fingerprint não é criada no ACK; `client_tx_id`/`client_op_id` já estavam persistidos na criação. O audit `operation_results` só é gravado no passo 6.2. Logo, crash entre 4 e 6 deixa `SYNCING` sem as ops aplicadas e sem audit local terminal.

### Sanitário canônico

```text
1. correlaciona resultado com op
2. monta deletes, updates, rejections e audit em memória
3. transaction(queue_gestures, queue_ops, queue_rejections):
   3.1 remove aplicadas/terminais
   3.2 atualiza RETRYABLE/BLOCKED
   3.3 persiste rejeições
   3.4 relê remanescentes
   3.5 recomputa gesture DONE/PENDING/ERROR/REJECTED + audit
4. reconcile/pull canônico fora da transaction
```

Evidência: `syncWorker.ts:385-590`. O ACK local é atômico neste caminho; convergência pós-ACK não é.

### Partial success genérico

```text
1. monta plan: applied / rejected / retryable / missing
2. transaction(queue_gestures, queue_ops, queue_rejections, stores afetadas):
   rollback rejeitadas → reaplica aplicadas → apaga aplicadas
   → marca rejeitadas/retryable → persiste auditoria
   → gesture PENDING ou REJECTED
3. pull/reconciliation fora da transaction
```

Evidência: `syncWorker.ts:772-927`. Se o processo cai antes do passo 2, permanece `SYNCING`; se cai durante, Dexie aborta a transação; depois do commit, op aplicada não é reenviada, retryable continua executável e rejeitada permanece auditável.

### Demais respostas

| Resposta            | Ordem e estado persistido                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REJECTED` genérico | caminho misto usa transação conjunta; caminho comercial/legado primeiro grava gesture `REJECTED`, depois adiciona rejections/rollback em writes separados (`syncWorker.ts:1333-1508`) |
| `RETRYABLE`         | canônico/misto grava op `RETRYABLE` e gesture `PENDING` na mesma transação; `next_attempt_at` aplica backoff                                                                          |
| `401`               | refresh de sessão uma vez e repete a mesma request; falha entra no catch genérico, preserva ops e volta a `PENDING` até 3 tentativas (`syncWorker.ts:1054-1076`, `1514-1556`)         |
| `403`               | classificado não retryable, gesture `ERROR`, ops preservadas, sem rollback; startup não reabre (`syncWorker.ts:229-235`, `1518-1537`)                                                 |
| `5xx`               | retry genérico até 3; startup só reconhece 502/503/504, não 500 (`syncWorker.ts:57-68`, `1514-1556`)                                                                                  |
| network error       | catch genérico: `PENDING` até 3; depois `ERROR`; marcadores conhecidos reabrem no próximo startup                                                                                     |
| timeout             | não há timeout explícito; promise pendente mantém gesture `SYNCING` enquanto o processo vive; crash o deixa persistido e não recuperado                                               |

## Startup recovery real

| Superfície        | Comportamento confirmado                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`        | monta o worker uma vez e o para no unmount (`src/components/layout/AppShell.tsx:20-26`)                                                                                          |
| sessão/auth       | `useAuth` restaura sessão/settings; logout remove apenas contexto de fazenda, não limpa fila (`src/hooks/useAuth.tsx:290-345`)                                                   |
| Dexie bootstrap   | stores persistentes; nenhuma rotina de normalização de `SYNCING` localizada                                                                                                      |
| worker bootstrap  | dispara pull inicial da fazenda ativa; no primeiro tick recupera `ERROR` reconhecido e dependências sanitárias; depois busca todos os gestures `PENDING`                         |
| network listeners | `TopBar`/`OfflineIndicator` atualizam apresentação; não acordam/reclassificam a fila. O interval de 5 s tenta rede sem consultar `navigator.onLine`                              |
| farm selection    | pull inicial é da fazenda ativa; processamento da fila não filtra fazenda nem usuário, usa `gesture.fazenda_id` e a sessão atual (`syncWorker.ts:175-195`, `116-123`, `711-729`) |

Respostas objetivas:

- `PENDING`: executado no próximo tick.
- `SYNCING`: não recuperado.
- `ERROR`: apenas se `last_error` contém um marcador enumerado; retry count é zerado.
- Filtro por retry count no startup: não.
- Filtro por fazenda/usuário na query executora: não.
- Idade/`updated_at`: não existe no gesture e não é usada.
- Watchdog: não.
- 403: terminal local `ERROR`.
- 5xx: retry genérico; 502/503/504 podem reabrir após restart, 500 não.
- Network error é distinto de rejeição aplicada: mantém ops e tenta novamente; rejeição terminal fica auditável/rollback conforme caminho.

## Orphan analysis

| Estado                                      | Classificação                                                                                            | Evidência                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| gesture sem ops                             | `POSSIBLE_STUCK`                                                                                         | sucesso genérico apaga ops antes do DONE; se ainda `PENDING`, `processGesture` pode recomputar DONE, mas se `SYNCING` o loop não o chama |
| op sem gesture                              | `POSSIBLE_RECOVERABLE`                                                                                   | criação pública normal é transacional; não há FK física; detector localiza legado/corrupção e remoção exige verificação externa          |
| gesture `SYNCING` sem op elegível           | `POSSIBLE_STUCK`                                                                                         | worker só consulta `PENDING`; vale com zero ops, apenas rejeitadas ou backoff futuro                                                     |
| gesture `DONE` com op pendente              | `IMPOSSIBLE_BY_TRANSACTION` nos ACKs canônico/misto; `UNKNOWN` global                                    | transações recomputam com base nas ops; não há constraint física e o health detector considera residual como blocker                     |
| gesture `ERROR` com erro retryable          | `RECOVERED_AUTOMATICALLY` somente para marcadores; caso contrário `POSSIBLE_STUCK`                       | lista textual fechada em `syncWorker.ts:57-68`                                                                                           |
| op aplicada remotamente mas `PENDING` local | `POSSIBLE_RECOVERABLE` enquanto gesture volta a `PENDING`; `POSSIBLE_STUCK` se crash preservou `SYNCING` | replay reutiliza IDs, mas depende de ser selecionado                                                                                     |
| gesture `PENDING` com todas ops terminais   | `RECOVERED_AUTOMATICALLY` no próximo tick                                                                | ramo sem ready ops recomputa `REJECTED`, `ERROR` ou `DONE` (`syncWorker.ts:979-1016`)                                                    |
| ops ausentes antes de gesture terminal      | `POSSIBLE_STUCK`                                                                                         | janela concreta do sucesso genérico (`syncWorker.ts:1160-1284`)                                                                          |

## Gaps confirmados e severidade

### P0

Nenhum P0 novo foi comprovado. Esta auditoria não demonstrou perda silenciosa irrecuperável, duplicação factual, cross-tenant access nem estado terminal falso que impeça permanentemente a aplicação remota. `DUPLICATE_EVENT_P0` permanece `NOT_CONFIRMED_AS_SYNC_FAILURE`.

### P1

1. **`SYNCING` persistido sem recovery:** crash em qualquer ponto após `status = SYNCING` e antes de o catch/ACK reclassificar o gesture deixa trabalho válido fora da query executora indefinidamente.
2. **ACK genérico não atômico:** ops aplicadas são apagadas antes do gesture terminal; crash produz `SYNCING` sem ops/audit terminal, não reconstruído no startup.
3. **Convergência pós-ACK não durável:** pulls/reconciliation podem falhar ou ser interrompidos sem item persistido de recovery; `DONE` prova ACK, não convergência local.
4. **HTTP 500 após limite vira `ERROR` não recuperável automaticamente:** 500 não pertence aos marcadores de startup, embora seja uma classe potencialmente transitória.

### P2

1. Ausência de lease/watchdog/idade do processamento e de telemetria específica para `SYNCING` stale.
2. Network `online` não acorda o worker; a retomada depende do interval de 5 s.
3. Cobertura não injeta crash nos boundaries do ACK nem exercita startup real com fixture `SYNCING`.

## Patch options para C1 (não implementadas)

### Opção A — recovery determinístico de `SYNCING` + recomputação por ops (recomendada)

- **gap:** gestures interrompidos não voltam a ser executáveis; `SYNCING` sem ops não chega a `DONE`.
- **arquivos prováveis:** `src/lib/offline/syncWorker.ts`; testes focados em `src/lib/offline/__tests__/`.
- **invariante:** todo `SYNCING` persistido no bootstrap é reclassificado usando as ops existentes, reutilizando os mesmos IDs.
- **patch mínimo:** antes do seletor de `PENDING`, numa transação `queue_gestures + queue_ops`, para cada `SYNCING`: com op não terminal, voltar a `PENDING`; sem ops, concluir `DONE` com marcador/audit conservador definido a partir da evidência disponível. A decisão “sem ops = DONE” precisa preservar que delete só ocorre após resultado aplicado nos caminhos atuais.
- **testes:** restart `SYNCING+ops`, `SYNCING` sem ops, `SYNCING+REJECTED`, response-lost com IDs iguais, idempotência do recovery.
- **risco:** médio; classificar cegamente dados legados/corrompidos sem ops como aplicados pode ser incorreto.
- **impacto offline/rollback:** apenas lifecycle local; reversão remove a rotina e seus testes, sem schema/migration.

### Opção B — ACK genérico atômico

- **gap:** delete de ops e transição terminal usam commits distintos.
- **arquivos prováveis:** `src/lib/offline/syncWorker.ts`; testes de fault injection.
- **invariante:** remoção das ops, audit e estado terminal do gesture commitam juntos.
- **patch mínimo:** mover o delete genérico para a mesma transação que relê/recomputa o gesture; manter pull fora dela.
- **testes:** falha antes/durante/depois da transaction; nenhuma combinação `SYNCING` sem ops após commit parcial.
- **risco:** baixo/médio; stores e concorrência devem continuar compatíveis com Dexie.
- **impacto offline/rollback:** local e reversível; sem schema.

### Opção C — recovery durável de pull/reconciliation

- **gap:** ACK remoto pode terminar sem convergência local.
- **arquivos prováveis:** `syncWorker.ts`, `pull.ts`, possível estado local já existente ou mecanismo explicitamente autorizado em fase posterior.
- **invariante:** ACK e convergência são estados distintos e a segunda permanece retomável.
- **testes:** crash/falha depois do ACK e antes/durante pull.
- **risco:** médio/alto; pode exigir modelagem de estado e pertence melhor à F24.2G.
- **impacto offline/rollback:** não deve ser incluída no patch mínimo C1.

```text
RECOMMENDED_MINIMAL_C1_PATCH = Opção B + subconjunto seguro da Opção A
```

O menor patch completo precisa de duas peças inseparáveis: (1) tornar o ACK genérico uma única transação e (2) recuperar `SYNCING+ops` para `PENDING` no startup. Para `SYNCING` sem ops legado, C1 deve primeiro testar/classificar a origem e então recomputar conservadoramente; não criar nova execução nem novos IDs. A durabilidade de pull/reconcile deve permanecer patch independente.

## Cobertura de testes existente

| Suite                                    | Prova                                                                    | Não prova                                           |
| ---------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `queueLifecycle.test.ts`                 | órfãs, health, retenção de ops para fixture `SYNCING`                    | execução/recovery de startup de `SYNCING`           |
| `syncWorkerRecovery.test.ts`             | 503 volta a `PENDING`; validação e 403 não voltam                        | crash, `SYNCING`, HTTP 500                          |
| `syncWorkerHttp403.test.ts`              | 403 vira `ERROR`, preserva optimistic apply e ops                        | posterior troca de usuário/fazenda                  |
| `syncPartialBatch.test.ts`               | partial success, retry, response-lost em processo vivo e IDs preservados | crash entre `SYNCING`, ACK transaction e pulls      |
| `sanitarioV2Worker.test.ts`              | ACK canônico por op, backoff, bloqueio, replay/audit                     | kill/restart nos boundaries                         |
| `sanitarioAgendaV2Sync.test.ts`          | network retry, replay e partial closure                                  | atomicidade do caminho legado de rejeição sob crash |
| `eventIdentity.characterization.test.ts` | contrato fechado da F24.2B                                               | liveness do worker                                  |
| `AppShell.test.tsx`                      | worker inicia/para com o shell                                           | sessão real, restart, reconnect                     |

## Evidência C10

A fixture existente `gesture("tx-retained", "SYNCING") + op` é persistida e retida em `queueLifecycle.test.ts:101-113`. A inspeção do bootstrap mostra que:

```text
startup recovery query = status == ERROR
executor query         = status == PENDING
fixture status         = SYNCING
resultado               = não selecionada; permanece SYNCING
```

Isso é prova por fixture persistente + predicados reais do worker, não mera ausência de teste. Não existe hoje um teste executável que inicialize o interval e afirme a não execução; essa lacuna permanece P2 de cobertura.
