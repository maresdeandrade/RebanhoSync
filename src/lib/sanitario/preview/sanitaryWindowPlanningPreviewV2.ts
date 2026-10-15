import { createSanitaryDemandGroupsFromEligibilityResults } from "../demand/sanitaryDemand";
import { createSanitaryOperationalPreview } from "./sanitaryOperationalPreview";
import { createSanitaryAgendaMaterializationCommands } from "../agenda/sanitaryAgendaMaterialization";
import type { SanitaryProtocolWindowRowV2 } from "../windows/sanitaryProtocolWindowsV2";
import type { SanitaryProtocolItemV2ReadModel, SanitaryProtocolV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";

// Informational eligibility remains visible while prospective restrictions are explicit.
export function sanitaryPlanningBlockersV2(
  protocol: SanitaryProtocolV2ReadModel,
  item: SanitaryProtocolItemV2ReadModel,
): string[] {
  const blockers: string[] = [];
  if (protocol.familyCode === "febre_aftosa" || ["bloqueado", "experimental_alerta"].includes(protocol.legalStatus) || protocol.metadata.automationStatus === "blocked" || protocol.metadata.archived === true) {
    blockers.push("Protocolo disponível somente para informação/histórico, sem planejamento operacional.");
  }
  if (protocol.status !== "active" || protocol.approvalStatus !== "approved") {
    blockers.push("Protocolo ainda sem aprovação prospectiva. Consulta e registro factual permanecem disponíveis.");
  }
  if (item.status !== "active" || ["bloqueado", "somente_alerta"].includes(item.itemStatus) || ["alerta", "orientacao"].includes(item.actionType)) {
    blockers.push("Item sem liberação para planejamento prospectivo.");
  }
  return blockers;
}

// Adapt already evaluated V2 rows; grouping must not invent another eligibility rule.
export function buildSanitaryWindowPlanningPreviewV2(input: {
  rows: SanitaryProtocolWindowRowV2[];
  plannedFor: string;
}) {
  const rows = [...new Map(input.rows.filter((row) => row.canSelect).map((row) => [`${row.protocolId}:${row.itemId}:${row.animalId}`, row])).values()];
  const demand = createSanitaryDemandGroupsFromEligibilityResults({
    entries: rows.map((row) => ({
      animal: { id: row.animalId, loteId: row.lotId, loteName: row.lotLabel },
      protocolRule: {
        id: row.protocolId,
        name: row.protocolLabel,
        completionCriteria: { requiresExecutedEvent: true, sourceRefs: [] },
      },
      metadata: { protocolItemId: row.itemId, productClass: row.precheck.productClass },
      eligibility: { status: row.status, limitations: [], matchedEventIds: [] },
    })),
  });
  const preview = createSanitaryOperationalPreview({ referenceDate: input.plannedFor, demandGroups: demand });
  return createSanitaryAgendaMaterializationCommands({ referenceDate: input.plannedFor, preview });
}
