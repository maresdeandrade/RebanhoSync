import { describe, expect, it, vi } from "vitest";
import {
  resolveSanitarioInventoryFactualDependency,
  SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED,
} from "./inventory-dependency.ts";
import type { SanitarioSyncV2Operation } from "./sanitario-v2.ts";

const FAZENDA_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_FAZENDA_ID = "10000000-0000-4000-8000-000000000002";
const EVENT_ID = "20000000-0000-4000-8000-000000000001";
const FACTUAL_OP_ID = "30000000-0000-4000-8000-000000000001";

function factualOperation(
  overrides: Partial<SanitarioSyncV2Operation> = {},
): SanitarioSyncV2Operation {
  return {
    domain: "sanitario_v2",
    command: "apply_factual_core",
    contract_version: 1,
    client_op_id: FACTUAL_OP_ID,
    client_tx_id: "40000000-0000-4000-8000-000000000001",
    domain_op_id: "50000000-0000-4000-8000-000000000001",
    payload: {
      event: { id: EVENT_ID },
      detail: {},
      event_animals: [],
    },
    ...overrides,
  } as SanitarioSyncV2Operation;
}

describe("sync-batch: dependência factual do estoque sanitário", () => {
  it("bloqueia sem escrita quando o fato foi rejeitado no mesmo batch", async () => {
    const writeMovement = vi.fn();
    const decision = await resolveSanitarioInventoryFactualDependency({
      operations: [factualOperation()],
      processedResults: [{ op_id: FACTUAL_OP_ID, status: "REJECTED" }],
      fazendaId: FAZENDA_ID,
      sourceEventId: EVENT_ID,
      loadAppliedLedger: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    if (decision.status === "READY") writeMovement();
    expect(decision).toEqual({
      status: "BLOCKED_DEPENDENCY",
      reason_code: SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED,
    });
    expect(writeMovement).not.toHaveBeenCalled();
  });

  it("processa quando o fato foi aplicado no mesmo batch sem consultar o ledger", async () => {
    const loadAppliedLedger = vi.fn();
    const decision = await resolveSanitarioInventoryFactualDependency({
      operations: [factualOperation()],
      processedResults: [{
        client_op_id: FACTUAL_OP_ID,
        status: "APPLIED",
      }],
      fazendaId: FAZENDA_ID,
      sourceEventId: EVENT_ID,
      loadAppliedLedger,
    });

    expect(decision).toEqual({ status: "READY", source: "CURRENT_BATCH" });
    expect(loadAppliedLedger).not.toHaveBeenCalled();
  });

  it("processa quando o fato já foi aplicado no ledger", async () => {
    const loadAppliedLedger = vi.fn().mockResolvedValue({
      data: { id: "60000000-0000-4000-8000-000000000001" },
      error: null,
    });
    const decision = await resolveSanitarioInventoryFactualDependency({
      operations: [],
      processedResults: [],
      fazendaId: FAZENDA_ID,
      sourceEventId: EVENT_ID,
      loadAppliedLedger,
    });

    expect(decision).toEqual({ status: "READY", source: "LEDGER" });
    expect(loadAppliedLedger).toHaveBeenCalledWith(FAZENDA_ID, EVENT_ID);
  });

  it("bloqueia dependência ausente ou existente somente em outra fazenda", async () => {
    const ledgerByFarm = new Map([
      [`${OTHER_FAZENDA_ID}:${EVENT_ID}`, {
        id: "60000000-0000-4000-8000-000000000002",
      }],
    ]);
    const decision = await resolveSanitarioInventoryFactualDependency({
      operations: [],
      processedResults: [],
      fazendaId: FAZENDA_ID,
      sourceEventId: EVENT_ID,
      loadAppliedLedger: vi.fn(async (fazendaId, sourceEventId) => ({
        data: ledgerByFarm.get(`${fazendaId}:${sourceEventId}`) ?? null,
        error: null,
      })),
    });

    expect(decision).toEqual({
      status: "BLOCKED_DEPENDENCY",
      reason_code: SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED,
    });
  });
});
