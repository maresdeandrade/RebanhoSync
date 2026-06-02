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
      dose: 2,
      doseUnidade: "ml",
      viaAplicacao: "subcutanea",
      protocoloItem: {
        id: "piv-1",
        logicalItemKey: "11111111-1111-4111-8111-111111111111",
        version: 2,
        itemCode: "dose-2",
        snapshot: {
          id: "piv-1",
          logical_item_key: "11111111-1111-4111-8111-111111111111",
          version: 2,
          item_code: "dose-2",
        },
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
      protocol_item_version_id: "piv-1",
      protocol_item_logical_key: "11111111-1111-4111-8111-111111111111",
      protocol_item_version: 2,
      protocol_item_code: "dose-2",
      protocol_item_snapshot: {
        id: "piv-1",
        logical_item_key: "11111111-1111-4111-8111-111111111111",
        version: 2,
        item_code: "dose-2",
      },
    });
    expect(result.ops[1].record).toMatchObject({
      protocol_item_version_id: "piv-1",
      protocol_item_logical_key: "11111111-1111-4111-8111-111111111111",
      protocol_item_version: 2,
      protocol_item_snapshot: {
        id: "piv-1",
        logical_item_key: "11111111-1111-4111-8111-111111111111",
        version: 2,
        item_code: "dose-2",
      },
    });
  });

  it("preserva evento original ao criar complemento vinculado", () => {
    const result = buildEventGesture({
      dominio: "conformidade",
      fazendaId: "farm-1",
      occurredAt: "2026-06-01T12:00:00.000Z",
      corrigeEventoId: "evt-original",
      complianceKind: "checklist",
      observacoes: "Complemento auditavel",
      payload: {
        sanitary_correction: {
          schema_version: 1,
          evento_origem_id: "evt-original",
          corrige_evento_id: "evt-original",
          tipo_correcao: "complemento_rastreabilidade",
          motivo: "Complemento auditavel",
          payload_correcao: {},
          created_by: "user-1",
          created_at: "2026-06-01T12:00:00.000Z",
        },
      },
    });

    expect(result.ops).toHaveLength(1);
    expect(result.ops).toEqual([
      expect.objectContaining({
        table: "eventos",
        action: "INSERT",
        record: expect.objectContaining({
          corrige_evento_id: "evt-original",
        }),
      }),
    ]);
    expect(result.ops.some((op) => op.action === "UPDATE" && op.table === "eventos"))
      .toBe(false);
  });

  it("links sanitario event to existing clinical case", () => {
    const result = buildEventGesture({
      dominio: "sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      tipo: "medicamento",
      produto: "Medicamento A",
      sanitarioCaso: { action: "link", id: "caso-1" },
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_sanitario",
    ]);
    expect(result.ops[0].record.sanitario_caso_id).toBe("caso-1");
  });

  it("opens clinical case before linked sanitario event", () => {
    const result = buildEventGesture({
      dominio: "sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      tipo: "medicamento",
      produto: "Medicamento A",
      sanitarioCaso: {
        action: "open",
        tipo: "clinico",
        status: "em_acompanhamento",
        payload: { source: "registrar" },
      },
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "sanitario_casos",
      "eventos",
      "eventos_sanitario",
    ]);
    expect(result.ops[0].record).toMatchObject({
      animal_id: "animal-1",
      tipo: "clinico",
      status: "em_acompanhamento",
      payload: { source: "registrar" },
    });
    expect(result.ops[1].record.sanitario_caso_id).toBe(
      result.ops[0].record.id,
    );
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

  it("opens sanitary case before linked sanitary alert event", () => {
    const result = buildEventGesture({
      dominio: "alerta_sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      alertKind: "suspeita_aberta",
      payload: { kind: "suspeita_aberta" },
      animalPayload: {
        sanidade_alerta: {
          status: "suspeita_aberta",
          movement_blocked: true,
        },
      },
      sanitarioCaso: {
        action: "open",
        tipo: "notificavel",
        diseaseCode: "AFTOSA",
        diseaseName: "Febre aftosa",
        notificationType: "imediata",
        requiresImmediateNotification: true,
        movementBlocked: true,
        observacoes: "Sinais compativeis",
      },
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "sanitario_casos",
      "eventos",
      "animais",
    ]);
    expect(result.ops[0].record).toMatchObject({
      animal_id: "animal-1",
      tipo: "notificavel",
      status: "aberto",
      disease_code: "AFTOSA",
      disease_name: "Febre aftosa",
      notification_type: "imediata",
      movement_blocked: true,
    });
    expect(result.ops[1].record.sanitario_caso_id).toBe(
      result.ops[0].record.id,
    );
  });

  it("closes sanitary case in the same gesture as sanitary alert closure", () => {
    const result = buildEventGesture({
      dominio: "alerta_sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      occurredAt: "2026-05-20T12:00:00.000Z",
      alertKind: "suspeita_encerrada",
      payload: { kind: "suspeita_encerrada" },
      animalPayload: {
        sanidade_alerta: {
          status: "encerrada",
          movement_blocked: false,
        },
      },
      sanitarioCaso: {
        action: "close",
        id: "caso-1",
        status: "encerrado",
        closureReason: "descartada",
        observacoes: "Exame descartou suspeita",
        movementBlocked: false,
      },
    });

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "sanitario_casos",
      "animais",
    ]);
    expect(result.ops[0].record.sanitario_caso_id).toBe("caso-1");
    expect(result.ops[1].record).toMatchObject({
      id: "caso-1",
      status: "encerrado",
      closed_at: "2026-05-20T12:00:00.000Z",
      closure_reason: "descartada",
      movement_blocked: false,
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

  it("rejects sanitary alert without animal or lote target", () => {
    expect(() =>
      buildEventGesture({
        dominio: "alerta_sanitario",
        fazendaId: "farm-1",
        alertKind: "suspeita_aberta",
        animalPayload: {},
      }),
    ).toThrow(EventValidationError);
  });

  it("builds lote-linked sanitary alert without animal state update", () => {
    const result = buildEventGesture({
      dominio: "alerta_sanitario",
      fazendaId: "farm-1",
      loteId: "lote-1",
      alertKind: "suspeita_aberta",
      payload: { kind: "suspeita_aberta" },
      animalPayload: {},
    });

    expect(result.ops.map((op) => op.table)).toEqual(["eventos"]);
    expect(result.ops[0].record).toMatchObject({
      dominio: "alerta_sanitario",
      animal_id: null,
      lote_id: "lote-1",
    });
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

  it("builds comercial venda with economic snapshot and animal sale update", () => {
    const result = buildEventGesture({
      dominio: "comercial",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      occurredAt: "2026-02-11T12:00:00.000Z",
      operationType: "venda",
      scope: "animal",
      quantidadeAnimais: 1,
      valorBruto: 4500,
      contraparteId: "cp-1",
      contraparteNome: "Comprador A",
      animalIds: ["animal-1"],
      animalStatusSnapshot: "ativo",
      sociedadeSnapshot: [
        {
          sociedadeId: "soc-1",
          sociedadeAnimalId: "soc-animal-1",
          contraparteId: "cp-socio",
          contraparteNome: "Socio A",
          percentualFazenda: 60,
          percentualParceiro: 40,
          status: "ativa",
        },
      ],
    });

    expect(result.ops.map((op) => op.table)).toEqual([
      "eventos",
      "eventos_comercial",
      "animais",
    ]);
    expect(result.ops[1].record).toMatchObject({
      operation_type: "venda",
      contraparte_id: "cp-1",
      valor_bruto: 4500,
      titularidade_snapshot: {
        animal_status: "ativo",
      },
    });
    expect(result.ops[1].record.sociedade_snapshot).toHaveLength(1);
    expect(result.ops[2].record).toEqual({
      id: "animal-1",
      status: "vendido",
      data_saida: "2026-02-11",
      lote_id: null,
    });
  });

  it("rejects comercial venda without counterparty and sale value", () => {
    expect(() =>
      buildEventGesture({
        dominio: "comercial",
        fazendaId: "farm-1",
        animalId: "animal-1",
        operationType: "venda",
        scope: "animal",
        quantidadeAnimais: 1,
        animalStatusSnapshot: "ativo",
      }),
    ).toThrow(EventValidationError);
  });
});
