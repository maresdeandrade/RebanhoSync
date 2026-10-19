import { describe, expect, it } from "vitest";

import {
  convertPresentationQuantityToBase,
  evaluateInventoryLotConsumption,
  evaluateInventoryLotManualMovement,
  evaluateNutritionalInventoryConsumptionReadiness,
  getInventoryMovementDelta,
  projectInventoryLotBalance,
} from "../inventoryContracts";

describe("inventoryContracts", () => {
  it("converte apresentacoes comerciais para unidade base", () => {
    expect(
      convertPresentationQuantityToBase({
        presentationQuantity: 3,
        presentationBaseQuantity: 25,
      }),
    ).toBe(75);
  });

  it.each([
    {
      presentationQuantity: 2.5,
      presentationBaseQuantity: 1.25,
      expected: 3.125,
    },
    {
      presentationQuantity: 0.1,
      presentationBaseQuantity: 0.2,
      expected: 0.020000000000000004,
    },
    {
      presentationQuantity: Number.MAX_VALUE,
      presentationBaseQuantity: 1,
      expected: Number.MAX_VALUE,
    },
  ])(
    "preserva produto finito sem arredondamento: $expected",
    ({ expected, ...input }) => {
      expect(convertPresentationQuantityToBase(input)).toBe(expected);
    },
  );

  it.each([
    { presentationQuantity: 1e308, presentationBaseQuantity: 1e308 },
    { presentationQuantity: Number.MAX_VALUE, presentationBaseQuantity: 2 },
    { presentationQuantity: 2, presentationBaseQuantity: Number.MAX_VALUE },
  ])("rejeita overflow com fatores finitos: %j", (input) => {
    expect(Number.isFinite(input.presentationQuantity)).toBe(true);
    expect(Number.isFinite(input.presentationBaseQuantity)).toBe(true);
    expect(() => convertPresentationQuantityToBase(input)).toThrow(
      "Quantidade base calculada deve ser finita.",
    );
  });

  it("projeta saldo por movimentacoes auditaveis", () => {
    expect(
      projectInventoryLotBalance({
        saldoAtualBase: 100,
        movements: [
          { tipo: "entrada", quantidade_base: 20 },
          { tipo: "consumo_nutricao", quantidade_base: 35 },
          { tipo: "ajuste_positivo", quantidade_base: 5 },
          { tipo: "perda", quantidade_base: 10 },
        ],
      }),
    ).toBe(80);

    expect(getInventoryMovementDelta("consumo_sanitario", 7)).toBe(-7);
  });

  it("bloqueia consumo quando saldo do lote e insuficiente", () => {
    expect(
      evaluateInventoryLotConsumption({
        lot: {
          id: "lot-1",
          saldo_atual_base: 4,
          unidade_base: "kg",
          status: "ativo",
          deleted_at: null,
        },
        quantidadeBase: 5,
        unidadeBase: "kg",
      }),
    ).toMatchObject({
      canConsume: false,
      projectedBalance: -1,
    });
  });

  it("bloqueia ajuste negativo que deixaria saldo abaixo de zero", () => {
    expect(
      evaluateInventoryLotManualMovement({
        lot: {
          id: "lot-1",
          saldo_atual_base: 8,
          unidade_base: "kg",
          status: "ativo",
          deleted_at: null,
        },
        tipo: "ajuste_negativo",
        quantidadeBase: 9,
        unidadeBase: "kg",
      }),
    ).toMatchObject({
      canRegister: false,
      projectedBalance: -1,
    });
  });

  it("aceita entrada em lote existente como contra-lancamento positivo", () => {
    expect(
      evaluateInventoryLotManualMovement({
        lot: {
          id: "lot-1",
          saldo_atual_base: 8,
          unidade_base: "kg",
          status: "ativo",
          deleted_at: null,
        },
        tipo: "entrada",
        quantidadeBase: 12,
        unidadeBase: "kg",
      }),
    ).toMatchObject({
      canRegister: true,
      projectedBalance: 20,
    });
  });

  it("aceita evento de nutricao como origem manual em kg", () => {
    expect(
      evaluateNutritionalInventoryConsumptionReadiness({
        event: {
          id: "evt-1",
          dominio: "nutricao",
          deleted_at: null,
        },
        nutricaoDetail: {
          evento_id: "evt-1",
          quantidade_kg: 42,
        },
      }),
    ).toMatchObject({
      decision: "eligible_manual_consumption_source",
      canCreateManualMovement: true,
      sourceEventoDominio: "nutricao",
      quantityBase: 42,
      unidadeBase: "kg",
      createsStockMutation: false,
    });
  });

  it("exige apresentacao para suplemento de pasto informado em sacos", () => {
    expect(
      evaluateNutritionalInventoryConsumptionReadiness({
        event: {
          id: "evt-2",
          dominio: "pastagem",
          deleted_at: null,
        },
        pastoDetail: {
          evento_id: "evt-2",
          suplemento_quantidade: 2,
          suplemento_unidade: "sacos",
        },
      }),
    ).toMatchObject({
      decision: "needs_presentation_conversion",
      canCreateManualMovement: false,
      sourceEventoDominio: "pastagem",
      quantityBase: null,
      createsStockMutation: false,
    });
  });
});
