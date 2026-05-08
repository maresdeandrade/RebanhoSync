import { describe, expect, it } from "vitest";

import { resolveRegistrarDisplayContext } from "@/pages/Registrar/helpers/registrarContextResolver";

describe("resolveRegistrarDisplayContext", () => {
  it("resolve contexto de animal", () => {
    const entries = resolveRegistrarDisplayContext({
      sourceTaskId: null,
      animalId: "animal-1",
      loteId: null,
      pastoId: null,
      records: {
        animal: {
          id: "animal-1",
          identificacao: "BR-001",
          status: "ativo",
        },
      },
    });

    expect(entries).toEqual([
      {
        kind: "animal",
        id: "animal-1",
        title: "Animal: BR-001",
        description: "Status ativo",
        found: true,
      },
    ]);
  });

  it("resolve contexto de lote", () => {
    const entries = resolveRegistrarDisplayContext({
      sourceTaskId: null,
      animalId: null,
      loteId: "lote-1",
      pastoId: null,
      records: {
        lote: {
          id: "lote-1",
          nome: "Lote A",
          status: "ativo",
        },
      },
    });

    expect(entries[0]).toMatchObject({
      kind: "lote",
      title: "Lote: Lote A",
      found: true,
    });
  });

  it("resolve contexto de pasto sem inferir outros alvos", () => {
    const entries = resolveRegistrarDisplayContext({
      sourceTaskId: null,
      animalId: null,
      loteId: null,
      pastoId: "pasto-1",
      records: {
        pasto: {
          id: "pasto-1",
          nome: "Piquete 1",
          tipo_pasto: "cultivado",
        },
        animal: {
          id: "animal-1",
          identificacao: "BR-001",
        },
        lote: {
          id: "lote-1",
          nome: "Lote A",
        },
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "pasto",
      title: "Pasto: Piquete 1",
      found: true,
    });
    expect(entries[0].description).toMatch(/nenhum animal e inferido/i);
  });

  it("resolve contexto de agenda", () => {
    const entries = resolveRegistrarDisplayContext({
      sourceTaskId: "agenda-1",
      animalId: null,
      loteId: null,
      pastoId: null,
      records: {
        agendaItem: {
          id: "agenda-1",
          dominio: "sanitario",
          tipo: "vacina_brucelose",
          status: "agendado",
          data_prevista: "2026-05-08",
        },
      },
    });

    expect(entries[0]).toMatchObject({
      kind: "agenda",
      title: "Agenda: vacina brucelose",
      description: "Status agendado | Previsto 2026-05-08",
      found: true,
    });
  });

  it("retorna estado seguro para contexto nao encontrado", () => {
    const entries = resolveRegistrarDisplayContext({
      sourceTaskId: null,
      animalId: "animal-invalido",
      loteId: "lote-invalido",
      pastoId: "pasto-invalido",
      records: {
        animal: null,
        lote: null,
        pasto: null,
      },
    });

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.title === "Contexto nao encontrado"))
      .toBe(true);
    expect(entries.every((entry) => entry.found === false)).toBe(true);
  });
});
