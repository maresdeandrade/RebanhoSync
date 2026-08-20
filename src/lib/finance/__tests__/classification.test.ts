import { describe, it, expect } from "vitest";
import {
  classifyLedgerTransaction,
  classifyFinancialEvent,
  classifyCommercialOperation,
} from "../classification";
import type {
  FinanceTransaction,
  Evento,
  EventoComercial,
  EventoFinanceiro,
} from "@/lib/offline/types";

describe("Financial Classification & Double Counting Prevention", () => {
  const baseTx: Partial<FinanceTransaction> = {
    id: "tx-1",
    status: "realizado",
    paid_at: "2026-05-30T10:00:00Z",
    competence_date: null,
    source_event_id: null,
  };

  const baseEvent: Partial<Evento> = {
    id: "evt-1",
    dominio: "comercial",
    payload: { kind: "commercial_operation_v2" },
  };

  describe("classifyLedgerTransaction", () => {
    it("classifies isolated manual cash transaction", () => {
      const tx = { ...baseTx } as FinanceTransaction;
      const result = classifyLedgerTransaction(tx);
      expect(result.sourceType).toBe("ledger_manual");
      expect(result.isRealizedCash).toBe(true);
      expect(result.includedInCashAggregate).toBe(true);
      expect(result.includedInCommercialAggregate).toBe(false);
    });

    it("classifies forecast transaction without cash inclusion", () => {
      const tx = {
        ...baseTx,
        status: "previsto",
        paid_at: null,
      } as FinanceTransaction;
      const result = classifyLedgerTransaction(tx);
      expect(result.isForecast).toBe(true);
      expect(result.isRealizedCash).toBe(false);
      expect(result.includedInCashAggregate).toBe(false);
    });
  });

  describe("classifyFinancialEvent", () => {
    it("classifies isolated financial event as cash but not commercial", () => {
      const evt = { id: "evt-fin", dominio: "financeiro" } as Evento;
      const det = { evento_id: "evt-fin" } as EventoFinanceiro;
      const result = classifyFinancialEvent(evt, det);

      expect(result.sourceType).toBe("evento_financeiro_isolated");
      expect(result.includedInCashAggregate).toBe(true);
      expect(result.includedInCommercialAggregate).toBe(false);
    });

    it("deduplicates linked financial event using the ledger transaction", () => {
      const evt = { id: "evt-fin", dominio: "financeiro" } as Evento;
      const det = { evento_id: "evt-fin" } as EventoFinanceiro;
      const tx = {
        ...baseTx,
        source_event_id: "evt-fin",
      } as FinanceTransaction;
      const result = classifyFinancialEvent(evt, det, tx);

      expect(result.sourceType).toBe("evento_financeiro_linked");
      expect(result.includedInCashAggregate).toBe(true);
      expect(result.limitations).toContain(
        "Efeito econômico deduplicado pelo lançamento financeiro vinculado.",
      );
    });
  });

  describe("classifyCommercialOperation", () => {
    const detBase: Partial<EventoComercial> = {
      evento_id: "evt-1",
      finance_transaction_id: null,
    };

    it("excludes simulation from all aggregates", () => {
      const evt = {
        ...baseEvent,
        payload: { kind: "commercial_simulation" },
      } as Evento;
      const det = { ...detBase } as EventoComercial;
      const result = classifyCommercialOperation(evt, det);

      expect(result.sourceType).toBe("comercial_simulation");
      expect(result.includedInCashAggregate).toBe(false);
      expect(result.includedInCommercialAggregate).toBe(false);
    });

    it("excludes legacy commercial from v2 aggregates", () => {
      const evt = { ...baseEvent, payload: { kind: "other" } } as Evento;
      const det = { ...detBase } as EventoComercial;
      const result = classifyCommercialOperation(evt, det);

      expect(result.sourceType).toBe("legacy_comercial");
      expect(result.includedInCommercialAggregate).toBe(false);
    });

    it("includes isolated commercial v2 in commercial aggregate but not cash", () => {
      const evt = { ...baseEvent } as Evento;
      const det = { ...detBase } as EventoComercial;
      const result = classifyCommercialOperation(evt, det);

      expect(result.sourceType).toBe("comercial_isolated");
      expect(result.isCommercialOperation).toBe(true);
      expect(result.includedInCommercialAggregate).toBe(true);
      expect(result.includedInCashAggregate).toBe(false);
      expect(result.limitations).toContain(
        "Operação comercial sem lançamento financeiro vinculado não entra no caixa.",
      );
    });

    it("includes linked commercial v2 in both aggregates based on the ledger transaction", () => {
      const evt = { ...baseEvent } as Evento;
      const det = {
        ...detBase,
        finance_transaction_id: "tx-1",
      } as EventoComercial;
      const tx = { ...baseTx, source_event_id: "evt-1" } as FinanceTransaction;
      const result = classifyCommercialOperation(evt, det, tx);

      expect(result.sourceType).toBe("comercial_linked");
      expect(result.includedInCommercialAggregate).toBe(true);
      expect(result.includedInCashAggregate).toBe(true);
      expect(result.isRealizedCash).toBe(true);
    });

    it("does not include linked commercial v2 in cash if the ledger transaction is only forecast", () => {
      const evt = { ...baseEvent } as Evento;
      const det = {
        ...detBase,
        finance_transaction_id: "tx-1",
      } as EventoComercial;
      const tx = {
        ...baseTx,
        status: "previsto",
        paid_at: null,
        source_event_id: "evt-1",
      } as FinanceTransaction;
      const result = classifyCommercialOperation(evt, det, tx);

      expect(result.sourceType).toBe("comercial_linked");
      expect(result.includedInCommercialAggregate).toBe(true);
      expect(result.includedInCashAggregate).toBe(false);
      expect(result.isForecast).toBe(true);
    });
  });
});

describe("explicit financial link resolution", () => {
  it("does not select one of multiple ledger records for the same source event", async () => {
    const { resolveFinancialEventLink } = await import("../classification");
    const result = resolveFinancialEventLink({
      fazendaId: "farm-1",
      eventId: "evt-1",
      transactions: [
        { id: "tx-1", fazenda_id: "farm-1", source_event_id: "evt-1" },
        { id: "tx-2", fazenda_id: "farm-1", source_event_id: "evt-1" },
      ] as FinanceTransaction[],
    });

    expect(result.transaction).toBeUndefined();
    expect(result.duplicate).toBe(true);
    expect(result.crossFarm).toBe(false);
  });

  it("flags an explicit source link that resolves only in another farm", async () => {
    const { resolveFinancialEventLink } = await import("../classification");
    const result = resolveFinancialEventLink({
      fazendaId: "farm-1",
      eventId: "evt-1",
      transactions: [
        { id: "tx-1", fazenda_id: "farm-2", source_event_id: "evt-1" },
      ] as FinanceTransaction[],
    });

    expect(result.transaction).toBeUndefined();
    expect(result.duplicate).toBe(false);
    expect(result.crossFarm).toBe(true);
  });
});
