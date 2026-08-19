import { describe, expect, it } from "vitest";

import {
  allocateCommercialTotalValue,
  calculateAverageCommercialPricePerHead,
  calculateCommercialPricingLine,
  calculateEffectiveArrobaPrices,
  simulateCommercialPricing,
  convertCommercialWeightFromKg,
  convertCommercialWeightToKg,
  resolveCommercialWeightUnit,
  sumCommercialPricingValues,
  sumCommercialWeights,
  switchCommercialWeightUnit,
} from "../commercialPricing";

describe("commercial pricing", () => {
  it("derives the commercial weight unit from the pricing mode", () => {
    expect(resolveCommercialWeightUnit("per_head")).toBe("arroba");
    expect(resolveCommercialWeightUnit("per_arroba")).toBe("arroba");
    expect(resolveCommercialWeightUnit("per_arroba", "carcass_weight")).toBe(
      "kg",
    );
    expect(resolveCommercialWeightUnit("per_arroba", "live_weight_yield")).toBe(
      "kg",
    );
  });

  it("calculates gross and net effective arroba prices", () => {
    expect(
      calculateEffectiveArrobaPrices({
        totalArrobas: "20",
        grossValue: "6000",
        netValue: "5700",
      }),
    ).toEqual({
      gross: { value: 300, input: "300.00" },
      net: { value: 285, input: "285.00" },
    });
    expect(
      calculateEffectiveArrobaPrices({
        totalArrobas: "",
        grossValue: "6000",
        netValue: "5700",
      }),
    ).toBeNull();
  });

  it("calculates value per head without coercing empty to zero", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_head",
        commercialWeight: { unit: "kg", amount: "450" },
        pricePerHead: "2500.35",
      }),
    ).toMatchObject({ issue: null, individualGrossValue: 2500.35 });
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_head",
        commercialWeight: { unit: "kg", amount: "" },
        pricePerHead: "",
      }).issue,
    ).toMatch(/valor por cabeça/i);
  });

  it("rates total value in cents and derives average price per head", () => {
    expect(allocateCommercialTotalValue("6200", 2)).toEqual([
      { value: 3100, input: "3100.00" },
      { value: 3100, input: "3100.00" },
    ]);
    expect(allocateCommercialTotalValue("100.01", 3)).toEqual([
      { value: 33.34, input: "33.34" },
      { value: 33.34, input: "33.34" },
      { value: 33.33, input: "33.33" },
    ]);
    expect(
      calculateAverageCommercialPricePerHead({ totalValue: "100", quantity: 3 }),
    ).toEqual({ value: 33.33, input: "33.33" });
  });

  it("simulates total value locally without mutating the input lines", () => {
    const lines = [
      {
        lineRef: "animal-1",
        commercialWeight: { unit: "arroba" as const, amount: "10" },
      },
      {
        lineRef: "animal-2",
        commercialWeight: { unit: "arroba" as const, amount: "10" },
      },
    ];
    const before = structuredClone(lines);
    const result = simulateCommercialPricing({
      pricingMode: "total_value",
      weightUnit: "arroba",
      totalValue: "6200",
      netValue: "5900",
      lines,
    });

    expect(result.issue).toBeNull();
    expect(result.grossValue).toEqual({ value: 6200, input: "6200.00" });
    expect(result.totalArrobas).toEqual({ value: 20, input: "20" });
    expect(result.effectivePricePerArrobaGross).toEqual({
      value: 310,
      input: "310.00",
    });
    expect(result.effectivePricePerHeadGross).toEqual({
      value: 3100,
      input: "3100.00",
    });
    expect(lines).toEqual(before);
  });

  it("sums individual head values exactly", () => {
    const calculations = ["1000.01", "2000.02", "3000.03"].map((pricePerHead) =>
      calculateCommercialPricingLine({
        pricingMode: "per_head",
        commercialWeight: { unit: "kg", amount: "" },
        pricePerHead,
      }),
    );
    expect(sumCommercialPricingValues(calculations)).toEqual({
      value: 6000.06,
      input: "6000.06",
    });
  });

  it("calculates total-value lines from an explicit allocated value", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "total_value",
        commercialWeight: { unit: "arroba", amount: "10" },
        allocatedGrossValue: "3100",
      }),
    ).toMatchObject({
      issue: null,
      individualGrossValue: 3100,
      individualGrossValueSource: "derived",
      arrobas: 10,
    });
  });

  it("calculates arrobas from known carcass weight", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_arroba",
        commercialWeight: { unit: "kg", amount: "300" },
        pricePerArroba: "300",
        arrobaBasis: "carcass_weight",
      }),
    ).toMatchObject({
      issue: null,
      arrobas: 20,
      individualGrossValue: 6000,
    });
  });

  it("calculates arrobas from live weight and explicit carcass yield", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_arroba",
        commercialWeight: { unit: "kg", amount: "500" },
        pricePerArroba: "300",
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: "54",
      }),
    ).toMatchObject({
      issue: null,
      arrobas: 18,
      individualGrossValue: 5400,
    });
  });

  it("prices direct arrobas without kilograms, basis or yield", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_arroba",
        commercialWeight: { unit: "arroba", amount: "18.25" },
        pricePerArroba: "300",
      }),
    ).toMatchObject({
      issue: null,
      commercialWeight: { unit: "arroba", amount: 18.25 },
      weightSource: "direct",
      weightConsideredKg: null,
      arrobas: 18.25,
      individualGrossValue: 5475,
    });
  });

  it("blocks live-weight pricing without an explicit yield", () => {
    expect(
      calculateCommercialPricingLine({
        pricingMode: "per_arroba",
        commercialWeight: { unit: "kg", amount: "500" },
        pricePerArroba: "300",
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: "",
      }).issue,
    ).toMatch(/rendimento/i);
  });

  it("recalculates when weight, yield or arroba price changes", () => {
    const calculate = (
      weightKg: string,
      carcassYieldPercent: string,
      pricePerArroba: string,
    ) =>
      calculateCommercialPricingLine({
        pricingMode: "per_arroba",
        commercialWeight: { unit: "kg", amount: weightKg },
        pricePerArroba,
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent,
      }).individualGrossValue;
    expect(calculate("500", "54", "300")).toBe(5400);
    expect(calculate("600", "54", "300")).toBe(6480);
    expect(calculate("600", "50", "300")).toBe(6000);
    expect(calculate("600", "50", "310")).toBe(6200);
  });

  it("recalculates deterministically and sums currency at cent precision", () => {
    const first = calculateCommercialPricingLine({
      pricingMode: "per_arroba",
      commercialWeight: { unit: "kg", amount: "333.33" },
      pricePerArroba: "287.45",
      arrobaBasis: "live_weight_yield",
      carcassYieldPercent: "53.5",
    });
    const second = calculateCommercialPricingLine({
      pricingMode: "per_arroba",
      commercialWeight: { unit: "kg", amount: "333.34" },
      pricePerArroba: "287.45",
      arrobaBasis: "live_weight_yield",
      carcassYieldPercent: "53.5",
    });
    expect(first.individualGrossValueInput).toBe("3417.43");
    expect(second.individualGrossValueInput).toBe("3417.53");
    expect(sumCommercialPricingValues([first, second])).toEqual({
      value: 6834.96,
      input: "6834.96",
    });
  });

  it("keeps kilograms canonical while displaying carcass arrobas", () => {
    expect(
      convertCommercialWeightFromKg({
        weightKg: "450",
        weightUnit: "arroba",
        arrobaBasis: "carcass_weight",
      }),
    ).toMatchObject({ issue: null, valueKg: 450, displayInput: "30" });
    expect(
      convertCommercialWeightToKg({
        displayWeight: "30",
        weightUnit: "arroba",
        arrobaBasis: "carcass_weight",
      }),
    ).toMatchObject({ issue: null, valueKg: 450 });
  });

  it("converts live kilograms to arrobas only with explicit yield", () => {
    const displayed = convertCommercialWeightFromKg({
      weightKg: "500",
      weightUnit: "arroba",
      arrobaBasis: "live_weight_yield",
      carcassYieldPercent: "54",
    });
    expect(displayed).toMatchObject({ issue: null, displayInput: "18" });
    expect(
      convertCommercialWeightToKg({
        displayWeight: displayed.displayInput,
        weightUnit: "arroba",
        arrobaBasis: "live_weight_yield",
        carcassYieldPercent: "54",
      }),
    ).toMatchObject({ issue: null, valueKg: 500 });
  });

  it("blocks arroba conversion without basis or live-weight yield", () => {
    expect(
      convertCommercialWeightFromKg({
        weightKg: "500",
        weightUnit: "arroba",
      }).issue,
    ).toMatch(/base/i);
    expect(
      convertCommercialWeightFromKg({
        weightKg: "500",
        weightUnit: "arroba",
        arrobaBasis: "live_weight_yield",
      }).issue,
    ).toMatch(/rendimento/i);
  });

  it("sums only commercial weights expressed in the same unit", () => {
    expect(
      sumCommercialWeights([
        { unit: "arroba", amount: "0.1" },
        { unit: "arroba", amount: "0.2" },
        { unit: "arroba", amount: "15.333333" },
      ]),
    ).toEqual({ unit: "arroba", amount: "15.633333" });
    expect(() =>
      sumCommercialWeights([
        { unit: "kg", amount: "300" },
        { unit: "arroba", amount: "20" },
      ]),
    ).toThrow(/unidades diferentes/i);
  });

  it("clears an incompatible amount when changing units", () => {
    expect(
      switchCommercialWeightUnit({ unit: "kg", amount: "450" }, "arroba"),
    ).toEqual({ unit: "arroba", amount: null });
  });
});
