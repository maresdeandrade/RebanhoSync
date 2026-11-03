import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import {
  validateSanitarioV2Enqueue,
  writeSanitarioV2Queue,
} from "@/lib/offline/sanitarioV2Cutover";
import { prepareSanitaryCommandV3 } from "./sanitaryAdmissionV3";
import type {
  SanitaryActionV3,
  SanitaryParticipationDraftV3,
} from "./sanitaryCollaborationTypesV3";

export interface CollaborationContextV3 {
  fazendaId: string;
  agendaId: string;
  actorUserId: string;
  clientId: string;
  projectRef: string;
  assertCurrentContext?: () => void;
}
async function assertOwner(context: CollaborationContextV3) {
  context.assertCurrentContext?.();
  const owner = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
  if (owner?.owner_user_id !== context.actorUserId)
    throw Error("SANITARIO_LOCAL_OWNERSHIP_CHANGED");
}
export async function currentParticipationV3(
  context: Pick<
    CollaborationContextV3,
    "fazendaId" | "agendaId" | "actorUserId" | "clientId"
  >,
) {
  return db.local_sanitario_participacoes
    .where("[fazenda_id+agenda_id+actor_user_id+client_id]")
    .equals([
      context.fazendaId,
      context.agendaId,
      context.actorUserId,
      context.clientId,
    ])
    .filter((x) => !x.superseded)
    .first();
}

/** Must run in the writer's transaction. Sequence allocation and queue insertion commit together. */
export async function allocateSanitarySequenceV3(
  fazendaId: string,
  agendaId: string,
  clientId: string,
) {
  const actor = (await db.local_ownership.get(LOCAL_OWNERSHIP_KEY))
    ?.owner_user_id;
  if (!actor) throw Error("SANITARIO_LOCAL_OWNERSHIP_REQUIRED");
  let draft = await currentParticipationV3({
    fazendaId,
    agendaId,
    clientId,
    actorUserId: actor,
  });
  if (draft?.completed)
    throw Error(
      "Concluiu sua atuação. Inicie uma nova participação para retomar.",
    );
  draft ??= {
    id: crypto.randomUUID(),
    fazenda_id: fazendaId,
    agenda_id: agendaId,
    client_id: clientId,
    actor_user_id: actor,
    sequence: 0,
    completed: false,
  };
  draft.sequence += 1;
  await db.local_sanitario_participacoes.put(draft);
  return { participation_id: draft.id, participation_sequence: draft.sequence };
}

/** Local command is an intention. Only a server receipt/pull confirms the transition. */
export async function manageSanitaryAgendaV3(
  context: CollaborationContextV3,
  action: SanitaryActionV3,
  fields: Record<string, unknown> = {},
  operationId = crypto.randomUUID(),
) {
  const ownership = await (
    await import("@/lib/offline/localReadBoundary")
  ).getCurrentLocalReadOwnership();
  if (
    ownership.status !== "OWNED" ||
    ownership.currentUserId !== context.actorUserId
  )
    throw Error("SANITARIO_LOCAL_OWNERSHIP_REQUIRED");
  const identity = {
    clientOpId: operationId,
    clientTxId: operationId,
    domainOpId: operationId,
  };
  const base = {
    domain: "sanitario_v2",
    contract_version: 3,
    command: "manage_agenda",
    fazenda_id: context.fazendaId,
    client_op_id: identity.clientOpId,
    client_tx_id: identity.clientTxId,
    domain_op_id: identity.domainOpId,
  };
  // Validate ownership/gate outside transaction, then recheck ownership and context inside.
  const stored = await db.queue_ops.get(operationId);
  const probe = prepareSanitaryCommandV3(
    stored?.record ?? {
      ...base,
      payload: {
        ...fields,
        agenda_id: context.agendaId,
        action,
        ...(["participate", "complete"].includes(action)
          ? {
              participation_id: operationId,
              ...(action === "complete" ? { final_sequence: 0 } : {}),
            }
          : {}),
      },
    },
  );
  await validateSanitarioV2Enqueue({
    fazendaId: context.fazendaId,
    projectRef: context.projectRef,
    operations: [probe],
  });
  await db.transaction(
    "rw",
    [
      db.local_ownership,
      db.local_sanitario_participacoes,
      db.ops_sanitario_participacoes,
      db.queue_ops,
      db.queue_gestures,
      db.ops_sanitario_agenda_v2,
    ],
    async () => {
      await assertOwner(context);
      const agenda = await db.ops_sanitario_agenda_v2.get(context.agendaId);
      if (!agenda || agenda.fazenda_id !== context.fazendaId)
        throw Error("SANITARIO_AGENDA_NOT_FOUND");
      // An already durable envelope is replayed verbatim; never allocate a new segment/sequence.
      const existing = await db.queue_ops.get(operationId);
      if (existing) {
        const p = existing.record.payload;
        if (
          existing.record.fazenda_id !== context.fazendaId ||
          p.agenda_id !== context.agendaId ||
          p.action !== action
        )
          throw Error("SANITARIO_IDENTITY_REUSE");
        if (
          Object.entries(fields).some(
            ([key, value]) => JSON.stringify(p[key]) !== JSON.stringify(value),
          )
        )
          throw Error("SANITARIO_IDENTITY_REUSE_DIVERGENT_PAYLOAD");
        return;
      }
      let draft: SanitaryParticipationDraftV3 | undefined;
      let payload: Record<string, unknown> = {
        ...fields,
        agenda_id: context.agendaId,
        action,
      };
      if (
        action === "complete" &&
        typeof fields.participation_id === "string"
      ) {
        const remote = await db.ops_sanitario_participacoes.get(
          fields.participation_id,
        );
        if (
          !remote ||
          remote.fazenda_id !== context.fazendaId ||
          remote.agenda_id !== context.agendaId ||
          remote.actor_user_id !== context.actorUserId ||
          remote.client_id !== context.clientId
        )
          throw Error("SANITARIO_PARTICIPATION_SCOPE_MISMATCH");
        if (
          !Number.isSafeInteger(fields.final_sequence) ||
          Number(fields.final_sequence) < 0
        )
          throw Error("SANITARIO_FINAL_SEQUENCE_INVALID");
        // Explicit declaration for an original durable segment, not a guessed final limit.
        payload = {
          ...payload,
          participation_id: remote.id,
          final_sequence: fields.final_sequence,
        };
      } else if (action === "participate" || action === "complete") {
        draft = await currentParticipationV3(context);
        if (action === "participate") {
          if (draft && !draft.completed)
            throw Error(
              "Já existe participação em andamento neste dispositivo.",
            );
          if (draft)
            await db.local_sanitario_participacoes.update(draft.id, {
              superseded: true,
            });
          draft = {
            id: operationId,
            fazenda_id: context.fazendaId,
            agenda_id: context.agendaId,
            actor_user_id: context.actorUserId,
            client_id: context.clientId,
            sequence: 0,
            completed: false,
          };
        } else {
          if (!draft || draft.completed)
            throw Error("Nenhuma participação em andamento.");
          draft.completed = true;
        }
        payload = {
          ...payload,
          participation_id: draft.id,
          ...(action === "complete" ? { final_sequence: draft.sequence } : {}),
        };
        await db.local_sanitario_participacoes.put(draft);
      }
      const operation = prepareSanitaryCommandV3({ ...base, payload });
      await writeSanitarioV2Queue({
        fazendaId: context.fazendaId,
        clientId: context.clientId,
        operations: [operation],
      });
      await assertOwner(context);
    },
  );
  return operationId;
}
