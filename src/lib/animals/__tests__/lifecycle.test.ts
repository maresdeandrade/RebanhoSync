import { describe, expect, it } from "vitest";
import type { Animal, AnimalLifeStageEnum } from "@/lib/offline/types";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import {
  buildAnimalLifecyclePayload,
  getPendingAnimalLifecycleTransitions,
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  inferAnimalLifeStage,
  resolveAnimalLifecycleSnapshot,
  summarizePendingAnimalLifecycleTransitions,
} from "../lifecycle";

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

describe("animal lifecycle", () => {
  it("classifies an unweaned calf as cria em aleitamento", () => {
    const recentDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: recentDate,
    });

    expect(inferAnimalLifeStage(animal)).toBe("cria_aleitamento");
  });

  it("suggests promotion to touro for an apt breeding male", () => {
    const animal = createAnimal({
      data_nascimento: "2023-01-01",
      payload: {
        lifecycle: {
          destino_produtivo: "reprodutor",
          modo_transicao: "manual",
          estagio_vida: "garrote",
        },
        male_profile: {
          status_reprodutivo: "apto",
        },
        weaning: {
          completed_at: "2023-09-01T12:00:00.000Z",
        },
      },
      papel_macho: "reprodutor",
      habilitado_monta: true,
    });

    const snapshot = resolveAnimalLifecycleSnapshot(
      animal,
      DEFAULT_FARM_LIFECYCLE_CONFIG,
    );

    expect(snapshot.currentStage).toBe("garrote");
    expect(snapshot.targetStage).toBe("touro");
    expect(snapshot.shouldSuggestTransition).toBe(true);
    expect(snapshot.canAutoApply).toBe(false);
  });

  it("allows hybrid auto-apply for age-only transitions", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2023-01-01",
      payload: {
        lifecycle: {
          modo_transicao: "hibrido",
          estagio_vida: "desmamado",
        },
        weaning: {
          completed_at: "2023-09-01T12:00:00.000Z",
        },
      },
    });

    const snapshot = resolveAnimalLifecycleSnapshot(animal);

    expect(snapshot.targetStage).toBe("vaca_adulta");
    expect(snapshot.canAutoApply).toBe(true);
  });

  it("writes lifecycle stage back into payload", () => {
    expect(
      buildAnimalLifecyclePayload({}, "novilha", "manual", "2026-04-04T12:00:00.000Z"),
    ).toMatchObject({
      lifecycle: {
        estagio_vida: "novilha",
        estagio_source: "manual",
        estagio_recorded_at: "2026-04-04T12:00:00.000Z",
      },
    });

    expect(getAnimalLifeStageLabel("terminacao")).toBe("Terminacao");
    expect(getPendingAnimalLifecycleKindLabel("decisao_estrategica")).toBe(
      "Decisao estrategica",
    );
  });

  it("builds a sorted queue of pending lifecycle transitions", () => {
    const items = getPendingAnimalLifecycleTransitions([
      createAnimal({
        id: "a-2",
        identificacao: "Z-200",
        sexo: "F",
        data_nascimento: "2023-01-01",
        payload: {
          lifecycle: {
            modo_transicao: "hibrido",
            estagio_vida: "desmamado",
          },
          weaning: {
            completed_at: "2023-09-01T12:00:00.000Z",
          },
        },
      }),
      createAnimal({
        id: "a-1",
        identificacao: "A-100",
        data_nascimento: "2023-01-01",
        payload: {
          lifecycle: {
            destino_produtivo: "reprodutor",
            modo_transicao: "manual",
            estagio_vida: "garrote",
          },
          male_profile: {
            status_reprodutivo: "apto",
          },
          weaning: {
            completed_at: "2023-09-01T12:00:00.000Z",
          },
        },
        papel_macho: "reprodutor",
        habilitado_monta: true,
      }),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]?.identificacao).toBe("A-100");
    expect(items[0]?.queueKind).toBe("decisao_estrategica");
    expect(items[1]?.queueKind).toBe("marco_biologico");
    expect(items[1]?.canAutoApply).toBe(true);

    expect(summarizePendingAnimalLifecycleTransitions(items)).toEqual({
      total: 2,
      strategic: 1,
      biological: 1,
      manual: 1,
      autoApply: 1,
    });
  });

  it("does not suggest same-stage no-op transitions", () => {
    // Vaca adulta -> Vaca adulta
    const vaca = createAnimal({
      sexo: "F",
      data_nascimento: "2015-01-01",
      payload: {
        lifecycle: {
          estagio_vida: "vaca_adulta",
        },
      },
    });
    const snapshotVaca = resolveAnimalLifecycleSnapshot(vaca);
    expect(snapshotVaca.shouldSuggestTransition).toBe(false);

    // Boi adulto -> Boi adulto
    const boi = createAnimal({
      sexo: "M",
      data_nascimento: "2015-01-01",
      payload: {
        lifecycle: {
          estagio_vida: "boi_adulto",
        },
      },
    });
    const snapshotBoi = resolveAnimalLifecycleSnapshot(boi);
    expect(snapshotBoi.shouldSuggestTransition).toBe(false);

    // Labels/cases equivalentes (com capitalização/acentuação diferente)
    const garrote = createAnimal({
      sexo: "M",
      data_nascimento: "2023-01-01",
      payload: {
        lifecycle: {
          estagio_vida: "Garrote" as AnimalLifeStageEnum,
        },
      },
    });
    const snapshotGarrote = resolveAnimalLifecycleSnapshot(garrote);
    expect(snapshotGarrote.shouldSuggestTransition).toBe(false);
  });

  it("does not suggest transitions when initial stage is unknown or missing from inferring context", () => {
    const animalSemData = createAnimal({
      sexo: "F",
      data_nascimento: null,
      payload: {},
    });
    const snapshot = resolveAnimalLifecycleSnapshot(animalSemData);
    expect(snapshot.shouldSuggestTransition).toBe(false);
  });

  it("preserves real transitions (Bezerra -> Novilha)", () => {
    const animal = createAnimal({
      sexo: "F",
      data_nascimento: "2024-05-01",
      payload: {
        lifecycle: {
          estagio_vida: "cria_aleitamento",
        },
      },
    });
    const snapshot = resolveAnimalLifecycleSnapshot(animal);
    expect(snapshot.shouldSuggestTransition).toBe(true);
    expect(snapshot.targetStage).toBe("novilha");
  });

  it("manages dedupKey logic properly", () => {
    const animals = [
      // Transição real
      createAnimal({
        id: "real-1",
        identificacao: "REAL-01",
        sexo: "F",
        data_nascimento: "2023-01-01",
        payload: {
          lifecycle: {
            estagio_vida: "desmamado",
          },
        },
      }),
      // Criação/Importação baseline
      createAnimal({
        id: "imported-1",
        identificacao: "IMP-01",
        sexo: "F",
        data_nascimento: "2023-01-01",
        payload: {
          import_source: "import.csv",
        },
      }),
    ];

    const transitions = getPendingAnimalLifecycleTransitions(animals);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.animalId).toBe("real-1");
    expect(transitions[0]?.dedupKey).toBe("stage_transition:real-1:desmamado:vaca_adulta");
  });
});
