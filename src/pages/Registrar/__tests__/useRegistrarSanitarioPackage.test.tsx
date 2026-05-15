/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
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
        typeof query === "function" ? query.toString().toLowerCase() : "";

      if (
        querySource.includes("product") ||
        querySource.includes("produto") ||
        querySource.includes("en(")
      ) {
        return [];
      }
      if (
        querySource.includes("item") ||
        querySource.includes("itens") ||
        querySource.includes("rn(")
      ) {
        return [
          {
            id: "item-1",
            protocolo_id: "protocolo-1",
            tipo: "medicamento",
            produto: "Produto A",
            dose_num: 1,
            intervalo_dias: 30,
            payload: {},
          },
        ];
      }
      return [{ id: "protocolo-1", nome: "Protocolo 1", payload: {} }];
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

  it("preenche produto pelo item de protocolo selecionado quando a query nao traz produto", async () => {
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
        sanitarioTipo: "medicamento",
      });
    });

    await waitFor(() => {
      expect(result.current.sanitarioData.produto).toBe("Produto A");
    });
  });

  it("nao apaga produto do item quando o mesmo prefill da agenda roda novamente", async () => {
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

    const query = {
      protocoloId: "protocolo-1",
      protocoloItemId: "item-1",
      sanitarioTipo: "medicamento",
    };

    act(() => {
      result.current.applySanitaryQueryPrefill(query);
    });

    await waitFor(() => {
      expect(result.current.sanitarioData.produto).toBe("Produto A");
    });

    act(() => {
      result.current.applySanitaryQueryPrefill(query);
    });

    expect(result.current.sanitarioData.produto).toBe("Produto A");
  });

  it("preserva edicao manual do produto apos prefill por item de protocolo", async () => {
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

    const query = {
      protocoloId: "protocolo-1",
      protocoloItemId: "item-1",
      sanitarioTipo: "medicamento",
    };

    act(() => {
      result.current.applySanitaryQueryPrefill(query);
    });

    await waitFor(() => {
      expect(result.current.sanitarioData.produto).toBe("Produto A");
    });

    act(() => {
      result.current.handleSanitarioProdutoChange("Outro produto");
      result.current.applySanitaryQueryPrefill(query);
    });

    expect(result.current.sanitarioData.produto).toBe("Outro produto");
  });

  it("nao sobrescreve produto manual existente ao selecionar item de protocolo", async () => {
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
      result.current.handleSanitarioTipoChange("medicamento");
    });

    await waitFor(() => {
      expect(result.current.sanitarioData.tipo).toBe("medicamento");
    });

    act(() => {
      result.current.applySanitaryQueryPrefill({
        protocoloId: "protocolo-1",
        sanitarioTipo: "medicamento",
      });
    });

    await waitFor(() => {
      expect(result.current.protocoloId).toBe("protocolo-1");
    });

    act(() => {
      result.current.handleSanitarioProdutoChange("Produto manual");
      result.current.setProtocoloItemId("item-1");
    });

    await waitFor(() => {
      expect(result.current.sanitarioData.produto).toBe("Produto manual");
    });
  });

  it("mantem protocoloItemId enquanto os itens ainda nao carregaram", async () => {
    vi.mocked(useLiveQuery).mockImplementation(((query) => {
      const querySource =
        typeof query === "function" ? query.toString().toLowerCase() : "";

      if (
        querySource.includes("product") ||
        querySource.includes("produto") ||
        querySource.includes("en(")
      ) {
        return [];
      }
      if (
        querySource.includes("item") ||
        querySource.includes("itens") ||
        querySource.includes("rn(")
      ) {
        return undefined;
      }
      return [{ id: "protocolo-1", nome: "Protocolo 1", payload: {} }];
    }) as typeof useLiveQuery);

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
        sanitarioTipo: "medicamento",
      });
    });

    await waitFor(() => {
      expect(result.current.protocoloItemId).toBe("item-1");
    });
  });
});
