import type { Animal } from "@/lib/offline/types";

export interface NeonatalSetup {
  completed_at?: string;
  birth_event_id?: string | null;
  mother_id?: string | null;
  father_id?: string | null;
  initial_lote_id?: string | null;
  initial_weight_kg?: number | null;
  initial_weight_recorded_at?: string | null;
  umbigo_curado_at?: string | null;
}

export function getAnimalPayloadRecord(
  payload: Animal["payload"] | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

export function getBirthEventId(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  return typeof record.birth_event_id === "string" ? record.birth_event_id : null;
}

export function getNeonatalSetup(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  const setup = record.neonatal_setup;

  if (!setup || typeof setup !== "object" || Array.isArray(setup)) {
    return null;
  }

  return setup as NeonatalSetup;
}

export function wasGeneratedFromBirthEvent(payload: Animal["payload"]) {
  const record = getAnimalPayloadRecord(payload);
  return record.generated_from === "evento_parto";
}

export function hasPendingNeonatalSetup(payload: Animal["payload"]) {
  return wasGeneratedFromBirthEvent(payload) && !getNeonatalSetup(payload);
}

export function hasRecordedUmbigoCare(payload: Animal["payload"]) {
  const setup = getNeonatalSetup(payload);
  return Boolean(setup?.umbigo_curado_at);
}

export function hasRecordedInitialWeight(payload: Animal["payload"]) {
  const setup = getNeonatalSetup(payload);
  return typeof setup?.initial_weight_kg === "number";
}
