import { describe, expect, it } from "vitest";
import type { SanitaryTraceabilityCostRow } from "../operationalSummaryTypes";
import {
  getEventDateKey,
  getTimestampDateKey,
} from "../operationalSummaryCalendar";
import {
  addTraceabilityCost,
  toSortedTraceabilityRows,
} from "../reportTraceability";

describe("report primitives without storage or backend initialization", () => {
  it("keeps incremental rounding, first labels and alphabetical ties", () => {
    const rows = new Map<string, SanitaryTraceabilityCostRow>();
    addTraceabilityCost(rows, "same", "Primeiro", 0.004);
    addTraceabilityCost(rows, "same", "Outro", 0.004);
    addTraceabilityCost(rows, "z", "Zulu", 0);
    addTraceabilityCost(rows, "a", "Alfa", 0);

    expect(toSortedTraceabilityRows(rows)).toEqual([
      { key: "a", label: "Alfa", eventCount: 1, totalCost: 0 },
      { key: "same", label: "Primeiro", eventCount: 2, totalCost: 0 },
      { key: "z", label: "Zulu", eventCount: 1, totalCost: 0 },
    ]);
  });

  it("uses the factual calendar date ahead of the timestamp", () => {
    const event = {
      occurred_on: "2026-10-20",
      occurred_at: "2026-10-23T23:00:00Z",
    };
    expect(getEventDateKey(event, "UTC")).toBe("2026-10-20");
  });

  it("preserves the raw date prefix when the timestamp cannot be formatted", () => {
    expect(getTimestampDateKey("invalid-timestamp", "UTC")).toBe("invalid-ti");
  });
});
