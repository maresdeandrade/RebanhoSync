import { describe, expect, it, vi } from "vitest";
import {
  buildFinancialTransaction,
  resolveFinancialTotalAmount,
} from "../transactions";

describe("finance transactions", () => {
  it("resolves total amount from unit price and quantity", () => {
    expect(
      resolveFinancialTotalAmount({
        quantity: 3,
        priceMode: "por_animal",
        unitAmount: 1500,
      }),
    ).toBe(4500);
  });

  it("builds purchase with one financial event, created animals and individual weights", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("animal-1")
      .mockReturnValueOnce("animal-2")
      .mockReturnValueOnce("event-financeiro")
      .mockReturnValueOnce("event-peso-1")
      .mockReturnValueOnce("event-peso-2");

    const result = buildFinancialTransaction({
      fazendaId: "farm-1",
      natureza: "compra",
      occurredAt: "2026-04-05T12:00:00.000Z",
      loteId: "lote-a",
      contraparteId: "cp-1",
      priceMode: "por_animal",
      unitAmount: 2500,
      weightMode: "individual",
      purchaseAnimals: [
        {
          localId: "draft-1",
          identificacao: "BZ-201",
          sexo: "F",
          dataNascimento: "2026-01-10",
          pesoKg: 182,
        },
        {
          localId: "draft-2",
          identificacao: "BZ-202",
          sexo: "M",
          dataNascimento: "2026-01-11",
          pesoKg: 190,
        },
      ],
    });

    expect(result.financialEventId).toBe("event-financeiro");
    expect(result.createdAnimalIds).toEqual(["animal-1", "animal-2"]);
    expect(
      result.ops.filter((op) => op.table === "eventos_financeiro"),
    ).toHaveLength(1);
    expect(
      result.ops.filter((op) => op.table === "animais" && op.action === "INSERT"),
    ).toHaveLength(2);
    expect(
      result.ops.filter((op) => op.table === "eventos_pesagem"),
    ).toHaveLength(2);

    const financialDetail = result.ops.find(
      (op) => op.table === "eventos_financeiro",
    );
    expect(financialDetail?.record.valor_total).toBe(5000);
  });

  it("builds sale with one financial event and marks all animals as sold", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("event-venda");

    const result = buildFinancialTransaction({
      fazendaId: "farm-1",
      natureza: "venda",
      occurredAt: "2026-04-05T12:00:00.000Z",
      loteId: "lote-a",
      contraparteId: "cp-9",
      priceMode: "por_lote",
      totalAmount: 7200,
      weightMode: "lote",
      lotWeightKg: 510,
      payload: {
        transito_sanitario: {
          enabled: true,
          purpose: "venda",
          gta_number: "GTA-2026-01",
        },
      },
      selectedAnimals: [
        { id: "animal-1", identificacao: "BR-001", loteId: "lote-a" },
        { id: "animal-2", identificacao: "BR-002", loteId: "lote-a" },
      ],
    });

    expect(
      result.ops.filter((op) => op.table === "eventos_financeiro"),
    ).toHaveLength(1);
    expect(
      result.ops.filter((op) => op.table === "animais" && op.action === "UPDATE"),
    ).toHaveLength(2);
    expect(
      result.ops.find(
        (op) => op.table === "eventos_financeiro",
      )?.record.valor_total,
    ).toBe(7200);
    expect(result.ops[0]?.record.payload).toMatchObject({
      transito_sanitario: {
        enabled: true,
        purpose: "venda",
        gta_number: "GTA-2026-01",
      },
    });
  });
});
