# F24.2C2.1 — Atomic Claim & Stale Worker Protection

## Decisão e escopo

```text
F24.2C2.1 = READY_FOR_MERGE
F24.2C2 = CLOSED
F24.2C3 = NOT_STARTED
F24.2C = IN_PROGRESS
F24.2 = IN_PROGRESS
```

Implementação sobre `origin/main@a15db5c264af5b0f2364a7a118941641a850db99`.
Não há migration, RPC, RLS, schema Dexie, UI, contrato remoto, TTL, lease persistido
ou mudança de domínio. O patch restringe-se a `src/lib/offline/syncWorker.ts` e aos
testes de concorrência do worker.

Desvio de processo registrado explicitamente:

```text
WORKTREE_WAS_NOT_CLEAN_AT_TASK_START = true
```

A implementação C2.1 já estava em progresso local quando o closeout iniciou. O diff
integral foi reconstruído e revisado item a item; todas as mudanças pertencem à C2.1.
Uma única linha incidental (campo `retryable` em payload de telemetria) foi removida
para manter o patch mínimo. Nenhum trabalho foi descartado.

## Race original

A C2 comprovou `MULTI_TAB_CONCURRENCY = RACE_CONFIRMED`: dois workers liam `PENDING`
e escreviam `SYNCING` incondicionalmente, produzindo `SYNCING + 0 ops` após o ACK do
worker A e reenvio do mesmo batch pelo worker B. Também foi observado `PENDING + 0`
após `APPLIED` concorrente, e o recovery C1 podia reabrir um `SYNCING` ativo de outra
aba (`ACTIVE_CLAIM_RECOVERY_RACE = CONFIRMED` antes do patch).

## Mecanismo escolhido

Coordenação cross-context por **Web Locks API** (`navigator.locks`), o menor mecanismo
suficiente, na camada offline (`withGestureLock` / `isGestureLockActive`):

- lock exclusivo por `client_tx_id` com `ifAvailable: true`; o vencedor executa
  todo o processamento, o perdedor retorna sem rede, sem escrita e sem erro;
- o lock é mantido durante todo o processamento, incluindo o request, e é
  liberado pelo browser no fim normal **e no crash da aba** — sem TTL arbitrário;
- `isGestureLockActive` permite ao startup recovery distinguir
  `active claim` de `orphaned/stale claim`;
- fallback sem `navigator.locks`: registro in-memory por aba (ver caveat abaixo).

Não são usados como exclusão mútua: flag JS por aba, `isTickRunning`,
BroadcastChannel ou `localStorage` check-then-set.

## Claim contract

`PENDING → SYNCING` ocorre dentro de uma única transação `rw` sobre
`queue_gestures`, revalidando o estado atual dentro da transação:

```text
transaction rw {
  current = read(client_tx_id)
  if current.status !== PENDING: claim = false
  else: persist SYNCING; claim = true
}
if claim !== true: return  // sem fetch, sem processamento, sem erro
```

As operações são revalidadas **após** o claim (Patch 2); o caminho sem trabalho
reutilizável usa a classificação existente guardada por `SYNCING`, sem inventar DONE.

## Stale write protection

Todo caminho pós-rede revalida `current.status === "SYNCING"` dentro da própria
transação `rw` antes de escrever:

- ACK genérico (delete ops + DONE);
- `processSanitarioCanonicalResults`;
- `reconcileGenericOperationResults` (rollback/rejeição);
- escrita de `REJECTED` por rejeição do `sync-batch`;
- catch handler (ERROR / retry PENDING), em transação única com o write;
- error handler do tick do worker;
- recovery de `SYNCING` (lock-aware + revalidação na transação).

Transições impedidas por resposta/catch/claim stale:
`DONE → SYNCING`, `DONE → PENDING`, `DONE → ERROR`, `DONE → REJECTED`, `REJECTED → *`.

## Active claim recovery

O recovery ignora gestures com lock ativo e revalida `SYNCING` na transação.
Um claim ativo de outra aba não é reaberto (T6); um claim órfão real volta a
`PENDING` com as mesmas identidades (T7, T8), preservando a garantia da C1.

## Testes T1–T10

Arquivo: `src/lib/offline/__tests__/syncWorkerConcurrency.test.ts` (11 testes,
incluindo T6b). Suíte de caracterização C2 atualizada para comprovar
`ACTIVE_CONCURRENCY_PATH_TO_SYNCING_ZERO = NOT_REPRODUCIBLE`.

```text
T1  dois claims simultâneos → exatamente um vencedor           = PASS
T2  loser não envia request (requests = 1)                     = PASS
T3  write tardio de SYNCING sobre DONE impossível              = PASS
T4  stale catch não sobrescreve DONE → PENDING/ERROR           = PASS
T5  dois APPLIED concorrentes → estado coerente, request único = PASS
T6  recovery não reabre claim ativo                            = PASS
T6b fallback sem navigator.locks caracterizado (caveat)        = PASS
T7  crash verdadeiro → recuperável para PENDING, mesmos IDs    = PASS
T8  replay preserva client_tx_id / client_op_id, sem Evento    = PASS
T9  ACK atômico C1: falha no ACK → rollback integral           = PASS
T10 partial success preservado                                 = PASS
```

Regressão adicional: `syncWorkerRecovery` (6), `syncWorkerAtomicAck` (3),
`queueLifecycle` (9), `syncPartialBatch` (6) — todos PASS.

## Runtime compatibility assumption

```text
WEB_LOCKS_REQUIRED_RUNTIME_SUPPORT = CONFIRMED
```

Evidência: o projeto não declara `browserslist`, `.browserslistrc` nem `build.target`
explícito; o bundle é produzido pelo target padrão do Vite 6
(`baseline-widely-available`: Chrome 107+, Edge 107+, Firefox 104+, Safari 16+).
Todos esses mínimos suportam Web Locks (Chrome 69+, Edge 79+, Firefox 96+,
Safari 15.4+). Não há contrato formalizado de WebView/Capacitor no repositório;
essa premissa está registrada aqui como suposição documentada.

## Fallback behavior

```text
CROSS_TAB_COORDINATION_WITHOUT_WEB_LOCKS = NOT_FULLY_PROTECTED
```

Em runtimes sem `navigator.locks`, o registro é in-memory por aba: dentro do mesmo
contexto o claim permanece protegido (e o claim atômico Dexie continua impedindo
push duplicado do mesmo gesture), mas o recovery de uma segunda aba **pode** reabrir
um `SYNCING` ativo de outra aba, pois não consegue distinguir active claim de claim
órfão. O teste T6b caracteriza esse comportamento explicitamente. Sob o target de
build vigente, esse cenário está fora dos runtimes suportados (opção A da decisão
de runtime); não foi aplicado patch adicional nem equivalência fictícia declarada.

## Validação

```text
vitest (concurrency, characterization, recovery, atomicAck) = 37/37 PASS
vitest (queueLifecycle, syncPartialBatch)                   = 30/30 PASS
pnpm run lint                                               = PASS
pnpm run build                                              = PASS (warnings preexistentes)
pnpm run gates:docs                                         = PASS
git diff --check                                            = PASS
```

Não executado: baseline funcional Supabase — nenhuma migration, RPC, RLS ou contrato
remoto foi alterado.

## Remaining gaps

```text
HUNG_FETCH / TIMEOUT = OPEN
DURABLE_POST_ACK_RECONCILIATION = OPEN
HTTP_500_RECOVERY = OPEN
AMBIGUOUS_LEGACY_QUEUE_STATES = OPEN
WEB_LOCKS_UNAVAILABLE_CROSS_TAB_FALLBACK = DOCUMENTED_CAVEAT
```

Nenhum deles é resolvido neste patch. F24.2C3 não foi iniciada.
