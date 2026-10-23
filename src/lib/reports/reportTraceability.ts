import type { SanitaryTraceabilityCostRow } from "./operationalSummaryTypes";

export function addTraceabilityCost(
  map: Map<string, SanitaryTraceabilityCostRow>,
  key: string | null | undefined,
  label: string | null | undefined,
  cost: number,
) {
  const normalizedKey = key?.trim() || "sem_chave";
  const row =
    map.get(normalizedKey) ??
    ({
      key: normalizedKey,
      label: label?.trim() || "Sem identificacao",
      eventCount: 0,
      totalCost: 0,
    } satisfies SanitaryTraceabilityCostRow);

  row.eventCount += 1;
  row.totalCost = Number((row.totalCost + cost).toFixed(2));
  map.set(normalizedKey, row);
}

export function toSortedTraceabilityRows(
  map: Map<string, SanitaryTraceabilityCostRow>,
): SanitaryTraceabilityCostRow[] {
  return Array.from(map.values()).sort((left, right) => {
    if (right.totalCost !== left.totalCost)
      return right.totalCost - left.totalCost;
    return left.label.localeCompare(right.label);
  });
}
