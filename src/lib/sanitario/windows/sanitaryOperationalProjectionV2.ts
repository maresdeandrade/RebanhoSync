import type { SanitaryProtocolCatalogReadModelV2 } from "../catalog/sanitaryProtocolCatalogV2";
import { buildSanitaryProtocolWindowV2, type SanitaryOperationalContextV2, type SanitaryProtocolWindowRowV2, type SanitaryProtocolWindowSourceV2 } from "./sanitaryProtocolWindowsV2";

export const sanitaryOperationalGroupsV2 = [
  "Planejamento disponível", "Janelas para acompanhamento", "Agendas existentes",
  "Informações insuficientes", "Restrições e consulta técnica",
] as const;
export type SanitaryOperationalGroupV2 = typeof sanitaryOperationalGroupsV2[number];

// Presentation only: physical versions and technical dimensions remain intact.
export function sanitaryOperationalGroupV2(row: SanitaryProtocolWindowRowV2, catalog: SanitaryProtocolCatalogReadModelV2): SanitaryOperationalGroupV2 {
  const item = catalog.items.find(item => item.id === row.itemId);
  const superseded = item && catalog.items.some(candidate => candidate.protocolId === item.protocolId && candidate.logicalItemKey === item.logicalItemKey && candidate.status === "active" && candidate.version > item.version);
  if (superseded) return "Restrições e consulta técnica";
  if (row.alreadyPlanned) return "Agendas existentes";
  if (row.blockers.length || ["not_applicable", "completed"].includes(row.status)) return "Restrições e consulta técnica";
  if (row.status === "insufficient_data" || row.documentaryPending || row.precheck.missingExecutedHistory) return "Informações insuficientes";
  if (["eligible_soon", "not_yet_eligible"].includes(row.status)) return "Janelas para acompanhamento";
  return row.canSelect ? "Planejamento disponível" : "Restrições e consulta técnica";
}

export type SanitaryDateReviewV2 = {
  original: SanitaryProtocolWindowRowV2;
  fresh?: SanitaryProtocolWindowRowV2;
  situation: "compatible" | "incompatible" | "existing" | "reevaluate";
  label: string;
  reason: string;
};

// Same canonical evaluation and proposed date as transactional revalidation.
// This preview never grants permission to write; the writer remains authoritative.
export function reviewSanitaryPlanningDateV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  rows: SanitaryProtocolWindowRowV2[];
  plannedFor: string;
  context: SanitaryOperationalContextV2;
}): SanitaryDateReviewV2[] {
  const evaluations = new Map<string, SanitaryProtocolWindowRowV2[]>();
  return input.rows.map<SanitaryDateReviewV2>(original => {
    const key = JSON.stringify([original.protocolId, original.itemId, original.generationMode]);
    if (!evaluations.has(key)) evaluations.set(key, buildSanitaryProtocolWindowV2({ source: input.source, protocolId: original.protocolId, itemId: original.itemId, evaluatedAt: input.plannedFor, operationalContext: input.context, generationMode: original.generationMode })?.rows ?? []);
    const fresh = evaluations.get(key)!.find(row => row.animalId === original.animalId);
    if (!fresh || fresh.lotId !== original.lotId || (original.planningKind && fresh.planningKind !== original.planningKind)) return { original, fresh, situation: "reevaluate", label: "Necessita de nova avaliação", reason: "Alvo, lote ou tipo de planejamento alterado. Retorne à seleção." };
    if (fresh.alreadyPlanned) return { original, fresh, situation: "existing", label: "Agenda equivalente existente", reason: fresh.plannedFor ? `Agenda prevista: ${fresh.plannedFor}` : fresh.reason };
    if (fresh.blockers.length) return { original, fresh, situation: "incompatible", label: "Incompatível com a data", reason: fresh.blockers[0] };
    if (fresh.status === "insufficient_data" || fresh.documentaryPending || fresh.precheck.missingExecutedHistory) return { original, fresh, situation: "reevaluate", label: "Necessita de nova avaliação", reason: fresh.documentaryPendingReasons[0] ?? fresh.reason };
    if (!fresh.canSelect || fresh.status === "eligible_soon") return { original, fresh, situation: "incompatible", label: "Incompatível com a data", reason: fresh.reason };
    return { original, fresh, situation: "compatible", label: "Compatível com a data", reason: fresh.reason };
  });
}
