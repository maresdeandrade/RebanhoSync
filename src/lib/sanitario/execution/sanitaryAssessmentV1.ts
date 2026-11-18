import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { getClientId } from "@/lib/offline/clientIdentity";
import { getCurrentLocalReadOwnership } from "@/lib/offline/localReadBoundary";
import { createSanitarioV2Identity, validateSanitarioV2Enqueue, writeSanitarioV2Queue } from "@/lib/offline/sanitarioV2Cutover";
import { getActiveFarmId } from "@/lib/storage";
import { prepareSanitaryCommandV3 } from "./sanitaryAdmissionV3";

export type SanitaryAssessmentResultV1 = "no_treatment_indicated" | "treatment_indicated" | "insufficient_data";
export type SanitaryAssessmentInputV1 = {
  fazendaId: string; animalIds: string[]; protocolId: string; itemId: string;
  itemVersion: number; occurredOn: string; responsibleName: string;
  result: SanitaryAssessmentResultV1; observation?: string;
  correctsEventId?: string;
};

// Only a queue intention is written locally. A confirmed fact arrives by pull.
export async function enqueueSanitaryAssessmentV1(input: SanitaryAssessmentInputV1): Promise<string> {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ? new Date(`${input.occurredOn}T12:00:00.000Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.occurredOn || input.occurredOn > todayKey ||
      !input.responsibleName.trim() || !["no_treatment_indicated", "treatment_indicated", "insufficient_data"].includes(input.result) ||
      !Number.isSafeInteger(input.itemVersion) || input.itemVersion < 1 || !input.animalIds.length ||
      input.animalIds.length > 500 || new Set(input.animalIds).size !== input.animalIds.length) {
    throw new Error("SANITARY_ASSESSMENT_INVALID");
  }
  const context = () => { if (!input.fazendaId || getActiveFarmId() !== input.fazendaId) throw new Error("SANITARY_ASSESSMENT_FARM_CHANGED"); };
  context();
  const ownership = await getCurrentLocalReadOwnership();
  if (ownership.status !== "OWNED") throw new Error("SANITARY_ASSESSMENT_OWNERSHIP_REQUIRED");
  context();
  const original = input.correctsEventId ? await db.event_eventos.get(input.correctsEventId) : undefined;
  const originalTimestamp = original?.occurred_at ? new Date(original.occurred_at) : null;
  const originalDate = original?.occurred_on ?? (originalTimestamp && Number.isFinite(originalTimestamp.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(originalTimestamp) : null);
  const originalAssessment = original?.payload?.assessment as Record<string, unknown> | undefined;
  const originalRelations = input.correctsEventId ? await db.event_eventos_animais.where("evento_id").equals(input.correctsEventId).toArray() : [];
  if (input.correctsEventId && (!input.observation?.trim() || !original || original.deleted_at || original.fazenda_id !== input.fazendaId || !originalDate || input.occurredOn < originalDate ||
      original.payload?.schema !== "sanitary_assessment_v1" || originalAssessment?.protocol_id !== input.protocolId ||
      originalAssessment.item_id !== input.itemId || originalAssessment.item_version !== input.itemVersion ||
      !/^[0-9]{4}$/.test(String(originalAssessment.cycle_key ?? "")) ||
      JSON.stringify(originalRelations.filter(r => r.fazenda_id === input.fazendaId).map(r => r.animal_id).sort()) !== JSON.stringify([...input.animalIds].sort()))) {
    throw new Error("SANITARY_ASSESSMENT_CORRECTION_INVALID");
  }
  const url = new URL(import.meta.env.VITE_SUPABASE_URL);
  const projectRef = ["localhost", "127.0.0.1"].includes(url.hostname) ? "local" : url.hostname.split(".")[0];
  const identity = createSanitarioV2Identity();
  const clientId = getClientId();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const operation = prepareSanitaryCommandV3({
    domain: "sanitario_v2", contract_version: 3, command: "apply_factual_core", fazenda_id: input.fazendaId,
    client_tx_id: identity.clientTxId, client_op_id: identity.clientOpId, domain_op_id: identity.domainOpId,
    payload: {
      event: { id: eventId, natureza: input.correctsEventId ? "correction" : "standalone_fact", occurred_at: date.toISOString(), animal_id: input.animalIds.length === 1 ? input.animalIds[0] : null,
        lote_id: null, source_sanitario_agenda_v2_id: null, corrige_evento_id: input.correctsEventId ?? null, observacoes: input.observation?.trim() || null,
        client_recorded_at: now, payload: { schema: "sanitary_assessment_v1", assessment: { schema_version: 1, result: input.result,
          protocol_id: input.protocolId, item_id: input.itemId, item_version: input.itemVersion, cycle_key: input.correctsEventId ? originalAssessment!.cycle_key : input.occurredOn.slice(0, 4),
          responsible_name: input.responsibleName.trim(), origin: "farm_assessment", observation: input.observation?.trim() || null } } },
      detail: { tipo: "avaliacao", payload: {}, produto_snapshot: {} },
      event_animals: input.animalIds.map(animal_id => ({ id: crypto.randomUUID(), animal_id })),
    },
  });
  await validateSanitarioV2Enqueue({ fazendaId: input.fazendaId, projectRef, operations: [operation] });
  const current = await getCurrentLocalReadOwnership();
  if (current.status !== "OWNED" || current.currentUserId !== ownership.currentUserId) throw new Error("SANITARY_ASSESSMENT_OWNERSHIP_CHANGED");
  await db.transaction("rw", [db.queue_ops, db.queue_gestures, db.local_ownership, db.state_animais, db.event_eventos, db.event_eventos_animais], async () => {
    context();
    const localOwnership = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
    if (localOwnership?.owner_user_id !== ownership.currentUserId) throw new Error("SANITARY_ASSESSMENT_OWNERSHIP_CHANGED");
    const animals = await db.state_animais.bulkGet(input.animalIds);
    if (animals.some(animal => !animal || animal.fazenda_id !== input.fazendaId || animal.deleted_at)) throw new Error("SANITARY_ASSESSMENT_ANIMAL_SCOPE_INVALID");
    if (input.correctsEventId) {
      const currentOriginal = await db.event_eventos.get(input.correctsEventId);
      const currentRelations = await db.event_eventos_animais.where("evento_id").equals(input.correctsEventId).toArray();
      if (JSON.stringify(currentOriginal) !== JSON.stringify(original) || JSON.stringify(currentRelations) !== JSON.stringify(originalRelations)) throw new Error("SANITARY_ASSESSMENT_CORRECTION_STALE");
    }
    await writeSanitarioV2Queue({ fazendaId: input.fazendaId, clientId, operations: [operation] });
    context();
  });
  return eventId;
}
