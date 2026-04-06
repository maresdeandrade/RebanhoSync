import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import {
  buildAnimalTaxonomyFactsPayload,
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
  getCategoriaZootecnicaAliases,
  getEstadoProdutivoReprodutivoAlias,
} from "../taxonomy";

const NOW = new Date("2026-04-06T12:00:00.000Z");

function createAnimal(overrides: Partial<Animal>): Animal {
  const now = NOW.toISOString();
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2025-01-01",
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

describe("deriveAnimalTaxonomy", () => {
  it("classifies a young female calf as bezerra neonatal vazia", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2026-03-20",
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("bezerra");
    expect(snapshot.fase_veterinaria).toBe("neonatal");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("vazia");
  });

  it("classifies a pregnant heifer as novilha gestante prenhe", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2024-12-01",
      payload: buildAnimalTaxonomyFactsPayload(
        {
          weaning: {
            completed_at: "2025-07-10",
          },
        },
        {
          prenhez_confirmada: true,
          data_prevista_parto: "2026-06-15",
          puberdade_confirmada: true,
        },
        "reproduction_event",
      ),
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("novilha");
    expect(snapshot.fase_veterinaria).toBe("gestante");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("prenhe");
  });

  it("keeps an adult female without parto history as novilha", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2023-01-01",
      payload: {
        weaning: {
          completed_at: "2023-08-01",
        },
      },
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("novilha");
    expect(snapshot.fase_veterinaria).toBe("pos_desmama");
  });

  it("prioritizes seca over prenhe in the principal productive label", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2022-01-01",
      payload: buildAnimalTaxonomyFactsPayload(
        {
          weaning: {
            completed_at: "2022-08-01",
          },
        },
        {
          data_ultimo_parto: "2025-07-01",
          prenhez_confirmada: true,
          data_prevista_parto: "2026-04-20",
          secagem_realizada: true,
        },
        "reproduction_event",
      ),
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("vaca");
    expect(snapshot.fase_veterinaria).toBe("gestante");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("seca");
  });

  it("prioritizes recem_parida over lactacao after a recent parto", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2021-01-01",
      payload: buildAnimalTaxonomyFactsPayload(
        {},
        {
          data_ultimo_parto: "2026-04-01",
          em_lactacao: true,
        },
        "reproduction_event",
      ),
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("vaca");
    expect(snapshot.fase_veterinaria).toBe("puerperio");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("recem_parida");
  });

  it("labels a lactating cow outside the immediate postpartum window", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2021-01-01",
      payload: buildAnimalTaxonomyFactsPayload(
        {},
        {
          data_ultimo_parto: "2026-01-15",
          em_lactacao: true,
        },
        "reproduction_event",
      ),
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("vaca");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("lactacao");
  });

  it("classifies a male between weaning and adulthood as garrote", () => {
    const animal = createAnimal({
      sexo: "M",
      data_nascimento: "2025-01-01",
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("garrote");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("inteiro");
  });

  it("classifies an adult breeding male as touro", () => {
    const animal = createAnimal({
      sexo: "M",
      data_nascimento: "2023-01-01",
      payload: {
        lifecycle: {
          destino_produtivo: "reprodutor",
        },
        male_profile: {
          status_reprodutivo: "apto",
        },
      },
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("touro");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("reprodutor");
  });

  it("classifies a castrated male in finishing as boi_terminacao", () => {
    const animal = createAnimal({
      sexo: "M",
      data_nascimento: "2023-01-01",
      payload: buildAnimalTaxonomyFactsPayload(
        {
          lifecycle: {
            destino_produtivo: "abate",
          },
        },
        {
          castrado: true,
        },
      ),
    });

    const snapshot = deriveAnimalTaxonomy(animal, { now: NOW });

    expect(snapshot.categoria_zootecnica).toBe("boi_terminacao");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("terminacao");
  });

  it("reads parto and pregnancy context from joined reproduction events", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2022-01-01",
    });
    const contextMap = buildAnimalTaxonomyReproContextMap([
      {
        id: "evt-diag",
        fazenda_id: "farm-1",
        dominio: "reproducao",
        occurred_at: "2026-03-01T10:00:00.000Z",
        animal_id: animal.id,
        lote_id: null,
        source_task_id: null,
        source_tx_id: null,
        source_client_op_id: null,
        corrige_evento_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: "tx-1",
        client_recorded_at: NOW.toISOString(),
        server_received_at: NOW.toISOString(),
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
        deleted_at: null,
        details: {
          evento_id: "evt-diag",
          fazenda_id: "farm-1",
          tipo: "diagnostico",
          macho_id: "bull-1",
          payload: {
            schema_version: 1,
            resultado: "positivo",
            data_prevista_parto: "2026-05-10",
          },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: "tx-1",
          client_recorded_at: NOW.toISOString(),
          server_received_at: NOW.toISOString(),
          created_at: NOW.toISOString(),
          updated_at: NOW.toISOString(),
          deleted_at: null,
        },
      },
    ]);

    const snapshot = deriveAnimalTaxonomy(animal, {
      now: NOW,
      reproContext: contextMap.get(animal.id),
    });

    expect(snapshot.fase_veterinaria).toBe("gestante");
    expect(snapshot.estado_produtivo_reprodutivo).toBe("prenhe");
    expect(snapshot.facts.data_prevista_parto).toBe("2026-05-10");
  });
});

describe("taxonomy display aliases", () => {
  it("keeps aliases out of canonical values", () => {
    expect(getEstadoProdutivoReprodutivoAlias("pre_parto_imediato")).toBe(
      "Amojando",
    );
    expect(getEstadoProdutivoReprodutivoAlias("recem_parida")).toBe(
      "Vaca parida",
    );
    expect(getEstadoProdutivoReprodutivoAlias("lactacao")).toBe(
      "Vaca em lactacao",
    );
    expect(getCategoriaZootecnicaAliases("garrote")).toEqual([
      "Garrote",
      "Sobreano",
    ]);
  });
});
