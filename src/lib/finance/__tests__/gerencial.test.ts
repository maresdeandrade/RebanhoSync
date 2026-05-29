import { describe, it, expect } from "vitest";
import {
  validateFinanceTransaction,
  calculateGerencialSummary,
  groupGerencialByCategory,
  groupGerencialByContraparte,
  groupGerencialByCentroCusto,
} from "../gerencial";
import type {
  FinanceTransaction,
  FinanceCategory,
  Contraparte,
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

    it("should reject negative or zero valor_total", () => {
      const txZero = { ...validTxBase, valor_total: 0 };
      const txNegative = { ...validTxBase, valor_total: -50 };

      expect(validateFinanceTransaction(txZero)).toContain(
        "valor_total deve ser estritamente positivo (maior que zero)."
      );
      expect(validateFinanceTransaction(txNegative)).toContain(
        "valor_total deve ser estritamente positivo (maior que zero)."
      );
    });

    it("should reject invalid direction", () => {
      const txInvalidDir = { ...validTxBase, direction: "transito" as unknown as FinanceTransactionDirectionEnum };
      const issues = validateFinanceTransaction(txInvalidDir);
      expect(issues).toContain("direction deve ser 'entrada' ou 'saida'.");
    });

    it("should reject invalid status", () => {
      const txInvalidStatus = { ...validTxBase, status: "pago" as unknown as FinanceTransactionStatusEnum };
      const issues = validateFinanceTransaction(txInvalidStatus);
      expect(issues).toContain("status deve ser 'previsto', 'realizado' ou 'cancelado'.");
    });

    it("should validate optional cost center type", () => {
      const txCcValid = {
        ...validTxBase,
        centro_custo_tipo: "lote" as const,
        centro_custo_id: "lote-abc",
      };
      const txCcInvalid = {
        ...validTxBase,
        centro_custo_tipo: "outros_custos" as unknown as FinanceTransactionCentroCustoTipoEnum,
      };

      expect(validateFinanceTransaction(txCcValid)).toHaveLength(0);
      expect(validateFinanceTransaction(txCcInvalid)).toContain(
        "centro_custo_tipo inválido."
      );
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
    ];

    it("should calculate correct realizado entries, exits and balance, filtering out previstos and cancelados", () => {
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
    ];

    it("should group by category", () => {
      const grouped = groupGerencialByCategory(transactions, categories);
      expect(grouped).toEqual({
        Sanidade: 400 + 100 + 300,
        "Venda de Animais": 12000,
      });
    });

    it("should group by counterpart", () => {
      const grouped = groupGerencialByContraparte(transactions, contrapartes);
      expect(grouped).toEqual({
        "Fornecedor Vacinas": 400 + 300,
        "Comprador Gado": 12000,
        "Sem parceiro": 100,
      });
    });

    it("should group by cost center key", () => {
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
