/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRegistrarFinanceiroPackage } from "@/pages/Registrar/components/useRegistrarFinanceiroPackage";

describe("useRegistrarFinanceiroPackage", () => {
  it("aplica prefill de natureza apenas para valores validos", () => {
    const selectedAnimalIds = ["animal-1"];
    const lotes = [{ id: "lote-1", nome: "Lote 1", fazenda_id: "farm-1" }];
    const { result } = renderHook(() =>
      useRegistrarFinanceiroPackage({
        role: "owner",
        activeFarmId: "farm-1",
        tipoManejo: "financeiro",
        selectedAnimalIds,
        farmWeightUnit: "kg",
        parseUserWeight: (value) => Number(value),
        lotes,
      }),
    );

    expect(result.current.financeiroData.natureza).toBe("compra");

    act(() => {
      result.current.applyFinanceiroNaturezaQueryPrefill("venda");
    });
    expect(result.current.financeiroData.natureza).toBe("venda");

    act(() => {
      result.current.applyFinanceiroNaturezaQueryPrefill("invalida");
    });
    expect(result.current.financeiroData.natureza).toBe("venda");
  });
});
