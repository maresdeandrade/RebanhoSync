import { describe, expect, it } from "vitest";

import {
  buildAgendaCalendarAnchorPath,
  buildAgendaCalendarModePath,
  buildAgendaOperationalClassPath,
  buildAnimalsCalendarAnchorPath,
  buildAnimalsCalendarModePath,
} from "../navigation";

describe("agenda navigation helpers", () => {
  it("builds agenda filter paths", () => {
    expect(buildAgendaCalendarModePath("routine")).toBe(
      "/agenda?calendarMode=routine",
    );
    expect(buildAgendaCalendarAnchorPath("calving")).toBe(
      "/agenda?calendarAnchor=calving",
    );
    expect(buildAgendaOperationalClassPath("operational_protocol")).toBe(
      "/agenda?operationalClass=operational_protocol",
    );
  });

  it("builds animal filter paths", () => {
    expect(buildAnimalsCalendarModePath("campaign")).toBe(
      "/animais?calendarMode=campaign",
    );
    expect(buildAnimalsCalendarAnchorPath("birth")).toBe(
      "/animais?calendarAnchor=birth",
    );
  });

  it("encodes query values", () => {
    expect(buildAgendaCalendarModePath("idade & rotina")).toBe(
      "/agenda?calendarMode=idade%20%26%20rotina",
    );
    expect(buildAnimalsCalendarAnchorPath("parto/pós-parto")).toBe(
      "/animais?calendarAnchor=parto%2Fp%C3%B3s-parto",
    );
  });
});
