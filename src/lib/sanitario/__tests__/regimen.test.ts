import { describe, expect, it } from "vitest";

import { buildSanitaryBaseCalendarPayload } from "@/lib/sanitario/calendar";
import {
  buildSanitaryRegimenDedupTemplate,
  buildSanitaryRegimenPayload,
  inferSanitaryRegimenMilestone,
  readSanitaryRegimen,
} from "@/lib/sanitario/regimen";

describe("sanitary regimen metadata", () => {
  it("infers a stable milestone contract from family, calendar and sequence metadata", () => {
    const regimen = inferSanitaryRegimenMilestone({
      familyCode: "clostridioses",
      regimenVersion: 1,
      milestoneCode: "clostridio_anual",
      sequenceOrder: 1,
      payload: buildSanitaryBaseCalendarPayload({
        mode: "rolling_interval",
        anchor: "calendar_month",
        label: "Revisao anual do rebanho",
        intervalDays: 365,
      }),
    });

    expect(regimen).toMatchObject({
      family_code: "clostridioses",
      regimen_version: 1,
      milestone_code: "clostridio_anual",
      sequence_order: 1,
      schedule_rule: {
        kind: "rolling_from_last_completion",
        calendarMode: "rolling_interval",
        intervalDays: 365,
      },
      completion_rule: {
        type: "event",
        anchorToLastValidCompletion: true,
      },
    });

    expect(buildSanitaryRegimenDedupTemplate(regimen!)).toBe(
      "sanitario:clostridioses:{animal_id}:milestone:clostridio_anual",
    );
  });

  it("round-trips regime_sanitario payloads without losing milestone semantics", () => {
    const regimen = inferSanitaryRegimenMilestone({
      familyCode: "raiva_herbivoros",
      regimenVersion: 1,
      milestoneCode: "raiva_d2",
      sequenceOrder: 2,
      dependsOnMilestone: "raiva_d1",
      requiresComplianceDocument: false,
      scheduleKind: "after_previous_completion",
      payload: buildSanitaryBaseCalendarPayload({
        mode: "rolling_interval",
        anchor: "calendar_month",
        label: "Reforco apos 30 dias",
        intervalDays: 30,
      }),
    });

    const payload = buildSanitaryRegimenPayload(regimen);

    expect(readSanitaryRegimen(payload)).toMatchObject({
      family_code: "raiva_herbivoros",
      milestone_code: "raiva_d2",
      sequence_order: 2,
      depends_on_milestone: "raiva_d1",
      schedule_rule: {
        kind: "after_previous_completion",
        intervalDays: 30,
      },
    });
  });
});
