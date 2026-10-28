import type { OfflineDB } from "@/lib/offline/db";
import type { SanitarioAgendaAnimalLocalV2, SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import { deterministicUuidFromText } from "./deterministicUuid";
import { getBirthEventId, wasGeneratedFromBirthEvent } from "./neonatal";

/** Only the deterministic birth writer's intentions qualify, including old six-slot IDs. */
export function birthNeonatalAgendaOrigin(agenda: SanitarioAgendaLocalV2) {
  if (agenda.protocolo_id || agenda.protocol_item_version_id) return null;
  const match = /^calf_journey:([^:]+):(cura_umbigo:d([0-2]):(diario|manha|tarde)|revisao_neonatal)$/.exec(agenda.dedup_key ?? "");
  if (!match) return null;
  const calfId = match[1];
  const milestone = match[2] === "revisao_neonatal" ? "revisao_neonatal" : "cura_umbigo";
  const { birth_event_id: birthId, mother_id: motherId } = agenda.metadata;
  if (typeof birthId !== "string" || typeof motherId !== "string" || !birthId || !motherId) return null;
  if (agenda.acao_sanitaria !== milestone) return null;
  const declaredTargets = agenda.metadata.targetAnimalIds;
  if (declaredTargets !== undefined && (!Array.isArray(declaredTargets) || declaredTargets.length !== 1 || declaredTargets[0] !== calfId)) return null;
  const directTarget = agenda.metadata.target as { scope?: string; id?: string } | undefined;
  if (directTarget !== undefined && (directTarget?.scope !== "animal" || directTarget.id !== calfId)) return null;
  for (const source of [agenda.metadata, agenda.protocol_item_snapshot]) {
    if (source.actionType !== undefined && source.actionType !== milestone) return null;
    if (source.source !== "evento_parto" || source.journey !== "cria" || source.milestone_key !== milestone ||
      source.birth_event_id !== birthId || source.mother_id !== motherId) return null;
    if (milestone === "cura_umbigo" && (source.schedule_day_offset !== Number(match[3]) || source.schedule_slot !== match[4])) return null;
  }
  const suffix = milestone === "cura_umbigo" ? `cura_umbigo:d${match[3]}:${match[4]}` : milestone;
  if (agenda.id !== deterministicUuidFromText(`${birthId}:calf:${calfId}:${suffix}`)) return null;
  return { calfId, birthId, motherId, milestone };
}

export async function assertBirthNeonatalAgendaOrigin(
  agenda: SanitarioAgendaLocalV2,
  entries: SanitarioAgendaAnimalLocalV2[],
  db: Pick<OfflineDB, "state_animais" | "event_eventos" | "event_eventos_reproducao">,
) {
  const origin = birthNeonatalAgendaOrigin(agenda);
  if (!origin || entries.length !== 1 || entries[0].animal_id !== origin.calfId ||
    entries[0].fazenda_id !== agenda.fazenda_id || entries[0].agenda_id !== agenda.id) {
    throw new Error("NEONATAL_AGENDA_ORIGIN_MISMATCH");
  }
  const [calf, mother, birth, detail] = await Promise.all([
    db.state_animais.get(origin.calfId), db.state_animais.get(origin.motherId),
    db.event_eventos.get(origin.birthId), db.event_eventos_reproducao.get(origin.birthId),
  ]);
  if (!calf || calf.deleted_at || calf.fazenda_id !== agenda.fazenda_id || calf.mae_id !== origin.motherId ||
    !wasGeneratedFromBirthEvent(calf.payload) || getBirthEventId(calf.payload) !== origin.birthId ||
    !mother || mother.deleted_at || mother.fazenda_id !== agenda.fazenda_id ||
    !birth || birth.deleted_at || birth.fazenda_id !== agenda.fazenda_id || birth.dominio !== "reproducao" || birth.animal_id !== origin.motherId ||
    !detail || detail.deleted_at || detail.fazenda_id !== agenda.fazenda_id || detail.tipo !== "parto") {
    throw new Error("NEONATAL_AGENDA_BIRTH_EVIDENCE_MISSING");
  }
  return origin;
}
