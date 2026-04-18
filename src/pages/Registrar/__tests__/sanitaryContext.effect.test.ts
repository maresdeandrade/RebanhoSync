import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRANSIT_CHECKLIST_DRAFT } from "@/lib/sanitario/transit";
import { loadRegistrarSanitaryFinalizeContext } from "@/pages/Registrar/effects/sanitaryContext";

describe("loadRegistrarSanitaryFinalizeContext", () => {
  it("carrega item de protocolo quando manejo eh sanitario e item foi selecionado", async () => {
    const loadProtocolItem = vi.fn(async () => ({
      id: "item-1",
      protocolo_id: "protocolo-1",
      produto: "Vacina A",
      tipo: "vacinacao" as const,
      payload: {},
    }));

    const result = await loadRegistrarSanitaryFinalizeContext({
      tipoManejo: "sanitario",
      protocoloItemId: "item-1",
      sanitaryTypedProduct: "",
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection: () => null,
      showsTransitChecklist: false,
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      officialTransitChecklistEnabled: true,
      loadProtocolItem,
    });

    expect(loadProtocolItem).toHaveBeenCalledWith("item-1");
    expect(result.protocoloItem?.id).toBe("item-1");
    expect(result.sanitaryProductName).toBe("Vacina A");
  });

  it("nao consulta protocolo fora do manejo sanitario", async () => {
    const loadProtocolItem = vi.fn(async () => ({
      id: "item-1",
      protocolo_id: "protocolo-1",
      produto: "Vacina A",
      tipo: "vacinacao" as const,
      payload: {},
    }));

    const result = await loadRegistrarSanitaryFinalizeContext({
      tipoManejo: "pesagem",
      protocoloItemId: "item-1",
      sanitaryTypedProduct: "qualquer",
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection: () => null,
      showsTransitChecklist: false,
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      officialTransitChecklistEnabled: true,
      loadProtocolItem,
    });

    expect(loadProtocolItem).not.toHaveBeenCalled();
    expect(result.protocoloItem).toBeNull();
    expect(result.sanitaryProductName).toBe("");
  });
});
