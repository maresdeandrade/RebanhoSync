import { describe, expect, it } from "vitest";

import { formatWeight, formatWeightInput, parseWeightInput } from "@/lib/format/weight";

describe("weight formatters", () => {
  it("keeps input values normalized for number fields", () => {
    expect(formatWeightInput(180, "arroba")).toBe("12");
    expect(formatWeightInput(31.5, "kg")).toBe("31.5");
  });

  it("formats display values using the farm unit", () => {
    expect(formatWeight(180, "arroba")).toBe("12,00 arroba");
    expect(parseWeightInput("12", "arroba")).toBe(180);
  });
});
