import { describe, expect, it } from "vitest";

import { buildAgendaRowMeta } from "@/pages/Agenda/helpers/rowMeta";
import type { AgendaRow } from "@/pages/Agenda/types";

function createRow(overrides: Partial<AgendaRow> = {}): AgendaRow {
  return {
    item: {
      id: "agenda-1",
      tipo: "vacinacao",
      dominio: "sanitario",
      status: "agendado",
      data_prevista: "2026-05-07",
      source_ref: {
        indicacao: "Dose estrategica",
      },
      payload: {},
    } as AgendaRow["item"],
    animal: {
      id: "animal-1",
      identificacao: "Matriz 001",
      sexo: "F",
    } as AgendaRow["animal"],
    lote: {
      id: "lote-1",
      nome: "Lote A",
    } as AgendaRow["lote"],
    animalNome: "Matriz 001",
    loteNome: "Lote A",
    idadeLabel: "6a 4m",
    syncStage: "synced",
    produtoLabel: "Vacina Brucelose",
    scheduleLabel: "Janela etaria oficial",
    scheduleMode: "janela_etaria",
    scheduleModeLabel: "Janela etaria",
    scheduleAnchor: "nascimento",
    scheduleAnchorLabel: "Nascimento",
    protocol: {
      id: "protocol-1",
      nome: "PNCEBT",
    } as AgendaRow["protocol"],
    protocolItem: {
      id: "protocol-item-1",
    } as AgendaRow["protocolItem"],
    priority: null,
    ...overrides,
  };
}

describe("buildAgendaRowMeta", () => {
  it("builds row metadata when animal, lot and protocol are available", () => {
    expect(buildAgendaRowMeta(createRow())).toEqual({
      dateLabel: "07/05/2026",
      statusLabel: "Agendado",
      statusTone: "warning",
      syncLabel: "Sincronizado",
      syncTone: "success",
      indicacao: "Dose estrategica",
      domainLabel: "Sanitário",
    });
  });

  it("keeps fallback metadata when animal, lot and protocol are absent", () => {
    const meta = buildAgendaRowMeta(
      createRow({
        item: {
          id: "agenda-1",
          tipo: "manejo",
          dominio: "custom_domain",
          status: "adiado",
          data_prevista: "2026-05-07",
          source_ref: {},
          payload: {},
        } as AgendaRow["item"],
        animal: null,
        lote: null,
        animalNome: "Sem animal",
        loteNome: "Sem lote",
        protocol: null,
        protocolItem: null,
        syncStage: "local_pending",
      }),
    );

    expect(meta).toMatchObject({
      statusLabel: "adiado",
      statusTone: "warning",
      syncLabel: "Salvo localmente",
      syncTone: "warning",
      indicacao: "Aplicação conforme protocolo",
      domainLabel: "custom_domain",
    });
  });

  it("keeps the dose fallback label when indication is absent", () => {
    const meta = buildAgendaRowMeta(
      createRow({
        item: {
          id: "agenda-1",
          tipo: "vacinacao",
          dominio: "sanitario",
          status: "concluido",
          data_prevista: "2026-05-07",
          source_ref: {
            dose_num: 2,
          },
          payload: {},
        } as AgendaRow["item"],
        syncStage: "synced_altered",
      }),
    );

    expect(meta).toMatchObject({
      statusLabel: "Concluído",
      statusTone: "success",
      syncLabel: "Confirmado com ajuste",
      syncTone: "warning",
      indicacao: "Dose 2",
      domainLabel: "Sanitário",
    });
  });

  it("preserves metadata key order expected by row cards", () => {
    expect(Object.keys(buildAgendaRowMeta(createRow()))).toEqual([
      "dateLabel",
      "statusLabel",
      "statusTone",
      "syncLabel",
      "syncTone",
      "indicacao",
      "domainLabel",
    ]);
  });

  it("returns the minimum visual metadata when optional row data is empty", () => {
    const meta = buildAgendaRowMeta(
      createRow({
        item: {
          id: "agenda-1",
          tipo: "vacinacao",
          dominio: "pesagem",
          status: "cancelado",
          data_prevista: "2026-05-07",
          source_ref: null,
          payload: null,
        } as AgendaRow["item"],
        scheduleLabel: null,
        scheduleMode: null,
        scheduleModeLabel: null,
        scheduleAnchor: null,
        scheduleAnchorLabel: null,
        priority: null,
      }),
    );

    expect(meta).toEqual({
      dateLabel: "07/05/2026",
      statusLabel: "Cancelado",
      statusTone: "danger",
      syncLabel: "Sincronizado",
      syncTone: "success",
      indicacao: "Aplicação conforme protocolo",
      domainLabel: "Pesagem",
    });
  });
});
