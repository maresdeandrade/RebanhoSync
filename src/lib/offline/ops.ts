import { assertInventoryFarmContext, getInventoryFarmContextStores } from "@/lib/inventory/inventoryFarmContext";
import { db } from "./db";
import { prepareMovementIntents } from "./movement";
import type {
  Gesture,
  InsumoLote,
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

export const getClientId = () => {
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

type CreateGestureOptions = {
  validateContext?: () => void;
  sanitarioAgendaV2?: readonly SanitarioAgendaCreateDraftV2[];
  enqueueSanitarioAgendaV2?: boolean;
  clientTxId?: string;
  clientOpIds?: readonly string[];
};

function hasExistingOperationSet(
  existingOps: Operation[],
  ops_input: OperationInput[],
  clientOpIds: readonly string[] | undefined,
) {
  const expectedOpIds = clientOpIds ?? [];
  return (
    expectedOpIds.length === ops_input.length &&
    expectedOpIds.every((clientOpId) =>
      existingOps.some((operation) => operation.client_op_id === clientOpId),
    )
  );
}

function materializeGestureMovement(
  ops_input: OperationInput[],
  options: CreateGestureOptions,
  movement: Awaited<ReturnType<typeof prepareMovementIntents>> | null,
  movementTx: string,
) {
  if (!movement) return { ops_input, options };
  return {
    ops_input: movement.local,
    options: { ...options, clientTxId: movementTx, clientOpIds: movement.ids },
  };
}

function assertMovementWriterBoundary(ops_input: OperationInput[]) {
  // Old Animal→Lote bundles are never reinterpreted as commands.
  if (
    ops_input.some(
      (op) =>
        op.table === "eventos" &&
        op.record?.dominio === "movimentacao" &&
        op.record?.animal_id,
    )
  ) {
    throw new Error("LEGACY_ANIMAL_MOVEMENT_WRITER_DISABLED");
  }
  if (
    ops_input.some(
      (op) =>
        op.table === "animais" &&
        op.action === "UPDATE" &&
        Object.prototype.hasOwnProperty.call(op.record, "lote_id") &&
        !["vendido", "morto", "retirado"].includes(op.record.status),
    )
  ) {
    throw new Error("GENERIC_ANIMAL_LOCATION_WRITER_DISABLED");
  }
}

export const createGesture = async (
  fazenda_id: string,
  ops_input: OperationInput[],
  options: CreateGestureOptions = {},
) => {
  const { validateContext = () => undefined } = options;
  validateContext();
  assertMovementWriterBoundary(ops_input);
  const movementTx = options.clientTxId ?? crypto.randomUUID();
  const movement = ops_input.some(op => op.table === "movement_v1")
    ? await prepareMovementIntents(fazenda_id, ops_input, movementTx, options.clientOpIds) : null;
  ({ ops_input, options } = materializeGestureMovement(ops_input, options, movement, movementTx));
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
    const sameOperationSet = hasExistingOperationSet(existingOps, ops_input, options.clientOpIds);
    if (!sameOperationSet) {
      throw new Error("CLIENT_TX_ID_REUSE_CONFLICT");
    }
    validateContext();
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
  if (movement) {
    const remaining = queueOps.filter(op => !op.movement_group);
    queueOps.splice(0, queueOps.length, ...remaining, ...movement.prepared);
    queueOps.forEach((op, index) => { op.op_order = index; });
  }

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
        ...getInventoryFarmContextStores(ops_input),
        ...(movement ? [db.state_animais] : []),
        ...(sanitarioAgendaV2.length > 0
          ? [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2]
          : []),
      ],
      async () => {
        transactionStage = "write-gesture";
        await movement?.verify();
        await assertInventoryFarmContext(fazenda_id, ops_input);
        validateContext();
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
        validateContext();
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

async function persistExpectedAnimalRevision(
  op: Operation,
  existing: { revision?: unknown } | undefined,
) {
  if (op.table !== "animais" || op.expected_revision !== undefined) return;

  const remoteRevision = existing?.revision;
  if (!Number.isSafeInteger(remoteRevision) || Number(remoteRevision) < 1) return;

  op.expected_revision = Number(remoteRevision);
  await db.queue_ops.update(op.client_op_id, {
    expected_revision: Number(remoteRevision),
  });
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

  const recordKey = getRecordKey(op.record);
  if (!recordKey) {
    console.error(
      `[ops] ${op.action} skipped for ${op.table}: missing primary key in record`,
    );
    return;
  }

  const existing = await store.get(recordKey);
  await persistExpectedAnimalRevision(op, existing);

  if (op.action === "UPDATE") {
    if (!op.before_snapshot) {
      op.before_snapshot = existing;
      await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
    }

    // UPDATE local deve ser patch parcial, nunca replace completo.
    const mergedRecord = existing ? { ...existing, ...op.record } : op.record;
    await store.put(mergedRecord);
    return;
  }

  op.before_snapshot = existing;
  await db.queue_ops.update(op.client_op_id, { before_snapshot: existing });
  await store.update(recordKey, { deleted_at: new Date().toISOString() });
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
    await persistExpectedAnimalRevision(op, existing);
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

async function assertRetryAnimalFarm(operation: Operation, farmId: string) {
  if (operation.table !== "animais") return;
  const animalId = operation.record.id;
  const animal = animalId ? await db.state_animais.get(String(animalId)) : undefined;
  if (animal && animal.fazenda_id !== farmId) {
    throw new Error("REJECTED_OPERATION_IDENTITY_MISMATCH");
  }
}

function isSanitaryStockRetry(op: Operation) {
  return op.action === "INSERT" && op.table === "state_insumo_movimentacoes" && op.record.tipo === "consumo_sanitario";
}

function validSanitaryRetryLot(lot: InsumoLote | undefined, farmId: string, quantity: number): lot is InsumoLote {
  return Boolean(lot && !lot.deleted_at && lot.fazenda_id === farmId && Number.isFinite(quantity) && quantity > 0);
}

async function reserveSanitaryStockRetry(op: Operation, fazendaId: string) {
  const existing = await db.state_insumo_movimentacoes.get(String(op.record.id));
  if (existing) {
    if (existing.client_op_id !== op.client_op_id || existing.fazenda_id !== fazendaId) throw new Error("REJECTED_OPERATION_IDENTITY_MISMATCH");
    return;
  }
  const lot = await db.state_insumo_lotes.get(String(op.record.insumo_lote_id));
  const quantity = Number(op.record.quantidade_base);
  if (!validSanitaryRetryLot(lot, fazendaId, quantity))
    throw new Error("SANITARIO_INVENTORY_RETRY_INVALID");
  if (lot.saldo_atual_base < quantity) throw new Error("SANITARIO_INVENTORY_RETRY_INSUFFICIENT_BALANCE");
  await db.state_insumo_lotes.update(lot.id, { saldo_atual_base: lot.saldo_atual_base - quantity });
}

async function reapplyExplicitRejectedOperation(op: Operation, farmId: string) {
  await assertRetryAnimalFarm(op, farmId);
  if (isSanitaryStockRetry(op)) await reserveSanitaryStockRetry(op, farmId);
  await reapplyOpLocal(op);
}

export async function retryRejectedOperation(rejection: Rejection) {
  const operation = await db.queue_ops.get(rejection.client_op_id);
  if (!operation) {
    throw new Error("REJECTED_OPERATION_NOT_AVAILABLE");
  }
  const isFactualCore = (op: Operation) =>
    op.record.domain === "sanitario_v2" && op.record.command === "apply_factual_core";
  const siblings = await db.queue_ops.where("client_tx_id").equals(operation.client_tx_id).toArray();
  const factualRetry = siblings.some(isFactualCore);

  return db.transaction(
    "rw",
    [db.queue_gestures, db.queue_ops, ...(factualRetry ? [] : getAffectedStores([operation])),
      ...(!factualRetry && isSanitaryStockRetry(operation) ? [db.state_insumo_lotes] : [])],
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

      // A rejected sanitary fact and its stock companion were never rolled back.
      // Re-arm their original envelopes together; never reapply the local fact/stock.
      const currentSiblings = factualRetry
        ? await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).toArray()
        : [currentOperation];
      if (factualRetry && !currentSiblings.some(isFactualCore)) {
        throw new Error("REJECTED_OPERATION_NOT_AVAILABLE");
      }
      const retryOps = currentSiblings.filter(op => op.sync_state === "REJECTED" &&
        (!factualRetry || isFactualCore(op) ||
          (op.table === "state_insumo_movimentacoes" && op.record.tipo === "consumo_sanitario")));
      if (!factualRetry) {
        await reapplyExplicitRejectedOperation(currentOperation, gesture.fazenda_id);
      }
      for (const retryOp of factualRetry ? retryOps : [currentOperation]) {
        await db.queue_ops.update(retryOp.client_op_id, {
        sync_state: "PENDING",
        retry_count: (retryOp.retry_count ?? 0) + 1,
        next_attempt_at: undefined,
        blocked_reason: undefined,
        });
      }
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
