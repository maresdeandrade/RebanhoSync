import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  applyInventoryItemSelection,
  getInventoryItemOptions,
} from "../inventoryItemSuggestions";
import {
  buildInventoryPresentationName,
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

describe("inventory item options", () => {
  it("returns item options by type and category", () => {
    const options = getInventoryItemOptions("nutricional", "Sal mineral");

    expect(options.map((item) => item.nome)).toContain(
      "Sal mineral pronto uso",
    );
    expect(options.map((item) => item.nome)).not.toContain("Outro / digitar");
    expect(
      getInventoryItemOptions("nutricional", "Silagem").map(
        (item) => item.nome,
      ),
    ).not.toContain("Sal mineral");
  });

  it("applies item selection defaults and generates presentation", () => {
    const [item] = getInventoryItemOptions("nutricional", "Sal mineral");
    const form = applyInventoryItemSelection(baseForm(), item);

    expect(form.nome).toBe("Sal mineral pronto uso");
    expect(form.unidadeBase).toBe("kg");
    expect(form.unidadeCompra).toBe("saco");
    expect(form.quantidadePorApresentacao).toBe("25");
    expect(buildInventoryPresentationName(form)).toBe("Saco 25 kg");
  });

  it("does not overwrite manually edited fields", () => {
    const [item] = getInventoryItemOptions("nutricional", "Sal mineral");
    const form = applyInventoryItemSelection(
      baseForm({
        nome: "Sal especial da fazenda",
        unidadeBase: "kg",
        quantidadePorApresentacao: "30",
      }),
      item,
      new Set(["nome", "quantidadePorApresentacao"]),
    );

    expect(form.nome).toBe("Sal especial da fazenda");
    expect(form.quantidadePorApresentacao).toBe("30");
    expect(form.unidadeCompra).toBe("saco");
  });

  it("keeps item selection inside the Insumo field instead of a separate suggestion field", () => {
    const source = readFileSync(
      new URL("../../../pages/Insumos.tsx", import.meta.url),
      "utf8",
    );
    const entrySectionStart = source.indexOf('title="Entrada inicial"');
    const entrySection = source.slice(entrySectionStart);

    expect(source).not.toContain("Insumo sugerido");
    expect(source).not.toContain("inventory-entry-item-options");
    expect(entrySection).toContain("<Label>Insumo</Label>");
    expect(
      entrySection.indexOf("<Label>Produto veterinário</Label>"),
    ).toBeLessThan(entrySection.indexOf("<Label>Insumo</Label>"));
    expect(
      entrySection.indexOf("<Label>Qtd. por apresentacao</Label>"),
    ).toBeLessThan(entrySection.indexOf("<Label>Apresentacao gerada</Label>"));
  });

  it("keeps helpers free from runtime IO and current time dependencies", () => {
    const source = readFileSync(
      new URL("../inventoryItemSuggestions.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/from ["']@\/lib\/offline\/db["']/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});
