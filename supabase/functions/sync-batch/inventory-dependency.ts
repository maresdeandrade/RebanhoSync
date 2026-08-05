import {
  isSanitarioSyncV2Operation,
  type SanitarioSyncV2Operation,
} from "./sanitario-v2.ts";
import type { Operation } from "./rules.ts";

export const SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED =
  "SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED";

interface ProcessedOperationResult {
  op_id?: string;
  client_op_id?: string;
  status?: string;
}

interface AppliedLedgerLookup {
  data: { id: string } | null;
  error: { message: string } | null;
}

export type SanitarioInventoryDependencyDecision =
  | { status: "READY"; source: "CURRENT_BATCH" | "LEDGER" }
  | {
    status: "BLOCKED_DEPENDENCY";
    reason_code: typeof SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED;
  }
  | {
    status: "RETRYABLE";
    reason_code: "SANITARIO_INVENTORY_LEDGER_LOOKUP_FAILED";
    reason_message: string;
  };

export function isSanitarioInventoryMovementOperation(
  value: Operation | SanitarioSyncV2Operation,
): value is Operation {
  if (isSanitarioSyncV2Operation(value)) return false;
  return value.table === "insumo_movimentacoes" &&
    value.action === "INSERT" &&
    value.record?.tipo === "consumo_sanitario";
}

export async function resolveSanitarioInventoryFactualDependency(input: {
  operations: readonly (Operation | SanitarioSyncV2Operation)[];
  processedResults: readonly ProcessedOperationResult[];
  fazendaId: string;
  sourceEventId: string;
  loadAppliedLedger: (
    fazendaId: string,
    sourceEventId: string,
  ) => Promise<AppliedLedgerLookup>;
}): Promise<SanitarioInventoryDependencyDecision> {
  const factualOperations = input.operations.filter((candidate) =>
    isSanitarioSyncV2Operation(candidate) &&
    candidate.command === "apply_factual_core" &&
    candidate.payload.event.id === input.sourceEventId
  );
  const appliedInCurrentBatch = factualOperations.some((dependency) =>
    input.processedResults.some((entry) =>
      (entry.op_id === dependency.client_op_id ||
        entry.client_op_id === dependency.client_op_id) &&
      entry.status === "APPLIED"
    )
  );
  if (appliedInCurrentBatch) {
    return { status: "READY", source: "CURRENT_BATCH" };
  }

  const ledger = await input.loadAppliedLedger(
    input.fazendaId,
    input.sourceEventId,
  );
  if (ledger.error) {
    return {
      status: "RETRYABLE",
      reason_code: "SANITARIO_INVENTORY_LEDGER_LOOKUP_FAILED",
      reason_message: ledger.error.message,
    };
  }
  if (ledger.data) return { status: "READY", source: "LEDGER" };
  return {
    status: "BLOCKED_DEPENDENCY",
    reason_code: SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED,
  };
}
