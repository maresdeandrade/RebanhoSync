import type { OfflineDB } from "@/lib/offline/db";
import type { Animal, Evento, EventoReproducao, SanitarioAgendaAnimalLocalV2, SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import { deterministicUuidFromText } from "./deterministicUuid";
import { getBirthEventId, wasGeneratedFromBirthEvent } from "./neonatal";

type NeonatalOrigin = {
  calfId: string;
  birthId: string;
  motherId: string;
  milestone: "cura_umbigo" | "revisao_neonatal";
};

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && !!value;
}

function matchesDeclaredTargets(targets: unknown, calfId: string) {
  return targets === undefined || (Array.isArray(targets) && targets.length === 1 && targets[0] === calfId);
}

function matchesDirectTarget(target: { scope?: string; id?: string } | undefined, calfId: string) {
  return target === undefined || (target?.scope === "animal" && target.id === calfId);
}

function matchesSourceOrigin(source: Record<string, unknown>, origin: NeonatalOrigin) {
  if (source.actionType !== undefined && source.actionType !== origin.milestone) return false;
  return source.source === "evento_parto" && source.journey === "cria" && source.milestone_key === origin.milestone &&
    source.birth_event_id === origin.birthId && source.mother_id === origin.motherId;
}

function matchesSourceSlot(source: Record<string, unknown>, origin: NeonatalOrigin, match: RegExpExecArray) {
  return origin.milestone !== "cura_umbigo" || (source.schedule_day_offset === Number(match[3]) && source.schedule_slot === match[4]);
}

function matchesAgendaSources(agenda: SanitarioAgendaLocalV2, origin: NeonatalOrigin, match: RegExpExecArray) {
  return [agenda.metadata, agenda.protocol_item_snapshot].every(source =>
    matchesSourceOrigin(source, origin) && matchesSourceSlot(source, origin, match));
}

function matchesAgendaAnimal(entries: SanitarioAgendaAnimalLocalV2[], agenda: SanitarioAgendaLocalV2, calfId: string) {
  return entries.length === 1 && entries[0].animal_id === calfId &&
    entries[0].fazenda_id === agenda.fazenda_id && entries[0].agenda_id === agenda.id;
}

function isLiveInFarm<T extends { fazenda_id: string; deleted_at: string | null }>(record: T | undefined, farmId: string): record is T {
  return !!record && !record.deleted_at && record.fazenda_id === farmId;
}

function matchesCalfOrigin(calf: Animal | undefined, origin: NeonatalOrigin, farmId: string) {
  return isLiveInFarm(calf, farmId) && calf.mae_id === origin.motherId &&
    wasGeneratedFromBirthEvent(calf.payload) && getBirthEventId(calf.payload) === origin.birthId;
}

function matchesBirthEvent(birth: Evento | undefined, origin: NeonatalOrigin, farmId: string) {
  return isLiveInFarm(birth, farmId) && birth.dominio === "reproducao" && birth.animal_id === origin.motherId;
}

function matchesBirthDetail(detail: EventoReproducao | undefined, farmId: string) {
  return isLiveInFarm(detail, farmId) && detail.tipo === "parto";
}

/** Only the deterministic birth writer's intentions qualify, including old six-slot IDs. */
export function birthNeonatalAgendaOrigin(agenda: SanitarioAgendaLocalV2) {
  if (agenda.protocolo_id || agenda.protocol_item_version_id) return null;
  const match = /^calf_journey:([^:]+):(cura_umbigo:d([0-2]):(diario|manha|tarde)|revisao_neonatal)$/.exec(agenda.dedup_key ?? "");
  if (!match) return null;
  const calfId = match[1];
  const milestone = match[2] === "revisao_neonatal" ? "revisao_neonatal" : "cura_umbigo";
  const { birth_event_id: birthId, mother_id: motherId } = agenda.metadata;
  if (!nonEmptyText(birthId) || !nonEmptyText(motherId)) return null;
  if (agenda.acao_sanitaria !== milestone) return null;
  if (!matchesDeclaredTargets(agenda.metadata.targetAnimalIds, calfId)) return null;
  const directTarget = agenda.metadata.target as { scope?: string; id?: string } | undefined;
  if (!matchesDirectTarget(directTarget, calfId)) return null;
  const origin: NeonatalOrigin = { calfId, birthId, motherId, milestone };
  if (!matchesAgendaSources(agenda, origin, match)) return null;
  const suffix = milestone === "cura_umbigo" ? `cura_umbigo:d${match[3]}:${match[4]}` : milestone;
  if (agenda.id !== deterministicUuidFromText(`${birthId}:calf:${calfId}:${suffix}`)) return null;
  return origin;
}

export async function assertBirthNeonatalAgendaOrigin(
  agenda: SanitarioAgendaLocalV2,
  entries: SanitarioAgendaAnimalLocalV2[],
  db: Pick<OfflineDB, "state_animais" | "event_eventos" | "event_eventos_reproducao">,
) {
  const origin = birthNeonatalAgendaOrigin(agenda);
  if (!origin || !matchesAgendaAnimal(entries, agenda, origin.calfId)) {
    throw new Error("NEONATAL_AGENDA_ORIGIN_MISMATCH");
  }
  const [calf, mother, birth, detail] = await Promise.all([
    db.state_animais.get(origin.calfId), db.state_animais.get(origin.motherId),
    db.event_eventos.get(origin.birthId), db.event_eventos_reproducao.get(origin.birthId),
  ]);
  if (!matchesCalfOrigin(calf, origin, agenda.fazenda_id) || !isLiveInFarm(mother, agenda.fazenda_id) ||
    !matchesBirthEvent(birth, origin, agenda.fazenda_id) || !matchesBirthDetail(detail, agenda.fazenda_id)) {
    throw new Error("NEONATAL_AGENDA_BIRTH_EVIDENCE_MISSING");
  }
  return origin;
}
