import { beforeEach, describe, expect, it } from "vitest";

import {
  getAgendaUiStorageKey,
  readAgendaUiState,
  writeAgendaUiState,
} from "@/lib/agenda/storage";

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe("agenda storage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    });
  });

  it("persists agenda ui state per user and farm", () => {
    writeAgendaUiState("user-1", "farm-1", {
      search: "Matriz 01",
      statusFilter: "all",
      dominioFilter: "sanitario",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      groupMode: "evento",
      quickTypeFilter: "vacinacao",
      quickScheduleFilter: "overdue",
      quickCalendarModeFilter: "campaign",
      quickCalendarAnchorFilter: "calendar_month",
      quickAnimalFilter: "with-animal",
      expandedGroups: ["evento:key-1"],
      revealedGroups: ["evento:key-1"],
      contextualFocus: {
        groupKey: "evento:key-1",
        rowId: "agenda-1",
        rowIds: ["agenda-1"],
      },
    });

    expect(readAgendaUiState("user-1", "farm-1")).toEqual({
      search: "Matriz 01",
      statusFilter: "all",
      dominioFilter: "sanitario",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      groupMode: "evento",
      quickTypeFilter: "vacinacao",
      quickScheduleFilter: "overdue",
      quickCalendarModeFilter: "campaign",
      quickCalendarAnchorFilter: "calendar_month",
      quickAnimalFilter: "with-animal",
      expandedGroups: ["evento:key-1"],
      revealedGroups: ["evento:key-1"],
      contextualFocus: {
        groupKey: "evento:key-1",
        rowId: "agenda-1",
        rowIds: ["agenda-1"],
      },
    });
  });

  it("uses a namespaced key per user and farm", () => {
    expect(getAgendaUiStorageKey("user-1", "farm-1")).toContain("user-1:farm-1");
  });

  it("returns null for malformed state", () => {
    localStorage.setItem(getAgendaUiStorageKey("user-1", "farm-1"), "{invalid-json");

    expect(readAgendaUiState("user-1", "farm-1")).toBeNull();
  });
});
