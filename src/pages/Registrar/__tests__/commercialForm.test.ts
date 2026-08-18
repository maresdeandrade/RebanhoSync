import { describe, expect, it } from "vitest";
import {
  formatCommercialBirthAge,
  resolveCommercialFormIssue,
  resolvePurchaseQuantity,
} from "../helpers/commercialForm";

const base = {
  operationType: "compra" as const,
  scope: "animal" as const,
  quantity: 1,
  newAnimalsCount: 1,
  purchaseDestinationLotId: "",
  selectedAnimalIds: [] as string[],
  targetLotId: null,
  saleSnapshotIds: [] as string[],
  currentLotActiveAnimalIds: [] as string[],
};

describe("commercial form invariants", () => {
  it("derives age only from a valid birth date and operation date", () => {
    expect(formatCommercialBirthAge("2024-02-10", "2026-08-14")).toBe("2a 6m");
    expect(formatCommercialBirthAge(null, "2026-08-14")).toBeNull();
    expect(formatCommercialBirthAge("2027-01-01", "2026-08-14")).toBeNull();
  });
  it("keeps individual purchase fixed to one line", () => {
    expect(resolvePurchaseQuantity("animal", 20)).toBe(1);
    expect(resolveCommercialFormIssue(base)).toBeNull();
  });

  it("requires 2-500 rows and a destination lot for lot purchase", () => {
    expect(resolvePurchaseQuantity("lote", 1)).toBe(2);
    expect(
      resolveCommercialFormIssue({
        ...base,
        scope: "lote",
        quantity: 2,
        newAnimalsCount: 2,
      }),
    ).toMatch(/lote de destino/i);
    expect(
      resolveCommercialFormIssue({
        ...base,
        scope: "lote",
        quantity: 2,
        newAnimalsCount: 2,
        purchaseDestinationLotId: "lot-1",
      }),
    ).toBeNull();
  });

  it("blocks animal scope with quantity greater than one", () => {
    expect(resolveCommercialFormIssue({ ...base, quantity: 2 })).toMatch(
      /quantidade igual a 1/i,
    );
  });

  it("requires exactly one existing animal for individual sale", () => {
    expect(
      resolveCommercialFormIssue({
        ...base,
        operationType: "venda",
        newAnimalsCount: 0,
        selectedAnimalIds: ["a", "b"],
      }),
    ).toMatch(/exatamente um animal/i);
  });

  it("requires the full, unique lot snapshot for a lot sale", () => {
    const lotSale = {
      ...base,
      operationType: "venda" as const,
      scope: "lote" as const,
      quantity: 2,
      newAnimalsCount: 0,
      targetLotId: "lot-1",
      saleSnapshotIds: ["a", "b"],
      currentLotActiveAnimalIds: ["b", "a"],
    };
    expect(resolveCommercialFormIssue(lotSale)).toBeNull();
    expect(
      resolveCommercialFormIssue({
        ...lotSale,
        saleSnapshotIds: ["a", "a", "b"],
      }),
    ).toMatch(/snapshot integral/i);
    expect(
      resolveCommercialFormIssue({
        ...lotSale,
        saleSnapshotIds: ["a"],
      }),
    ).toMatch(/snapshot integral/i);
  });
});
