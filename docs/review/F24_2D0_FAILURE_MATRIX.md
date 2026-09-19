# F24.2D0 — Failure Matrix

Baseline: `origin/main@4dbde8f1ba5b9f81f5ac171e800dcfb9f94d426e`.

D0 closeout evidence: `git diff --check` was executed and passed. The
documentation-only D0 run did not execute lint, build, or fallow; those are
recorded as closeout gates rather than inferred results.

Legend:

- **C** = fato confirmado by current code or executed focused test;
- **I** = inference from confirmed control flow;
- **R** = recommendation, not implemented.

| ID | Scenario | Current behavior | Recovery / terminality | Evidence | Severity |
|---|---|---|---|---|---|
| D1-01 | Fetch hangs during push | `fetch` has no timeout or abort; sequential `await processGesture` holds the tick | Worker tick and later drain remain blocked until fetch settles or context dies | C: `syncWorker.ts` request path and tick loop | P1 |
| D1-02 | `stopSyncWorker` during hung fetch | Interval/listener/flags are reset; in-flight promise is not cancelled | Request continues; no abort recovery | C: `stopSyncWorker` and `sendBatchRequest` | P1 |
| D1-03 | Next interval during hung fetch | `isTickRunning` remains true | Later ticks return immediately | C: worker interval guard | P1 |
| D1-04 | HTTP 500 below limit | Error enters generic catch and gesture returns to `PENDING`; budget increments | Same-session retry on later tick | C: catch path | P2 |
| D1-05 | HTTP 500 at limit | Gesture becomes `ERROR` with `Max retries: HTTP 500...` | Startup marker list does not recognize HTTP 500 | C: marker list and recovery function | P1 |
| D1-06 | HTTP 502/503/504 at limit | Gesture becomes `ERROR` | Startup marker list requeues and resets generic retry budget | C: marker list plus `syncWorkerRecovery.test.ts` for 503 | P2 |
| D1-07 | HTTP 500 versus other 5xx | Same transport class, different startup policy | Inconsistent transient policy | C: code comparison | P2 |
| D1-08 | HTTP 401 first response | One refresh and one repeat request | If repeat succeeds, normal ACK path; if not, generic retry | C: process path | P1 |
| D1-09 | `getSession` unusable and refresh fails | Throws localized session-expired error | Generic retry; startup recovery only if message matches a marker | C: `getValidSession` and marker policy | P1 |
| D1-10 | Repeated 401 | First 401 refreshes once; second 401 throws | Generic retry budget; no second refresh in same request | C: process path | P2 |
| D1-11 | HTTP 403 | `ERROR`; retry count unchanged; queue/op and optimistic state remain | No automatic requeue; cause is not separated | C: `syncWorkerHttp403.test.ts` and classifier | P1 |
| D1-12 | HTTP 429 | Generic HTTP error | No `Retry-After`; generic retry, then terminal `ERROR` | C: no explicit 429 branch found | P2 |
| D1-13 | Network failure | Generic catch | Retry up to three; startup only for textual markers | C: catch and markers | P2 |
| D1-14 | Domain `REJECTED` / `CONFLICT` result | Operation-level reconciliation, rollback/audit according to result | Not the generic HTTP error path | C: `planOperationReconciliation` and worker | None |
| D1-15 | Sanitário retryable result | Operation remains `RETRYABLE`; `next_attempt_at` uses exponential backoff capped at five minutes | Operation-level retry policy | C: `getSanitarioRetryUpdate` | None |
| D1-16 | Generic gesture retry | Five-second worker interval; no `next_attempt_at` or jitter | Can create retry bursts | C: worker interval and generic catch | P2 |
| D1-17 | Pull/reconciliation failure | Pull error is logged; durable reconciliation obligation remains where already persisted | Retried on later drain/wakeup, without explicit attempt backoff | C: obligation drain | P2 |
| D1-18 | `SYNCING` + zero operations | Can remain after legacy/interrupted boundary | Startup stale recovery deliberately leaves it unchanged | C: recovery code and existing test | P1 |
| D1-19 | `SYNCING` + terminal-only operations | Can remain | Startup stale recovery leaves it unchanged | C: recovery code and existing test | P1 |
| D1-20 | `ERROR` + zero operations | Can remain | Marker-only recovery; no operation proof | C: recovery code | P1 |
| D1-21 | `PENDING` + zero operations | Legacy/corrupt state is possible | No general inference to `DONE`; fail-closed handling | C/I: claim and no-ready-op branch | P1 |
| D1-22 | `DONE` + remaining operations | Residual state is detectable by queue lifecycle health | Worker does not select `DONE` for push; no repair | C: `queueLifecycle.ts` | P1 |
| D1-23 | `REJECTED` + non-terminal remaining operation | Possible mixed legacy state | Worker does not select terminal gesture; no generic repair | C/I: state filters | P1 |
| D1-24 | Crash before request | Persisted `SYNCING` with non-terminal ops can be reopened | Same IDs replayed | C: stale recovery and concurrency tests | None |
| D1-25 | Crash during request | No timeout; if context remains active, tick is blocked; if claim becomes stale, recovery depends on persisted non-terminal ops | Same IDs are intended for replay | C/I: request/lock/recovery paths | P1 |
| D1-26 | Remote apply before response loss | Same persisted IDs are resent | Remote idempotency/ledger behavior is relied on | C from prior C1/C2 evidence; no new runtime change | None |
| D1-27 | Logout with pending queue | Auth/active-farm UI state cleared; Dexie and queues retained | Work can reappear after another login; no user ownership policy | C: `useAuth`, `Perfil`, offline stores | P1 |
| D1-28 | Account switch with local data | No local `user_id` ownership in queue records | Membership/RLS is the remote barrier; no local purge/freeze policy | C/I: inspected queue shape and auth paths | P1 |
| D1-29 | Farm switch | Gesture retains its farm ID; pull/drain uses active farm | Queue persists; projection handling is separate | C/I: worker and farm selection paths | P1 |
| D1-30 | Logout cache purge | No purge in logout; explicit reset is separate support action and does not cover all sync metadata | Requires separate phase; do not mix with retry patch | C: `resetOfflineFarmData` and auth paths | Separate phase |
| D1-31 | Worker order | Initial pull → startup recovery → push → telemetry → purge → reconciliation drain | Hung push starves later work; initial pull catches its own failures | C: `startSyncWorker` | P1 |
| D1-32 | Online wakeup | Starts initial pull and reconciliation drain | Does not cancel/bypass an in-flight push or reset `isTickRunning` | C: `wakeUpDurableSyncWork` | P2 |

## Required classifications

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

## Minimal D1 proposal

```text
R1. Request-scoped AbortController timeout, preserving persisted identities.
R2. Explicit transient HTTP normalization, including the confirmed HTTP 500 gap.
R3. Auth failure normalization and explicit user-action boundary.
R4. Separate fail-closed legacy-state characterization/recovery phase.
```

Do not add schema, migration, RLS, RPC, remote execution, logout purge, or
global backoff redesign as part of this diagnostic exit.
