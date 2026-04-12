import { describe, expect, it } from "vitest";

import {
  compareAgendaGroupOrdering,
  summarizeAgendaGroupOrdering,
} from "@/lib/agenda/groupOrdering";

function createRow(
  overrides: Partial<{ status: "agendado" | "concluido" | "cancelado"; data_prevista: string }> = {},
) {
  return {
    item: {
      status: "agendado" as const,
      data_prevista: "2026-04-09",
      ...overrides,
    },
  };
}

describe("agenda group ordering", () => {
  it("summarizes pending buckets for sorting", () => {
    const meta = summarizeAgendaGroupOrdering(
      [
        createRow({ data_prevista: "2026-04-08" }),
        createRow({ data_prevista: "2026-04-09" }),
        createRow({ data_prevista: "2026-04-11" }),
        createRow({ status: "concluido", data_prevista: "2026-04-07" }),
      ],
      new Date("2026-04-09T09:00:00"),
    );

    expect(meta).toEqual({
      overdueCount: 1,
      todayCount: 1,
      futureCount: 1,
      pendingCount: 3,
      urgencyBucket: 0,
      earliestPendingDate: "2026-04-08",
    });
  });

  it("sorts overdue ahead of today and future", () => {
    const overdue = summarizeAgendaGroupOrdering(
      [createRow({ data_prevista: "2026-04-08" })],
      new Date("2026-04-09T09:00:00"),
    );
    const today = summarizeAgendaGroupOrdering(
      [createRow({ data_prevista: "2026-04-09" })],
      new Date("2026-04-09T09:00:00"),
    );
    const future = summarizeAgendaGroupOrdering(
      [createRow({ data_prevista: "2026-04-12" })],
      new Date("2026-04-09T09:00:00"),
    );

    expect(compareAgendaGroupOrdering(overdue, today)).toBeLessThan(0);
    expect(compareAgendaGroupOrdering(today, future)).toBeLessThan(0);
  });

  it("uses earliest pending date as tie-breaker", () => {
    const nearer = summarizeAgendaGroupOrdering(
      [createRow({ data_prevista: "2026-04-10" })],
      new Date("2026-04-09T09:00:00"),
    );
    const later = summarizeAgendaGroupOrdering(
      [createRow({ data_prevista: "2026-04-12" })],
      new Date("2026-04-09T09:00:00"),
    );

    expect(compareAgendaGroupOrdering(nearer, later)).toBeLessThan(0);
  });
});
