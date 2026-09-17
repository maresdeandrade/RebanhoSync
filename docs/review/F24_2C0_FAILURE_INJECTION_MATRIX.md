# F24.2C0 — Failure injection matrix

Baseline auditada: `origin/main@2f40be7a889c40311057e0b947a273923973983a`.

As classificações abaixo descrevem o código atual. “Replay seguro” reutiliza o contrato de identidade certificado na F24.2B e não reabre deduplicação factual.

## Matriz C1–C10

| Cenário                                                    | Estado persistente possível                                                                                                                                             | Comportamento no restart                                                                         | Classificação                                                          | Severidade |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------- |
| **C1 — crash antes do worker** (`PENDING`)                 | gesture e ops já foram gravados atomicamente com o apply local                                                                                                          | worker seleciona `PENDING` no próximo tick; tenta push                                           | `RECOVERED_AUTOMATICALLY`                                              | `NONE`     |
| **C2 — crash depois de `SYNCING`, antes do request**       | gesture `SYNCING`, ops intactas                                                                                                                                         | startup não consulta `SYNCING`; nenhuma request é feita                                          | `POSSIBLE_STUCK`                                                       | `P1`       |
| **C3 — request enviada, servidor não aplicou, crash**      | gesture `SYNCING`, ops intactas                                                                                                                                         | não há retomada; operação válida fica sem aplicação remota                                       | `POSSIBLE_STUCK`                                                       | `P1`       |
| **C4 — servidor aplicou, resposta perdida, crash**         | gesture `SYNCING`, ops com IDs originais intactas se o catch ainda não persistiu                                                                                        | replay seria idempotente, mas o worker não volta a selecionar o gesture                          | `POSSIBLE_STUCK`; identidade `CONFIRMED_SAFE`, liveness não            | `P1`       |
| **C5 — response `APPLIED`, crash durante ACK**             | canônico/misto: transação aborta ou commita inteira; genérico total: pode commitar delete e não commitar `DONE`                                                         | canônico/misto coerente após commit; genérico fica `SYNCING` sem ops/audit                       | `PARTIAL`; janela genérica confirmada                                  | `P1`       |
| **C6 — op removida, gesture ainda `SYNCING`**              | possível no sucesso genérico entre `bulkDelete` e transaction terminal                                                                                                  | executor ignora `SYNCING`; ramo que recomputaria `DONE` não é chamado                            | `POSSIBLE_STUCK`                                                       | `P1`       |
| **C7 — todas ops finalizadas, gesture não chega a `DONE`** | `SYNCING` sem ops                                                                                                                                                       | `processGesture` poderia recomputar `DONE` se chamado, mas o loop não chama                      | `POSSIBLE_STUCK`; reconstruível por patch                              | `P1`       |
| **C8 — gesture `DONE`, pull/reconcile não ocorreu**        | canônico marca terminal antes do reconcile; genérico engole falha de pull e ainda marca `DONE`                                                                          | pull inicial da fazenda ativa pode convergir parte dos dados, mas não há item durável específico | ACK remoto válido; convergência local `PARTIAL/UNKNOWN` por superfície | `P1`       |
| **C9 — partial success + crash**                           | antes da transaction: `SYNCING` com todas ops; durante: rollback Dexie; depois: aplicada removida, retryable retida, rejeitada auditável e gesture `PENDING`/`REJECTED` | somente o estado pós-commit retoma corretamente; estado pré-commit fica preso                    | ACK parcial atômico, recovery pré-commit ausente                       | `P1`       |
| **C10 — restart com `SYNCING`**                            | fixture Dexie persiste gesture `SYNCING` e op                                                                                                                           | recovery `ERROR` não a seleciona; executor `PENDING` não a seleciona                             | `GAP_CONFIRMED`                                                        | `P1`       |

## Injection points e boundaries

| Ponto de interrupção                            | Último commit local                                | Próximo write que não ocorreu | Resultado                                                 |
| ----------------------------------------------- | -------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| após `status = SYNCING`                         | gesture `SYNCING`                                  | sessão/request                | limbo indefinido                                          |
| após request, antes de response                 | gesture `SYNCING`                                  | catch ou ACK                  | remoto `UNKNOWN`; limbo após crash                        |
| após response JSON, antes de ACK canônico/misto | gesture `SYNCING`                                  | transaction de reconciliação  | ops intactas, mas sem executor após restart               |
| dentro da transaction canônica/mista            | nenhum commit parcial                              | restante da mesma transaction | Dexie aborta atomicamente; ainda `SYNCING`                |
| após transaction canônica/mista                 | ops e gesture coerentes                            | pull/reconcile                | ACK consistente; convergência pode faltar                 |
| após delete genérico total                      | ops aplicadas ausentes                             | pull + gesture terminal/audit | `SYNCING` sem ops, gap confirmado                         |
| após pull genérico, antes do terminal           | ops ausentes e read model possivelmente convergido | gesture `DONE`/audit          | fila continua presa apesar do dado poder estar convergido |
| após `DONE`, antes de reconcile canônico        | gesture terminal e ops removidas                   | reconcile/pull                | ACK verdadeiro; convergência não durável                  |

## Detalhe C9 — `APPLIED + RETRYABLE + REJECTED`

No caminho genérico, `reconcileGenericOperationResults` abre uma transaction contendo queue, rejections e stores afetadas (`src/lib/offline/syncWorker.ts:793-872`):

```text
op1 APPLIED   → reapply local + delete queue_op
op2 RETRYABLE → mantém queue_op, sync_state RETRYABLE, next_attempt_at
op3 REJECTED  → rollback local + mantém queue_op REJECTED + queue_rejection
gesture       → PENDING (porque existe retryable) + operation_results
```

Depois do commit, o restart não reenvia op1, espera/reenvia op2 com o mesmo ID e mantém op3 auditável. Entretanto, crash antes de a transaction iniciar ou depois de seu rollback por interrupção preserva o gesture `SYNCING`; o conteúdo permanece seguro, mas sem liveness.

No caminho sanitário canônico, deletes/updates/rejections/gesture também commitam juntos (`syncWorker.ts:529-587`). A reconciliação canônica é posterior e não durável (`syncWorker.ts:589`).

## Matriz de respostas remotas e transporte

| Condição                 | Estado atual                                                                   | Recovery automático                                   | Risco confirmado                                           |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------- |
| `APPLIED` genérico total | delete de ops → pulls → gesture terminal                                       | não, se crash ocorrer após delete e antes do terminal | fila presa; audit terminal ausente                         |
| `APPLIED` canônico       | transaction atômica de ops+gesture                                             | terminal coerente; pull posterior não durável         | read model pode não convergir                              |
| `RETRYABLE`              | op retida com backoff; gesture `PENDING`                                       | sim, após `next_attempt_at`                           | sem corrupção demonstrada                                  |
| `REJECTED`               | audit/rollback conforme caminho; op rejeitada retida no caminho genérico misto | retry explícito ou reconciliação                      | caminhos legados têm writes separados sob crash            |
| `401`                    | refresh + uma repetição; depois retry genérico                                 | até 3; startup reabre `ERROR` com marcador 401        | retry/liveness, não duplicação comprovada                  |
| `403`                    | `ERROR` imediato, ops preservadas                                              | não                                                   | terminal por autorização; comportamento coberto por teste  |
| `502/503/504`            | `PENDING` até 3, depois `ERROR`                                                | startup reabre e zera count                           | pode repetir por reinícios; sem limbo se catch conclui     |
| `500`                    | `PENDING` até 3, depois `ERROR`                                                | não reconhecido no startup                            | erro potencialmente transitório vira terminal local (`P1`) |
| network reject           | `PENDING` até 3, depois `ERROR`                                                | marcadores conhecidos reabrem no startup              | crash antes do catch deixa `SYNCING`                       |
| fetch pendurado          | `SYNCING` em memória e IndexedDB                                               | nenhum timeout/watchdog                               | indefinido; restart não recupera                           |

## Expected invariants versus implementação

| Invariante C1 futura                                         | Situação atual                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| I1. Toda op não terminal executável/recuperável após restart | violada quando o gesture está `SYNCING`                                                        |
| I2. Nenhum gesture `SYNCING` indefinidamente por interrupção | violada                                                                                        |
| I3. Terminal do gesture consistente com ops                  | protegida nos ACKs canônico/misto; janela genérica anterior ao terminal                        |
| I4. Crash converge a DONE/RETRYABLE/REJECTED auditável       | violada nos pontos pré-ACK e entre delete genérico/DONE                                        |
| I5. Recovery reutiliza IDs existentes                        | IDs estão disponíveis em `SYNCING+ops`; recovery não existe. Nenhum patch deve gerar novos IDs |

## Evidência e validação focada

Comando executado:

```bash
pnpm exec vitest run \
  src/lib/offline/__tests__/queueLifecycle.test.ts \
  src/lib/offline/__tests__/syncWorkerRecovery.test.ts \
  src/lib/offline/__tests__/syncWorkerHttp403.test.ts \
  src/lib/offline/__tests__/syncPartialBatch.test.ts \
  src/lib/offline/__tests__/sanitarioV2Worker.test.ts \
  src/lib/offline/__tests__/sanitarioAgendaV2Sync.test.ts \
  src/lib/offline/__tests__/eventIdentity.characterization.test.ts \
  src/components/layout/__tests__/AppShell.test.tsx
```

Resultado real:

```text
Test Files  8 passed (8)
Tests       45 passed (45)
Duration    68.34s
```

O conjunto prova criação/lifecycle básico, recovery de `ERROR` 503, terminalidade de 403, partial success, retry/replay com IDs estáveis, ACK sanitário e start/stop do shell. Não injeta kill/crash entre writes, não prova recovery de `SYNCING` e não prova convergência durável pós-ACK.
