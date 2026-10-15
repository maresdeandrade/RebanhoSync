import { describe, expect, it } from "vitest";

import { resolveLotEditCosts } from "../helpers/resolveLotEditCosts";

function resolve(
  custoTotal: string,
  custoUnitario: string,
  quantidadeBase = 10,
  origemCusto: Parameters<
    typeof resolveLotEditCosts
  >[0]["origemCusto"] = "manual",
) {
  return resolveLotEditCosts(
    Object.freeze({ custoTotal, custoUnitario, quantidadeBase, origemCusto }),
  );
}

describe("resolveLotEditCosts", () => {
  it.each([
    ["", "", 10, null, null, false, false, "ausente"],
    [" \t", " \n", 10, null, null, false, false, "ausente"],
    ["100", "", 10, 100, 10, true, false, "informado"],
    ["", "10", 10, 100, 10, false, true, "informado"],
    ["100", "10", 10, 100, 10, true, true, "informado"],
    ["0", "", 10, 0, 0, true, false, "informado"],
    ["", "0", 10, 0, 0, false, true, "informado"],
    ["0", "0", 10, 0, 0, true, true, "informado"],
    [" 100,0suffix ", "10tail", 10, 100, 10, true, true, "informado"],
    ["10,5,6", "", 10, 10.5, 1.05, true, false, "informado"],
    ["1", "", 3, 1, 0.3333, true, false, "informado"],
    ["", "0,33333", 3, 1, 0.33333, false, true, "informado"],
    ["1", "0,33333", 3, 1, 0.33333, true, true, "informado"],
    ["0,01", "0", 10, 0.01, 0, true, true, "informado"],
    ["-0", "", 10, -0, 0, true, false, "informado"],
  ] as const)(
    "resolves total=%s, unit=%s, quantity=%s",
    (
      total,
      unit,
      quantity,
      expectedTotal,
      expectedUnit,
      hasTotal,
      hasUnit,
      status,
    ) => {
      expect(resolve(total, unit, quantity)).toEqual({
        hasCustoTotal: hasTotal,
        hasCustoUnitario: hasUnit,
        resolvedCustoTotal: expectedTotal,
        resolvedCustoUnitario: expectedUnit,
        resolvedCustoStatus: status,
        resolvedOrigemCusto: status === "ausente" ? "ausente" : "manual",
      });
    },
  );

  it.each([
    ["invalid", "", "Custo total informado é inválido."],
    ["-1", "", "Custo total informado é inválido."],
    ["invalid", "10", "Custo total informado é inválido."],
    ["-1", "10", "Custo total informado é inválido."],
    ["invalid", "invalid", "Custo total informado é inválido."],
    ["-1", "-1", "Custo total informado é inválido."],
    ["", "invalid", "Custo unitário informado é inválido."],
    ["", "-1", "Custo unitário informado é inválido."],
    ["100", "invalid", "Custo unitário informado é inválido."],
    ["100", "-1", "Custo unitário informado é inválido."],
  ])(
    "rejects total=%s and unit=%s in the original order",
    (total, unit, error) => {
      expect(resolve(total, unit)).toEqual({ error });
    },
  );

  it.each([
    ["101", "10", "101.00", "100.00"],
    ["0,0101", "0", "0.01", "0.00"],
  ])(
    "preserves the coherence error for total=%s and unit=%s",
    (total, unit, totalLabel, calculatedLabel) => {
      expect(resolve(total, unit)).toEqual({
        error: `Coerência de custos inválida: custo total informado (${totalLabel}) diverge do calculado (${calculatedLabel}) com base no custo unitário.`,
      });
    },
  );

  it.each(["manual", "ausente", "financeiro_vinculado"] as const)(
    "resolves absent costs to absent origin from %s",
    (origin) => {
      expect(resolve("", "", 10, origin)).toMatchObject({
        resolvedCustoStatus: "ausente",
        resolvedOrigemCusto: "ausente",
      });
    },
  );

  it.each([
    ["manual", "manual"],
    ["ausente", "manual"],
    ["financeiro_vinculado", "financeiro_vinculado"],
  ] as const)("resolves informed cost origin %s to %s", (origin, expected) => {
    expect(resolve("100", "", 10, origin)).toMatchObject({
      resolvedCustoStatus: "informado",
      resolvedOrigemCusto: expected,
    });
  });

  it.each([
    ["Infinity", "", 10, Infinity, Infinity],
    ["", "Infinity", 10, Infinity, Infinity],
    ["Infinity", "Infinity", 10, Infinity, Infinity],
    ["100", "", 0, 100, Infinity],
    ["0", "", 0, 0, NaN],
    ["", "10", 0, 0, 10],
    ["100", "", -10, 100, -10],
    ["", "10", -10, -100, 10],
    ["100", "", NaN, 100, NaN],
    ["100", "10", NaN, 100, 10],
  ])(
    "preserves inherited behavior for total=%s, unit=%s, quantity=%s",
    (total, unit, quantity, expectedTotal, expectedUnit) => {
      expect(resolve(total, unit, quantity)).toMatchObject({
        resolvedCustoTotal: expectedTotal,
        resolvedCustoUnitario: expectedUnit,
        resolvedCustoStatus: "informado",
        resolvedOrigemCusto: "manual",
      });
    },
  );
});
