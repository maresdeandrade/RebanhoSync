import { describe, expect, it, vi } from "vitest";
import {
  type CommercialOperationV2,
  executeCommercialOperationV2,
  validateCommercialOperationV2,
} from "./commercial-operation-v2";

const farm = "10000000-0000-4000-8000-000000000001";
const tx = "20000000-0000-4000-8000-000000000001";
const opId = "30000000-0000-4000-8000-000000000001";
const animalId = "40000000-0000-4000-8000-000000000001";
const occurredAt = "2026-08-13T12:00:00.000Z";

function operation(): CommercialOperationV2 {
  return {
    domain: "commercial_operation_v2",
    command: "apply_commercial_operation",
    contract_version: 2,
    client_op_id: opId,
    client_tx_id: tx,
    operation_id: opId,
    operation_type: "compra",
    scope: "animal",
    fazenda_id: farm,
    occurred_at: occurredAt,
    animal_ids: [animalId],
    animals: [
      {
        id: animalId,
        fazenda_id: farm,
        status: "ativo",
        origem: "compra",
        identificacao: "BR-001",
      },
    ],
    event: {
      id: opId,
      fazenda_id: farm,
      dominio: "comercial",
      occurred_at: occurredAt,
      animal_id: animalId,
      lote_id: null,
    },
    detail: {
      evento_id: opId,
      fazenda_id: farm,
      operation_type: "compra",
      scope: "animal",
      occurred_at: occurredAt,
      quantidade_animais: 1,
      animal_ids: [animalId],
      lote_id: null,
    },
  };
}

describe("sync-batch commercial_operation_v2", () => {
  it("accepts the complete atomic envelope", () => {
    expect(
      validateCommercialOperationV2(operation(), {
        fazendaId: farm,
        clientTxId: tx,
      }),
    ).toBeNull();
  });

  it.each([
    [
      "cross farm",
      (op: CommercialOperationV2) => (op.animals[0]!.fazenda_id = "other"),
      "COMMERCIAL_OPERATION_FARM_MISMATCH",
    ],
    [
      "duplicate ids",
      (op: CommercialOperationV2) => {
        op.animal_ids = [animalId, animalId];
        op.animals = [op.animals[0]!, op.animals[0]!];
      },
      "COMMERCIAL_OPERATION_ANIMAL_COUNT_INVALID",
    ],
    [
      "divergent state",
      (op: CommercialOperationV2) => (op.animals[0]!.status = "vendido"),
      "COMMERCIAL_OPERATION_PURCHASE_STATE_INVALID",
    ],
    [
      "missing identification",
      (op: CommercialOperationV2) => delete op.animals[0]!.identificacao,
      "COMMERCIAL_OPERATION_IDENTIFICATION_INVALID",
    ],
  ])("rejects %s before RPC", (_name, mutate, reason) => {
    const op = operation();
    mutate(op);
    expect(
      validateCommercialOperationV2(op, {
        fazendaId: farm,
        clientTxId: tx,
      }),
    ).toBe(reason);
  });

  it.each([
    [{ status: "APPLIED", replay: false }, "APPLIED"],
    [{ status: "APPLIED", replay: true }, "APPLIED"],
    [
      { status: "CONFLICT", reason_code: "COMMERCIAL_OPERATION_DIVERGENT" },
      "CONFLICT",
    ],
  ])("maps transactional RPC results", async (rpcResult, status) => {
    const rpc = vi.fn(async () => ({ data: rpcResult, error: null }));
    const result = await executeCommercialOperationV2({ rpc }, operation(), {
      fazendaId: farm,
      clientTxId: tx,
    });
    expect(result.status).toBe(status);
    expect(rpc).toHaveBeenCalledWith(
      "apply_commercial_operation_v2",
      expect.objectContaining({
        p_fazenda_id: farm,
        p_client_op_id: opId,
        p_client_tx_id: tx,
      }),
    );
  });

  it("retries a lost response with exactly the same command identity", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "network lost" } })
      .mockResolvedValueOnce({
        data: { status: "APPLIED", replay: true },
        error: null,
      });
    const op = operation();
    const first = await executeCommercialOperationV2({ rpc }, op, {
      fazendaId: farm,
      clientTxId: tx,
    });
    const second = await executeCommercialOperationV2({ rpc }, op, {
      fazendaId: farm,
      clientTxId: tx,
    });
    expect(first.status).toBe("RETRYABLE");
    expect(second.status).toBe("APPLIED");
    expect(rpc.mock.calls[0]![1]).toEqual(rpc.mock.calls[1]![1]);
  });
});
