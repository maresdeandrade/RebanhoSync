/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";
import { EMPTY_REGULATORY_OPERATIONAL_READ_MODEL } from "@/lib/sanitario/compliance/regulatoryReadModel";
import { useRegistrarSanitarioPackage } from "@/pages/Registrar/components/useRegistrarSanitarioPackage";

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock("@/pages/Registrar/effects/bootstrap", () => ({
  refreshRegistrarSanitaryProtocolsEffect: vi.fn().mockResolvedValue(undefined),
  refreshRegistrarVeterinaryProductsEffect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/pages/Registrar/effects/sourceTaskPrefill", () => ({
  loadRegistrarSourceTaskPrefillEffect: vi.fn().mockResolvedValue(null),
}));

describe("useRegistrarSanitarioPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveQuery).mockImplementation(((query) => {
      const querySource =
        typeof query === "function" ? query.toString() : "";

      if (querySource.includes("loadRegistrarProtocolosEffect")) {
        return [{ id: "protocolo-1", nome: "Protocolo 1" }];
      }
      if (querySource.includes("loadRegistrarProtocoloItensEffect")) {
        return [
          {
            id: "item-1",
            tipo: "medicamento",
            produto: "Produto A",
            payload: null,
          },
        ];
      }
      return [];
    }) as typeof useLiveQuery);
  });

  it("aplica prefill sanitario e ignora tipo invalido", () => {
    const { result } = renderHook(() =>
      useRegistrarSanitarioPackage({
        activeFarmId: "farm-1",
        tipoManejo: "sanitario",
        sourceTaskId: "",
        financeiroNatureza: "compra",
        regulatorySurfaceConfig: null,
        regulatoryReadModel: EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
        animaisNoLote: [],
        selectedAnimaisDetalhes: [],
      }),
    );

    act(() => {
      result.current.applySanitaryQueryPrefill({
        protocoloId: "protocolo-1",
        protocoloItemId: "item-1",
        produto: "Produto A",
        sanitarioTipo: "medicamento",
      });
    });

    expect(result.current.protocoloId).toBe("protocolo-1");
    expect(result.current.protocoloItemId).toBe("item-1");
    expect(result.current.sanitarioData.produto).toBe("Produto A");
    expect(result.current.sanitarioData.tipo).toBe("medicamento");

    act(() => {
      result.current.applySanitaryQueryPrefill({
        sanitarioTipo: "tipo_invalido",
      });
    });

    expect(result.current.sanitarioData.tipo).toBe("medicamento");
  });
});
