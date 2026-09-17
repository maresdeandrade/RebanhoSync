# F24.2C2 — Auditoria de `SYNCING` ambíguo e concorrência do worker

## Decisão e escopo

```text
F24.2C2 = READY_FOR_REVIEW
F24.2C3 = NOT_STARTED
F24.2C = NOT_COMPLETED
F24.2 = IN_PROGRESS
```

Auditoria diagnóstica sobre `origin/main@9014c1d41ca4d6c6b23c0da34b156953aef33f71`. O único artefato executável adicionado é um teste de caracterização. Não há mudança de runtime, schema Dexie, migration, RPC, contrato remoto, timeout, lease, leader election, BroadcastChannel ou Web Locks.

Contratos preservados:

```text
ACK_ATOMICITY = CONFIRMED_SAFE
SYNCING_RECOVERY_WITH_NON_TERMINAL_OPS = CONFIRMED_SAFE
DUPLICATE_EVENT_P0 = NOT_CONFIRMED_AS_SYNC_FAILURE
DURABLE_POST_ACK_RECONCILIATION = OPEN
HTTP_500_RECOVERY = OPEN
```

## Classificação executiva

```text
AMBIGUOUS_SYNCING_ZERO_OPS = ACTIVE_GAP
MULTI_TAB_CONCURRENCY = RACE_CONFIRMED
HUNG_FETCH_IMPACT = WORKER_WIDE
```

Não foi comprovado P0. A identidade persistida é reutilizada nos dois pushes concorrentes, mas a fila local não possui claim exclusivo e pode entrar em estados intermediários ambíguos.

Qualificação da evidência:

- **CONFIRMED:** interleavings exercitados pelo teste, ordem/guards do worker, ausência de abort/claim no código e boundaries C1 reexecutados;
- **INFERENCE:** duas abas reais reproduzirão o mesmo interleaving, com base em um `AppShell` por realm e IndexedDB compartilhado; não foi executado E2E com duas janelas;
- **UNKNOWN:** origem concreta de registros legados já persistidos e conclusão remota de um `SYNCING+0` encontrado fora do teste.

## A — `SYNCING + zero queue_ops`

### Origem pós-C1 confirmada

O ACK C1 continua atômico isoladamente. O estado volta a ser possível por concorrência entre dois processadores:

```text
Worker A                         Worker B
read PENDING + ops              read PENDING + mesmas ops
mark SYNCING                    aguarda antes de mark SYNCING
push APPLIED
ACK atômico: delete ops + DONE
                                 mark SYNCING cego sobre DONE
                                 fetch permanece pendente

resultado persistido: SYNCING + 0 ops
```

O teste `syncWorkerConcurrency.characterization.test.ts` controla exatamente esse interleaving e confirma que `recoverStaleSyncingGesturesOnce` retorna `0` e preserva `SYNCING`. A causa é a separação entre leitura das ops (`processGesture`) e update incondicional para `SYNCING` (`syncWorker.ts:1014-1068`); não existe compare-and-set que exija o estado ainda ser `PENDING`.

Classificação por origem:

| Origem investigada | Resultado | Evidência |
| --- | --- | --- |
| writer genérico | não cria `SYNCING+0` diretamente | criação de gesture, ops e apply local é transacional (`ops.ts:354-397`) |
| writer sanitário | não cria diretamente nos callers reais verificados | `writeSanitarioV2Queue` é executado dentro de transações que incluem gesture e ops (`sanitaryAgendaExecutionV2.ts:777-824`, `sanitaryCorrectionV2.ts:683-704`, `sanitarioV2Cutover.ts:749-768`) |
| ACK genérico C1 | não cria isoladamente | delete + audit + estado final na mesma transação (`syncWorker.ts:1201-1245`) |
| ACK sanitário | não cria isoladamente | delete/update e gesture na mesma transação (`syncWorker.ts:525-590`) |
| cleanup manual | não remove ops ligadas a gesture existente | `queueLifecycle.ts:106-124` |
| reset por fazenda | remove gesture e ops na mesma transação | `reset.ts:3-35` |
| migration Dexie | nenhuma transformação de fila localizada | versões preservam as stores; nenhuma migration de dados cria o estado |
| legado pré-C1 | possível | janela antiga documentada pela C0 |
| concorrência | **reproduzível** | novo teste, cenário late `SYNCING` após ACK |

Conclusão: não é `LEGACY_ONLY`; é `CONCURRENTLY_REPRODUCIBLE` e, portanto, `ACTIVE_GAP`. Não é seguro promover automaticamente para `DONE`, pois a ausência de ops não prova se houve ACK remoto, cleanup legado ou corrida interrompida.

## B — `SYNCING + somente ops terminais`

O ramo inicial de `processGesture` possui recomputação determinística quando é explicitamente chamado (`syncWorker.ts:1022-1059`):

| Ops existentes | Estado derivado pelo ramo | Observação |
| --- | --- | --- |
| somente `REJECTED` | `REJECTED` | `REJECTED` prevalece sobre `BLOCKED_DEPENDENCY` na expressão atual |
| somente `BLOCKED_DEPENDENCY` | `ERROR` | indica dependência indisponível |
| `REJECTED` + `BLOCKED_DEPENDENCY` | `REJECTED` | precedência textual não prova que todo recovery/rollback/audit terminou |
| `RETRYABLE` com backoff futuro | `PENDING` | é não terminal e aguarda `next_attempt_at` |

O startup não chama esse ramo para gesture `SYNCING`. A ordem real é:

```text
recoverErroredGesturesOnce
→ recoverBlockedSanitarioV2Operations
→ recoverStaleSyncingGesturesOnce
```

Assim, `BLOCKED_DEPENDENCY` volta a `PENDING` antes da análise stale (`syncWorker.ts:110-114`, `670-711`), preservando liveness. Já `SYNCING + only REJECTED` permanece fail-closed: a op informa terminalidade, mas não comprova isoladamente que rollback, `queue_rejections` e audit do gesture tenham sido concluídos. A F24.2C2 não promove esse estado automaticamente.

## Multi-tab / múltiplos workers

### Fluxo real

Cada `AppShell` monta e inicia o worker (`AppShell.tsx:20-25`). `intervalId` e `isTickRunning` são variáveis de módulo (`syncWorker.ts:49-50`): impedem duplicidade somente dentro do mesmo realm JavaScript. Abas diferentes possuem realms distintos e compartilham o mesmo IndexedDB.

Não foi localizado:

- mutex persistido;
- compare-and-set `PENDING → SYNCING`;
- transaction claim que cubra seleção e transição;
- leader election;
- lease/owner/heartbeat;
- `BroadcastChannel`;
- Web Lock API.

Logo, duas abas podem ler o mesmo snapshot `PENDING`, ambas mudar o gesture para `SYNCING` e enviar o mesmo `client_tx_id`/`client_op_id`. O teste de dois processadores confirma duas requests com identidades idênticas.

### Safety, liveness e race

- **Safety remota:** replay preserva identidade nos caminhos já certificados; nenhum novo Evento ou nova identidade é criado por este patch diagnóstico.
- **Liveness local:** não é garantida. O interleaving late-write produz `SYNCING+0`, que o recovery C1 deixa fail-closed.
- **ACK concorrente:** dois `APPLIED` podem deixar temporariamente `PENDING+0` por erro de concorrência capturado; uma execução subsequente de `processGesture` deriva `DONE` sem novo fetch. Portanto é recuperável, mas não atomicamente coerente entre workers.
- **Race delete/process:** um worker pode remover as ops enquanto o outro continua com sua cópia em memória e ainda escreve no mesmo gesture.

O teste simula dois processadores independentes sobre o mesmo IndexedDB; não é um E2E de navegador com duas janelas. A possibilidade multi-tab é confirmada pela combinação de `AppShell` por aba, guards apenas em memória e ausência de claim compartilhado.

## Fetch pendurado

`sendBatchRequest` chama `fetch` sem `AbortController` ou timeout (`syncWorker.ts:755-773`). O loop do tick executa gestures sequencialmente com `await processGesture(gesture)` (`syncWorker.ts:122-125`) e `isTickRunning` impede ticks sobrepostos (`syncWorker.ts:103-105`).

Com o primeiro fetch sem resolver:

- o gesture atual permanece `SYNCING`;
- gestures posteriores do snapshot permanecem `PENDING`;
- o tick inteiro permanece aberto;
- os intervals seguintes retornam por `isTickRunning`;
- mudança `online/offline` não aborta nem reinicia o fetch;
- `stopSyncWorker` limpa interval e flags, mas não aborta request ativa (`syncWorker.ts:166-174`).

O teste serial mantém o primeiro fetch pendente e confirma que o segundo gesture não inicia. Ao resolver o primeiro, o segundo prossegue.

Restart encerra o realm/request pendente. No próximo startup, `SYNCING` com op não terminal volta a `PENDING` com os mesmos IDs. A exceção é a corrida já descrita que deixou `SYNCING+0`: esse estado persiste sem recovery automático.

## Fault injection pós-C1

| Boundary | Resultado | Evidência |
| --- | --- | --- |
| T1 — `SYNCING` + op executável → restart | `PENDING`, IDs e payload preservados | `syncWorkerRecovery.test.ts`; `syncWorkerAtomicAck.test.ts` |
| T2 — falha dentro do ACK | rollback integral; ops preservadas; gesture volta a `PENDING` | fault injection de `syncWorkerAtomicAck.test.ts` |
| T3 — ACK commit → falha antes/durante pull | gesture `DONE`, ops removidas | novo teste faz pull rejeitar e observa ACK durável |
| T4 — recovery → replay | mesmos `client_tx_id` e `client_op_id`; nenhum novo Evento | `syncWorkerAtomicAck.test.ts` |

```text
ACK_ATOMICITY = CONFIRMED_SAFE
SYNCING_RECOVERY_WITH_NON_TERMINAL_OPS = CONFIRMED_SAFE
DURABLE_POST_ACK_RECONCILIATION = OPEN
```

## Gaps confirmados

### P0

Nenhum. Não foi comprovada corrupção factual, perda irrecuperável, cross-tenant, duplicação de Evento nem confirmação falsa irreversível.

### P1

1. **Claim ausente / corrida late `SYNCING`:** dois processadores podem produzir `SYNCING+0`, não recuperado no startup.
2. **Concorrência local não linearizável:** duas respostas `APPLIED` podem terminar em `PENDING+0`; o próximo processamento corrige para `DONE`, mas há inconsistência recuperável.
3. **Fetch pendurado bloqueia o worker inteiro:** não há timeout/abort; restart recupera apenas quando ainda existem ops não terminais.
4. **`SYNCING+only REJECTED` sem recovery determinístico:** permanece fail-closed porque terminalidade da op não comprova conclusão de rollback/audit.

### P2

1. Ausência de telemetria específica para late claim, `SYNCING+0` e duração de fetch.
2. `inspectQueueLifecycleHealth` conta `SYNCING` como ativo, mas não distingue gesture ativo sem ops.

## Recomendação de patch

Um patch seguinte é necessário para a corrida, mas não deve inferir `DONE` a partir de zero ops. Ordem mínima:

1. introduzir claim atômico sem schema, comparando `status === PENDING` dentro de transação Dexie antes do push;
2. fazer `processGesture` retornar sem rede quando o claim falhar;
3. impedir que catch/resposta de worker stale sobrescreva estado terminal mais novo;
4. testar dois claims, ACK concorrente, response-lost e late error;
5. tratar timeout/abort em patch separado, preservando replay com a mesma identidade.

Não há evidência suficiente nesta fase para escolher lease, leader election, BroadcastChannel, Web Locks ou novo schema. A primeira defesa deve ser local, mínima e testável no boundary do claim.

## Fontes de verdade

Agenda continua intenção; Evento continua fato; `state_*` continua read model; Protocolo continua regra/configuração. Status de fila não cria fato nem comprova execução. Tags, sinais e insights não participam da decisão de recovery.

## Respostas ao critério de aceite

1. **`SYNCING+0` ainda pode nascer?** Sim, por late write concorrente após outro ACK.
2. **Por qual caminho?** Dois processadores leem as mesmas ops; A conclui ACK; B grava `SYNCING` sem CAS e fica pendente/interrompido.
3. **Ops terminais são deriváveis?** O ramo direto deriva `REJECTED` ou `ERROR`, mas startup só recupera `BLOCKED`; `REJECTED` isolado permanece ambíguo quanto ao audit/rollback.
4. **Duas abas podem processar o mesmo gesture?** Sim; guards são por realm e não há claim compartilhado.
5. **O estado local continua consistente?** Nem sempre: foram reproduzidos `SYNCING+0` persistente e `PENDING+0` recuperável.
6. **Fetch pendurado bloqueia o quê?** O tick inteiro e, pelo guard, os ticks seguintes do mesmo worker.
7. **Restart resolve?** Sim para `SYNCING` com op não terminal; não para `SYNCING+0`.
8. **Boundaries C1 seguem seguros?** Sim nos testes T1–T4; falta de pull durável continua separada.
9. **Novo patch é necessário?** Sim: claim/CAS mínimo e proteção contra writes stale, sem solução implementada nesta fase.
10. **O que fica para C3/D?** Reconciliação pós-ACK durável em C3; HTTP 500/retry/auth em D.
