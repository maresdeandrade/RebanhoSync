import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { getCurrentLocalReadOwnership } from "@/lib/offline/localReadBoundary";
import { createGesture } from "@/lib/offline/ops";
import { getLocalStoreName } from "@/lib/offline/tableMap";
import type {
  FarmRoleEnum,
  Operation,
  SanitarioAgendaCreateDraftV2,
} from "@/lib/offline/types";
import { readSanitaryPlanningSyncContextV2 } from "@/lib/sanitario/agenda/sanitaryPlanningSyncV2";
import { deterministicUuidFromText } from "./deterministicUuid";
import { getBirthEventId } from "./neonatal";
import { buildPostPartumOps, type BuildPostPartumOpsInput } from "./postPartum";

export type PostPartumContext = {
  fazendaId: string | null;
  userId: string | null;
  role: FarmRoleEnum | null;
};
type SanitaryUnavailableReason =
  | "gate_off"
  | "planning_forbidden"
  | "cutover_unavailable"
  | "legacy_identity";

function assertContext(
  expected: PostPartumContext,
  current: PostPartumContext,
  farm: string,
) {
  if (
    !expected.userId ||
    expected.fazendaId !== farm ||
    current.userId !== expected.userId ||
    current.fazendaId !== farm ||
    current.role !== expected.role
  )
    throw new Error("POSTPARTUM_CONTEXT_CHANGED");
}

function queuedAgenda(op: Operation) {
  if (op.table === "agenda_itens") return op.record;
  if (
    op.record.domain === "sanitario_v2" &&
    op.record.command === "create_agenda"
  )
    return op.record.payload?.agenda;
  return null;
}

/** Domain-scoped transaction; no change to the generic writer or old envelopes. */
export async function registerPostPartumGesture(
  input: BuildPostPartumOpsInput,
  readContext: () => PostPartumContext,
) {
  const context = { ...readContext() };
  assertContext(context, readContext(), input.fazendaId);
  // Auth can refresh: it must finish before opening the IndexedDB transaction.
  const ownership = await getCurrentLocalReadOwnership();
  if (
    ownership.status !== "OWNED" ||
    ownership.currentUserId !== context.userId
  )
    throw new Error("POSTPARTUM_CONTEXT_CHANGED");
  assertContext(context, readContext(), input.fazendaId);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const txId = deterministicUuidFromText(
    JSON.stringify([
      "postpartum-v1",
      input.fazendaId,
      context.userId,
      input.mother.id,
      occurredAt,
      input.weightUnit ?? "kg",
      input.birthEventId ?? null,
      [...input.drafts]
        .sort((a, b) => a.calfId.localeCompare(b.calfId))
        .map((draft) => [
          draft.calfId,
          draft.identificacao,
          draft.nome,
          draft.loteId,
          draft.pesoKg,
          draft.curaUmbigo,
        ]),
    ]),
  );
  // The reread can introduce factual writes absent from the screen snapshot.
  // Declare every possible domain store before opening the transaction.
  const stores = [
    ...[
      "animais",
      "lotes",
      "agenda_itens",
      "eventos",
      "eventos_pesagem",
      "eventos_sanitario",
      "eventos_movimentacao",
    ].map((table) => db.table(getLocalStoreName(table))),
    db.queue_ops,
    db.queue_gestures,
    db.local_ownership,
    db.ops_sanitario_agenda_v2,
    db.ops_sanitario_agenda_animais_v2,
    db.sync_sanitario_v2_cutovers,
  ];
  return db.transaction("rw", stores, async () => {
    assertContext(context, readContext(), input.fazendaId);
    if (
      (await db.local_ownership.get(LOCAL_OWNERSHIP_KEY))?.owner_user_id !==
      context.userId
    )
      throw new Error("POSTPARTUM_CONTEXT_CHANGED");
    const previous = await db.queue_gestures.get(txId);
    if (previous) {
      if (previous.fazenda_id !== input.fazendaId)
        throw new Error("POSTPARTUM_CONTEXT_CHANGED");
      return {
        txId,
        replayed: true,
        weighedCount: 0,
        umbigoCount: 0,
        agendaCount: 0,
        sanitary: {
          created: 0,
          unavailable: 0,
          reason: undefined as SanitaryUnavailableReason | undefined,
        },
      };
    }
    const mother = await db.state_animais.get(input.mother.id);
    const calves = await db.state_animais.bulkGet(
      input.calves.map((calf) => calf.id),
    );
    if (
      !mother ||
      mother.fazenda_id !== input.fazendaId ||
      mother.deleted_at ||
      calves.some(
        (calf) =>
          !calf ||
          calf.fazenda_id !== input.fazendaId ||
          calf.mae_id !== mother.id ||
          calf.deleted_at,
      )
    )
      throw new Error("POSTPARTUM_ANIMAL_SCOPE_MISMATCH");
    const calfIds = new Set(calves.map((calf) => calf!.id));
    if (input.drafts.some((draft) => !calfIds.has(draft.calfId)))
      throw new Error("POSTPARTUM_ANIMAL_SCOPE_MISMATCH");
    if (
      input.birthEventId &&
      calves.some(
        (calf) => getBirthEventId(calf!.payload) !== input.birthEventId,
      )
    )
      throw new Error("POSTPARTUM_BIRTH_LINK_MISMATCH");
    const legacy = await db.state_agenda_itens
      .where("fazenda_id")
      .equals(input.fazendaId)
      .toArray();
    const existingV2 = await db.ops_sanitario_agenda_v2
      .where("fazenda_id")
      .equals(input.fazendaId)
      .toArray();
    const gestures = new Map(
      (await db.queue_gestures.toArray()).map((gesture) => [
        gesture.client_tx_id,
        gesture.fazenda_id,
      ]),
    );
    const pending = (await db.queue_ops.toArray()).filter(
      (op) =>
        (op.record.fazenda_id ?? gestures.get(op.client_tx_id)) ===
        input.fazendaId,
    );
    const pendingAgendas = pending.map(queuedAgenda).filter(Boolean);
    const blockedKeys = new Set([
      ...existingV2.map((row) => row.dedup_key),
      ...pendingAgendas.map((row) => row.dedup_key),
    ]);
    const blockedIds = new Set([
      ...existingV2.map((row) => row.id),
      ...pendingAgendas.map((row) => row.id),
      ...pending.map(
        (op) =>
          op.record.payload?.agenda_id ?? op.record.payload?.closure?.agenda_id,
      ),
    ]);
    const built = buildPostPartumOps({
      ...input,
      occurredAt,
      mother,
      calves: calves.filter((calf) => !!calf),
      existingAgendaItems: legacy,
    });
    // Preserve terminal states, tombstones and old queue entries. No backfill/translation.
    const drafts = built.sanitarioAgendaV2.filter(
      (draft) =>
        !blockedIds.has(draft.agenda.id) &&
        !blockedKeys.has(draft.agenda.dedup_key),
    );
    const occupiedIds = await db.ops_sanitario_agenda_v2.bulkGet(
      drafts.map((draft) => draft.agenda.id),
    );
    if (occupiedIds.some((row) => row && row.fazenda_id !== input.fazendaId))
      throw new Error("POSTPARTUM_AGENDA_SCOPE_MISMATCH");
    // Also protect non-sanitary intentions left pending without a materialized row.
    const ops = built.ops.filter(
      (op) =>
        !(
          op.table === "agenda_itens" &&
          op.action === "INSERT" &&
          (blockedIds.has(op.record.id) || blockedKeys.has(op.record.dedup_key))
        ),
    );
    let reason: SanitaryUnavailableReason | undefined;
    const sync = readSanitaryPlanningSyncContextV2();
    if (context.role !== "owner" && context.role !== "manager")
      reason = "planning_forbidden";
    else if (!sync) reason = "gate_off";
    else if (
      (await db.sync_sanitario_v2_cutovers.get(`${input.fazendaId}:2`))
        ?.status !== "APPLIED"
    )
      reason = "cutover_unavailable";
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!reason && drafts.some((draft) => !uuid.test(draft.animal_id)))
      reason = "legacy_identity";
    const permittedDrafts: SanitarioAgendaCreateDraftV2[] = reason
      ? []
      : drafts;
    assertContext(context, readContext(), input.fazendaId);
    await createGesture(input.fazendaId, ops, {
      clientTxId: txId,
      sanitarioAgendaV2: permittedDrafts,
      enqueueSanitarioAgendaV2: permittedDrafts.length > 0,
    });
    assertContext(context, readContext(), input.fazendaId);
    if (
      permittedDrafts.length &&
      readSanitaryPlanningSyncContextV2()?.projectRef !== sync?.projectRef
    )
      throw new Error("POSTPARTUM_PLANNING_CONTEXT_CHANGED");
    return {
      txId,
      replayed: false,
      weighedCount: built.weighedCount,
      umbigoCount: built.umbigoCount,
      agendaCount:
        ops.filter(
          (op) => op.table === "agenda_itens" && op.action === "INSERT",
        ).length + permittedDrafts.length,
      sanitary: {
        created: permittedDrafts.length,
        unavailable: reason ? drafts.length : 0,
        reason,
      },
    };
  });
}
