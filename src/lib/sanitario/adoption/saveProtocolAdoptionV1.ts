import { db } from "@/lib/offline/db";
import { requireTenantSensitiveWrite } from "@/lib/offline/localReadBoundary";
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";

// The queue stores an intention. Only the subsequent acknowledged remote pull
// may change the effective configuration used by triage.
export async function saveProtocolAdoptionV1(
  fazendaId: string,
  expectedRevision: number,
  families: Record<string, { monitoringEnabled: boolean }>,
): Promise<string> {
  const validateContext = () => {
    if (!fazendaId || getActiveFarmId() !== fazendaId)
      throw new Error("PROTOCOL_ADOPTION_FARM_CHANGED");
  };
  validateContext();
  await requireTenantSensitiveWrite();
  validateContext();
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("PROTOCOL_ADOPTION_REVISION_INVALID");
  const clientOpId = crypto.randomUUID();
  await createGesture(fazendaId, [{
    table: "fazenda_sanidade_config", action: "UPDATE",
    record: { domain: "sanitary_protocol_adoption_v1", contract_version: 1,
      fazenda_id: fazendaId, expected_revision: expectedRevision,
      families: structuredClone(families) },
  }], { validateContext, clientOpIds: [clientOpId] });
  return clientOpId;
}
