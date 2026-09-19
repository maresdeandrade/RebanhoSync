# F24.2C3C — Failure Matrix

Baseline: `origin/main@134e52596d9bb81d63dac73fdc437e7308daa6a3`

| ID | Preconditions / injection | Expected state | Observed evidence | Classification |
|---|---|---|---|---|
| C1 | APPLIED result; obligation write fault | No partial terminal ACK; queue retained; no obligation | Fault injection passed | SAFE |
| C2 | ACK committed; restart before pull | `DONE`; obligation retained; no queue replay | Durable store and recovery identity tests; real kill not run | SAFE_BY_DURABLE_CONTRACT |
| C3 | Pull promise interrupted | `DONE`; obligation retained | Drain failure and post-ACK pull failure passed | SAFE |
| C4 | Pull success; exit before delete | Replay then conditional delete | Control flow and generation tests passed; real kill not run | SAFE_BY_CONTROL_FLOW_AND_IDEMPOTENT_REPLAY |
| C5 | Persistent pull error | Obligation retained; `DONE` | Network error test passed | SAFE |
| C6 | Pending obligation; restart offline | Obligation retained; no replay | Persistence tests passed; offline transport not separately simulated | SAFE for local state |
| C7 | Restart online | Startup drain opportunity | Startup and drain tests passed | SAFE |
| C8 | Offline then online event | Listener drains active farm | Lifecycle/online test passed | SAFE |
| C9 | Farm A pending; active farm B | A remains; no A pull | Farm isolation test passed | SAFE |
| C10 | B returns to A | A becomes drainable | Farm-scoped drain passed; selector transition not separately simulated | SAFE for drain contract |
| C11 | New ACK upserts G2 during G1 drain | G1 delete fails; G2 remains | Generation race passed | SAFE |
| C12 | Two same-process drains | No corruption | Concurrent drain passed | SAFE |
| C13 | Two tabs with Web Locks | One holder; other skips | Real browser multi-tab with `navigator.locks` not executed | PARTIAL EVIDENCE |
| C14 | Two tabs without Web Locks | Duplicate pull possible; no loss | Correctness invariant reviewed; real independent no-Web-Locks contexts not directly exercised | CORRECTNESS SAFE BY INVARIANT; REAL MULTI-CONTEXT EXECUTION NOT DIRECTLY OBSERVED; EFFICIENCY/LIVENESS PARTIAL |
| C15 | Old obligation plus new generation | Old delete cannot remove new | Conditional-delete test passed | SAFE |
| C16 | Repeated reconciliation | No queue replay; convergent pull | Drain has no send/enqueue path | SAFE at worker boundary |
| C17 | Auth/session failure | Obligation retained; `DONE` | Auth-specific injection not executed; generic reconciliation failure retention covered | AUTH_SPECIFIC_RECONCILIATION_RECOVERY = NOT_DIRECTLY_TESTED; GENERIC_RECONCILIATION_FAILURE_RETENTION = SAFE |
| C18 | Worker stop/start | Listener removed/re-added; obligations retained | Lifecycle test passed | SAFE |

## Invariants

| Invariant | Result |
|---|---|
| ACK + obligation atomicity | SAFE |
| `DONE` is not reconciliation complete | CONFIRMED |
| Generation stale-delete protection | SAFE |
| Farm-scoped retention | SAFE |
| No factual replay from drain | NOT_PRESENT |
| Obligation is not source of truth | CONFIRMED |
| Multi-context correctness | SAFE_BY_INVARIANT; real browser multi-tab evidence PARTIAL |
| Non-active-farm background reconciliation | OPEN / FUTURE |

## Severity

`NEW_P0 = NONE_OBSERVED`

`NEW_P1 = NONE_OBSERVED`

Known P2: duplicate reconciliation pull work may occur across independent contexts without Web Locks. This is not classified as factual risk.

## Closeout recommendation

`F24.2C3 = READY_TO_CLOSE` is recommended for review, conditional on accepting the C13/C14/C17 evidence limits and the existing GAP-2 classification.
