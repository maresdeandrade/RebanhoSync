import { describe, expect, it } from "vitest";
import {
  distributeCommercialInput,
  distributeCommercialTotal,
  parseOptionalCommercialNumber,
  sumCommercialInputs,
} from "../helpers/commercialLineDistribution";

describe("commercial line distribution", () => {
  it("distributes weight with two-decimal precision and adjusts the last line", () => {
    expect(distributeCommercialTotal(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it("distributes gross value and preserves its exact decimal sum", () => {
    expect(distributeCommercialInput("10.00", ["a", "b", "c"])).toEqual({
      a: "3.33",
      b: "3.33",
      c: "3.34",
    });
  });

  it("recalculates totals after an individual weight or value edit", () => {
    expect(sumCommercialInputs(["20.25", "", "10.10"])).toBe("30.35");
    expect(sumCommercialInputs(["0", "0.00"])).toBe("0.00");
  });

  it("distinguishes an empty field from zero", () => {
    expect(parseOptionalCommercialNumber("")).toBeNull();
    expect(parseOptionalCommercialNumber("0")).toBe(0);
    expect(sumCommercialInputs(["", ""])).toBe("");
  });

  it("never creates a negative last line when the total is smaller than the quantity", () => {
    const values = distributeCommercialTotal(2.5, 500);
    expect(values.every((value) => value >= 0)).toBe(true);
    expect(values.reduce((total, value) => total + value, 0)).toBe(2.5);
  });
});
