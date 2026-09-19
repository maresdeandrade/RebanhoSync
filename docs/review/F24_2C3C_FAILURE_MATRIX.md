# F24.2C3C — Failure Matrix

Baseline: `origin/main@134e52596d9bb81d63dac73fdc437e7308daa6a3`

| ID | Preconditions / injection | Expected state | Observed evidence | Classification |
|---|---|---|---|---|
| C1 | APPLIED result; obligation write fault | No partial terminal ACK; queue retained; no obligation | Fault injection passed | SAFE |
| C2 | ACK committed; restart before pull | `DONE`; obligation retained; no queue replay | Durable store and recovery identity tests; real kill not run | SAFE by persistence contract |
| C3 | Pull promise interrupted | `DONE`; obligation retained | Drain failure and post-ACK pull failure passed | SAFE |
| C4 | Pull success; exit before delete | Replay then conditional delete | Control flow and generation tests passed; real kill not run | SAFE by control flow |
| C5 | Persistent pull error | Obligation retained; `DONE` | Network error test passed | SAFE |
| C6 | Pending obligation; restart offline | Obligation retained; no replay | Persistence tests passed; offline transport not separately simulated | SAFE for local state |
| C7 | Restart online | Startup drain opportunity | Startup and drain tests passed | SAFE |
| C8 | Offline then online event | Listener drains active farm | Lifecycle/online test passed | SAFE |
| C9 | Farm A pending; active farm B | A remains; no A pull | Farm isolation test passed | SAFE |
| C10 | B returns to A | A becomes drainable | Farm-scoped drain passed; selector transition not separately simulated | SAFE for drain contract |
| C11 | New ACK upserts G2 during G1 drain | G1 delete fails; G2 remains | Generation race passed | SAFE |
| C12 | Two same-process drains | No corruption | Concurrent drain passed | SAFE |
| C13 | Two tabs with Web Locks | One holder; other skips | Branch exists; real browser tabs not run | PARTIAL EVIDENCE |
| C14 | Two tabs without Web Locks | Duplicate pull possible; no loss | Existing fallback characterization; independent tabs not run | SAFE correctness / partial liveness |
| C15 | Old obligation plus new generation | Old delete cannot remove new | Conditional-delete test passed | SAFE |
| C16 | Repeated reconciliation | No queue replay; convergent pull | Drain has no send/enqueue path | SAFE at worker boundary |
| C17 | Auth/session failure | Obligation retained; `DONE` | No dedicated auth injection | PARTIAL EVIDENCE |
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
| Multi-context correctness | SAFE for correctness; efficiency/liveness partial without Web Locks |
| Non-active-farm background reconciliation | OPEN / FUTURE |

## Severity

No new P0 or P1 was observed. Known P2 limitation: duplicate work may occur without Web Locks across independent contexts.

## Closeout recommendation

`F24.2C3 = READY_TO_CLOSE` is recommended for review, conditional on accepting the C13/C14/C17 evidence limits and the existing GAP-2 classification.
