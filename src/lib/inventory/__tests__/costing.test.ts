import { describe, expect, it } from "vitest";
import {
  resolveInventoryLotUnitCost,
  buildInventoryCostSnapshot,
} from "../costing";
import type { InsumoLote } from "@/lib/offline/types";

describe("costing helper module", () => {
  it("uses custo_unitario when present", () => {
    const lot: Partial<InsumoLote> = {
      custo_unitario: 1.5,
      custo_total: 100,
      quantidade_inicial_base: 50,
    };
    const unitCost = resolveInventoryLotUnitCost(lot as InsumoLote);
    expect(unitCost).toBe(1.5);
  });

  it("derives custo_unitario from custo_total / quantidade_inicial_base when custo_unitario is absent", () => {
    const lot: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: 100,
      quantidade_inicial_base: 8,
    };
    const unitCost = resolveInventoryLotUnitCost(lot as InsumoLote);
    // 100 / 8 = 12.5
    expect(unitCost).toBe(12.5);
  });

  it("rounds derived unit cost to 4 decimal places", () => {
    const lot: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: 10,
      quantidade_inicial_base: 3,
    };
    const unitCost = resolveInventoryLotUnitCost(lot as InsumoLote);
    // 10 / 3 = 3.3333333... rounded to 4 decimals = 3.3333
    expect(unitCost).toBe(3.3333);
  });

  it("returns null/ausente when there is no cost", () => {
    const lot: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: null,
      quantidade_inicial_base: 50,
    };
    const unitCost = resolveInventoryLotUnitCost(lot as InsumoLote);
    expect(unitCost).toBeNull();

    const snapshot = buildInventoryCostSnapshot({
      lot: lot as InsumoLote,
      quantidadeBase: 10,
    });
    expect(snapshot.custo_status).toBe("ausente");
    expect(snapshot.custo_unitario_snapshot).toBeNull();
    expect(snapshot.custo_total_snapshot).toBeNull();
    expect(snapshot.limitacoes).toContain("Sem custo unitario cadastrado no lote");
  });

  it("does not derive if quantidade_inicial_base <= 0", () => {
    const lotZero: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: 100,
      quantidade_inicial_base: 0,
    };
    expect(resolveInventoryLotUnitCost(lotZero as InsumoLote)).toBeNull();

    const lotNeg: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: 100,
      quantidade_inicial_base: -5,
    };
    expect(resolveInventoryLotUnitCost(lotNeg as InsumoLote)).toBeNull();
  });

  it("accepts zero cost as informed", () => {
    const lotUnitZero: Partial<InsumoLote> = {
      custo_unitario: 0,
      custo_total: 100,
      quantidade_inicial_base: 50,
    };
    expect(resolveInventoryLotUnitCost(lotUnitZero as InsumoLote)).toBe(0);

    const lotTotalZero: Partial<InsumoLote> = {
      custo_unitario: null,
      custo_total: 0,
      quantidade_inicial_base: 50,
    };
    expect(resolveInventoryLotUnitCost(lotTotalZero as InsumoLote)).toBe(0);

    const snapshot = buildInventoryCostSnapshot({
      lot: lotTotalZero as InsumoLote,
      quantidadeBase: 10,
    });
    expect(snapshot.custo_status).toBe("informado");
    expect(snapshot.custo_unitario_snapshot).toBe(0);
    expect(snapshot.custo_total_snapshot).toBe(0);
  });

  it("calculates total snapshot with stable rounding (2 decimals)", () => {
    const lot: Partial<InsumoLote> = {
      custo_unitario: 1.3333,
    };
    const snapshot = buildInventoryCostSnapshot({
      lot: lot as InsumoLote,
      quantidadeBase: 10.5,
    });
    // 1.3333 * 10.5 = 13.99965 -> rounded to 2 decimals = 14.00
    expect(snapshot.custo_unitario_snapshot).toBe(1.3333);
    expect(snapshot.custo_total_snapshot).toBe(14.00);
    expect(snapshot.custo_status).toBe("informado");
  });
});
