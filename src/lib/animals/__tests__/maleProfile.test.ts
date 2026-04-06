import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import {
  buildAnimalClassificationPayload,
  getAnimalProductiveDestination,
  getAnimalTransitionMode,
  getLegacyMaleFields,
  getMaleReproductiveStatus,
  isAnimalBreedingEligible,
} from "../maleProfile";

function createAnimal(overrides: Partial<Animal>): Animal {
  const now = new Date().toISOString();
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "M",
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

describe("maleProfile helpers", () => {
  it("reads the new male profile and transition mode from payload", () => {
    const animal = createAnimal({
      payload: {
        lifecycle: {
          destino_produtivo: "reprodutor",
          modo_transicao: "hibrido",
        },
        male_profile: {
          status_reprodutivo: "apto",
        },
      },
    });

    expect(getAnimalProductiveDestination(animal)).toBe("reprodutor");
    expect(getMaleReproductiveStatus(animal)).toBe("apto");
    expect(getAnimalTransitionMode(animal)).toBe("hibrido");
    expect(isAnimalBreedingEligible(animal)).toBe(true);
  });

  it("falls back to the legacy fields when the payload is absent", () => {
    const animal = createAnimal({
      papel_macho: "reprodutor",
      habilitado_monta: false,
    });

    expect(getAnimalProductiveDestination(animal)).toBe("reprodutor");
    expect(getMaleReproductiveStatus(animal)).toBe("candidato");
    expect(isAnimalBreedingEligible(animal)).toBe(false);
  });

  it("maps the new profile back to legacy fields for compatibility", () => {
    expect(
      getLegacyMaleFields({
        sexo: "M",
        destinoProdutivo: "reprodutor",
        statusReprodutivoMacho: "apto",
      }),
    ).toEqual({
      papel_macho: "reprodutor",
      habilitado_monta: true,
    });

    expect(
      getLegacyMaleFields({
        sexo: "M",
        destinoProdutivo: "engorda",
        statusReprodutivoMacho: "inativo",
      }),
    ).toEqual({
      papel_macho: null,
      habilitado_monta: false,
    });
  });

  it("preserves unrelated payload keys when updating the classification payload", () => {
    const payload = buildAnimalClassificationPayload(
      {
        neonatal_setup: {
          mother_id: "animal-mae",
        },
      },
      {
        sexo: "M",
        destinoProdutivo: "reprodutor",
        statusReprodutivoMacho: "candidato",
        modoTransicao: "manual",
      },
    );

    expect(payload).toMatchObject({
      neonatal_setup: {
        mother_id: "animal-mae",
      },
      lifecycle: {
        destino_produtivo: "reprodutor",
        modo_transicao: "manual",
      },
      male_profile: {
        status_reprodutivo: "candidato",
      },
    });
  });
});
