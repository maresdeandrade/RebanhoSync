import { db } from "./db";
import { Operation, Gesture, OperationInput } from "./types";
import { getLocalStoreName } from "./tableMap";

function getRecordKey(record: Record<string, unknown>): string | null {
  if (typeof record.id === "string") return record.id;
  if (typeof record.evento_id === "string") return record.evento_id;
  if (typeof record.user_id === "string") return record.user_id;
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

export const createGesture = async (
  fazenda_id: string,
  ops_input: OperationInput[],
) => {
  const client_tx_id = crypto.randomUUID();
  const client_recorded_at = new Date().toISOString();
  const client_id = getClientId();

  const gesture: Gesture = {
    client_tx_id,
    fazenda_id,
    client_id,
    status: "PENDING",
    created_at: client_recorded_at,
  };

  const ops: Operation[] = ops_input.map((op, index) => {
    const client_op_id = crypto.randomUUID();

    return {
      ...op,
      client_tx_id,
      client_op_id,
      op_order: index,
      created_at: client_recorded_at,
      // Injeta SyncMeta no record (sem created_at/updated_at de negocio)
      record: {
        ...op.record,
        fazenda_id,
        client_id,
        client_op_id,
        client_tx_id,
        client_recorded_at,
      },
    };
  });

  await db.transaction(
    "rw",
    [db.queue_gestures, db.queue_ops, ...getAffectedStores(ops)],
    async () => {
      await db.queue_gestures.add(gesture);
      await db.queue_ops.bulkAdd(ops);

      for (const op of ops) {
        await applyOpLocal(op);
      }
    },
  );

  return client_tx_id;
};

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
