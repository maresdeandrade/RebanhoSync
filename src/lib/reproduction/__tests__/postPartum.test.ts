import { describe, expect, it } from "vitest";
import { buildPostPartumOps } from "../postPartum";

describe("buildPostPartumOps", () => {
  it("builds animal updates and neonatal weighing ops", () => {
    const result = buildPostPartumOps({
      fazendaId: "farm-1",
      mother: {
        id: "matriz-1",
        identificacao: "MAT-001",
      },
      calves: [
        {
          id: "cria-1",
          identificacao: "TEMP-1",
          nome: null,
          lote_id: "lote-matriz",
          pai_id: "touro-1",
          payload: {
            generated_from: "evento_parto",
            birth_event_id: "evento-1",
          },
        },
        {
          id: "cria-2",
          identificacao: "TEMP-2",
          nome: "Origem",
          lote_id: "lote-matriz",
          pai_id: null,
          payload: {
            generated_from: "evento_parto",
            birth_event_id: "evento-1",
            neonatal_setup: {
              started_at: "2026-04-01T10:00:00.000Z",
            },
          },
        },
      ],
      drafts: [
        {
          calfId: "cria-1",
          identificacao: "BZ-001",
          nome: "Aurora",
          loteId: "bezerreiro",
          pesoKg: "32,5",
          curaUmbigo: true,
        },
        {
          calfId: "cria-2",
          identificacao: "BZ-002",
          nome: "",
          loteId: null,
          pesoKg: "",
          curaUmbigo: false,
        },
      ],
      occurredAt: "2026-04-01T12:00:00.000Z",
      birthEventId: "evento-1",
    });

    expect(result.weighedCount).toBe(1);
    expect(result.umbigoCount).toBe(1);
    expect(result.agendaCount).toBe(9);
    expect(result.ops).toHaveLength(19);


    const firstAnimalUpdate = result.ops.find(op => op.table === "animais" && op.record.id === "cria-1");
    expect(firstAnimalUpdate).toMatchObject({

      table: "animais",
      action: "UPDATE",
      record: {
        id: "cria-1",
        identificacao: "BZ-001",
        nome: "Aurora",
        lote_id: "bezerreiro",
      },
    });
    expect(firstAnimalUpdate?.record.payload.neonatal_setup).toMatchObject({
      completed_at: "2026-04-01T12:00:00.000Z",
      birth_event_id: "evento-1",
      mother_id: "matriz-1",
      father_id: "touro-1",
      initial_lote_id: "bezerreiro",
      initial_weight_kg: 32.5,
      umbigo_curado_at: "2026-04-01T12:00:00.000Z",
    });


    const pesagemEvent = result.ops.find(op => op.table === "eventos" && op.record.dominio === "pesagem" && op.record.animal_id === "cria-1");
    expect(pesagemEvent).toMatchObject({

      table: "eventos",
      action: "INSERT",
      record: {
        dominio: "pesagem",
        animal_id: "cria-1",
        lote_id: "bezerreiro",
      },
    });

    const pesagemDetails = result.ops.find(op => op.table === "eventos_pesagem" && op.action === "INSERT");
    expect(pesagemDetails).toMatchObject({

      table: "eventos_pesagem",
      action: "INSERT",
      record: {
        peso_kg: 32.5,
      },
    });

    const sanitarioEvent = result.ops.find(op => op.table === "eventos" && op.record.dominio === "sanitario" && op.record.animal_id === "cria-1");
    expect(sanitarioEvent).toMatchObject({

      table: "eventos",
      action: "INSERT",
      record: {
        dominio: "sanitario",
        animal_id: "cria-1",
      },
    });

    const sanitarioDetails = result.ops.find(op => op.table === "eventos_sanitario" && op.action === "INSERT");
    expect(sanitarioDetails).toMatchObject({

      table: "eventos_sanitario",
      action: "INSERT",
      record: {
        produto: "Cura de umbigo",
        tipo: "medicamento",
      },
    });

    const secondAnimalUpdate = result.ops.findLast(
      (op) => op.table === "animais" && op.record.id === "cria-2",
    );

    expect(secondAnimalUpdate).toMatchObject({
      table: "animais",
      action: "UPDATE",
      record: {
        id: "cria-2",
        identificacao: "BZ-002",
        nome: null,
        lote_id: null,
      },
    });
    expect(secondAnimalUpdate?.record.payload.neonatal_setup).toMatchObject({
      started_at: "2026-04-01T10:00:00.000Z",
      completed_at: "2026-04-01T12:00:00.000Z",
    });

    const agendaOps = result.ops.filter((op) => op.table === "agenda_itens");
    expect(agendaOps).toHaveLength(9);
    expect(agendaOps[0]?.record).toMatchObject({
      animal_id: "cria-1",
      status: "agendado",
      source_kind: "automatico",
    });
    expect(agendaOps.map((op) => op.record.dedup_key)).not.toContain(
      "calf_journey:cria-1:cura_umbigo",
    );
  });
});
