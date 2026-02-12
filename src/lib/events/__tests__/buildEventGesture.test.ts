import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";

describe("buildEventGesture", () => {
  it("builds base + detail for pesagem", () => {
    const result = buildEventGesture({
      dominio: "pesagem",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      pesoKg: 333.5,
    });

    expect(result.ops).toHaveLength(2);
    expect(result.ops[0].table).toBe("eventos");
    expect(result.ops[1].table).toBe("eventos_pesagem");
    expect(result.ops[1].record.peso_kg).toBe(333.5);
  });

  it("builds sanitario with base + detail only", () => {
    const result = buildEventGesture({
      dominio: "sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      tipo: "vacinacao",
      produto: "Vacina A",
      protocoloItem: {
        id: "piv-1",
        intervalDays: 30,
        doseNum: 2,
        geraAgenda: true,
      },
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_sanitario",
    ]);
  });

  it("builds movimentacao with animal update (including null destination when allowed)", () => {
    const result = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-old",
      fromLoteId: "lote-old",
      toLoteId: null,
      allowDestinationNull: true,
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_movimentacao",
      "animais",
    ]);
    expect(result.ops[2].record.lote_id).toBeNull();
  });

  it("rejects movimentacao without destination when not allowed", () => {
    expect(() =>
      buildEventGesture({
        dominio: "movimentacao",
        fazendaId: "farm-1",
        animalId: "animal-1",
        fromLoteId: "lote-old",
        toLoteId: null,
      }),
    ).toThrow(EventValidationError);
  });

  it("builds financeiro venda with animal exit update", () => {
    const result = buildEventGesture({
      dominio: "financeiro",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      occurredAt: "2026-02-11T12:34:56.000Z",
      tipo: "venda",
      valorTotal: 2500,
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_financeiro",
      "animais",
    ]);
    expect(result.ops[2].record).toEqual({
      id: "animal-1",
      status: "vendido",
      data_saida: "2026-02-11",
      lote_id: null,
    });
  });

  it("allows financeiro venda without changing animal state when explicitly disabled", () => {
    const result = buildEventGesture({
      dominio: "financeiro",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      tipo: "venda",
      valorTotal: 2500,
      applyAnimalStateUpdate: false,
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_financeiro",
    ]);
  });
});
