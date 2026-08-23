import type {
  Operation,
  SyncOperationAuditResult,
  SyncOperationResult,
} from "./types";

export type OperationResultMatch = {
  op: Operation;
  result: SyncOperationResult;
};

export type OperationReconciliationPlan = {
  applied: OperationResultMatch[];
  rejected: OperationResultMatch[];
  retryable: OperationResultMatch[];
  missing: Operation[];
  audits: SyncOperationAuditResult[];
};

export type TerminalBlockedDependencyClassifier = (
  match: OperationResultMatch,
) => boolean;

export function mergeOperationAudit(
  current: SyncOperationAuditResult[] | undefined,
  incoming: SyncOperationAuditResult[],
) {
  const merged = new Map<string, SyncOperationAuditResult>();

  for (const result of current ?? []) {
    const key =
      result.op_id ||
      result.domain_op_id ||
      `${result.status}:${result.local_reason_code ?? "unknown"}`;
    merged.set(key, result);
  }
  for (const result of incoming) {
    const key =
      result.op_id ||
      result.domain_op_id ||
      `${result.status}:${result.local_reason_code ?? "unknown"}`;
    merged.set(key, result);
  }

  return Array.from(merged.values());
}

export function planOperationReconciliation(
  operations: Operation[],
  results: SyncOperationResult[],
  recordedAt: string,
  isTerminalBlockedDependency?: TerminalBlockedDependencyClassifier,
): OperationReconciliationPlan {
  const operationsById = new Map(
    operations.map((operation) => [operation.client_op_id, operation]),
  );
  const resultsById = new Map<string, SyncOperationResult>();
  const audits: SyncOperationAuditResult[] = [];

  for (const result of results) {
    const opId = typeof result.op_id === "string" ? result.op_id : "";
    const operation = operationsById.get(opId);
    const identifiersDiverge =
      typeof result.client_op_id === "string" &&
      result.client_op_id !== opId;

    audits.push({
      ...result,
      op_id: opId,
      matched: Boolean(operation) && !identifiersDiverge,
      recorded_at: recordedAt,
      local_reason_code:
        !operation || identifiersDiverge
          ? identifiersDiverge
            ? "SYNC_RESULT_ID_MISMATCH"
            : "SYNC_RESULT_OP_NOT_FOUND"
          : undefined,
    });

    if (operation && !identifiersDiverge) {
      resultsById.set(opId, result);
    }
  }

  const plan: OperationReconciliationPlan = {
    applied: [],
    rejected: [],
    retryable: [],
    missing: [],
    audits,
  };

  for (const operation of operations) {
    const result = resultsById.get(operation.client_op_id);
    if (!result) {
      plan.missing.push(operation);
      continue;
    }

    const match = { op: operation, result };
    if (result.status === "APPLIED" || result.status === "APPLIED_ALTERED") {
      plan.applied.push(match);
    } else if (
      result.status === "REJECTED" ||
      result.status === "CONFLICT" ||
      (result.status === "BLOCKED_DEPENDENCY" &&
        result.retryable !== true &&
        isTerminalBlockedDependency?.(match) === true)
    ) {
      plan.rejected.push(match);
    } else {
      plan.retryable.push(match);
    }
  }

  return plan;
}
