import { describe, expect, it } from "vitest";

import {
  buildAgendaCriticalNavigationTargets,
  getAdjacentAgendaCriticalNavigationTarget,
} from "@/lib/agenda/criticalNavigation";

describe("agenda critical navigation", () => {
  it("extracts only groups that have overdue rows", () => {
    const targets = buildAgendaCriticalNavigationTargets(
      [
        {
          key: "animal-1",
          title: "Matriz 001",
          rows: [
            { item: { id: "agenda-1", status: "agendado", data_prevista: "2020-01-01" } },
            { item: { id: "agenda-2", status: "agendado", data_prevista: "2099-01-01" } },
          ],
        },
        {
          key: "animal-2",
          title: "Matriz 002",
          rows: [{ item: { id: "agenda-3", status: "agendado", data_prevista: "2099-01-01" } }],
        },
      ],
      new Date("2026-04-09T00:00:00.000Z"),
    );

    expect(targets).toEqual([
      {
        groupKey: "animal-1",
        groupTitle: "Matriz 001",
        overdueCount: 1,
        rows: [{ item: { id: "agenda-1", status: "agendado", data_prevista: "2020-01-01" } }],
      },
    ]);
  });

  it("navigates forward and wraps around the critical group list", () => {
    const targets = [
      { groupKey: "animal-1", groupTitle: "Matriz 001", rows: [], overdueCount: 2 },
      { groupKey: "animal-2", groupTitle: "Matriz 002", rows: [], overdueCount: 1 },
    ];

    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, null, "next")?.groupKey,
    ).toBe("animal-1");
    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, "animal-1", "next")?.groupKey,
    ).toBe("animal-2");
    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, "animal-2", "next")?.groupKey,
    ).toBe("animal-1");
  });

  it("navigates backward and wraps around the critical group list", () => {
    const targets = [
      { groupKey: "animal-1", groupTitle: "Matriz 001", rows: [], overdueCount: 2 },
      { groupKey: "animal-2", groupTitle: "Matriz 002", rows: [], overdueCount: 1 },
    ];

    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, null, "previous")?.groupKey,
    ).toBe("animal-2");
    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, "animal-1", "previous")?.groupKey,
    ).toBe("animal-2");
    expect(
      getAdjacentAgendaCriticalNavigationTarget(targets, "animal-2", "previous")?.groupKey,
    ).toBe("animal-1");
  });
});
