import { db } from "./db";
import type {
  Gesture,
  Operation,
  OperationInput,
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
  for (const op of ops_input) {
    assertAllowedOfflinePushSurface(op);
  }

  const client_tx_id = options.clientTxId ?? crypto.randomUUID();
  const client_recorded_at = new Date().toISOString();
  const client_id = getClientId();

  const existingGesture = await db.queue_gestures.get(client_tx_id);
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
    const normalizedRecord = normalizeTableMutationRecord(
      op.table,
      op.record,
      fazenda_id,
    );

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

  for (const op of queueOps) {
    validateOperationPayloadContracts(op);
  }

  await db.transaction(
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
      await db.queue_gestures.add(gesture);
      await db.queue_ops.bulkAdd(queueOps);

      for (const op of ops) {
        await applyOpLocal(op);
      }
      if (sanitarioAgendaV2.length > 0) {
        await db.ops_sanitario_agenda_v2.bulkPut(
          sanitarioAgendaV2.map(({ agenda }) => agenda),
        );
        await db.ops_sanitario_agenda_animais_v2.bulkPut(
          sanitarioAgendaV2.map(({ animal }) => animal),
        );
      }
    },
  );

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
