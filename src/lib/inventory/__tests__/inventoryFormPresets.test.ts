import { describe, expect, it } from "vitest";

import {
  applyInventoryPreset,
  buildInventoryPresentationName,
  calculateBaseQuantity,
  calculateInventoryCostSummary,
  getInventoryCategoryPreset,
  getInventoryProductPreset,
  getInventoryTypeOptions,
  isVeterinaryProductRequired,
  shouldShowInventoryField,
  type InventoryFormLike,
} from "../inventoryFormPresets";

function baseForm(
  overrides: Partial<InventoryFormLike> = {},
): InventoryFormLike {
  return {
    tipo: "nutricional",
    nome: "",
    categoria: "",
    unidadeBase: "un",
    unidadeCompra: "unidade",
    apresentacaoNome: "",
    quantidadePorApresentacao: "",
    quantidadeEntrada: "1",
    identificacaoLote: "",
    validade: "",
    fabricante: "",
    localArmazenamento: "",
    custoTotal: "",
    custoUnitario: "",
    ...overrides,
  };
}

describe("inventory form presets", () => {
  it("applies Sal mineral defaults", () => {
    const preset = getInventoryCategoryPreset("nutricional", "Sal mineral");
    const form = applyInventoryPreset(baseForm(), preset);

    expect(form.unidadeBase).toBe("kg");
    expect(form.unidadeCompra).toBe("saco");
    expect(form.quantidadePorApresentacao).toBe("25");
    expect(buildInventoryPresentationName(form)).toBe("Saco 25 kg");
  });

  it("applies Vacina defaults and requires cataloged veterinary product", () => {
    const preset = getInventoryCategoryPreset("sanitario", "Vacina");
    const form = applyInventoryPreset(baseForm({ tipo: "sanitario" }), preset);

    expect(form.unidadeBase).toBe("dose");
    expect(form.unidadeCompra).toBe("frasco");
    expect(preset.requiresVeterinaryProduct).toBe(true);
    expect(isVeterinaryProductRequired("sanitario", "Vacina")).toBe(true);
  });

  it("allows Material sanitario without cataloged veterinary product", () => {
    const preset = getInventoryCategoryPreset(
      "sanitario",
      "Material sanitário",
    );

    expect(preset.requiresVeterinaryProduct).toBe(false);
    expect(isVeterinaryProductRequired("sanitario", "Material sanitário")).toBe(
      false,
    );
  });

  it("shows outro as Operacional while preserving persisted value", () => {
    const option = getInventoryTypeOptions().find(
      (item) => item.value === "outro",
    );

    expect(option).toEqual({
      value: "outro",
      label: "Operacional",
    });
  });

  it("lowers lot and validity relevance for operational ear tags", () => {
    const form = baseForm({
      tipo: "outro",
      categoria: "Brinco de identificação",
    });
    const preset = getInventoryCategoryPreset(
      "outro",
      "Brinco de identificação",
    );

    expect(shouldShowInventoryField("lote", form, preset)).toBe(false);
    expect(shouldShowInventoryField("validade", form, preset)).toBe(false);
    expect(shouldShowInventoryField("fabricante", form, preset)).toBe(true);
  });

  it("fills compatible defaults from selected veterinary product", () => {
    const preset = getInventoryProductPreset({
      nome: "Vacina Bovina",
      categoria: "vacina",
    });
    const form = applyInventoryPreset(baseForm({ tipo: "sanitario" }), preset);

    expect(form.nome).toBe("Vacina Bovina");
    expect(form.categoria).toBe("Vacina");
    expect(form.unidadeBase).toBe("dose");
    expect(form.unidadeCompra).toBe("frasco");
  });

  it("calculates entry unit cost from total cost", () => {
    const summary = calculateInventoryCostSummary(
      baseForm({
        quantidadeEntrada: "2",
        quantidadePorApresentacao: "25",
        custoTotal: "250",
      }),
      "custo_total",
    );

    expect(
      calculateBaseQuantity({
        quantidadeEntrada: "2",
        quantidadePorApresentacao: "25",
      }),
    ).toBe(50);
    expect(summary.custoTotal).toBe(250);
    expect(summary.custoPorEntrada).toBe(125);
    expect(summary.custoUnitarioBase).toBe(5);
    expect(summary.status).toBe("informado");
  });

  it("calculates total cost from entry unit cost", () => {
    const summary = calculateInventoryCostSummary(
      baseForm({
        quantidadeEntrada: "2",
        quantidadePorApresentacao: "25",
        custoUnitario: "5",
      }),
      "custo_unitario",
    );

    expect(summary.custoTotal).toBe(10);
    expect(summary.custoPorEntrada).toBe(5);
    expect(summary.custoUnitarioBase).toBe(0.2);
    expect(summary.status).toBe("informado");
  });

  it("uses operational purchase cost by entry and keeps base quantity separate", () => {
    const form = baseForm({
      unidadeBase: "kg",
      unidadeCompra: "saco",
      quantidadeEntrada: "10",
      quantidadePorApresentacao: "25",
      custoUnitario: "100",
    });
    const summary = calculateInventoryCostSummary(form, "custo_unitario");

    expect(calculateBaseQuantity(form)).toBe(250);
    expect(summary.custoPorEntrada).toBe(100);
    expect(summary.custoUnitarioBase).toBe(4);
    expect(summary.custoTotal).toBe(1000);
  });

  it("preserves compatible manually edited fields when type changes", () => {
    const form = baseForm({
      tipo: "nutricional",
      quantidadeEntrada: "4",
      custoTotal: "500",
      localArmazenamento: "Deposito",
      fabricante: "Fabricante X",
    });
    const preset = getInventoryCategoryPreset(
      "outro",
      "Brinco de identificação",
    );
    const next = applyInventoryPreset(
      {
        ...form,
        tipo: "outro",
      },
      preset,
      new Set(["quantidadeEntrada", "custoTotal"]),
    );

    expect(next.quantidadeEntrada).toBe("4");
    expect(next.custoTotal).toBe("500");
    expect(next.localArmazenamento).toBe("Deposito");
    expect(next.fabricante).toBe("Fabricante X");
  });
});
