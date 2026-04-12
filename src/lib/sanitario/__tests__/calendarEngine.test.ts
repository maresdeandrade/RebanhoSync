import { describe, expect, it } from "vitest";

import {
  isSanitaryWindowEligible,
  resolveDeclarativeSanitaryDueDate,
  resolveSanitaryAnchorDate,
  resolveSanitaryCampaignDueDate,
} from "@/lib/sanitario/calendarEngine";

describe("sanitary declarative calendar engine", () => {
  it("resolves weaning anchor from the animal payload and falls back to farm lifecycle config", () => {
    expect(
      resolveSanitaryAnchorDate({
        anchor: "weaning",
        birthDate: "2026-01-01",
        animalPayload: {
          weaning: {
            completed_at: "2026-08-15",
          },
        },
        farmMetadata: {
          animal_lifecycle: {
            weaning_days: 240,
          },
        },
      }),
    ).toBe("2026-08-15");

    expect(
      resolveSanitaryAnchorDate({
        anchor: "weaning",
        birthDate: "2026-01-01",
        animalPayload: {},
        farmMetadata: {
          animal_lifecycle: {
            weaning_days: 240,
          },
        },
      }),
    ).toBe("2026-08-29");
  });

  it("chooses the latest overdue campaign after eligibility starts and the next upcoming one otherwise", () => {
    expect(
      resolveSanitaryCampaignDueDate({
        months: [5, 11],
        asOf: "2026-07-20",
        notBefore: "2026-01-15",
      }),
    ).toBe("2026-05-01");

    expect(
      resolveSanitaryCampaignDueDate({
        months: [5, 11],
        asOf: "2026-07-20",
        notBefore: "2026-06-15",
      }),
    ).toBe("2026-11-01");
  });

  it("keeps mandatory windows actionable after the upper bound while suppressing optional windows", () => {
    expect(
      isSanitaryWindowEligible({
        asOf: "2026-11-20",
        eligibilityEndDate: "2026-08-29",
        keepAfterWindow: true,
      }),
    ).toBe(true);

    expect(
      isSanitaryWindowEligible({
        asOf: "2026-11-20",
        eligibilityEndDate: "2026-08-29",
        keepAfterWindow: false,
      }),
    ).toBe(false);
  });

  it("reopens anchor-driven clinical tasks when a new dry-off date appears after the last application", () => {
    expect(
      resolveDeclarativeSanitaryDueDate({
        mode: "clinical_protocol",
        anchor: "dry_off",
        asOf: "2026-10-01",
        anchorDate: "2026-09-15",
        lastCompletion: "2025-09-10",
      }),
    ).toBe("2026-09-15");
  });

  it("uses age eligibility as first due date for rolling schedules and interval after completion", () => {
    expect(
      resolveDeclarativeSanitaryDueDate({
        mode: "rolling_interval",
        anchor: "calendar_month",
        asOf: "2026-06-01",
        intervalDays: 365,
        eligibilityStartDate: "2026-04-01",
      }),
    ).toBe("2026-04-01");

    expect(
      resolveDeclarativeSanitaryDueDate({
        mode: "rolling_interval",
        anchor: "calendar_month",
        asOf: "2026-06-01",
        intervalDays: 365,
        eligibilityStartDate: "2026-04-01",
        lastCompletion: "2026-04-10",
      }),
    ).toBe("2027-04-10");
  });
});
