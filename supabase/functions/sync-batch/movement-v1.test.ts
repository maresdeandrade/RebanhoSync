import { describe, expect, it, vi } from "vitest";
import {
  executeMovementV1,
  isMovementV1Operation,
  type MovementV1,
} from "./movement-v1";

const farm = crypto.randomUUID(),
  tx = crypto.randomUUID();
function operation(overrides: Record<string, unknown> = {}): MovementV1 {
  return {
    domain: "movement_v1",
    command: "apply_animal_lot",
    contract_version: 1,
    fazenda_id: farm,
    subject_type: "animal",
    subject_id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    client_op_id: crypto.randomUUID(),
    client_tx_id: tx,
    movement_mode: "operational",
    from_lote_id: null,
    to_lote_id: crypto.randomUUID(),
    occurred_at: "2026-10-01T12:00:00.000Z",
    movement_base: {
      kind: "snapshot",
      movement_version: "0",
      head_event_id: null,
    },
    payload: { factual: "preserved" },
    detail_payload: { note: "preserved" },
    ...overrides,
  } as MovementV1;
}
const context = { fazendaId: farm, clientTxId: tx };
describe("movement_v1 transport", () => {
  it("E10 timeout is unknown outcome, never a durable rejection or early ACK", async () => {
    vi.useFakeTimers();
    try {
      const rpc = vi.fn(
        () => new Promise<{ data: unknown; error: null }>(() => {}),
      );
      const result = executeMovementV1({ rpc }, operation(), context);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(await result).toMatchObject({
        status: "RETRYABLE",
        commit_unknown: true,
        terminal: false,
        reason_code: "MOVEMENT_RPC_UNCONFIRMED",
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it("E1 forwards exact PostgreSQL input and acknowledges only after awaited RPC", async () => {
    const op = operation();
    let finish!: (response: { data: unknown; error: null }) => void;
    const rpc = vi.fn(
      () =>
        new Promise<{ data: unknown; error: null }>((resolve) => {
          finish = resolve;
        }),
    );
    let acknowledged = false;
    const running = executeMovementV1({ rpc }, op, context).then((result) => {
      acknowledged = true;
      return result;
    });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    const { domain, command, ...input } = op;
    void domain;
    void command;
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "apply_animal_lot_movement_v1",
      { p_command: input },
    );
    finish({
      data: { status: "STATE_APPLIED", event_id: op.event_id, replayed: false },
      error: null,
    });
    expect(await running).toMatchObject({
      op_id: op.client_op_id,
      status: "APPLIED",
      terminal: true,
      state_effect: true,
      retryable: false,
    });
  });
  it.each([
    { command: undefined },
    { domain: undefined },
    { contract_version: 2 },
    { domain: "movement_v2" },
    { actor_id: crypto.randomUUID() },
    { movement_head_event_id: crypto.randomUUID() },
    { table: "eventos", action: "INSERT", record: {} },
    { movement_base: undefined },
    { client_op_id: undefined },
    { payload: [] },
  ])(
    "E2 partial or invalid declaration is recognized but never calls RPC: %j",
    async (overrides) => {
      const op = operation(overrides),
        rpc = vi.fn();
      expect(isMovementV1Operation(op)).toBe(true);
      expect(await executeMovementV1({ rpc }, op, context)).toMatchObject({
        status: "REJECTED",
        reason_code: "MOVEMENT_ENVELOPE_INVALID",
      });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("keeps an old generic operation outside specialized recognition", () => {
    expect(
      isMovementV1Operation({
        table: "eventos_movimentacao",
        action: "INSERT",
        record: {},
      }),
    ).toBe(false);
  });
  it("E3 farm and transaction mismatch reject before RPC", async () => {
    const rpc = vi.fn();
    expect(
      await executeMovementV1(
        { rpc },
        operation({ fazenda_id: crypto.randomUUID() }),
        context,
      ),
    ).toMatchObject({ reason_code: "MOVEMENT_FARM_MISMATCH" });
    expect(
      await executeMovementV1(
        { rpc },
        operation({ client_tx_id: crypto.randomUUID() }),
        context,
      ),
    ).toMatchObject({ reason_code: "MOVEMENT_TX_MISMATCH" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["STATE_APPLIED", "APPLIED", true, true],
    ["PROJECTION_CONFLICT", "CONFLICT", true, false],
    ["PENDING_CAUSAL_DEPENDENCY", "BLOCKED_DEPENDENCY", false, false],
    ["HISTORY_ONLY", "APPLIED", true, false],
    ["HISTORY_CONFLICT", "CONFLICT", true, false],
    ["REJECTED", "REJECTED", true, false],
    ["CONFLICT", "CONFLICT", true, false],
  ])(
    "E4-E9 maps %s without altering the original receipt",
    async (domainStatus, status, terminal, effect) => {
      const receipt = {
        status: domainStatus,
        reason_code: domainStatus === "CONFLICT" ? "IDENTITY_DIVERGENCE" : null,
        replayed: true,
        movement_version_after: "1",
      };
      const rpc = vi.fn().mockResolvedValue({ data: receipt, error: null });
      const result = await executeMovementV1({ rpc }, operation(), context);
      expect(result).toMatchObject({
        status,
        terminal,
        state_effect: effect,
        retryable: false,
        reconciliation_required: true,
        canonical_result: receipt,
      });
      expect(result.canonical_result).toBe(receipt);
    },
  );
  it.each(["returned", "thrown", "malformed"])(
    "E10 %s RPC error is retryable uncertainty, not factual rejection",
    async (kind) => {
      const rpc =
        kind === "thrown"
          ? vi.fn().mockRejectedValue(new Error("network"))
          : vi
              .fn()
              .mockResolvedValue(
                kind === "returned"
                  ? { data: null, error: { message: "unavailable" } }
                  : { data: { status: "UNEXPECTED" }, error: null },
              );
      expect(
        await executeMovementV1({ rpc }, operation(), context),
      ).toMatchObject({
        status: "RETRYABLE",
        retryable: true,
        terminal: false,
        commit_unknown: true,
      });
    },
  );
});
