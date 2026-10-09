/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimalWeightVariationBadge } from "../AnimalWeightVariationBadge";

describe("AnimalWeightVariationBadge", () => {
  it.each([
    { value: 12, label: "+12,0 kg · ganho" },
    { value: -12, label: "−12,0 kg · perda" },
    { value: 0, label: "0,0 kg · sem variação" },
  ])("mantém sinal e significado de $value", ({ value, label }) => {
    render(<AnimalWeightVariationBadge variationKg={value} weightUnit="kg" />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("preserva perda na unidade configurada", () => {
    render(<AnimalWeightVariationBadge variationKg={-15} weightUnit="arroba" />);
    expect(screen.getByText("−1,00 arroba · perda")).toBeVisible();
  });

  it.each([null, undefined])("não converte ausência em zero: %s", (value) => {
    const { container } = render(<AnimalWeightVariationBadge variationKg={value} weightUnit="kg" />);
    expect(container).toBeEmptyDOMElement();
  });
});
