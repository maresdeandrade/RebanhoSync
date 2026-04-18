import { describe, expect, it } from "vitest";
import {
  resolveMovementSensitiveRecords,
  resolveSelectedRecordsByIds,
} from "@/pages/Registrar/helpers/selectContext";

describe("resolveSelectedRecordsByIds", () => {
  it("retorna apenas os registros selecionados mantendo a ordem da base", () => {
    const records = [
      { id: "a-1", label: "A" },
      { id: "a-2", label: "B" },
      { id: "a-3", label: "C" },
    ];

    const selected = resolveSelectedRecordsByIds({
      records,
      selectedIds: ["a-3", "a-1"],
    });

    expect(selected).toEqual([
      { id: "a-1", label: "A" },
      { id: "a-3", label: "C" },
    ]);
  });
});

describe("resolveMovementSensitiveRecords", () => {
  it("retorna vazio quando checklist de trânsito está desativado", () => {
    const records = resolveMovementSensitiveRecords({
      showsTransitChecklist: false,
      selectedRecords: [{ id: "a-1" }],
      fallbackRecords: [{ id: "a-2" }],
    });

    expect(records).toEqual([]);
  });

  it("prioriza recorte selecionado quando disponível", () => {
    const records = resolveMovementSensitiveRecords({
      showsTransitChecklist: true,
      selectedRecords: [{ id: "a-1" }],
      fallbackRecords: [{ id: "a-2" }],
    });

    expect(records).toEqual([{ id: "a-1" }]);
  });

  it("usa fallback quando não há seleção explícita", () => {
    const records = resolveMovementSensitiveRecords({
      showsTransitChecklist: true,
      selectedRecords: [],
      fallbackRecords: [{ id: "a-2" }],
    });

    expect(records).toEqual([{ id: "a-2" }]);
  });
});
