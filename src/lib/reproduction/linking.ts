
import { isPayloadV1, ReproLinkMethod } from "./types";
import type { ReproEventJoined } from "./selectors";

type LegacyDiagnosticPayload = {
  diagnostico_resultado?: unknown;
};

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

  // Sort DESC (newest first)
  candidates.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return candidates[0] || null;
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
  
  // 1. Try via Positive Diagnostic
  // Find Positive Diags before Parto
  const positiveDiags = history.filter(e => 
    e.details?.tipo === 'diagnostico' &&
    e.occurred_at <= partoDate &&
    isPositiveDiag(e)
  ).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); // Newest first

  if (positiveDiags.length > 0) {
    const bestDiag = positiveDiags[0];
    const payload = bestDiag.details?.payload;
    
    // Check if Diag has a link (V1)
    if (isPayloadV1(payload) && payload.episode_evento_id) {
       const linkedService = history.find(e => e.id === payload.episode_evento_id);
       if (linkedService) {
         return { event: linkedService, method: 'auto_B' };
       }
    }
    // Legacy Diag (might not have link). We could infer, but let's stick to strict V1 path or fallback to Strategy 2.
    // If we have a positive diagnostic close to creation, it's a strong hint.
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
  return (p as LegacyDiagnosticPayload).diagnostico_resultado === 'positivo';
}
