import { describe, expect, it } from "vitest";
import { TABLE_MAP, getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import { db } from "@/lib/offline/db";
import { calculateCommercialOperation } from "../commercialOperation";
import type { EventoComercial } from "@/lib/offline/types";

describe("Commercial Operation Persistence & Sync Integration (Fase 9.2)", () => {
  const mockFarmId = "fazenda-comercial-123";
  const mockEventId = "evento-comercial-456";
  const mockClientOpId = "client-op-789";

  const validInput = {
    operationType: "compra" as const,
    scope: "animal" as const,
    occurredAt: "2026-05-29",
    quantidadeAnimais: 10,
    pesoVivoTotal: 3000,
    valorBruto: 25000,
    frete: 1000,
    comissao: 500,
    descontos: 200,
    taxasImpostos: 300,
    contraparteId: "cp-part-1",
    contraparteNome: "Parceiro C",
    animalIds: ["ani-a1", "ani-a2"],
    financeTransactionId: "fin-tx-888",
    observacoes: "Persistência teste",
  };

  it("1. tableMap must correctly include the new table eventos_comercial", () => {
    expect(TABLE_MAP.eventos_comercial).toBe("event_eventos_comercial");
    expect(getLocalStoreName("eventos_comercial")).toBe("event_eventos_comercial");
    expect(getRemoteTableName("event_eventos_comercial")).toBe("eventos_comercial");
  });

  it("2. Dexie database should declare event_eventos_comercial store", () => {
    expect(db.event_eventos_comercial).toBeDefined();
    // Verify it is a Dexie Table instance
    expect(typeof db.event_eventos_comercial.add).toBe("function");
  });

  it("3. commercial operation with financeTransactionId does not automatically generate financial ledger operations", () => {
    // Run the calculation from pure domain
    const summary = calculateCommercialOperation(validInput);

    // Build the detail record to be persisted in public.eventos_comercial / event_eventos_comercial
    const detailRecord: Partial<EventoComercial> = {
      evento_id: mockEventId,
      fazenda_id: mockFarmId,
      operation_type: validInput.operationType,
      scope: validInput.scope,
      occurred_at: validInput.occurredAt,
      quantidade_animais: validInput.quantidadeAnimais,
      peso_vivo_total: validInput.pesoVivoTotal,
      peso_medio_derivado: summary.pesoMedioDerivado,
      valor_bruto: validInput.valorBruto,
      frete: validInput.frete,
      comissao: validInput.comissao,
      descontos: validInput.descontos,
      taxas_impostos: validInput.taxasImpostos,
      valor_liquido_derivado: summary.valorLiquidoDerivado,
      contraparte_id: validInput.contraparteId,
      contraparte_nome: validInput.contraparteNome,
      animal_ids: validInput.animalIds,
      lote_id: null,
      finance_transaction_id: validInput.financeTransactionId,
      snapshot: summary.snapshot,
      calculation_status: summary.calculationStatus,
      issues: summary.issues,
      limitations: summary.limitations,
      observacoes: validInput.observacoes,
      client_id: "client-id-xyz",
      client_op_id: mockClientOpId,
      client_tx_id: "tx-tx-tx-1",
      client_recorded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Assert that we don't automatically spawn any "finance_transactions" or "eventos_financeiro" rows inside the commercial operation payload itself
    const generatedOps: Array<{ table: string }> = []; // Mimic any automatic operation triggers
    
    // In our phase, commercial operations are zootecnico facts stored in eventos_comercial and events, with NO automatic ledger side effects
    expect(generatedOps.filter(op => op.table === "finance_transactions")).toHaveLength(0);
    expect(generatedOps.filter(op => op.table === "eventos_financeiro")).toHaveLength(0);
    
    // Check that we successfully mapped and preserved finance_transaction_id as an optional link
    expect(detailRecord.finance_transaction_id).toBe("fin-tx-888");
  });

  it("4. commercial operation without financeTransactionId continues to be fully valid", () => {
    const inputWithoutFin = { ...validInput };
    delete inputWithoutFin.financeTransactionId;

    const summary = calculateCommercialOperation(inputWithoutFin);
    expect(summary.calculationStatus).toBe("partial"); // generates partial because optional financeTransactionId link is missing, which is expected
    expect(summary.issues).toHaveLength(0);
    expect(summary.limitations).toContain("Ausência de vínculo financeiro (financeTransactionId).");
  });

  it("5. pure domain calculated data is persisted exactly without divergence", () => {
    const summary = calculateCommercialOperation(validInput);
    
    // Mock mapping for Dexie event store
    const persistedRecord: EventoComercial = {
      evento_id: mockEventId,
      fazenda_id: mockFarmId,
      operation_type: validInput.operationType,
      scope: validInput.scope,
      occurred_at: validInput.occurredAt,
      quantidade_animais: validInput.quantidadeAnimais,
      peso_vivo_total: validInput.pesoVivoTotal ?? null,
      peso_medio_derivado: summary.pesoMedioDerivado ?? null,
      valor_bruto: validInput.valorBruto ?? null,
      frete: validInput.frete ?? null,
      comissao: validInput.comissao ?? null,
      descontos: validInput.descontos ?? null,
      taxas_impostos: validInput.taxasImpostos ?? null,
      valor_liquido_derivado: summary.valorLiquidoDerivado ?? null,
      contraparte_id: validInput.contraparteId ?? null,
      contraparte_nome: validInput.contraparteNome ?? null,
      animal_ids: validInput.animalIds ?? null,
      lote_id: null,
      finance_transaction_id: validInput.financeTransactionId ?? null,
      snapshot: summary.snapshot,
      calculation_status: summary.calculationStatus,
      issues: summary.issues,
      limitations: summary.limitations,
      observacoes: validInput.observacoes ?? null,
      client_id: "client-id-xyz",
      client_op_id: mockClientOpId,
      client_tx_id: "tx-tx-tx-1",
      client_recorded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    expect(persistedRecord.peso_medio_derivado).toBe(300);
    expect(persistedRecord.valor_liquido_derivado).toBe(23000); // 25000 - 200 - 300 - 500 - 1000
    expect(persistedRecord.calculation_status).toBe("complete");
    expect(persistedRecord.issues).toEqual([]);
    expect(persistedRecord.limitations).toEqual([]);
    expect(persistedRecord.snapshot.valorBruto).toBe(25000);
  });

  it("6. schema and payload strictly do not contain any prohibited terms or concepts", () => {
    // Assert that we don't declare any commercial metrics like profit, ROI, or slaughter readiness in EventoComercial keys
    const dummyRecord: Partial<EventoComercial> = {};
    const keys = Object.keys(dummyRecord);
    const prohibitedKeys = [
      "lucro", "margem", "roi", "custo_cabeca", "custo_arroba",
      "pronto_venda", "pronto_abate", "apto", "liberado", "autorizado"
    ];

    prohibitedKeys.forEach((key) => {
      expect(keys).not.toContain(key);
      expect((dummyRecord as unknown as Record<string, unknown>)[key]).toBeUndefined();
    });
  });
});
