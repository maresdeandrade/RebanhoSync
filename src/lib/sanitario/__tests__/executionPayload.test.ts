import { describe, expect, it, vi } from "vitest";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";
import {
  buildSanitaryExecutionPayload,
  type SanitaryExecutionProtocolItem,
} from "@/lib/sanitario/models/executionPayload";

const protocolItem: SanitaryExecutionProtocolItem = {
  id: "item-1",
  protocolo_id: "proto-1",
  produto: "Vacina Protocolo",
  tipo: "vacinacao",
  payload: {
    regime_sanitario: {
      family_code: "raiva_herbivoros",
      regimen_version: 1,
      milestone_code: "raiva_d1",
      sequence_order: 1,
      eligibility_rule: {},
      completion_rule: {},
      schedule_rule: {},
    },
  },
};

const selectedProduct: VeterinaryProductSelection = {
  id: "prod-1",
  nome: "Vacina Catalogada",
  categoria: "vacina",
  origem: "catalogo",
};

describe("buildSanitaryExecutionPayload", () => {
  it("agenda: monta payload sanitario a partir de item de agenda/protocolo", () => {
    const result = buildSanitaryExecutionPayload({
      protocoloItem: protocolItem,
      typedProductName: "",
      selectedVeterinaryProductSelection: selectedProduct,
      resolveProtocolProductSelection: () => null,
    });

    expect(result.sanitaryProductName).toBe("Vacina Protocolo");
    expect(result.sanitaryProductSelection).toBe(selectedProduct);
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_veterinario_id: "prod-1",
      produto_nome_catalogo: "Vacina Catalogada",
      produto_categoria: "vacina",
      produto_origem: "catalogo",
      produto_rotulo_informado: "Vacina Protocolo",
      protocolo_item_id: "item-1",
      protocolo_id: "proto-1",
      family_code: "raiva_herbivoros",
      regimen_version: 1,
      milestone_code: "raiva_d1",
    });
  });

  it("manual: monta payload sanitario sem item de agenda", () => {
    const result = buildSanitaryExecutionPayload({
      typedProductName: " Medicamento digitado ",
      selectedVeterinaryProductSelection: null,
    });

    expect(result.sanitaryProductName).toBe("Medicamento digitado");
    expect(result.sanitaryProductSelection).toBeNull();
    expect(result.sanitaryProductMetadata).toEqual({
      produto_origem: "texto_livre",
    });
  });

  it("produto: preserva referencia catalogada e rotulo informado", () => {
    const result = buildSanitaryExecutionPayload({
      typedProductName: "Rotulo no campo",
      selectedVeterinaryProductSelection: selectedProduct,
    });

    expect(result.sanitaryProductName).toBe("Rotulo no campo");
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_veterinario_id: "prod-1",
      produto_nome_catalogo: "Vacina Catalogada",
      produto_categoria: "vacina",
      produto_origem: "catalogo",
      produto_rotulo_informado: "Rotulo no campo",
    });
  });

  it("sem produto: retorna payload seguro e vazio", () => {
    const result = buildSanitaryExecutionPayload({});

    expect(result).toEqual({
      sanitaryProductName: "",
      sanitaryProductSelection: null,
      sanitaryProductMetadata: {},
    });
  });

  it("protocolo: usa selecao resolvida do protocolo quando nao ha produto selecionado", () => {
    const protocolProductSelection: VeterinaryProductSelection = {
      id: "prod-protocol",
      nome: "Vacina Protocolo",
      categoria: "vacina",
      origem: "catalogo_automatico",
      matchMode: "exact",
    };
    const resolveProtocolProductSelection = vi.fn(() => protocolProductSelection);

    const result = buildSanitaryExecutionPayload({
      protocoloItem: protocolItem,
      typedProductName: "",
      selectedVeterinaryProductSelection: null,
      resolveProtocolProductSelection,
    });

    expect(resolveProtocolProductSelection).toHaveBeenCalledWith(
      protocolItem.payload,
      "Vacina Protocolo",
      "vacinacao",
    );
    expect(result.sanitaryProductSelection).toBe(protocolProductSelection);
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_veterinario_id: "prod-protocol",
      produto_origem: "catalogo_automatico",
      produto_match_mode: "exact",
      protocolo_item_id: "item-1",
    });
  });

  it("compliance/documental: nao monta payload sanitario executavel quando desabilitado", () => {
    const result = buildSanitaryExecutionPayload({
      isSanitaryExecution: false,
      protocoloItem: protocolItem,
      typedProductName: "Checklist GTA",
      selectedVeterinaryProductSelection: selectedProduct,
      resolveProtocolProductSelection: () => selectedProduct,
    });

    expect(result).toEqual({
      sanitaryProductName: "",
      sanitaryProductSelection: null,
      sanitaryProductMetadata: {},
    });
  });

  it("compatibilidade: metadata continua consumivel por RPC e fallback offline", () => {
    const result = buildSanitaryExecutionPayload({
      protocoloItem: protocolItem,
      typedProductName: "",
      selectedVeterinaryProductSelection: selectedProduct,
    });

    expect({
      origem: "registrar_manejo",
      ...result.sanitaryProductMetadata,
    }).toMatchObject({
      origem: "registrar_manejo",
      produto_veterinario_id: "prod-1",
      protocolo_item_id: "item-1",
      protocolo_id: "proto-1",
      regime_sanitario: expect.objectContaining({
        family_code: "raiva_herbivoros",
        milestone_code: "raiva_d1",
      }),
    });
  });
});
