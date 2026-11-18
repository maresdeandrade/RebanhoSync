import { requireTenantSensitiveWrite } from "@/lib/offline/localReadBoundary";
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";
import type { StrategicVariantV1 } from "./strategicCalendarPreferenceV1";

export async function saveStrategicCalendarV1(farmId: string, expectedRevision: number, variant: StrategicVariantV1): Promise<string> {
  const validateContext = () => { if (!farmId || getActiveFarmId() !== farmId) throw new Error("STRATEGIC_CALENDAR_FARM_CHANGED"); };
  validateContext();
  await requireTenantSensitiveWrite();
  validateContext();
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !["5-7-9", "5-6-9"].includes(variant)) throw new Error("STRATEGIC_CALENDAR_INVALID");
  const clientOpId = crypto.randomUUID();
  await createGesture(farmId, [{ table: "fazenda_sanidade_config", action: "UPDATE", record: {
    domain: "sanitary_strategic_calendar_v1", contract_version: 1, fazenda_id: farmId, expected_revision: expectedRevision, variant,
  } }], { validateContext, clientOpIds: [clientOpId] });
  return clientOpId;
}
