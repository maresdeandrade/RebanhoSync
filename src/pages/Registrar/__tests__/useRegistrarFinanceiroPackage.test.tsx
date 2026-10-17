/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRegistrarFinanceiroPackage } from "@/pages/Registrar/components/useRegistrarFinanceiroPackage";
import { buildRegistrarFinancialPurchaseAnimals } from "@/pages/Registrar/helpers/financialPlan";
import { buildFinancialTransaction } from "@/lib/finance/transactions";

describe("useRegistrarFinanceiroPackage", () => {
  it.each([
    { nextIds: ["b", "a"], expected: ["500", "300"] },
    { nextIds: ["b"], expected: ["500"] },
    { nextIds: ["b", "c"], expected: ["500", ""] },
  ])(
    "preserva a identidade dos pesos ao selecionar $nextIds",
    ({ nextIds, expected }) => {
      const { result, rerender } = renderHook(
        ({ ids }) =>
          useRegistrarFinanceiroPackage({
            role: "owner",
            activeFarmId: "farm-1",
            tipoManejo: "financeiro",
            selectedAnimalIds: ids,
            farmWeightUnit: "kg",
            parseUserWeight: (value) => (value ? Number(value) : null),
            lotes: [],
          }),
        { initialProps: { ids: ["a", "b"] } },
      );
      act(() => {
        result.current.updateFinanceiroData("natureza", "venda");
        result.current.updateFinanceiroData("modoPeso", "individual");
      });
      act(() => {
        result.current.updateCompraNovoAnimalPesoByIndex(0, "300");
        result.current.updateCompraNovoAnimalPesoByIndex(1, "500");
      });
      rerender({ ids: nextIds });

      const selectedAnimals = nextIds.map((id) => ({
        id,
        identificacao: id,
        loteId: null,
      }));
      const built = buildFinancialTransaction({
        fazendaId: "farm-1",
        natureza: "venda",
        occurredAt: "2026-01-01T12:00:00.000Z",
        loteId: "lote-1",
        selectedAnimals,
        purchaseAnimals: buildRegistrarFinancialPurchaseAnimals({
          natureza: "venda",
          compraNovosAnimais: result.current.compraNovosAnimais,
          selectedAnimalRecords: selectedAnimals,
          modoPeso: "individual",
          parseUserWeight: (value) => (value ? Number(value) : null),
        }),
        priceMode: "por_lote",
        totalAmount: 10000,
        weightMode: "individual",
      });
      const weightEvents = built.ops.filter(
        (op) => op.table === "eventos" && op.record.dominio === "pesagem",
      );
      const weightDetails = built.ops.filter(
        (op) => op.table === "eventos_pesagem",
      );
      expect(
        weightEvents.map((op) => ({
          animalId: op.record.animal_id,
          peso: weightDetails.find(
            (detail) => detail.record.evento_id === op.record.id,
          )?.record.peso_kg,
        })),
      ).toEqual(
        nextIds.flatMap((id, index) =>
          expected[index]
            ? [{ animalId: id, peso: Number(expected[index]) }]
            : [],
        ),
      );
      expect(
        result.current.compraNovosAnimais.map((draft) => draft.localId),
      ).toEqual(nextIds);
      expect(
        result.current.compraNovosAnimais.map((draft) => draft.pesoKg),
      ).toEqual(expected);
    },
  );
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

  it("nao recria estado quando prefill repete a mesma natureza", () => {
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

    const stateBefore = result.current.financeiroData;

    act(() => {
      result.current.applyFinanceiroNaturezaQueryPrefill("compra");
    });

    expect(result.current.financeiroData).toBe(stateBefore);
  });
});
