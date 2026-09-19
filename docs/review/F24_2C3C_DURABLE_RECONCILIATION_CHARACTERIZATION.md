# F24.2C3C — Durable Reconciliation Characterization

Baseline: `origin/main@134e52596d9bb81d63dac73fdc437e7308daa6a3`
Date: 2026-09-19

## Decision

`F24.2C3C = READY_FOR_REVIEW`

The integrated C3B implementation is characterized below. No additional C3C runtime implementation was started. F24.2D was not started.

## FACT CONFIRMED

- Dexie v30 contains `sync_reconcile_obligations`.
- Obligation identity is `fazenda_id:scope`.
- Scopes are `factual`, `sanitario-v2`, `agenda-v2`, and `reproduction`.
- Upsert merges `tables` by set union and creates a new `generation_id`.
- Generic APPLIED ACKs persist obligations, delete queue operations, and mark the gesture `DONE` in one Dexie transaction.
- An obligation-write fault aborts that transaction.
- Drain lists only the requested farm, dispatches to pull/recovery functions, and conditionally deletes by the observed generation.
- Startup, worker tick, and browser `online` wake-up provide drain opportunities.
- Drain calls read/reconstruction paths only. It does not call `sendBatchRequest`, enqueue, or create a gesture.
- Web Locks are opportunistic. Without them, correctness relies on idempotent pulls and generation-conditional deletion.

## INFERENCE

- A crash after the Dexie commit leaves both the `DONE` gesture and obligation durable. Restart can drain without replaying queue operations.
- A pull interruption leaves the obligation because deletion follows successful dispatch.
- If a pull succeeds but the process exits before deletion, replay is safe at the obligation boundary; factual idempotency remains delegated to the existing pull implementation.

## RECOMMENDATION

- Close C3C with `NON_ACTIVE_FARM_BACKGROUND_RECONCILIATION = OPEN / FUTURE`.
- Keep `HUNG_FETCH / TIMEOUT`, `HTTP_500_RECOVERY`, `AMBIGUOUS_LEGACY_QUEUE_STATES`, and `LOGOUT CACHE PURGE` outside this phase.
- Treat no-Web-Locks multi-tab behavior as correctness-safe but partial for efficiency/liveness.

## Contract and source-of-truth invariant

`DONE` means write acknowledgement complete; it does not mean read-model reconciliation complete.

The obligation store contains synchronization metadata only: key, farm, scope, optional table names, generation, and timestamps. It contains no factual event, agenda execution, clinical state, weight, sale, slaughter, or authoritative domain payload.

Drain is farm-scoped. It does not execute `sendBatchRequest`, enqueue, or create a gesture.

## Evidence

- `reconciliationObligations.test.ts`: 16 passing tests.
- `reconciliationObligations.upgrade.test.ts`: 1 passing test.
- `syncWorkerAtomicAck.test.ts`: 3 passing tests.
- `syncWorkerConcurrency.test.ts`: 11 passing tests.
- `syncWorkerConcurrency.characterization.test.ts`: 8 passing tests.
- Combined focused run: 8 files, 61 tests, all passing.

## Non-observed boundaries

- A real OS process kill during an in-flight pull was not executed in Vitest.
- Independent browser tabs with a real `navigator.locks` implementation were not executed in local jsdom.
- Auth/session failure during reconciliation was not separately injected; generic pull-failure retention is covered.
- Remote factual idempotency was not re-certified against Supabase; no remote operation was executed.

## Final classifications

- `ACK_OBLIGATION_ATOMICITY = SAFE`
- `POST_ACK_CRASH_RECOVERY = SAFE_BY_DURABLE_CONTRACT`
- `RECONCILIATION_REPLAY_IDEMPOTENCY = SAFE_AT_WORKER_BOUNDARY`
- `STALE_DRAIN_DELETE_PROTECTION = SAFE`
- `RECONCILIATION_MULTI_CONTEXT_CORRECTNESS = SAFE_BY_INVARIANT`
- `REAL_BROWSER_MULTI_TAB_EVIDENCE = PARTIAL`
- `RECONNECT_RECOVERY = SAFE`
- `FARM_SWITCH_OBLIGATION_RETENTION = SAFE`
- `RECONCILIATION_FACTUAL_REPLAY = NOT_PRESENT`
- `AUTH_SPECIFIC_RECONCILIATION_RECOVERY = NOT_DIRECTLY_TESTED`
- `C3_CLOSEOUT_READINESS = READY`

`GAP-1 = CLOSED`

`GAP-2 = DURABLY_DEFERRED / MITIGATED`

`NON_ACTIVE_FARM_BACKGROUND_RECONCILIATION = OPEN / FUTURE`

`NEW_P0 = NONE_OBSERVED`

`NEW_P1 = NONE_OBSERVED`
