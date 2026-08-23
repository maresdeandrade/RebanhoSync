import { db } from "./db";
import type {
  Gesture,
  Operation,
  OperationInput,
  Rejection,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaCreateDraftV2,
  SanitarioAgendaLocalV2,
} from "./types";
import { getLocalStoreName } from "./tableMap";
import { normalizeTableMutationRecord } from "./mutationRecord";
import { buildCreateAgendaOperation } from "./sanitarioV2Cutover";
import {
  assertValidAnimalTaxonomyFactsContract,
  readTaxonomyFactsRecord,
} from "@/lib/animals/taxonomyFactsContract";
import { buildCommercialPurchaseQueueOperation } from "@/lib/comercial/animalPurchaseSync";
import { buildCommercialOperationQueueOperation } from "@/lib/comercial/commercialOperationSync";

export type CreateGestureDiagnostic = {
  stage: string;
  clientTxId?: string;
  operationCount: number;
  operationIndex?: number;
  table?: string;
  action?: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    cause?: { name: string; message: string };
    dexie?: Record<string, unknown>;
  };
};

const createGestureDiagnostics = new WeakMap<object, CreateGestureDiagnostic>();

function describeCreateGestureError(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : null;
  const cause = value?.cause;
  const causeRecord =
    cause && typeof cause === "object"
      ? (cause as Record<string, unknown>)
      : null;
  const dexieKeys = ["inner", "failures", "failuresByPos", "failedKeys"];
  const dexie = value
    ? Object.fromEntries(
        dexieKeys
          .filter((key) => value[key] !== undefined)
          .map((key) => [key, value[key]]),
      )
    : {};
  return {
    name: typeof value?.name === "string" ? value.name : typeof error,
    message: typeof value?.message === "string" ? value.message : String(error),
    ...(typeof value?.stack === "string" ? { stack: value.stack } : {}),
    ...(typeof causeRecord?.message === "string"
      ? {
          cause: {
            name:
              typeof causeRecord.name === "string" ? causeRecord.name : typeof cause,
            message: causeRecord.message,
          },
        }
      : {}),
    ...(Object.keys(dexie).length > 0 ? { dexie } : {}),
  };
}

function recordCreateGestureFailure(
  error: unknown,
  context: Omit<CreateGestureDiagnostic, "error">,
): never {
  const diagnostic = { ...context, error: describeCreateGestureError(error) };
  if (error && typeof error === "object") {
    createGestureDiagnostics.set(error, diagnostic);
  }
  console.error("[createGesture] failed", diagnostic);
  throw error;
}

export function getCreateGestureDiagnostic(error: unknown) {
  return error && typeof error === "object"
    ? createGestureDiagnostics.get(error)
    : undefined;
}

function getRecordKey(record: Record<string, unknown>): string | null {
  if (typeof record.id === "string") return record.id;
  if (typeof record.evento_id === "string") return record.evento_id;
  if (typeof record.user_id === "string") return record.user_id;
  if (
    typeof record.fazenda_id === "string" &&
    typeof record.id !== "string" &&
    typeof record.evento_id !== "string" &&
    typeof record.user_id !== "string"
  ) {
    return record.fazenda_id;
  }
  return null;
}

const getClientId = () => {
  const key = "gestao_agro_client_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `browser:${crypto.randomUUID()}`;
  localStorage.setItem(key, next);
  return next;
};

function assertAllowedOfflinePushSurface(op: OperationInput) {
  const localStoreName = getLocalStoreName(op.table);

  if (op.table === "animais_sociedade") {
    throw new Error(
      "LEGACY_SOCIETY_WRITE_BLOCKED: use sociedades_pecuarias/sociedade_animais",
    );
  }

  if (op.table.startsWith("state_")) {
    throw new Error(
      `STATE_PUSH_BLOCKED: ${op.table} is a read-model surface and cannot generate queue_ops`,
    );
  }

  if (localStoreName.startsWith("catalog_")) {
    throw new Error(
      `CATALOG_PUSH_BLOCKED: ${op.table} is pull-only and cannot generate queue_ops`,
    );
  }

  if (
    localStoreName === "ops_sanitario_agenda_v2" ||
    localStoreName === "ops_sanitario_agenda_animais_v2"
  ) {
    throw new Error(
      `SANITARIO_AGENDA_V2_PULL_ONLY: ${op.table} is synced remote-to-local in this phase`,
    );
  }

  if (localStoreName === "ops_sanitario_agenda_closures_v2") {
    const closureType = op.record?.closure_type;
    const executionEventoId = op.record?.execution_evento_id;

    if (
      closureType === "executed_with_event" ||
      closureType === "partially_executed_with_event" ||
      executionEventoId != null
    ) {
      throw new Error("SANITARIO_AGENDA_CLOSURE_EXECUTION_BLOCKED_IN_12E4");
    }
  }
}

export const createGesture = async (
  fazenda_id: string,
  ops_input: OperationInput[],
  options: {
    sanitarioAgendaV2?: readonly SanitarioAgendaCreateDraftV2[];
    enqueueSanitarioAgendaV2?: boolean;
    clientTxId?: string;
    clientOpIds?: readonly string[];
  } = {},
) => {
  for (const [operationIndex, op] of ops_input.entries()) {
    try {
      assertAllowedOfflinePushSurface(op);
    } catch (error) {
      recordCreateGestureFailure(error, {
        stage: "validate-input",
        operationCount: ops_input.length,
        operationIndex,
        table: op.table,
        action: op.action,
      });
    }
  }

  const client_tx_id = options.clientTxId ?? crypto.randomUUID();
  const client_recorded_at = new Date().toISOString();
  let client_id: string;
  try {
    client_id = getClientId();
  } catch (error) {
    recordCreateGestureFailure(error, {
      stage: "create-identifiers",
      clientTxId: client_tx_id,
      operationCount: ops_input.length,
    });
  }

  let existingGesture: Gesture | undefined;
  try {
    existingGesture = await db.queue_gestures.get(client_tx_id);
  } catch (error) {
    recordCreateGestureFailure(error, {
      stage: "check-existing-gesture",
      clientTxId: client_tx_id,
      operationCount: ops_input.length,
    });
  }
  if (existingGesture) {
    const existingOps = await db.queue_ops
      .where("client_tx_id")
      .equals(client_tx_id)
      .toArray();
    const expectedOpIds = options.clientOpIds ?? [];
    const sameOperationSet =
      expectedOpIds.length === ops_input.length &&
      expectedOpIds.every((clientOpId) =>
        existingOps.some((operation) => operation.client_op_id === clientOpId),
      );
    if (!sameOperationSet) {
      throw new Error("CLIENT_TX_ID_REUSE_CONFLICT");
    }
    return client_tx_id;
  }

  const gesture: Gesture = {
    client_tx_id,
    fazenda_id,
    client_id,
    status: "PENDING",
    created_at: client_recorded_at,
  };

  const ops: Operation[] = ops_input.map((op, index) => {
    const client_op_id = options.clientOpIds?.[index] ?? crypto.randomUUID();
    let normalizedRecord: Record<string, unknown>;
    try {
      normalizedRecord = normalizeTableMutationRecord(
        op.table,
        op.record,
        fazenda_id,
      );
    } catch (error) {
      recordCreateGestureFailure(error, {
        stage: "normalize-operation",
        clientTxId: client_tx_id,
        operationCount: ops_input.length,
        operationIndex: index,
        table: op.table,
        action: op.action,
      });
    }

    return {
      ...op,
      client_tx_id,
      client_op_id,
      op_order: index,
      created_at: client_recorded_at,
      // Injeta SyncMeta no record (sem created_at/updated_at de negocio)
      record: {
        ...normalizedRecord,
        fazenda_id,
        client_id,
        client_op_id,
        client_tx_id,
        client_recorded_at,
      },
    };
  });

  const sanitarioAgendaV2 = (options.sanitarioAgendaV2 ?? []).map(
    (draft, index) => {
      const client_op_id = crypto.randomUUID();
      const domain_op_id = crypto.randomUUID();
      const agenda: SanitarioAgendaLocalV2 = {
        ...draft.agenda,
        fazenda_id,
        client_id,
        client_op_id,
        client_tx_id,
        client_recorded_at,
        server_received_at: client_recorded_at,
        created_at: client_recorded_at,
        updated_at: client_recorded_at,
        revision: 0,
        contract_version: 2,
        domain_op_id,
      };
      const animal: SanitarioAgendaAnimalLocalV2 = {
        agenda_id: agenda.id,
        fazenda_id,
        animal_id: draft.animal_id,
        planned_status: "planejado",
        execution_evento_id: null,
        not_executed_reason: null,
        metadata: draft.animal_metadata,
        created_at: client_recorded_at,
        updated_at: client_recorded_at,
      };
      const envelope = options.enqueueSanitarioAgendaV2
        ? buildCreateAgendaOperation(
            {
              clientTxId: client_tx_id,
              clientOpId: client_op_id,
              domainOpId: domain_op_id,
            },
            agenda,
            [animal.animal_id],
          )
        : null;
      const queueOp: Operation | null = envelope
        ? {
            client_op_id,
            client_tx_id,
            op_order: ops.length + index,
            table: "sanitario_v2",
            action: "INSERT",
            record: envelope,
            domain_op_id,
            sync_state: "PENDING",
            created_at: client_recorded_at,
          }
        : null;

      return { agenda, animal, queueOp };
    },
  );
  const commercialOperationQueueOp = buildCommercialOperationQueueOperation(
    ops,
    fazenda_id,
  );
  const commercialPurchaseQueueOp = commercialOperationQueueOp
    ? null
    : buildCommercialPurchaseQueueOperation(ops, fazenda_id);
  const commercialQueueOp =
    commercialOperationQueueOp ?? commercialPurchaseQueueOp;
  const compoundTables = new Set(["animais", "eventos", "eventos_comercial"]);
  const auxiliaryCommercialOps = commercialQueueOp
    ? ops.filter((op) => !compoundTables.has(op.table))
    : [];
  const queueOps = [
    ...(commercialQueueOp
      ? [commercialQueueOp, ...auxiliaryCommercialOps]
      : ops),
    ...sanitarioAgendaV2.flatMap(({ queueOp }) => (queueOp ? [queueOp] : [])),
  ];

  for (const [operationIndex, op] of queueOps.entries()) {
    try {
      validateOperationPayloadContracts(op);
    } catch (error) {
      recordCreateGestureFailure(error, {
        stage: "validate-operation",
        clientTxId: client_tx_id,
        operationCount: queueOps.length,
        operationIndex,
        table: op.table,
        action: op.action,
      });
    }
  }

  let transactionStage = "transaction-start";
  let transactionOperationIndex: number | undefined;
  await db
    .transaction(
      "rw",
      [
        db.queue_gestures,
        db.queue_ops,
        ...getAffectedStores(ops),
        ...(sanitarioAgendaV2.length > 0
          ? [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2]
          : []),
      ],
      async () => {
        transactionStage = "write-gesture";
        await db.queue_gestures.add(gesture);
        transactionStage = "write-operations";
        await db.queue_ops.bulkAdd(queueOps);

        transactionStage = "apply-local-operation";
        for (const [operationIndex, op] of ops.entries()) {
          transactionOperationIndex = operationIndex;
          await applyOpLocal(op);
        }
        transactionOperationIndex = undefined;
        if (sanitarioAgendaV2.length > 0) {
          await db.ops_sanitario_agenda_v2.bulkPut(
            sanitarioAgendaV2.map(({ agenda }) => agenda),
          );
          await db.ops_sanitario_agenda_animais_v2.bulkPut(
            sanitarioAgendaV2.map(({ animal }) => animal),
          );
        }
      },
    )
    .catch((error) => {
      const op =
        transactionOperationIndex === undefined
          ? undefined
          : ops[transactionOperationIndex];
      recordCreateGestureFailure(error, {
        stage: transactionStage,
        clientTxId: client_tx_id,
        operationCount: queueOps.length,
        ...(transactionOperationIndex === undefined
          ? {}
          : { operationIndex: transactionOperationIndex }),
        ...(op ? { table: op.table, action: op.action } : {}),
      });
    });

  return client_tx_id;
};

function validateOperationPayloadContracts(op: Operation) {
  if (
    op.table !== "animais" ||
    (op.action !== "INSERT" && op.action !== "UPDATE")
  ) {
    return;
  }

  const payload =
    op.record && typeof op.record === "object" && !Array.isArray(op.record)
      ? op.record.payload
      : undefined;
  const taxonomyFacts = readTaxonomyFactsRecord(payload);

  if (!taxonomyFacts) return;

  assertValidAnimalTaxonomyFactsContract(taxonomyFacts);
}

export const applyOpLocal = async (op: Operation) => {
  const localStoreName = getLocalStoreName(op.table);
  const store = db.table(localStoreName);

  if (!store) {
    console.error(`[ops] Store ${localStoreName} not found in database.`);
    return;
  }

  if (op.action === "INSERT") {
    await store.put(op.record);
    return;
  }

  if (op.action === "UPDATE") {
    const recordKey = getRecordKey(op.record);
    if (!recordKey) {
      console.error(
        `[ops] UPDATE skipped for ${op.table}: missing primary key in record`,
      );
      return;
    }

    const existing = await store.get(recordKey);
    if (!op.before_snapshot) {
      op.before_snapshot = existing;
      await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    }

    // UPDATE local deve ser patch parcial, nunca replace completo.
    const mergedRecord = existing ? { ...existing, ...op.record } : op.record;
    await store.put(mergedRecord);
    return;
  }

  if (op.action === "DELETE") {
    const recordKey = getRecordKey(op.record);
    if (!recordKey) {
      console.error(
        `[ops] DELETE skipped for ${op.table}: missing primary key in record`,
      );
      return;
    }

    const existing = await store.get(recordKey);
    op.before_snapshot = existing;
    await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    await store.update(recordKey, { deleted_at: new Date().toISOString() });
  }
};

export const reapplyOpLocal = async (op: Operation) => {
  const localStoreName = getLocalStoreName(op.table);
  const store = db.table(localStoreName);
  if (!store) return;

  const recordKey = getRecordKey(op.record);
  if (!recordKey) return;

  if (op.action === "INSERT") {
    await store.put(op.record);
    return;
  }

  if (op.action === "UPDATE") {
    const existing = await store.get(recordKey);
    await store.put(existing ? { ...existing, ...op.record } : op.record);
    return;
  }

  if (op.action === "DELETE") {
    await store.update(recordKey, {
      deleted_at:
        typeof op.record.deleted_at === "string"
          ? op.record.deleted_at
          : new Date().toISOString(),
    });
  }
};

export const rollbackOpLocal = async (op: Operation) => {
  if (!op.before_snapshot && op.action !== "INSERT") return;

  const localStoreName = getLocalStoreName(op.table);
  const store = db.table(localStoreName);
  if (!store) return;

  if (op.action === "INSERT") {
    const recordKey = getRecordKey(op.record);
    if (!recordKey) return;
    await store.delete(recordKey);
  } else if (op.action === "UPDATE" || op.action === "DELETE") {
    if (op.before_snapshot) {
      await store.put(op.before_snapshot);
    }
  }
};

export function getAffectedStores(ops: Operation[]) {
  const tableNames = new Set(ops.map((op) => getLocalStoreName(op.table)));
  return Array.from(tableNames)
    .map((t) => db.table(t))
    .filter(Boolean);
}

export async function retryRejectedOperation(rejection: Rejection) {
  const operation = await db.queue_ops.get(rejection.client_op_id);
  if (!operation) {
    throw new Error("REJECTED_OPERATION_NOT_AVAILABLE");
  }

  return db.transaction(
    "rw",
    [db.queue_gestures, db.queue_ops, ...getAffectedStores([operation])],
    async () => {
      const [currentOperation, gesture] = await Promise.all([
        db.queue_ops.get(operation.client_op_id),
        db.queue_gestures.get(rejection.client_tx_id),
      ]);

      if (!currentOperation || !gesture) {
        throw new Error("REJECTED_OPERATION_NOT_AVAILABLE");
      }
      if (
        currentOperation.client_tx_id !== rejection.client_tx_id ||
        gesture.fazenda_id !== rejection.fazenda_id
      ) {
        throw new Error("REJECTED_OPERATION_IDENTITY_MISMATCH");
      }
      if (
        currentOperation.sync_state !== "REJECTED" &&
        !(
          currentOperation.sync_state === undefined &&
          gesture.status === "REJECTED"
        )
      ) {
        throw new Error("REJECTED_OPERATION_ALREADY_QUEUED");
      }

      await reapplyOpLocal(currentOperation);
      await db.queue_ops.update(currentOperation.client_op_id, {
        sync_state: "PENDING",
        retry_count: (currentOperation.retry_count ?? 0) + 1,
        next_attempt_at: undefined,
        blocked_reason: undefined,
      });
      await db.queue_gestures.update(gesture.client_tx_id, {
        status: "PENDING",
        sync_result: undefined,
        completed_at: undefined,
        retry_count: (gesture.retry_count ?? 0) + 1,
        last_error: "Retry explícito da operação rejeitada com identidade preservada",
      });

      return {
        clientTxId: gesture.client_tx_id,
        clientOpId: currentOperation.client_op_id,
      };
    },
  );
}
