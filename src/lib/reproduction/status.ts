
import type { Evento, EventoReproducao, ReproTipoEnum } from "@/lib/offline/types";
import { isPayloadV1, PUERPERIO_DAYS, ReproStatus } from "./types";
import { ReproEventJoined } from "./selectors";

export interface AnimalReproStatus {
  status: ReproStatus;
  lastEventDate: string | null;
  lastEventType: ReproTipoEnum | null;
  daysSinceEvent: number | null;
  predictionDate: string | null; // Parto ou Desmame/Diag
}

/**
 * Derives the reproductive status of an animal based on its history of reproduction events.
 * 
 * Logic (Sequential Dominance):
 * 1. Sort events DESC (Newest first).
 * 2. Iterate to find the first "Status Defining" event.
 *    - PARTO: Sets status to PARIDA_PUERPERIO (if <= 60d) or VAZIA (if > 60d).
 *    - DIAGNOSTICO POSITIVO: Sets status to PRENHA.
 *    - DIAGNOSTICO NEGATIVO: Sets status to VAZIA (Clears previous service).
 *    - COBERTURA/IA: Sets status to SERVIDA.
 * 
 * This assumes that a newer event logically supersedes an older one.
 * (e.g. A Service after a Positive Diag implies the pregnancy was lost/ended).
 */
export function computeReproStatus(events: ReproEventJoined[]): AnimalReproStatus {
  if (!events || events.length === 0) {
    return createStatus('VAZIA', null, null, null);
  }

  // Sort events (Most recent first)
  const history = [...events].sort((a, b) => 
    new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  const now = new Date();

  for (const evt of history) {
    if (!evt.details) continue;

    const date = new Date(evt.occurred_at);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const type = evt.details.tipo;
    const payload = evt.details.payload;

    if (type === 'parto') {
      // Found a Parto. This resets the cycle.
      if (diffDays <= PUERPERIO_DAYS) {
        return createStatus('PARIDA_PUERPERIO', evt, diffDays, calculateWeaningDate(date));
      } else {
        // PARIDA > 60 days -> VAZIA (Open)
        // But we keep the event reference to show "Parida" context in UI if needed.
        return createStatus('VAZIA', evt, diffDays, null); 
      }
    }

    if (type === 'diagnostico') {
      const isPos = isPositive(payload);
      const isNeg = isNegative(payload);

      if (isPos) {
        return createStatus('PRENHA', evt, diffDays, extractPredictionDate(payload) || estimatePartoDate(date));
      }
      if (isNeg) {
         // Negative Diag -> VAZIA.
         // STRICT DOMINANCE: If we found a service AFTER this diag (newer),
         // we would have already returned 'SERVIDA' in the loop above.
         // Reaching here means this Negative Diag is the most recent status-defining event.
         // Therefore, the animal is empty.
         return createStatus('VAZIA', evt, diffDays, null);
      }
      continue;
    }

    if (type === 'cobertura' || type === 'IA') {
      // Found a service (and no later Parto/Diag stopped us).
      return createStatus('SERVIDA', evt, diffDays, estimateDiagDate(date));
    }
  }

  // If we fell through (only inconclusive diags? or no events?), return VAZIA
  return createStatus('VAZIA', null, null, null);
}

// =========================================================
// HELPERS
// =========================================================

function createStatus(
  status: ReproStatus, 
  evt: ReproEventJoined | null, 
  days: number | null, 
  prediction: string | null
): AnimalReproStatus {
  return {
    status,
    lastEventDate: evt?.occurred_at ?? null,
    lastEventType: evt?.details?.tipo ?? null,
    daysSinceEvent: days,
    predictionDate: prediction
  };
}

function isPositive(payload: unknown): boolean {
  if (isPayloadV1(payload)) return payload.resultado === 'positivo';
  const legacy = payload as Record<string, unknown> | undefined;
  return legacy?.diagnostico_resultado === 'positivo';
}

function isNegative(payload: unknown): boolean {
  if (isPayloadV1(payload)) return payload.resultado === 'negativo';
  const legacy = payload as Record<string, unknown> | undefined;
  return legacy?.diagnostico_resultado === 'negativo';
}

function extractPredictionDate(payload: unknown): string | undefined {
  if (isPayloadV1(payload)) return payload.data_prevista_parto;
  return undefined;
}

function calculateWeaningDate(partoDate: Date): string {
  const d = new Date(partoDate);
  d.setDate(d.getDate() + 210); // 7 months widely used
  return d.toISOString().split('T')[0];
}

function estimatePartoDate(diagDate: Date): string {
  // Rough estimate if not in payload: Diag + 6 months? 
  // Better: Users usually input prediction. If missing, maybe don't guess or guess conservative.
  // Let's guess 283 days from "Conception", but we don't know conception date here easily without linking.
  // Just return null if missing? Or Diag + 150 days?
  const d = new Date(diagDate);
  d.setDate(d.getDate() + 150);
  return d.toISOString().split('T')[0];
}

function estimateDiagDate(serviceDate: Date): string {
  const d = new Date(serviceDate);
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}
