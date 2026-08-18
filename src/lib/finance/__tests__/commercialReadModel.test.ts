import { describe, expect, it } from "vitest";
import { buildCommercialFinanceRows } from "../commercialReadModel";

describe("commercial finance read model", () => {
  it("shows individual and lot facts without requiring a financial link", () => {
    const rows = buildCommercialFinanceRows({
      events: [{ id: "purchase" }, { id: "sale" }],
      lots: [{ id: "lot-1", nome: "Lote Norte" }],
      details: [
        {
          evento_id: "purchase",
          operation_type: "compra",
          scope: "animal",
          occurred_at: "2026-08-12T12:00:00.000Z",
          lote_id: null,
          quantidade_animais: 1,
          animal_ids: ["animal-1"],
          contraparte_nome: "Fornecedor",
          valor_bruto: 1000,
          valor_liquido_derivado: 950,
          finance_transaction_id: null,
        },
        {
          evento_id: "sale",
          operation_type: "venda",
          scope: "lote",
          occurred_at: "2026-08-13T12:00:00.000Z",
          lote_id: "lot-1",
          quantidade_animais: 2,
          animal_ids: ["animal-1", "animal-2"],
          contraparte_nome: "Comprador",
          valor_bruto: 3000,
          valor_liquido_derivado: 2850,
          finance_transaction_id: "finance-1",
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      operationType: "venda",
      scope: "lote",
      lote: "Lote Norte",
      quantidade: 2,
      financeTransactionId: "finance-1",
    });
    expect(rows[1]).toMatchObject({
      operationType: "compra",
      scope: "animal",
      lote: "Sem lote",
      quantidade: 1,
      financeTransactionId: null,
    });
  });

  it("ignores orphan details instead of creating a parallel source of truth", () => {
    expect(
      buildCommercialFinanceRows({
        events: [],
        lots: [],
        details: [
          {
            evento_id: "orphan",
            operation_type: "compra",
            scope: "animal",
            occurred_at: "2026-08-13T12:00:00.000Z",
            lote_id: null,
            quantidade_animais: 1,
            animal_ids: ["animal-1"],
            contraparte_nome: null,
            valor_bruto: null,
            valor_liquido_derivado: null,
            finance_transaction_id: null,
          },
        ],
      }),
    ).toEqual([]);
  });
});
