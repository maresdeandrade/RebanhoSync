# F24.2C1 — ACK atômico e recuperação conservadora de `SYNCING`

## Decisão e escopo

```text
F24.2C0 = CLOSED
F24.2C1 = READY_FOR_MERGE
F24.2C2 = NOT_STARTED
F24.2C = IN_PROGRESS
F24.2 = IN_PROGRESS
```

Patch funcional desenvolvido sobre `origin/main@81f26f5633c1f2de185015c4fe2bd087f9057bf5`. O escopo é exclusivamente o ACK genérico total e a recuperação de startup de gestures interrompidos em `SYNCING`. Não há alteração de schema Dexie, migration, RPC, contrato remoto, dependência, backoff, lease, watchdog, coordenação multi-tab ou reconciliação durável pós-ACK.

## Problema confirmado em F24.2C0

O caminho genérico de sucesso total removia `queue_ops`, executava pull e somente depois atualizava `queue_gestures` para `DONE`. Um crash entre esses commits podia persistir um gesture `SYNCING` sem as operações que justificavam seu estado. Além disso, o startup recovery não selecionava gestures `SYNCING`, deixando trabalho não terminal fora da fila executável.

## Patch aplicado

### ACK genérico total

Em `processGesture`, as seguintes ações agora pertencem à mesma transação Dexie sobre `queue_gestures` e `queue_ops`:

1. remoção das operações aplicadas;
2. leitura das operações remanescentes;
3. cálculo do estado resultante;
4. persistência de `DONE`, `REJECTED` ou `PENDING`;
5. persistência de `sync_result`, `completed_at`, `last_error` e `operation_results`.

O pull/reconciliation ocorre somente depois do commit local do ACK. Uma falha dentro da transação aborta a remoção das operações e preserva a execução para replay com a mesma identidade.

```text
ACK_ATOMICITY = CONFIRMED_SAFE
```

### Startup recovery de `SYNCING`

`recoverStaleSyncingGesturesOnce` é executado no primeiro tick do worker. Dentro de uma transação Dexie, cada gesture ainda `SYNCING` é relacionado às suas operações persistidas:

- havendo ao menos uma operação não terminal, o gesture volta a `PENDING`;
- `client_tx_id`, `client_op_id`, payload e metadados das operações permanecem inalterados;
- sem operações, ou com apenas operações terminais (`REJECTED`/`BLOCKED_DEPENDENCY`), o gesture permanece `SYNCING` fail-closed.

O patch não infere sucesso remoto quando a evidência local é ambígua.

```text
SYNCING_RECOVERY_WITH_NON_TERMINAL_OPS = CONFIRMED_SAFE
SYNCING_RECOVERY_GLOBAL = PARTIAL_BY_DESIGN
```

## Invariantes I1–I8

| ID | Invariante | Evidência |
| --- | --- | --- |
| I1 | Delete das ops, audit e estado final do gesture commitam juntos no sucesso genérico total. | Transação conjunta em `processGesture`; teste de ACK atômico. |
| I2 | Falha na escrita terminal aborta a remoção das ops. | Fault injection em `syncWorkerAtomicAck.test.ts`. |
| I3 | `SYNCING` com trabalho não terminal volta a ser executável no startup. | `recoverStaleSyncingGesturesOnce`; teste de recovery. |
| I4 | Recovery não cria nova execução nem altera identidades/payload/retry. | Comparação integral da op e teste de replay com os mesmos IDs. |
| I5 | `SYNCING` sem evidência executável não é promovido a `DONE`. | Testes com zero ops e apenas op terminal. |
| I6 | Partial success continua sob o caminho transacional já existente. | Suítes offline e `syncPartialBatch` aprovadas; ramo não alterado. |
| I7 | Pull ocorre depois de o ACK local estar durável. | Mock do pull observa gesture `DONE` e ausência das ops. |
| I8 | Nenhum contrato de banco/remoto foi alterado. | Diff restrito a worker, testes e este documento. |

## Fault injection e replay

O teste injeta erro na escrita `queue_gestures.update(... status: "DONE")`. A transação aborta, as duas operações continuam em `queue_ops`, o tratamento existente retorna o gesture a `PENDING` e nenhum pull é iniciado. Outro teste parte de `SYNCING`, executa recovery e confirma que o push reutiliza o mesmo `client_tx_id` e os mesmos `client_op_id`, sem criar novo Evento local.

## Validação executada

```text
Vitest focado: 6 arquivos / 38 testes = PASS
Vitest final C1: 3 arquivos / 15 testes = PASS
Vitest src/lib/offline: 43 arquivos / 200 testes = PASS
pnpm run lint = PASS
pnpm run build = PASS (somente warnings preexistentes de caniuse-lite/import/chunk size)
git diff --check = PASS
```

A primeira coleta focada também passou (`11 arquivos / 70 testes`), mas incluiu cópias em `.kilo/worktrees`; a execução autoritativa foi repetida com exclusão de `.kilo/**`.

## Contratos não alterados

```text
NO SUPABASE MIGRATION
NO RPC CHANGE
NO DEXIE SCHEMA CHANGE
NO REMOTE CONTRACT CHANGE
```

Agenda continua sendo intenção futura; Evento continua sendo fato executado; `state_*` continua read model; Protocolo continua regra/configuração. O patch não usa tags, sinais ou insights como fonte primária.

## Remaining gaps

Os seguintes itens permanecem explicitamente fora da F24.2C1:

- `AMBIGUOUS_SYNCING_WITHOUT_EXECUTABLE_OPS`
- `DURABLE_POST_ACK_RECONCILIATION`
- `HTTP_500_RECOVERY`
- `MULTI_TAB_WORKER_COORDINATION`
- `WATCHDOG / LEASE`

Nenhum desses gaps é encoberto pela classificação `CONFIRMED_SAFE`; a segurança confirmada limita-se ao ACK genérico alterado e ao recovery de `SYNCING` que ainda possui operação não terminal persistida.
