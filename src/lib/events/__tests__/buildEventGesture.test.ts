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
      produtoRef: {
        id: "produto-1",
        nome: "Vacina A",
        categoria: "Vacina",
        origem: "catalogo",
      },
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
    expect(result.ops[1].record.payload).toMatchObject({
      produto_veterinario_id: "produto-1",
      produto_nome_catalogo: "Vacina A",
      produto_categoria: "Vacina",
      produto_origem: "catalogo",
    });
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

  it("builds sanitary alert with animal payload update", () => {
    const result = buildEventGesture({
      dominio: "alerta_sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      alertKind: "suspeita_aberta",
      payload: {
        kind: "suspeita_aberta",
        disease_name: "Suspeita sanitaria de notificacao obrigatoria",
      },
      animalPayload: {
        sanidade_alerta: {
          status: "suspeita_aberta",
          movement_blocked: true,
        },
      },
    });

    expect(result.ops.map((o) => o.table)).toEqual(["eventos", "animais"]);
    expect(result.ops[0].record.payload).toMatchObject({
      kind: "suspeita_aberta",
    });
    expect(result.ops[1].record).toEqual({
      id: "animal-1",
      payload: {
        sanidade_alerta: {
          status: "suspeita_aberta",
          movement_blocked: true,
        },
      },
    });
  });

  it("builds compliance event without animal or lote target", () => {
    const result = buildEventGesture({
      dominio: "conformidade",
      fazendaId: "farm-1",
      complianceKind: "checklist",
      payload: {
        official_item_code: "agua-equipamentos",
        status: "conforme",
      },
    });

    expect(result.ops).toHaveLength(1);
    expect(result.ops[0].table).toBe("eventos");
    expect(result.ops[0].record.payload).toMatchObject({
      official_item_code: "agua-equipamentos",
      status: "conforme",
    });
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

  it("rejects sanitary alert without animal target", () => {
    expect(() =>
      buildEventGesture({
        dominio: "alerta_sanitario",
        fazendaId: "farm-1",
        loteId: "lote-1",
        alertKind: "suspeita_aberta",
        animalPayload: {},
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
