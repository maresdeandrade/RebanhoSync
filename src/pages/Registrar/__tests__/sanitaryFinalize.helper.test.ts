import { describe, expect, it } from "vitest";
import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import { DEFAULT_TRANSIT_CHECKLIST_DRAFT } from "@/lib/sanitario/compliance/transit";
import { resolveRegistrarSanitaryFinalizeContext } from "@/pages/Registrar/helpers/sanitaryFinalize";

const baseProtocolItem: Pick<
  ProtocoloSanitarioItem,
  "id" | "protocolo_id" | "produto" | "tipo" | "payload"
> = {
  id: "item-1",
  protocolo_id: "proto-1",
  produto: "Produto Protocolo",
  tipo: "vacinacao",
  payload: {
    regime_sanitario: {
      family_code: "aftosa",
      regimen_version: 2,
      milestone_code: "dose_1",
      sequence_order: 1,
      eligibility_rule: {},
      completion_rule: {},
      schedule_rule: {},
    },
  },
};

describe("resolveRegistrarSanitaryFinalizeContext", () => {
  it("retorna contexto neutro fora do fluxo sanitario", () => {
    const result = resolveRegistrarSanitaryFinalizeContext({
      tipoManejo: "movimentacao",
      protocoloItem: null,
      sanitaryTypedProduct: "",
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection: () => null,
      showsTransitChecklist: false,
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      officialTransitChecklistEnabled: false,
    });

    expect(result.sanitaryProductName).toBe("");
    expect(result.sanitaryProductSelection).toBeNull();
    expect(result.sanitaryProductMetadata).toEqual({});
    expect(result.transitChecklistPayload).toEqual({});
  });

  it("compoe metadata sanitaria com protocolo e regimen", () => {
    const result = resolveRegistrarSanitaryFinalizeContext({
      tipoManejo: "sanitario",
      protocoloItem: baseProtocolItem,
      sanitaryTypedProduct: "",
      selectedVeterinaryProductSelection: {
        id: "prod-1",
        nome: "Produto Selecionado",
        categoria: "vacina",
        origem: "catalogo",
      },
      resolveProtocolProductSelection: () => ({
        id: "prod-fallback",
        nome: "Produto Fallback",
        categoria: "vacina",
        origem: "catalogo_automatico",
      }),
      showsTransitChecklist: true,
      transitChecklist: {
        ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
        enabled: true,
        gtaChecked: true,
        gtaNumber: "GTA-123",
      },
      officialTransitChecklistEnabled: true,
    });

    expect(result.sanitaryProductName).toBe("Produto Protocolo");
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_veterinario_id: "prod-1",
      produto_nome_catalogo: "Produto Selecionado",
      protocolo_item_id: "item-1",
      protocolo_id: "proto-1",
      family_code: "aftosa",
      regimen_version: 2,
      milestone_code: "dose_1",
    });
    expect(result.transitChecklistPayload).toMatchObject({
      transito_sanitario: {
        enabled: true,
        gta_checked: true,
        gta_number: "GTA-123",
        source: "pack_oficial_transito",
      },
    });
  });
});
