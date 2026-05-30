import { describe, it, expect } from "vitest";
import { calculateCommercialOperation } from "../commercialOperation";
import type { CommercialOperationInput } from "../commercialOperation";

describe("Commercial Operation Core Domain", () => {
  const validCompraAnimalBase: CommercialOperationInput = {
    operationType: "compra",
    scope: "animal",
    occurredAt: "2026-05-29",
    quantidadeAnimais: 5,
    pesoVivoTotal: 1500,
    valorBruto: 12000,
    frete: 500,
    comissao: 200,
    descontos: 100,
    taxasImpostos: 300,
    contraparteId: "cp-1",
    contraparteNome: "Parceiro A",
    animalIds: ["ani-1", "ani-2", "ani-3", "ani-4", "ani-5"],
    financeTransactionId: "fin-123",
    observacoes: "Mock compra",
  };

  const validVendaLoteBase: CommercialOperationInput = {
    operationType: "venda",
    scope: "lote",
    occurredAt: "2026-05-29",
    quantidadeAnimais: 10,
    pesoVivoTotal: 4000,
    valorBruto: 35000,
    frete: 1000,
    comissao: 500,
    descontos: 0,
    taxasImpostos: 800,
    contraparteId: "cp-2",
    contraparteNome: "Parceiro B",
    loteId: "lot-999",
    financeTransactionId: "fin-456",
    observacoes: "Mock venda",
  };

  it("should successfully calculate a valid compra with scope = 'animal'", () => {
    const summary = calculateCommercialOperation(validCompraAnimalBase);

    expect(summary.calculationStatus).toBe("complete");
    expect(summary.issues).toHaveLength(0);
    expect(summary.limitations).toHaveLength(0);
    expect(summary.pesoMedioDerivado).toBe(300); // 1500 / 5
    expect(summary.valorLiquidoDerivado).toBe(10900); // 12000 - 100 - 300 - 200 - 500
    expect(summary.snapshot.operationType).toBe("compra");
    expect(summary.snapshot.scope).toBe("animal");
    expect(summary.snapshot.animalIds).toEqual(["ani-1", "ani-2", "ani-3", "ani-4", "ani-5"]);
  });

  it("should successfully calculate a valid venda with scope = 'lote'", () => {
    const summary = calculateCommercialOperation(validVendaLoteBase);

    expect(summary.calculationStatus).toBe("complete");
    expect(summary.issues).toHaveLength(0);
    expect(summary.limitations).toHaveLength(0);
    expect(summary.pesoMedioDerivado).toBe(400); // 4000 / 10
    expect(summary.valorLiquidoDerivado).toBe(32700); // 35000 - 0 - 800 - 500 - 1000
    expect(summary.snapshot.operationType).toBe("venda");
    expect(summary.snapshot.scope).toBe("lote");
    expect(summary.snapshot.loteId).toBe("lot-999");
  });

  it("should calculate pesoMedioDerivado correctly", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      quantidadeAnimais: 4,
      pesoVivoTotal: 1000,
    };
    const summary = calculateCommercialOperation(input);
    expect(summary.pesoMedioDerivado).toBe(250);
  });

  it("should calculate valorLiquidoDerivado correctly", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      valorBruto: 10000,
      descontos: 500,
      taxasImpostos: 200,
      comissao: 300,
      frete: 1000,
    };
    const summary = calculateCommercialOperation(input);
    expect(summary.valorLiquidoDerivado).toBe(8000); // 10000 - 500 - 200 - 300 - 1000
  });

  it("should block calculation if quantidadeAnimais <= 0", () => {
    const inputZero: CommercialOperationInput = {
      ...validCompraAnimalBase,
      quantidadeAnimais: 0,
    };
    const inputNegative: CommercialOperationInput = {
      ...validCompraAnimalBase,
      quantidadeAnimais: -5,
    };

    const summaryZero = calculateCommercialOperation(inputZero);
    const summaryNegative = calculateCommercialOperation(inputNegative);

    expect(summaryZero.calculationStatus).toBe("blocked");
    expect(summaryZero.issues.some(i => i.code === "invalid_quantidade_animais")).toBe(true);

    expect(summaryNegative.calculationStatus).toBe("blocked");
    expect(summaryNegative.issues.some(i => i.code === "invalid_quantidade_animais")).toBe(true);
  });

  it("should block calculation if any monetary value is negative", () => {
    const fields: Array<keyof CommercialOperationInput> = [
      "valorBruto",
      "frete",
      "comissao",
      "descontos",
      "taxasImpostos",
    ];

    fields.forEach((field) => {
      const input: CommercialOperationInput = {
        ...validCompraAnimalBase,
        [field]: -50,
      };
      const summary = calculateCommercialOperation(input);
      expect(summary.calculationStatus).toBe("blocked");
      expect(summary.issues.some(i => i.code.startsWith("negative_"))).toBe(true);
    });
  });

  it("should block calculation if pesoVivoTotal < 0", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      pesoVivoTotal: -100,
    };
    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("blocked");
    expect(summary.issues.some(i => i.code === "negative_peso_vivo_total")).toBe(true);
  });

  it("should block calculation if valorLiquidoDerivado < 0", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      valorBruto: 100,
      frete: 500, // costs > valorBruto
    };
    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("blocked");
    expect(summary.issues.some(i => i.code === "negative_valor_liquido_derivado")).toBe(true);
  });

  it("should generate partial status, not blocked, when valorBruto is absent", () => {
    const input = { ...validCompraAnimalBase };
    delete input.valorBruto;

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("partial");
    expect(summary.issues.some(i => i.severity === "blocking")).toBe(false);
    expect(summary.valorLiquidoDerivado).toBeUndefined();
    expect(summary.limitations).toContain("Ausência de valor bruto impossibilita o cálculo do valor líquido derivado.");
  });

  it("should generate partial status, not blocked, when pesoVivoTotal is absent", () => {
    const input = { ...validCompraAnimalBase };
    delete input.pesoVivoTotal;

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("partial");
    expect(summary.issues.some(i => i.severity === "blocking")).toBe(false);
    expect(summary.pesoMedioDerivado).toBeUndefined();
    expect(summary.limitations).toContain("Ausência de peso vivo total impossibilita o cálculo do peso médio derivado.");
  });

  it("should generate limitation when contraparte is absent", () => {
    const input = { ...validCompraAnimalBase };
    delete input.contraparteId;
    delete input.contraparteNome;

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("partial");
    expect(summary.limitations).toContain("Ausência de contraparte (parceiro comercial).");
  });

  it("should generate limitation when animal/lote specific link is absent", () => {
    const inputAnimal = { ...validCompraAnimalBase };
    delete inputAnimal.animalIds;

    const summaryAnimal = calculateCommercialOperation(inputAnimal);
    expect(summaryAnimal.calculationStatus).toBe("partial");
    expect(summaryAnimal.limitations).toContain("Ausência de vínculo específico com animal(is).");

    const inputLote = { ...validVendaLoteBase };
    delete inputLote.loteId;

    const summaryLote = calculateCommercialOperation(inputLote);
    expect(summaryLote.calculationStatus).toBe("partial");
    expect(summaryLote.limitations).toContain("Ausência de vínculo específico com lote.");
  });

  it("should block calculation with negative liquid value if valorBruto = 0 and costs > 0", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      valorBruto: 0,
      frete: 10,
    };

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("blocked");
    expect(summary.issues.some(i => i.code === "negative_valor_liquido_derivado")).toBe(true);
  });

  it("should not break calculation when pesoVivoTotal = 0, but generate an informative limitation", () => {
    const input: CommercialOperationInput = {
      ...validCompraAnimalBase,
      pesoVivoTotal: 0,
    };

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("complete");
    expect(summary.issues).toHaveLength(0);
    expect(summary.pesoMedioDerivado).toBe(0);
    expect(summary.limitations).toContain("Peso vivo total informado como zero.");
  });

  it("should not block when financeTransactionId is absent, but should report partial status and a limitation", () => {
    const input = { ...validCompraAnimalBase };
    delete input.financeTransactionId;

    const summary = calculateCommercialOperation(input);

    expect(summary.calculationStatus).toBe("partial");
    expect(summary.issues.some(i => i.severity === "blocking")).toBe(false);
    expect(summary.limitations).toContain("Ausência de vínculo financeiro (financeTransactionId).");
  });

  it("should absolutely not contain any prohibited terms or calculations in the output", () => {
    const summary = calculateCommercialOperation(validCompraAnimalBase);

    // Verify prohibited keys don't exist
    const keys = Object.keys(summary);
    const prohibitedKeys = [
      "lucro",
      "margem",
      "roi",
      "roiDerivado",
      "custoPorCabeca",
      "custoPorArroba",
      "prontidao",
      "prontidaoVenda",
      "aptidao",
      "aptidaoAbate",
      "liberacao",
      "recomendacao",
    ];

    prohibitedKeys.forEach((key) => {
      expect(keys).not.toContain(key);
      expect((summary as unknown as Record<string, unknown>)[key]).toBeUndefined();
    });

    // Check that issues and limitations don't have prohibited terms
    const prohibitedTerms = [
      "apto",
      "liberado",
      "autorizado",
      "pronto para venda",
      "pronto para abate",
      "lucro",
      "margem",
      "roi",
      "custo por cabeça",
      "custo por arroba",
    ];

    summary.issues.forEach((issue) => {
      const msg = issue.message.toLowerCase();
      prohibitedTerms.forEach((term) => {
        expect(msg).not.toContain(term);
      });
    });

    summary.limitations.forEach((limitation) => {
      const msg = limitation.toLowerCase();
      prohibitedTerms.forEach((term) => {
        expect(msg).not.toContain(term);
      });
    });
  });
});
