import { describe, expect, it, vi } from "vitest";
import {
  type CommercialPurchaseOperation,
  executeCommercialPurchaseOperation,
  validateCommercialPurchaseOperation,
} from "./commercial-purchase";

const farm = "10000000-0000-4000-8000-000000000001";
const tx = "20000000-0000-4000-8000-000000000001";
const opId = "30000000-0000-4000-8000-000000000001";
const animalId = "40000000-0000-4000-8000-000000000001";
const eventId = "50000000-0000-4000-8000-000000000001";

function operation(): CommercialPurchaseOperation {
  return {
    domain: "commercial_purchase_v1",
    command: "apply_individual_purchase",
    contract_version: 1,
    client_op_id: opId,
    client_tx_id: tx,
    animal: {
      id: animalId,
      fazenda_id: farm,
      origem: "compra",
      status: "ativo",
    },
    event: {
      id: eventId,
      fazenda_id: farm,
      dominio: "comercial",
      animal_id: animalId,
      occurred_at: "2026-08-08T12:00:00.000Z",
    },
    detail: {
      evento_id: eventId,
      fazenda_id: farm,
      operation_type: "compra",
      scope: "animal",
      occurred_at: "2026-08-08T12:00:00.000Z",
      quantidade_animais: 1,
      animal_ids: [animalId],
      finance_transaction_id: null,
    },
  };
}

describe("sync-batch commercial purchase command", () => {
  it("accepts only the coherent individual purchase unit", () => {
    expect(validateCommercialPurchaseOperation(operation(), {
      fazendaId: farm,
      clientTxId: tx,
    })).toBeNull();
  });

  it.each([
    [
      "cross-farm",
      (op: CommercialPurchaseOperation) => op.detail.fazenda_id = "other",
      "COMMERCIAL_PURCHASE_FARM_MISMATCH",
    ],
    [
      "link mismatch",
      (op: CommercialPurchaseOperation) => op.detail.animal_ids = ["other"],
      "COMMERCIAL_PURCHASE_LINK_MISMATCH",
    ],
    [
      "lote mismatch",
      (op: CommercialPurchaseOperation) => {
        op.animal.lote_id = "lote-a";
        op.event.lote_id = "lote-a";
        op.detail.lote_id = "lote-b";
      },
      "COMMERCIAL_PURCHASE_LINK_MISMATCH",
    ],
    [
      "occurred_at mismatch",
      (op: CommercialPurchaseOperation) => {
        op.event.occurred_at = "2026-08-08T12:00:00.000Z";
        op.detail.occurred_at = "2026-08-08T13:00:00.000Z";
      },
      "COMMERCIAL_PURCHASE_LINK_MISMATCH",
    ],
    [
      "missing parent",
      (op: CommercialPurchaseOperation) => op.event = {},
      "COMMERCIAL_PURCHASE_PARENT_REQUIRED",
    ],
    [
      "finance side effect",
      (op: CommercialPurchaseOperation) =>
        op.detail.finance_transaction_id = "finance",
      "COMMERCIAL_PURCHASE_DOMAIN_INVALID",
    ],
  ])("rejects %s before RPC", (_name, mutate, reason) => {
    const op = operation();
    mutate(op);
    expect(validateCommercialPurchaseOperation(op, {
      fazendaId: farm,
      clientTxId: tx,
    })).toBe(reason);
  });

  it.each([
    ["valid purchase", { status: "APPLIED", replay: false }, "APPLIED"],
    ["identical replay", { status: "APPLIED", replay: true }, "APPLIED"],
    ["animal divergent", {
      status: "CONFLICT",
      reason_code: "COMMERCIAL_PURCHASE_ANIMAL_DIVERGENT",
    }, "CONFLICT"],
    ["event divergent", {
      status: "CONFLICT",
      reason_code: "COMMERCIAL_PURCHASE_EVENT_DIVERGENT",
    }, "CONFLICT"],
    ["detail divergent", {
      status: "CONFLICT",
      reason_code: "COMMERCIAL_PURCHASE_DETAIL_DIVERGENT",
    }, "CONFLICT"],
  ])("maps RPC result for %s", async (_name, rpcResult, status) => {
    const rpc = vi.fn(async () => ({ data: rpcResult, error: null }));
    const result = await executeCommercialPurchaseOperation(
      { rpc },
      operation(),
      { fazendaId: farm, clientTxId: tx },
    );
    expect(result.status).toBe(status);
    expect(rpc).toHaveBeenCalledWith(
      "apply_individual_animal_purchase",
      expect.objectContaining({
        p_fazenda_id: farm,
        p_client_op_id: opId,
        p_client_tx_id: tx,
      }),
    );
  });

  it("allows retry after a lost response without changing identity", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: "network lost" } })
      .mockResolvedValueOnce({
        data: { status: "APPLIED", replay: true },
        error: null,
      });
    const first = await executeCommercialPurchaseOperation(
      { rpc },
      operation(),
      { fazendaId: farm, clientTxId: tx },
    );
    const second = await executeCommercialPurchaseOperation(
      { rpc },
      operation(),
      { fazendaId: farm, clientTxId: tx },
    );
    expect(first.status).toBe("RETRYABLE");
    expect(second.status).toBe("APPLIED");
    expect(rpc.mock.calls[0][1]).toEqual(rpc.mock.calls[1][1]);
  });
});
