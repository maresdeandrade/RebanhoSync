# F24.2D0 — Retry / Timeout / Auth / Terminality Audit

## DECISION

```text
F24.2D0 = READY_FOR_REVIEW
F24.2D1 = UNBLOCKED
D1_IMPLEMENTATION_READINESS = READY
```

This is a diagnostic, read-only audit. No runtime, schema, migration, RLS, RPC,
logout purge, timeout, or retry policy was changed.

## BASELINE

```text
BASELINE_D = origin/main@4dbde8f1ba5b9f81f5ac171e800dcfb9f94d426e
HEAD       = 4dbde8f1ba5b9f81f5ac171e800dcfb9f94d426e
branch     = codex/f24-2d0-retry-timeout-auth-audit
```

The requested baseline was confirmed after `git fetch origin`, branch creation,
and `git pull --ff-only origin main`. Pre-existing out-of-scope worktree changes
were preserved.

## PIPELINE

```text
worker interval / online wakeup
→ query PENDING gestures
→ withGestureLock
→ atomic PENDING → SYNCING claim
→ re-read queue_ops and filter ready operations
→ getSession
→ refreshSession only when getSession has no usable session
→ POST /sync-batch
→ on 401: refreshSession once and repeat request
→ classify HTTP response
→ reconcile operation results
→ ACK / rollback / retry transition
→ post-sync pull and durable reconciliation drain
→ startup recovery on first worker tick
```

Confirmed locations:

| Responsibility | Implementation |
|---|---|
| Worker tick, start/stop, online wakeup | `src/lib/offline/syncWorker.ts` |
| Gesture claim and processing | `withGestureLock`, `processGesture` in `syncWorker.ts` |
| Session validation | `getValidSession` in `syncWorker.ts` |
| Batch request | `sendBatchRequest` in `syncWorker.ts` |
| Generic retry budget | `MAX_RETRIES = 3` and catch path in `syncWorker.ts` |
| Startup ERROR recovery | `recoverErroredGesturesOnce` |
| Startup stale SYNCING recovery | `recoverStaleSyncingGesturesOnce` |
| Operation retry/backoff | `getSanitarioRetryUpdate` |
| Durable reconciliation | `reconciliationObligations.ts` and worker drain |
| Local persistence | `src/lib/offline/db.ts`, `pull.ts`, `reset.ts` |
| Manual rejection recovery | `src/pages/Reconciliacao.tsx` |

Push retry, pull/reconciliation retry, sanitário operation retry, auth recovery,
transport retry, and startup recovery are separate policies.

## HUNG FETCH

### FATO CONFIRMADO

`sendBatchRequest` calls `fetch` without `AbortController`, `AbortSignal.timeout`,
a request-timeout wrapper, worker watchdog, or per-gesture timeout.

The tick processes pending gestures sequentially with `await processGesture(...)`
and protects the entire tick with `isTickRunning`. Therefore:

| Question | Result |
|---|---|
| A blocks only itself? | No |
| A blocks the entire worker tick? | Yes |
| Can B execute while A is hung? | No |
| Can the reconciliation drain execute in that tick? | No |
| Does `stopSyncWorker` abort the request? | No |
| Can the next interval start another tick? | No, `isTickRunning` remains true |
| Can online wakeup bypass the blocked tick? | It starts initial pull/drain calls, but does not abort or bypass the in-flight push |

`stopSyncWorker` clears the interval, removes the online listener, resets local
flags, and clears local locks. It does not cancel an existing `fetch`; the current
`processGesture` promise remains in flight.

The Web Lock is held during the request. In a supported runtime, a tab crash
releases the lock; a normal stop does not cancel the request.

### Classifications

```text
HUNG_FETCH_SCOPE = WORKER_WIDE
REQUEST_TIMEOUT = ABSENT
HUNG_FETCH_RECOVERY = NOT_AVAILABLE
STOP_ABORTS_IN_FLIGHT = NO
```

## HTTP MATRIX

### FATO CONFIRMADO

All non-2xx responses are converted to an error after the body is read. Only
`HTTP 403` is explicitly non-retryable in the generic catch path. Generic
transport/HTTP errors use the gesture-level budget and become `ERROR` after
three retries in the current process. A startup recovery pass can requeue only
ERROR messages matching the closed marker list.

| Status / failure | Immediate behavior | Retry count | Queue state before limit | After limit | Startup recovery | Same-session refresh | Operator path |
|---|---|---:|---|---|---|---|---|
| 400 | Error | +1 | `PENDING` | `ERROR` | No marker | No | Reconciliation/manual |
| 401 | Refresh once, then retry request | +1 only if refresh/retry fails | `PENDING` | `ERROR` | `HTTP 401` marker can requeue | Yes, one refresh | Login/session may be required |
| 403 | Error classified non-retryable | unchanged | N/A | `ERROR` | No | No | Membership/farm authorization |
| 404 | Error | +1 | `PENDING` | `ERROR` | No marker | No | Manual/domain investigation |
| 409 | Error at transport layer unless returned as operation result | +1 for HTTP error | `PENDING` | `ERROR` | No marker | No | Domain-specific conflict/reconciliation |
| 422 | Error | +1 | `PENDING` | `ERROR` | No marker | No | Correct operation/input |
| 429 | No explicit handling; generic error | +1 | `PENDING` | `ERROR` | No marker | No | None beyond manual retry |
| 500 | Error | +1 | `PENDING` | `ERROR` with `Max retries` | No marker | No | Explicit reconciliation/manual |
| 502 | Error | +1 | `PENDING` | `ERROR` | Marker | No | Startup retry |
| 503 | Error | +1 | `PENDING` | `ERROR` | Marker | No | Startup retry |
| 504 | Error | +1 | `PENDING` | `ERROR` | Marker | No | Startup retry |
| network / failed fetch | Catch error | +1 | `PENDING` | `ERROR` | Known textual markers only | No | Reconnect/startup/manual |

The matrix distinguishes HTTP responses from transport failures and from
successful HTTP responses carrying domain `REJECTED`, `CONFLICT`, or
`BLOCKED_DEPENDENCY` results. Domain results are reconciled per operation and do
not use the generic HTTP catch path.

### HTTP 500

```text
HTTP 500
→ response.ok = false
→ response.text()
→ Error("HTTP 500 ...")
→ generic catch
→ PENDING while retry_count < 3
→ ERROR with "Max retries: HTTP 500 ..." after the limit
```

`recoverErroredGesturesOnce` does not recognize `HTTP 500`, so the current final
state is terminal without automatic startup recovery.

```text
HTTP_500_AFTER_MAX_RETRIES = TERMINAL_WITHOUT_EXPLICIT_RECOVERY
HTTP_500_RECOVERY = GAP_CONFIRMED
```

### 502 / 503 / 504

The three statuses are present in `RECOVERABLE_ERROR_MARKERS`; `500` is absent.
They are therefore the same server-side transient family at transport level but
have different restart behavior.

```text
TRANSIENT_HTTP_POLICY_INCONSISTENCY = CONFIRMED
```

This does not establish that every 5xx should be treated identically; it proves
that the current distinction is textual and undocumented in runtime policy.

## AUTH MATRIX

| Scenario | Current behavior |
|---|---|
| A. `getSession` returns valid session | Uses it directly |
| B. `getSession` null/error, refresh succeeds | Uses refreshed session |
| C. `getSession` null/error, refresh fails | Throws `Nao autenticado - sessao expirada (...)`; generic retry path |
| D. HTTP 401, refresh succeeds, retry succeeds | Batch proceeds with refreshed token |
| E. HTTP 401, refresh succeeds, retry is still 401 | Generic catch path; retry budget increments |
| F. HTTP 401, refresh fails | Generic catch path with `HTTP 401 - refresh failed...` |
| G. App restarts after auth-related ERROR | Only automatically requeues if the stored message contains a marker such as `HTTP 401`, `Invalid JWT`, or an exact transport marker |

Identity is preserved because the same gesture and persisted operation IDs are
reused. A failed refresh does not delete local data or queue operations.

```text
AUTH_EXPIRED_RECOVERY = PARTIAL
AUTH_ERROR_TERMINALITY = USER_ACTION_REQUIRED
AUTH_RECOVERY = PARTIAL
```

The gap is that `getValidSession` failure messages are not normalized into the
startup marker policy, and no explicit session-state/user-action terminal
classification is persisted.

## HTTP 403

### FATO CONFIRMADO

`HTTP 403` and `"Forbidden - no access to this farm"` are treated as
non-retryable transport errors. The gesture becomes `ERROR`, `retry_count` is
unchanged, the optimistic state and `queue_ops` remain, and no rejection row is
created. This behavior is covered by
`src/lib/offline/__tests__/syncWorkerHttp403.test.ts`.

Possible causes are not separated in the worker: revoked membership, wrong farm,
RLS/authorization denial, or an invalid authorization context can all collapse
into the same terminal classification.

```text
HTTP_403_TERMINALITY = AMBIGUOUS
```

It is intentionally not converted to automatic retry; the ambiguity is a
diagnostic classification, not permission to broaden retry.

## RETRY / BACKOFF

### Counters

| Counter | Increment | Reset / persistence | Scope |
|---|---|---|---|
| `Gesture.retry_count` | Generic catch while below `MAX_RETRIES`; sanitário canonical retry also increments gesture retry | Generic startup recovery resets to `0`; Dexie persistence survives reload | Gesture/transport |
| `Operation.retry_count` | `getSanitarioRetryUpdate` on retryable or missing result | Not reset by generic startup recovery; persisted in `queue_ops` | Operation/sanitário |
| `Operation.next_attempt_at` | Set by sanitário retry update | Used to defer operation; persisted | Operation/sanitário |
| `Operation.sync_state` | Set to `RETRYABLE`, `REJECTED`, or `BLOCKED_DEPENDENCY` through result reconciliation | Persisted; blocked recovery removes defer/block fields | Operation |

Generic gestures retry on the fixed worker interval of 5 seconds, with no
generic `next_attempt_at`, exponential backoff, or jitter. Sanitário operation
retry uses exponential backoff starting at 5 seconds and capped at 5 minutes.
Reconciliation obligations are retried on worker ticks and online wakeup but do
not have a persisted attempt counter or explicit backoff.

```text
GENERIC_RETRY_BACKOFF = ABSENT
```

Restart does not reset persisted operation budgets. It does reset the gesture
counter when an ERROR matches the startup recovery markers, which can reopen a
gesture with a fresh generic budget. An ERROR not matching a marker remains
terminal automatically.

## LEGACY STATES

| Combination | Reachable today? | Startup recovery | Worker behavior | Classification |
|---|---|---|---|---|
| `SYNCING` + zero operations | Yes through interrupted ACK/legacy state | Not recovered; stale recovery requires non-terminal operations | No pending query match; remains `SYNCING` | Ambiguous/fail-closed |
| `SYNCING` + terminal-only operations | Yes | Not recovered | Remains `SYNCING` | Ambiguous/fail-closed |
| `ERROR` + zero operations | Yes | Marker-based only; no operation-level proof | Not selected as PENDING | Ambiguous/fail-closed |
| `PENDING` + zero operations | Reachable as legacy/corrupt state | Not converted to `DONE` | Claim then fail-closed classification may settle it based on terminal flags | Partial |
| `DONE` + remaining operations | Reachable as residual/legacy state | No automatic repair | Not selected for push | Ambiguous |
| `REJECTED` + remaining non-terminal operation | Reachable in mixed/legacy transitions | No generic startup repair | Not selected for push | Ambiguous |

The code does not infer `DONE` from absence of evidence. `recoverStaleSyncingGesturesOnce`
leaves zero-operation and terminal-only `SYNCING` untouched. `queueLifecycle`
reports orphan and residual operations but does not repair them.

```text
LEGACY_STATE_RECOVERY = PARTIAL
LEGACY_QUEUE_STATE_RECOVERY = AMBIGUOUS
```

## CRASH / RESTART MATRIX

| Boundary | Observed behavior |
|---|---|
| Before request | Gesture remains recoverable after a persisted `SYNCING` claim if non-terminal operations remain |
| During request | No timeout or abort; worker-wide tick can remain blocked |
| After remote apply / before response | Replay reuses stable IDs; remote idempotency is relied upon |
| After response / before local terminal commit | ACK transaction behavior is covered for current paths; stale/legacy residual states remain possible |
| After terminal ACK | `DONE` and removed operations are not selected for retry |
| During reconciliation pull | Pull errors are logged; durable reconciliation obligations cover post-ACK scopes, but pull-specific policy is separate from push retry |

The audit preserves earlier C1/C2/C3 evidence and focuses here on liveness and
retry rather than factual identity.

## WORKER STARVATION

The tick order is:

1. initial pull;
2. one-time startup recovery;
3. sequential push of pending gestures;
4. telemetry;
5. rejection purge;
6. durable reconciliation drain.

A hung push blocks later pushes, telemetry, purge, and reconciliation for that
tick. A hung initial pull is caught inside its own helper, so the tick proceeds
after the pull promise returns; a hung push has no equivalent containment.
Online wakeup starts initial-pull and reconciliation calls independently, but
does not bypass `isTickRunning` for push.

```text
WORKER_STARVATION = CONFIRMED_FOR_HUNG_PUSH
```

This is a liveness issue. It is not evidence of duplicate factual execution.

## LOGOUT INVENTORY

### FATO CONFIRMADO

`useAuth.signOut` calls Supabase sign-out, clears active-farm/auth UI state, and
removes the active farm ID. `Perfil` has a separate direct `supabase.auth.signOut`
path. Neither path calls `resetOfflineFarmData`.

The local stores include:

```text
queue_gestures
queue_ops
queue_rejections
sync_reconcile_obligations
sync_pull_cursors
farm-scoped state_* and event_* stores
metrics_events
```

`resetOfflineFarmData` clears many farm-scoped stores, including queues and
rejections, but does not include `sync_reconcile_obligations` or
`sync_pull_cursors`. It is an explicit Reconciliation support action, not logout
behavior.

Account switch and farm switch do not establish a user-scoped queue ownership
or purge policy in the inspected paths. The worker uses the gesture's persisted
`fazenda_id` for push and the active farm for pull/drain.

```text
LOGOUT_CACHE_PURGE = SEPARATE_PHASE
```

No logout purge is recommended in D0 because it could discard durable pending
work. Cross-user queue ownership remains a separate P1 investigation/decision.

## TESTS

Focused characterization executed:

```text
pnpm exec vitest run \
  src/lib/offline/__tests__/syncWorkerRecovery.test.ts \
  src/lib/offline/__tests__/syncWorkerHttp403.test.ts \
  src/lib/offline/__tests__/syncWorkerConcurrency.test.ts \
  src/lib/offline/__tests__/syncWorkerAtomicAck.test.ts \
  src/lib/offline/__tests__/syncWorkerInitialPull.test.ts
```

Observed result:

```text
10 test files passed
48 tests passed
```

The command also discovered and executed same-named suites under an existing
`.kilo/worktrees/flicker-slash` worktree. Those were pre-existing, out of scope,
and were not modified. The relevant current-worktree suites passed.

No new characterization tests were added because the current suites already
provide direct evidence for 503 startup recovery, 403 terminal behavior,
stale-SYNCING recovery, active-claim protection, ACK behavior, and initial pull.
They do not prove the absent cases T1/T4/T5/T7/T8/T9/T11/T12/T13/T14/T15 from the
requested list; those remain gaps rather than inferred results.

## CLASSIFICATIONS

```text
HUNG_FETCH_SCOPE = WORKER_WIDE
REQUEST_TIMEOUT = ABSENT
STOP_ABORTS_IN_FLIGHT = NO
HTTP_500_RECOVERY = GAP_CONFIRMED
TRANSIENT_HTTP_POLICY = INCONSISTENT
AUTH_RECOVERY = PARTIAL
HTTP_403_TERMINALITY = AMBIGUOUS
RATE_LIMIT_POLICY = ABSENT
GENERIC_RETRY_BACKOFF = ABSENT
LEGACY_QUEUE_STATE_RECOVERY = AMBIGUOUS
LOGOUT_CACHE_PURGE = SEPARATE_PHASE
D1_IMPLEMENTATION_READINESS = READY
```

## SEVERITY

### P1 confirmed

1. A hung push request can stall the whole worker tick and prevent later push and
   reconciliation work from running.
2. HTTP 500 can become terminal without the intended startup recovery path.
3. Auth recovery is partial: refresh/retry exists, but session failure and
   startup recovery markers are not normalized.
4. Legacy `SYNCING`/residual queue combinations can remain stranded without
   automatic repair.

### P2 confirmed

1. Generic retry has no backoff or jitter and can retry on every five-second tick.
2. 502/503/504 and 500 have inconsistent restart behavior.
3. 429 and `Retry-After` have no explicit policy.
4. Reconciliation retry has no explicit persisted attempt/backoff policy.

### P0

No P0 was proven. The audit found no new evidence of duplicate factual execution,
loss of factual execution, cross-user/cross-farm corruption, or unauthorized
factual replay.

## D1 MINIMAL PATCH RECOMMENDATION

Do not implement in D0. The smallest D1 proposal, ordered by confirmed P1
impact, is:

1. Add a request-scoped timeout and `AbortController` to `sendBatchRequest`,
   preserving the existing gesture and operation identities and translating
   aborts into the existing retryable transport path.
2. Normalize transient HTTP classification so the startup recovery contract
   explicitly covers the confirmed server-transient class, including the
   current HTTP 500 gap, without converting 403 or domain conflicts into retry.
3. Normalize auth/session failure markers and distinguish refresh failure from
   authorization denial; require user action where the session cannot be
   recovered.
4. Keep legacy queue-state recovery as a separate, fail-closed patch with
   characterization tests before any state promotion.

No backoff redesign, logout purge, schema change, migration, RLS/RPC change, or
remote operation is part of this D1 proposal unless a later implementation task
explicitly authorizes it.

## FILES CHANGED

```text
docs/review/F24_2D0_RETRY_TIMEOUT_AUTH_AUDIT.md
docs/review/F24_2D0_FAILURE_MATRIX.md
```

Runtime files, schema, migrations, RLS, RPCs, and tests were not modified.

## VALIDATION

### Executed

```text
git fetch origin
git checkout -b codex/f24-2d0-retry-timeout-auth-audit
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git status -sb
pnpm exec vitest run <focused offline suites>
```

The baseline hashes and focused test result were observed as stated above.

### Not executed

The D0 diagnostic run executed `git diff --check` successfully. The remaining
closeout gates were not executed in that run because it was diagnostic/read-only
and only the two review artifacts were added:

```text
pnpm run lint
pnpm run build
pnpm exec fallow audit --gate new-only --changed-since origin/main
```

The earlier summary's `git diff --check = PASS` is therefore the confirmed
result; the detailed artifact's previous `NOT EXECUTED` wording was corrected.

No migration, remote database operation, staging/production change, or deploy
was executed.

## FINAL STATE

```text
F24.2D0 = READY_FOR_REVIEW
F24.2D1 = UNBLOCKED
```
