import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import {
  getAnimalVisualProfile,
  isFemaleReproductionEligible,
} from "../presentation";

function createAnimal(overrides: Partial<Animal>): Animal {
  const now = new Date().toISOString();
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

describe("getAnimalVisualProfile", () => {
  it("maps female calves to bezerra with female tone", () => {
    const profile = getAnimalVisualProfile(
      createAnimal({
        sexo: "F",
        data_nascimento: new Date().toISOString().slice(0, 10),
      }),
      "Bezerro(a)",
    );

    expect(profile.label).toBe("Bezerra");
    expect(profile.icon).toBe("calf");
    expect(profile.toneClassName).toContain("rose");
    expect(profile.modifier).toBe("female");
    expect(profile.headClassName).toBe("h-4 w-4");
    expect(profile.frameClassName).toBe("h-8 w-8");
  });

  it("maps novilha label directly", () => {
    const profile = getAnimalVisualProfile(
      createAnimal({
        sexo: "F",
      }),
      "Novilha",
    );

    expect(profile.label).toBe("Novilha");
    expect(profile.icon).toBe("adult");
    expect(profile.headClassName).toBe("h-5 w-5");
  });

  it("falls back to touro for breeding male using the new profile payload", () => {
    const profile = getAnimalVisualProfile(
      createAnimal({
        sexo: "M",
        data_nascimento: "2021-01-01",
        payload: {
          lifecycle: {
            destino_produtivo: "reprodutor",
          },
          male_profile: {
            status_reprodutivo: "apto",
          },
        },
      }),
      null,
    );

    expect(profile.label).toBe("Touro");
    expect(profile.toneClassName).toContain("sky");
    expect(profile.modifier).toBe("weight");
    expect(profile.headClassName).toBe("h-5 w-6");
  });

  it("keeps compatibility with legacy male breeding fields", () => {
    const profile = getAnimalVisualProfile(
      createAnimal({
        sexo: "M",
        papel_macho: "reprodutor",
        habilitado_monta: true,
        data_nascimento: "2021-01-01",
      }),
      null,
    );

    expect(profile.label).toBe("Touro");
  });

  it("falls back to garrote for adult male sem destino de terminacao", () => {
    const profile = getAnimalVisualProfile(
      createAnimal({
        sexo: "M",
        data_nascimento: "2020-01-01",
      }),
      null,
    );

    expect(profile.label).toBe("Garrote");
  });

  it("flags only novilha and vaca as eligible for female reproduction", () => {
    expect(
      isFemaleReproductionEligible(
        createAnimal({
          sexo: "F",
          data_nascimento: new Date().toISOString().slice(0, 10),
        }),
        "Bezerro(a)",
      ),
    ).toBe(false);

    expect(
      isFemaleReproductionEligible(
        createAnimal({
          sexo: "F",
          data_nascimento: "2024-01-01",
        }),
        "Novilha",
      ),
    ).toBe(true);

    expect(
      isFemaleReproductionEligible(
        createAnimal({
          sexo: "F",
          data_nascimento: "2021-01-01",
        }),
        "Vaca",
      ),
    ).toBe(true);
  });
});
