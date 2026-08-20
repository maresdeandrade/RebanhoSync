import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@/lib/offline/types";
import {
  buildFinanceReversalOperation,
  getFinanceReversalId,
  parseFinanceReversal,
  validateFinanceReversal,
} from "../corrections";

const original = {
  id: "tx-original",
  fazenda_id: "farm-1",
  occurred_at: "2026-03-10T10:00:00.000Z",
  competence_date: "2026-03-01",
  due_date: "2026-03-15",
  paid_at: "2026-03-10T10:00:00.000Z",
  direction: "saida",
  status: "realizado",
  category_id: "cat-1",
  valor_total: 900,
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
  observacoes: "Original",
  client_id: "client-1",
  client_op_id: "op-original",
  client_tx_id: null,
  client_recorded_at: "2026-03-10T10:00:00.000Z",
  server_received_at: "2026-03-10T10:00:00.000Z",
  created_at: "2026-03-10T10:00:00.000Z",
  updated_at: "2026-03-10T10:00:00.000Z",
  deleted_at: null,
} as FinanceTransaction;

describe("Finance reversal contract", () => {
  it("builds an additive opposite realized transaction and never edits the original", () => {
    const operation = buildFinanceReversalOperation({
      original,
      occurredAt: "2026-03-20T12:00:00.000Z",
      reason: "Pagamento lançado em duplicidade",
    });

    expect(operation.action).toBe("INSERT");
    expect(operation.record.id).toBe(getFinanceReversalId(original.id));
    expect(operation.record.direction).toBe("entrada");
    expect(operation.record.status).toBe("realizado");
    expect(operation.record.valor_total).toBe(original.valor_total);
    expect(operation.record.paid_at).toBe("2026-03-20T12:00:00.000Z");
    expect(operation.record.origem).toBe("estorno");
    expect(operation.record.reverses_transaction_id).toBe(original.id);
    expect(original.status).toBe("realizado");
    expect(original.deleted_at).toBeNull();
  });

  it("is idempotent for the same original and rejects a second reversal branch", () => {
    const operation = buildFinanceReversalOperation({
      original,
      occurredAt: "2026-03-20T12:00:00.000Z",
      reason: "Correção",
    });
    const reversal = operation.record as FinanceTransaction;

    expect(validateFinanceReversal(original, [reversal])).toContain(
      "Este lançamento já possui estorno registrado.",
    );
    expect(getFinanceReversalId(original.id)).toBe(
      getFinanceReversalId(original.id),
    );
    expect(
      parseFinanceReversal(reversal.observacoes)?.original_transaction_id,
    ).toBe(original.id);
  });

  it("rejects forecast and invalid original values", () => {
    expect(
      validateFinanceReversal({ ...original, status: "previsto" }, []),
    ).toContain("Somente lançamentos realizados podem ser estornados.");
    expect(
      validateFinanceReversal({ ...original, valor_total: 0 }, []),
    ).toContain("O lançamento original precisa ter valor positivo e finito.");
  });
});
