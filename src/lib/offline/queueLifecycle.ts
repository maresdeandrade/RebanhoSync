import { db } from "./db";

export interface OrphanedQueueOperationsGroup {
  clientTxId: string;
  operationCount: number;
  tables: string[];
  createdAt: string[];
}

export interface QueueLifecycleHealth {
  activeGestures: number;
  retryOrReconciliationGestures: number;
  doneGestures: number;
  operationsForActiveGestures: number;
  operationsForRetryOrReconciliation: number;
  historicalOperations: 0;
  orphanOperations: number;
  residualOperationsForDoneGestures: number;
  syncBlockers: number;
}

export async function inspectQueueLifecycleHealth(): Promise<QueueLifecycleHealth> {
  const [gestures, operations] = await Promise.all([
    db.queue_gestures.toArray(),
    db.queue_ops.toArray(),
  ]);
  const gestureStatusById = new Map(
    gestures.map((gesture) => [gesture.client_tx_id, gesture.status]),
  );
  const activeStatuses = new Set(["PENDING", "SYNCING"]);
  const recoveryStatuses = new Set(["ERROR", "REJECTED"]);
  const operationCounts = operations.reduce(
    (counts, operation) => {
      const status = gestureStatusById.get(operation.client_tx_id);
      if (!status) counts.orphan += 1;
      else if (activeStatuses.has(status)) counts.active += 1;
      else if (recoveryStatuses.has(status)) counts.recovery += 1;
      else if (status === "DONE") counts.doneResidual += 1;
      return counts;
    },
    { active: 0, recovery: 0, orphan: 0, doneResidual: 0 },
  );
  const activeGestures = gestures.filter((gesture) =>
    activeStatuses.has(gesture.status),
  ).length;
  const retryOrReconciliationGestures = gestures.filter((gesture) =>
    recoveryStatuses.has(gesture.status),
  ).length;

  return {
    activeGestures,
    retryOrReconciliationGestures,
    doneGestures: gestures.filter((gesture) => gesture.status === "DONE")
      .length,
    operationsForActiveGestures: operationCounts.active,
    operationsForRetryOrReconciliation: operationCounts.recovery,
    historicalOperations: 0,
    orphanOperations: operationCounts.orphan,
    residualOperationsForDoneGestures: operationCounts.doneResidual,
    syncBlockers:
      retryOrReconciliationGestures +
      operationCounts.orphan +
      operationCounts.doneResidual,
  };
}

export async function inspectOrphanedQueueOperations(): Promise<
  OrphanedQueueOperationsGroup[]
> {
  const [gestures, operations] = await Promise.all([
    db.queue_gestures.toArray(),
    db.queue_ops.toArray(),
  ]);
  const gestureIds = new Set(gestures.map((gesture) => gesture.client_tx_id));
  const groups = new Map<string, OrphanedQueueOperationsGroup>();

  for (const operation of operations) {
    if (gestureIds.has(operation.client_tx_id)) continue;

    const group = groups.get(operation.client_tx_id) ?? {
      clientTxId: operation.client_tx_id,
      operationCount: 0,
      tables: [],
      createdAt: [],
    };
    group.operationCount += 1;
    if (!group.tables.includes(operation.table))
      group.tables.push(operation.table);
    if (!group.createdAt.includes(operation.created_at)) {
      group.createdAt.push(operation.created_at);
    }
    groups.set(operation.client_tx_id, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    tables: group.tables.sort(),
    createdAt: group.createdAt.sort(),
  }));
}

/**
 * Remove somente operações órfãs de transações já auditadas externamente.
 * A ausência do gesto é revalidada na mesma transação que apaga as operações.
 */
export async function removeVerifiedOrphanedQueueOperations(
  verifiedClientTxIds: readonly string[],
) {
  const uniqueClientTxIds = Array.from(new Set(verifiedClientTxIds));
  const removedByTransaction: Record<string, number> = {};

  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    for (const clientTxId of uniqueClientTxIds) {
      const gesture = await db.queue_gestures.get(clientTxId);
      if (gesture) continue;

      const operationIds = await db.queue_ops
        .where("client_tx_id")
        .equals(clientTxId)
        .primaryKeys();
      if (operationIds.length === 0) continue;

      await db.queue_ops.bulkDelete(operationIds);
      removedByTransaction[clientTxId] = operationIds.length;
    }
  });

  for (const [clientTxId, operationCount] of Object.entries(
    removedByTransaction,
  )) {
    console.info("[queue-lifecycle] Removed verified orphaned operations", {
      client_tx_id: clientTxId,
      operation_count: operationCount,
    });
  }

  return removedByTransaction;
}
