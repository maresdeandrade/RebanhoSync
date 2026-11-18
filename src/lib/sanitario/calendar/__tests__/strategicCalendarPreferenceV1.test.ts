import { describe, expect, it } from "vitest";
import { readStrategicCalendarPreferenceV1 } from "../strategicCalendarPreferenceV1";

const preference = { schemaVersion: 1, revision: 2, variant: "5-6-9", declaredAt: "2026-11-16T10:00:00Z", declaredBy: "user", provenance: "farm_declared", effectiveFrom: "2026-11-16" };
describe("configuração estratégica da fazenda", () => {
  it("lê somente versão íntegra e tenant correspondente", () => {
    const config = { fazenda_id: "a", deleted_at: null, payload: { sanitary_strategic_calendar_v1: preference } };
    expect(readStrategicCalendarPreferenceV1(config, "a")).toEqual(preference);
    expect(readStrategicCalendarPreferenceV1(config, "b")).toBeNull();
    expect(readStrategicCalendarPreferenceV1(null, "a")).toBeNull();
    expect(readStrategicCalendarPreferenceV1({ ...config, payload: { sanitary_strategic_calendar_v1: { ...preference, variant: "5-8-9" } } }, "a")).toBeNull();
    expect(readStrategicCalendarPreferenceV1({ ...config, deleted_at: "2026-11-16" }, "a")).toBeNull();
  });
});
