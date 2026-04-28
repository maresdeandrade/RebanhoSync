import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { deriveAnimalTaxonomy } from "../taxonomy";

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function dateDaysAhead(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function buildAnimal(overrides: Partial<Animal>): Animal {
  const now = new Date().toISOString();
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: dateDaysAgo(500),
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

const fixtures = [
  buildAnimal({
    id: "f-bezerra",
    sexo: "F",
    data_nascimento: dateDaysAgo(10),
  }),
  buildAnimal({
    id: "f-novilha-prenhe",
    sexo: "F",
    data_nascimento: dateDaysAgo(500),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(250),
      },
      taxonomy_facts: {
        schema_version: 1,
        puberdade_confirmada: true,
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(90),
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-seca",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(180),
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(20),
        secagem_realizada: true,
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-parida",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(5),
        em_lactacao: true,
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-lactacao",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(120),
        em_lactacao: true,
      },
    },
  }),
  buildAnimal({
    id: "m-garrote",
    sexo: "M",
    data_nascimento: dateDaysAgo(400),
  }),
  buildAnimal({
    id: "m-touro",
    sexo: "M",
    data_nascimento: dateDaysAgo(1200),
    payload: {
      lifecycle: {
        destino_produtivo: "reprodutor",
      },
      male_profile: {
        status_reprodutivo: "apto",
      },
    },
  }),
  buildAnimal({
    id: "m-boi",
    sexo: "M",
    data_nascimento: dateDaysAgo(1200),
    payload: {
      lifecycle: {
        destino_produtivo: "abate",
      },
      taxonomy_facts: {
        schema_version: 1,
        castrado: true,
      },
    },
  }),
];

const expectedByAnimal = new Map([
  [
    "f-bezerra",
    {
      categoria_zootecnica: "bezerra",
      fase_veterinaria: "neonatal",
      estado_produtivo_reprodutivo: "vazia",
    },
  ],
  [
    "f-novilha-prenhe",
    {
      categoria_zootecnica: "novilha",
      fase_veterinaria: "gestante",
      estado_produtivo_reprodutivo: "prenhe",
    },
  ],
  [
    "f-vaca-seca",
    {
      categoria_zootecnica: "vaca",
      fase_veterinaria: "gestante",
      estado_produtivo_reprodutivo: "seca",
    },
  ],
  [
    "f-vaca-parida",
    {
      categoria_zootecnica: "vaca",
      fase_veterinaria: "puerperio",
      estado_produtivo_reprodutivo: "recem_parida",
    },
  ],
  [
    "f-vaca-lactacao",
    {
      categoria_zootecnica: "vaca",
      fase_veterinaria: "pubere",
      estado_produtivo_reprodutivo: "lactacao",
    },
  ],
  [
    "m-garrote",
    {
      categoria_zootecnica: "garrote",
      fase_veterinaria: "pos_desmama",
      estado_produtivo_reprodutivo: "inteiro",
    },
  ],
  [
    "m-touro",
    {
      categoria_zootecnica: "touro",
      fase_veterinaria: "pubere",
      estado_produtivo_reprodutivo: "reprodutor",
    },
  ],
  [
    "m-boi",
    {
      categoria_zootecnica: "boi_terminacao",
      fase_veterinaria: "pos_desmama",
      estado_produtivo_reprodutivo: "terminacao",
    },
  ],
]);

describe("canonical taxonomy projection contract", () => {
  it("matches canonical fixture scenarios without reading historical migrations", () => {
    for (const animal of fixtures) {
      const taxonomy = deriveAnimalTaxonomy(animal, { now: new Date() });
      const expected = expectedByAnimal.get(animal.id);

      expect(expected).toBeTruthy();
      expect(taxonomy).toMatchObject(expected ?? {});
    }
  });
});
