import { db } from "./db";
import { movementCommandDigest } from "./movementDigest";
import type { Operation, OperationInput } from "./types";

export const isMovementOperation = (op: Operation) =>
  op.table === "movement_v1";
const signature = (animal: unknown, ops: Operation[]) =>
  JSON.stringify([animal, ops.filter(isMovementOperation)]);

export async function prepareMovementIntents(
  farm: string,
  drafts: OperationInput[],
  tx: string,
  clientOpIds?: readonly string[],
) {
  const snapshots = new Map<string, string>();
  const queue = await db.queue_ops.toArray();
  const local: OperationInput[] = [];
  const ids: string[] = [];
  const prepared: Operation[] = [];
  for (const [draftIndex, draft] of drafts.entries()) {
    if (draft.table !== "movement_v1") {
      local.push(draft);
      ids.push(clientOpIds?.[draftIndex] ?? crypto.randomUUID());
      continue;
    }
    const fact = draft.record as Record<string, unknown>;
    const animalId = String(fact.subject_id);
    const animal = await db.state_animais.get(animalId);
    if (!animal || animal.fazenda_id !== farm)
      throw new Error("MOVEMENT_LOCAL_ANIMAL_UNAVAILABLE");
    if (!snapshots.has(animalId))
      snapshots.set(animalId, signature(animal, queue));
    const predecessors = [...queue, ...prepared].filter(
      (op) =>
        isMovementOperation(op) &&
        op.record.fazenda_id === farm &&
        op.record.subject_id === animalId &&
        op.sync_state !== "REJECTED",
    );
    const referenced = new Set(
      predecessors.map((op) => op.record.movement_base?.event_id),
    );
    const tails = predecessors.filter(
      (op) =>
        !referenced.has(op.record.event_id) &&
        op.record.movement_mode === "operational",
    );
    if (tails.length > 1) throw new Error("MOVEMENT_LOCAL_CHAIN_AMBIGUOUS");
    const parent = tails[0];
    if (
      fact.movement_mode === "operational" &&
      !parent &&
      animal.movement_version == null
    )
      throw new Error("MOVEMENT_SNAPSHOT_REQUIRED_PULL");
    if (
      fact.movement_mode === "operational" &&
      !parent &&
      ((typeof animal.movement_version === "number" &&
        !Number.isSafeInteger(animal.movement_version)) ||
        !/^(0|[1-9][0-9]*)$/.test(String(animal.movement_version)))
    )
      throw new Error("MOVEMENT_SNAPSHOT_TOKEN_UNSAFE");
    const opId = clientOpIds?.[draftIndex] ?? crypto.randomUUID();
    const command = {
      domain: "movement_v1",
      command: "apply_animal_lot",
      contract_version: 1,
      fazenda_id: farm,
      subject_type: "animal",
      subject_id: animalId,
      event_id: fact.event_id,
      client_op_id: opId,
      client_tx_id: tx,
      movement_mode: fact.movement_mode,
      from_lote_id:
        fact.movement_mode === "history_only"
          ? fact.from_lote_id
          : parent
            ? parent.record.to_lote_id
            : animal.lote_id,
      to_lote_id: fact.to_lote_id,
      occurred_at: fact.occurred_at,
      movement_base:
        fact.movement_mode === "history_only"
          ? null
          : parent
            ? {
                kind: "after_movement",
                event_id: parent.record.event_id,
                command_digest: parent.command_digest,
              }
            : {
                kind: "snapshot",
                movement_version: String(animal.movement_version),
                head_event_id: animal.movement_head_event_id ?? null,
              },
      source_task_id: fact.source_task_id ?? null,
      observacoes: fact.observacoes ?? null,
      payload: fact.payload ?? {},
      detail_payload: fact.detail_payload ?? {},
    };
    const input = Object.fromEntries(
      Object.entries(command).filter(
        ([key]) => key !== "domain" && key !== "command",
      ),
    );
    const digest = await movementCommandDigest(input);
    const op: Operation = {
      client_op_id: opId,
      client_tx_id: tx,
      table: "movement_v1",
      action: "INSERT",
      record: command,
      command_digest: digest,
      sync_state: "PENDING",
      created_at: new Date().toISOString(),
      before_snapshot: animal,
    };
    prepared.push(op);
    local.push(
      {
        table: "eventos",
        action: "INSERT",
        movement_group: opId,
        record: {
          id: command.event_id,
          dominio: "movimentacao",
          occurred_at: command.occurred_at,
          animal_id: animalId,
          lote_id: command.from_lote_id,
          source_task_id: command.source_task_id,
          observacoes: command.observacoes,
          payload: command.payload,
        },
      },
      {
        table: "eventos_movimentacao",
        action: "INSERT",
        movement_group: opId,
        record: {
          evento_id: command.event_id,
          from_lote_id: command.from_lote_id,
          to_lote_id: command.to_lote_id,
          from_pasto_id: null,
          to_pasto_id: null,
          payload: command.detail_payload,
        },
      },
    );
    ids.push(opId, crypto.randomUUID());
    if (command.movement_mode === "operational") {
      local.push({
        table: "animais",
        action: "UPDATE",
        movement_group: opId,
        record: { id: animalId, lote_id: command.to_lote_id },
      });
      ids.push(crypto.randomUUID());
    }
  }
  return {
    local,
    ids,
    prepared,
    async verify() {
      const currentOps = await db.queue_ops.toArray();
      for (const [id, snapshot] of snapshots) {
        if (signature(await db.state_animais.get(id), currentOps) !== snapshot)
          throw new Error("MOVEMENT_LOCAL_SNAPSHOT_CHANGED_RESUBMIT");
      }
    },
  };
}
