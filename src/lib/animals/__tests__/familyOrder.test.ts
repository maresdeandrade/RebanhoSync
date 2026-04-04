import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { buildAnimalFamilyRows } from "../familyOrder";

function createAnimal(overrides: Partial<Animal>): Animal {
  const now = "2026-04-01T10:00:00.000Z";
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2024-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: "tx-1",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

describe("buildAnimalFamilyRows", () => {
  it("keeps calf grouped under its mother and includes the mother when calf is visible", () => {
    const mother = createAnimal({
      id: "mae-1",
      identificacao: "MAT-001",
      sexo: "F",
      data_nascimento: "2022-01-01",
    });
    const calf = createAnimal({
      id: "cria-1",
      identificacao: "BZ-001",
      sexo: "F",
      mae_id: mother.id,
      data_nascimento: "2026-03-30",
    });
    const other = createAnimal({
      id: "outro-1",
      identificacao: "MAT-999",
      sexo: "F",
      data_nascimento: "2021-01-01",
    });

    const rows = buildAnimalFamilyRows([calf], [mother, calf, other]);

    expect(rows.map((row) => row.animal.id)).toEqual(["mae-1", "cria-1"]);
    expect(rows[0]?.depth).toBe(0);
    expect(rows[1]?.depth).toBe(1);
  });

  it("includes calves after a visible mother even if they do not match the base filter", () => {
    const mother = createAnimal({
      id: "mae-1",
      identificacao: "MAT-001",
      sexo: "F",
      data_nascimento: "2022-01-01",
    });
    const calfA = createAnimal({
      id: "cria-1",
      identificacao: "BZ-001",
      sexo: "F",
      mae_id: mother.id,
      data_nascimento: "2026-03-30",
    });
    const calfB = createAnimal({
      id: "cria-2",
      identificacao: "BZ-002",
      sexo: "M",
      mae_id: mother.id,
      data_nascimento: "2026-03-30",
    });

    const rows = buildAnimalFamilyRows([mother], [mother, calfB, calfA]);

    expect(rows.map((row) => row.animal.identificacao)).toEqual([
      "MAT-001",
      "BZ-001",
      "BZ-002",
    ]);
  });
});
