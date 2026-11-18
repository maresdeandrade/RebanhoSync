export type StrategicVariantV1 = "5-7-9" | "5-6-9";
export type StrategicCalendarPreferenceV1 = { schemaVersion: 1; revision: number; variant: StrategicVariantV1; declaredAt: string; declaredBy: string; provenance: "farm_declared"; effectiveFrom: string };

export function readStrategicCalendarPreferenceV1(config: { fazenda_id: string; deleted_at?: string | null; payload?: Record<string, unknown> } | null | undefined, farmId: string): StrategicCalendarPreferenceV1 | null {
  if (!config || config.fazenda_id !== farmId || config.deleted_at) return null;
  const raw = config.payload?.sanitary_strategic_calendar_v1;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
      (value.variant !== "5-7-9" && value.variant !== "5-6-9") || value.provenance !== "farm_declared" ||
      typeof value.declaredBy !== "string" || !value.declaredBy || typeof value.declaredAt !== "string" || !Number.isFinite(Date.parse(value.declaredAt)) ||
      typeof value.effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.effectiveFrom)) return null;
  return value as StrategicCalendarPreferenceV1;
}
