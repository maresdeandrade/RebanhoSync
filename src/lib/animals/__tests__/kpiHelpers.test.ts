// src/lib/animals/__tests__/kpiHelpers.test.ts

import { describe, it, expect } from "vitest";
import { calculateIndividualGmd, calculateUaLotacao } from "../kpiHelpers";

describe("calculateIndividualGmd", () => {
  it("calcula GMD correto usando occurred_at (não created_at)", () => {
    // Valida que occurred_at é a fonte temporal; 10 dias de intervalo, 10 kg de ganho = 1.0 kg/dia
    const pesagens = [
      { peso_kg: 200, occurred_at: "2026-05-01", deleted_at: null },
      { peso_kg: 210, occurred_at: "2026-05-11", deleted_at: null },
    ];
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(true);
    expect(result.gmdKgDia).toBe(1.0);
    expect(result.ganhoKg).toBe(10);
    expect(result.diasIntervalo).toBe(10);
    expect(result.pesoInicialKg).toBe(200);
    expect(result.pesoFinalKg).toBe(210);
  });

  it("ignora pesagem com soft delete (deleted_at preenchido)", () => {
    const pesagens = [
      { peso_kg: 200, occurred_at: "2026-05-01", deleted_at: null },
      { peso_kg: 250, occurred_at: "2026-05-11", deleted_at: "2026-05-12" }, // soft-deleted
    ];
    // Com apenas 1 pesagem válida, GMD deve ser bloqueado
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("Menos de 2");
  });

  it("bloqueia GMD quando mesmo dia (intervalo = 0 dias)", () => {
    const pesagens = [
      { peso_kg: 200, occurred_at: "2026-05-11", deleted_at: null },
      { peso_kg: 210, occurred_at: "2026-05-11", deleted_at: null },
    ];
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(false);
    expect(result.diasIntervalo).toBe(0);
    expect(result.reason).toContain("0 dias");
  });

  it("bloqueia GMD com menos de 2 pesagens", () => {
    const pesagens = [
      { peso_kg: 200, occurred_at: "2026-05-01", deleted_at: null },
    ];
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(false);
    expect(result.gmdKgDia).toBe(0);
    expect(result.reason).toContain("Menos de 2");
  });

  it("bloqueia GMD com zero pesagens", () => {
    const result = calculateIndividualGmd([]);
    expect(result.isValid).toBe(false);
    expect(result.gmdKgDia).toBe(0);
  });

  it("usa a mais antiga como inicial e a mais recente como final (independente de ordem de entrada)", () => {
    // Pesagens fora de ordem
    const pesagens = [
      { peso_kg: 250, occurred_at: "2026-05-20", deleted_at: null },
      { peso_kg: 200, occurred_at: "2026-05-01", deleted_at: null },
    ];
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(true);
    expect(result.pesoInicialKg).toBe(200);
    expect(result.pesoFinalKg).toBe(250);
    expect(result.ganhoKg).toBe(50);
    expect(result.diasIntervalo).toBe(19);
  });

  it("aceita ganho negativo (perda de peso)", () => {
    const pesagens = [
      { peso_kg: 300, occurred_at: "2026-05-01", deleted_at: null },
      { peso_kg: 280, occurred_at: "2026-05-11", deleted_at: null },
    ];
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(true);
    expect(result.ganhoKg).toBe(-20);
    expect(result.gmdKgDia).toBe(-2.0);
  });

  it("ignora pesagens com peso_kg <= 0", () => {
    const pesagens = [
      { peso_kg: 0, occurred_at: "2026-05-01", deleted_at: null },
      { peso_kg: 200, occurred_at: "2026-05-11", deleted_at: null },
    ];
    // Apenas 1 pesagem válida (peso > 0)
    const result = calculateIndividualGmd(pesagens);
    expect(result.isValid).toBe(false);
  });
});

describe("calculateUaLotacao", () => {
  it("calcula uaTotal = soma pesos / 450", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
      { pesoKg: 450, isConfiavel: true, isMissing: false },
    ];
    const result = calculateUaLotacao(weights, undefined);
    expect(result.uaTotal).toBe(2); // 900 / 450 = 2 UA
  });

  it("bloqueia taxa UA/ha quando area_ha <= 0", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
    ];
    const result = calculateUaLotacao(weights, 0);
    expect(result.taxaLotacaoUaHa).toBeNull();
    expect(result.status).toBe("bloqueado");
    expect(result.reason).toContain("Área");
  });

  it("bloqueia taxa UA/ha quando area_ha é null", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
    ];
    const result = calculateUaLotacao(weights, null);
    expect(result.taxaLotacaoUaHa).toBeNull();
    expect(result.status).toBe("bloqueado");
  });

  it("calcula taxaLotacaoUaHa = uaTotal / areaHa quando area > 0", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
    ];
    const result = calculateUaLotacao(weights, 10);
    expect(result.uaTotal).toBe(1);
    expect(result.taxaLotacaoUaHa).toBe(0.1); // 1 UA / 10 ha
    expect(result.status).toBe("complete");
  });

  it("marca status parcial quando há pesos ausentes ou desatualizados", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
      { pesoKg: 0, isConfiavel: false, isMissing: true }, // sem peso
    ];
    const result = calculateUaLotacao(weights, 10);
    expect(result.status).toBe("partial");
    expect(result.limitation).toContain("sem peso");
  });

  it("retorna empty quando não há animais", () => {
    const result = calculateUaLotacao([], 10);
    expect(result.status).toBe("empty");
    expect(result.uaTotal).toBe(0);
    expect(result.taxaLotacaoUaHa).toBeNull();
  });

  it("retorna taxaLotacaoUaHa null quando areaHa é undefined (lote sem pasto)", () => {
    const weights = [
      { pesoKg: 450, isConfiavel: true, isMissing: false },
    ];
    // areaHa = undefined significa contexto de lote sem pasto associado
    const result = calculateUaLotacao(weights, undefined);
    expect(result.taxaLotacaoUaHa).toBeNull();
    expect(result.uaTotal).toBe(1);
    expect(result.status).toBe("complete");
  });
});
