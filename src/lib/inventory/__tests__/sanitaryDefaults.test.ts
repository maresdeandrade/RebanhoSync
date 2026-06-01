import { describe, expect, it } from "vitest";

import {
  normalizeSanitaryApplicationRoute,
  resolveSanitaryDefaultApplicationRoute,
  resolveSanitaryDefaultDose,
  resolveSanitaryDefaultDoseUnit,
} from "@/lib/inventory/sanitaryDefaults";

describe("sanitary inventory defaults", () => {
  it("usa 1 dose como dose operacional padrao", () => {
    expect(resolveSanitaryDefaultDose()).toBe("1");
  });

  it("prioriza unidade do lote e depois unidade base do insumo", () => {
    expect(
      resolveSanitaryDefaultDoseUnit({
        loteUnit: "ml",
        insumo: { unidade_base: "dose" },
      }),
    ).toBe("ml");
    expect(
      resolveSanitaryDefaultDoseUnit({
        loteUnit: null,
        insumo: { unidade_base: "dose" },
      }),
    ).toBe("dose");
  });

  it("normaliza via de aplicacao informada no payload do insumo", () => {
    expect(normalizeSanitaryApplicationRoute("SC")).toBe("subcutanea");
    expect(
      resolveSanitaryDefaultApplicationRoute({
        sanitarioTipo: "vermifugacao",
        insumo: { payload: { via_aplicacao_padrao: "IM" } },
      }),
    ).toBe("intramuscular");
  });

  it("usa via base pelo tipo sanitario quando o insumo nao informa via", () => {
    expect(
      resolveSanitaryDefaultApplicationRoute({
        sanitarioTipo: "vermifugacao",
        insumo: null,
      }),
    ).toBe("oral");
    expect(
      resolveSanitaryDefaultApplicationRoute({
        sanitarioTipo: "medicamento",
        insumo: null,
      }),
    ).toBe("intramuscular");
  });
});
