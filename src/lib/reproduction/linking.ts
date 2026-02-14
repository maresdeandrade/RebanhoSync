
import { isPayloadV1, ReproLinkMethod } from "./types";
import type { ReproEventJoined } from "./selectors";

interface LegacyReproPayload {
  diagnostico_resultado?: string;
  [key: string]: unknown;
}

/**
 * ALGORITHM A: Find Candidate Service for Diagnostic
 * Logic: Latest service (Cobertura/IA) occurred on or before diagnostic date.
 * Does NOT require service to be "open" (multi-diag is allowed).
 */
export function findLinkedServiceForDiagnostic(
  history: ReproEventJoined[], 
  diagnosticDate: string
): ReproEventJoined | null {
  // Filter candidates
  const candidates = history.filter(e => 
    e.details && 
    (e.details.tipo === 'cobertura' || e.details.tipo === 'IA') &&
    e.occurred_at <= diagnosticDate
  );

  // Filter out services that are already "taken" by a Parto occurring BEFORE this diagnostic.
  // (If Parto was AFTER, it might be the outcome of this diagnostic, so we keep the service as candidate).
  // Strategy: Find all Partos before DiagnosticDate. Collect their linked Service IDs. Exclude those.
  const priorPartos = history.filter(p => 
      p.details?.tipo === 'parto' && 
      p.occurred_at < diagnosticDate // Strict less than. If same day, dubious, but let's assume prior.
  );
  
  const closedServiceIds = new Set<string>();
  priorPartos.forEach(p => {
      const pay = p.details?.payload;
      if (isPayloadV1(pay) && pay.episode_evento_id) {
          closedServiceIds.add(pay.episode_evento_id);
      }
  });

  const validCandidates = candidates.filter(c => !closedServiceIds.has(c.id));
  
  // Sort DESC (newest first)
  validCandidates.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return validCandidates[0] || null;
}

/**
 * ALGORITHM B: Find Candidate Service for Parto
 * Logic:
 * 1. Prefer Service linked to a POSITIVE Diagnostic that occurred before Parto.
 * 2. Fallback: Latest OPEN Service (not linked to another Parto) before Parto.
 * 3. Strictly block orphan (unless legacy, handled by caller).
 */
export function findLinkedServiceForParto(
  history: ReproEventJoined[],
  partoDate: string
): { event: ReproEventJoined | null, method: ReproLinkMethod } {
  
  // 1. Try via Positive Diagnostic (Strict V1 Link)
  // Find most recent Positive Diag before Parto
  const positiveDiags = history.filter(e => 
    e.details?.tipo === 'diagnostico' &&
    e.occurred_at <= partoDate &&
    isPositiveDiag(e)
  ).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); // Newest first

  // Check if the best diag has a link to a service
  const bestDiag = positiveDiags[0];
  if (bestDiag) {
      const payload = bestDiag.details?.payload;
      if (isPayloadV1(payload) && payload.episode_evento_id) {
          const linkedService = history.find(e => e.id === payload.episode_evento_id);
          // Sanity check: Service must be before Parto (should be, if Diag was before Parto)
          if (linkedService && linkedService.occurred_at <= partoDate) {
             return { event: linkedService, method: 'auto_B' };
          }
      }
      // If legacy or no link, we fall through to finding Open Service.
      // But having a Positive Diag is a strong signal that an Open Service exists 
      // (or the diag itself is the "proxy" for the cycle, but our model requires Service root).
  }

  // 2. Fallback: Open Service
  // Find all services before Parto
  const services = history.filter(e => 
    e.details && 
    (e.details.tipo === 'cobertura' || e.details.tipo === 'IA') &&
    e.occurred_at <= partoDate
  ).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  // Identify "Taken" services (linked to OTHER Partos)
  const takenServiceIds = new Set<string>();
  const partos = history.filter(e => e.details?.tipo === 'parto');
  
  partos.forEach(p => {
    const pPayload = p.details?.payload;
    if (isPayloadV1(pPayload) && pPayload.episode_evento_id) {
      takenServiceIds.add(pPayload.episode_evento_id);
    }
  });

  // Find first service not taken
  const openService = services.find(s => !takenServiceIds.has(s.id));

  if (openService) {
    return { event: openService, method: 'auto_B' };
  }

  return { event: null, method: 'orphan' };
}

// Helpers
function isPositiveDiag(e: ReproEventJoined): boolean {
  if (!e.details) return false;
  const p = e.details.payload;
  if (isPayloadV1(p)) {
    return p.resultado === 'positivo';
  }
  // Legacy fallback
  const legacy = p as LegacyReproPayload | undefined;
  return legacy?.diagnostico_resultado === 'positivo';
}
