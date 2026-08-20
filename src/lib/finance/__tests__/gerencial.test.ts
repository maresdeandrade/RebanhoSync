import { describe, it, expect } from "vitest";
import {
  validateFinanceTransaction,
  calculateGerencialSummary,
  groupGerencialByCategory,
  groupGerencialByContraparte,
  groupGerencialByCentroCusto,
  parseOptionalFinanceNumber,
} from "../gerencial";
import type {
  FinanceTransaction,
  FinanceCategory,
  Contraparte,
  FinanceTransactionCentroCustoTipoEnum,
  FinanceTransactionDirectionEnum,
  FinanceTransactionStatusEnum,
} from "@/lib/offline/types";

describe("Gerencial Finance Core Domain Logic", () => {
  const mockFarmId = "farm-123";
  const mockCategoryId = "cat-999";

  const validTxBase: Partial<FinanceTransaction> = {
    fazenda_id: mockFarmId,
    category_id: mockCategoryId,
    occurred_at: "2026-05-29T12:00:00Z",
    direction: "saida",
    valor_total: 1500.5,
    status: "realizado",
  };

  describe("validateFinanceTransaction", () => {
    it("should accept a fully valid transaction", () => {
      const issues = validateFinanceTransaction(validTxBase);
      expect(issues).toHaveLength(0);
    });

    it.each([
      ["undefined", undefined, "valor_total é obrigatório."],
      ["null", null, "valor_total é obrigatório."],
      ["NaN", Number.NaN, "valor_total deve ser um número finito."],
      [
        "Infinity",
        Number.POSITIVE_INFINITY,
        "valor_total deve ser um número finito.",
      ],
      [
        "-Infinity",
        Number.NEGATIVE_INFINITY,
        "valor_total deve ser um número finito.",
      ],
      [
        "zero",
        0,
        "valor_total deve ser estritamente positivo (maior que zero).",
      ],
      [
        "negative",
        -50,
        "valor_total deve ser estritamente positivo (maior que zero).",
      ],
    ])("should reject %s valor_total", (_label, value, expectedIssue) => {
      const tx = {
        ...validTxBase,
        valor_total: value as number,
      };

      expect(validateFinanceTransaction(tx)).toContain(expectedIssue);
    });

    it("should accept a positive finite valor_total", () => {
      const issues = validateFinanceTransaction({
        ...validTxBase,
        valor_total: 0.01,
      });

      expect(issues).toHaveLength(0);
    });

    it("should reject an invalid occurred_at", () => {
      const issues = validateFinanceTransaction({
        ...validTxBase,
        occurred_at: "not-a-date",
      });

      expect(issues).toContain("occurred_at deve ser uma data válida.");
    });

    it("should validate optional quantity and unit price as finite values", () => {
      const invalidQuantity = validateFinanceTransaction({
        ...validTxBase,
        quantidade: Number.NaN,
      });
      const invalidUnitPrice = validateFinanceTransaction({
        ...validTxBase,
        valor_unitario: Number.POSITIVE_INFINITY,
      });
      const negativeUnitPrice = validateFinanceTransaction({
        ...validTxBase,
        valor_unitario: -0.01,
      });

      expect(invalidQuantity).toContain(
        "quantidade deve ser um número finito.",
      );
      expect(invalidUnitPrice).toContain(
        "valor_unitario deve ser um número finito.",
      );
      expect(negativeUnitPrice).toContain(
        "valor_unitario não pode ser negativo.",
      );
    });

    it("should reject non-positive quantity when it is informed", () => {
      expect(
        validateFinanceTransaction({ ...validTxBase, quantidade: 0 }),
      ).toContain(
        "quantidade deve ser estritamente positiva quando informada.",
      );
    });

    it("should reject invalid direction", () => {
      const txInvalidDir = {
        ...validTxBase,
        direction: "transito" as unknown as FinanceTransactionDirectionEnum,
      };
      const issues = validateFinanceTransaction(txInvalidDir);
      expect(issues).toContain("direction deve ser 'entrada' ou 'saida'.");
    });

    it("should reject invalid status", () => {
      const txInvalidStatus = {
        ...validTxBase,
        status: "pago" as unknown as FinanceTransactionStatusEnum,
      };
      const issues = validateFinanceTransaction(txInvalidStatus);
      expect(issues).toContain(
        "status deve ser 'previsto', 'realizado' ou 'cancelado'.",
      );
    });

    it("should validate optional cost center type", () => {
      const txCcValid = {
        ...validTxBase,
        centro_custo_tipo: "lote" as const,
        centro_custo_id: "lote-abc",
      };
      const txCcInvalid = {
        ...validTxBase,
        centro_custo_tipo:
          "outros_custos" as unknown as FinanceTransactionCentroCustoTipoEnum,
      };

      expect(validateFinanceTransaction(txCcValid)).toHaveLength(0);
      expect(validateFinanceTransaction(txCcInvalid)).toContain(
        "centro_custo_tipo inválido.",
      );
    });
  });

  describe("parseOptionalFinanceNumber", () => {
    it("keeps absence distinct from invalid and zero values", () => {
      expect(parseOptionalFinanceNumber("")).toBeUndefined();
      expect(parseOptionalFinanceNumber("   ")).toBeUndefined();
      expect(parseOptionalFinanceNumber("texto")).toBeNaN();
      expect(parseOptionalFinanceNumber("0")).toBe(0);
      expect(parseOptionalFinanceNumber("125.75")).toBe(125.75);
    });
  });

  describe("calculateGerencialSummary", () => {
    const transactions: FinanceTransaction[] = [
      {
        id: "tx-1",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "entrada",
        status: "realizado",
        paid_at: "2026-05-29T12:00:00Z",
        category_id: "cat-receita",
        valor_total: 10000,
        deleted_at: null,
      } as unknown as FinanceTransaction,
      {
        id: "tx-2",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "saida",
        status: "realizado",
        paid_at: "2026-05-29T12:00:00Z",
        category_id: "cat-despesa",
        valor_total: 3500.5,
        deleted_at: null,
      } as unknown as FinanceTransaction,
      {
        id: "tx-3",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "saida",
        status: "previsto",
        category_id: "cat-despesa",
        valor_total: 1200,
        deleted_at: null,
      } as unknown as FinanceTransaction,
      {
        id: "tx-4",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "entrada",
        status: "previsto",
        category_id: "cat-receita",
        valor_total: 5000,
        deleted_at: null,
      } as unknown as FinanceTransaction,
      {
        id: "tx-5",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "saida",
        status: "cancelado",
        category_id: "cat-despesa",
        valor_total: 99999,
        deleted_at: null,
      } as unknown as FinanceTransaction,
      {
        id: "tx-6",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "saida",
        status: "realizado",
        category_id: "cat-despesa",
        valor_total: 500,
        deleted_at: "2026-05-29T12:00:00Z",
      } as unknown as FinanceTransaction,
      {
        id: "tx-7",
        fazenda_id: mockFarmId,
        occurred_at: "2026-05-29T12:00:00Z",
        direction: "entrada",
        status: "realizado",
        category_id: "cat-receita",
        valor_total: Number.NaN,
        deleted_at: null,
      } as unknown as FinanceTransaction,
    ];

    it("counts only active transactions according to their explicit status", () => {
      const summary = calculateGerencialSummary(transactions);

      expect(summary.entradasRealizadas).toBe(10000);
      expect(summary.saidasRealizadas).toBe(3500.5);
      expect(summary.saldoRealizado).toBe(10000 - 3500.5);
      expect(summary.previstosAPagar).toBe(1200);
      expect(summary.previstosAReceber).toBe(5000);
    });
  });

  describe("groupings", () => {
    const categories: FinanceCategory[] = [
      { id: "cat-1", nome: "Sanidade" } as unknown as FinanceCategory,
      { id: "cat-2", nome: "Venda de Animais" } as unknown as FinanceCategory,
    ];

    const contrapartes: Contraparte[] = [
      { id: "cp-1", nome: "Fornecedor Vacinas" } as unknown as Contraparte,
      { id: "cp-2", nome: "Comprador Gado" } as unknown as Contraparte,
    ];

    const transactions: FinanceTransaction[] = [
      {
        id: "t1",
        category_id: "cat-1",
        contraparte_id: "cp-1",
        valor_total: 400,
        status: "realizado",
        centro_custo_tipo: "animal",
        centro_custo_id: "animal-cow1",
      } as unknown as FinanceTransaction,
      {
        id: "t2",
        category_id: "cat-2",
        contraparte_id: "cp-2",
        valor_total: 12000,
        status: "realizado",
        centro_custo_tipo: "lote",
        centro_custo_id: "lote-lotA",
      } as unknown as FinanceTransaction,
      {
        id: "t3",
        category_id: "cat-1",
        contraparte_id: null,
        valor_total: 100,
        status: "realizado",
        centro_custo_tipo: "pasto",
        centro_custo_id: "pasto-pastureX",
      } as unknown as FinanceTransaction,
      {
        id: "t4",
        category_id: "cat-1",
        contraparte_id: "cp-1",
        valor_total: 300,
        status: "realizado",
        centro_custo_tipo: "fazenda",
        centro_custo_id: null,
      } as unknown as FinanceTransaction,
      {
        id: "t5",
        category_id: "cat-1",
        contraparte_id: "cp-1",
        valor_total: 900,
        status: "previsto",
        centro_custo_tipo: "fazenda",
        centro_custo_id: null,
      } as unknown as FinanceTransaction,
      {
        id: "t6",
        category_id: "cat-2",
        contraparte_id: "cp-2",
        valor_total: 1000,
        status: "cancelado",
        centro_custo_tipo: "lote",
        centro_custo_id: "lote-lotA",
      } as unknown as FinanceTransaction,
      {
        id: "t7",
        category_id: "cat-1",
        contraparte_id: null,
        valor_total: 2000,
        status: "realizado",
        centro_custo_tipo: "pasto",
        centro_custo_id: "pasto-pastureX",
        deleted_at: "2026-05-29T12:00:00Z",
      } as unknown as FinanceTransaction,
    ];

    it("groups realized transactions by category only", () => {
      const grouped = groupGerencialByCategory(transactions, categories);
      expect(grouped).toEqual({
        Sanidade: 400 + 100 + 300,
        "Venda de Animais": 12000,
      });
    });

    it("groups realized transactions by counterpart only", () => {
      const grouped = groupGerencialByContraparte(transactions, contrapartes);
      expect(grouped).toEqual({
        "Fornecedor Vacinas": 400 + 300,
        "Comprador Gado": 12000,
        "Sem parceiro": 100,
      });
    });

    it("groups realized transactions by cost center only", () => {
      const grouped = groupGerencialByCentroCusto(transactions);
      expect(grouped).toEqual({
        "animal:animal-cow1": 400,
        "lote:lote-lotA": 12000,
        "pasto:pasto-pastureX": 100,
        fazenda: 300,
      });
    });
  });
});

describe("temporal finance summary", () => {
  it("separates cash from competence and due-date forecasts", async () => {
    const { calculateGerencialTemporalSummary } = await import("../gerencial");
    const base = {
      fazenda_id: "farm-1",
      category_id: "cat-1",
      quantidade: null,
      unidade: null,
      valor_unitario: null,
      contraparte_id: null,
      animal_id: null,
      lote_id: null,
      pasto_id: null,
      centro_custo_tipo: "fazenda",
      centro_custo_id: null,
      rateio_metodo: "direto",
      origem: "manual",
      source_event_id: null,
      source_inventory_movement_id: null,
      observacoes: null,
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-03-01T00:00:00.000Z",
      server_received_at: "2026-03-01T00:00:00.000Z",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      deleted_at: null,
    };
    const realizedWithoutPaidAt = {
      ...base,
      id: "tx-no-paid",
      occurred_at: "2026-03-10T00:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: null,
      paid_at: null,
      direction: "entrada",
      status: "realizado",
      valor_total: 100,
    };
    const realizedWithPaidAt = {
      ...base,
      id: "tx-paid",
      occurred_at: "2026-03-11T00:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: null,
      paid_at: "2026-03-11T00:00:00.000Z",
      direction: "saida",
      status: "realizado",
      valor_total: 80,
    };
    const forecast = {
      ...base,
      id: "tx-forecast",
      occurred_at: "2026-03-12T00:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: "2026-03-15",
      paid_at: null,
      direction: "entrada",
      status: "previsto",
      valor_total: 50,
    };

    const result = calculateGerencialTemporalSummary(
      [realizedWithoutPaidAt, realizedWithPaidAt, forecast] as never,
      new Date("2026-03-20T00:00:00.000Z"),
    );

    expect(result.entradasRealizadas).toBe(0);
    expect(result.saidasRealizadas).toBe(80);
    expect(result.entradasCompetencia).toBe(150);
    expect(result.saidasCompetencia).toBe(80);
    expect(result.previstosAReceber).toBe(50);
    expect(result.vencidosAReceber).toBe(50);
  });
});
