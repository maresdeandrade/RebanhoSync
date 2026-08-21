import { describe, expect, it } from "vitest";

import { selectFutureSanitarySupplyAgenda } from "@/lib/reports/futureSanitarySupplyAgenda";
import type {
  AgendaItem,
  Animal,
  Lote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";

const farmId = "farm-1";

function animal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: "animal-1",
    fazenda_id: farmId,
    identificacao: "A-1",
    status: "ativo",
    lote_id: "lot-1",
    deleted_at: null,
    ...overrides,
  } as Animal;
}

function lot(overrides: Partial<Lote> = {}): Lote {
  return {
    id: "lot-1",
    fazenda_id: farmId,
    nome: "Lote 1",
    status: "ativo",
    deleted_at: null,
    ...overrides,
  } as Lote;
}

function legacy(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "legacy-1",
    fazenda_id: farmId,
    dominio: "sanitario",
    tipo: "vacinacao",
    status: "agendado",
    data_prevista: "2026-08-25",
    animal_id: "animal-1",
    lote_id: null,
    source_ref: null,
    payload: {
      produto_veterinario_id: "product-legacy",
      produto_nome_catalogo: "Produto legacy",
      quantityPerAnimal: 2,
    },
    protocol_item_version_id: null,
    deleted_at: null,
    ...overrides,
  } as AgendaItem;
}

function agendaV2(
  overrides: Partial<SanitarioAgendaLocalV2> = {},
): SanitarioAgendaLocalV2 {
  return {
    id: "agenda-v2-1",
    fazenda_id: farmId,
    status: "programada",
    dedup_key: "agenda-v2-1",
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-08-20T10:00:00.000Z",
    server_received_at: "2026-08-20T10:00:00.000Z",
    source_demand_key: null,
    preview_group_id: null,
    protocolo_id: "protocol-1",
    protocol_item_version_id: "protocol-item-1",
    protocol_item_snapshot: {},
    janela_inicio: "2026-08-25",
    janela_fim: null,
    data_programada: "2026-08-25",
    lote_id: null,
    produto_veterinario_id: "product-v2",
    produto_snapshot: { productName: "Produto v2" },
    produto_classe: null,
    acao_sanitaria: "vacinacao",
    execution_evento_id: null,
    metadata: { target: { scope: "animal", id: "animal-1" } },
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function relation(
  overrides: Partial<SanitarioAgendaAnimalLocalV2> = {},
): SanitarioAgendaAnimalLocalV2 {
  return {
    agenda_id: "agenda-v2-1",
    fazenda_id: farmId,
    animal_id: "animal-1",
    planned_status: "planejado",
    execution_evento_id: null,
    not_executed_reason: null,
    metadata: {},
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

function select(overrides: Partial<Parameters<typeof selectFutureSanitarySupplyAgenda>[0]> = {}) {
  return selectFutureSanitarySupplyAgenda({
    activeFarmId: farmId,
    legacyItems: [],
    agendaV2: [],
    agendaAnimalsV2: [],
    animals: [animal()],
    lots: [lot()],
    ...overrides,
  });
}

describe("selectFutureSanitarySupplyAgenda", () => {
  it("preserva agenda legacy aberta com produto e quantidade", () => {
    expect(select({ legacyItems: [legacy()] })).toMatchObject([
      {
        id: "legacy-1",
        productId: "product-legacy",
        productName: "Produto legacy",
        productUnit: "dose",
        quantityPerAnimal: 2,
        animalCount: 1,
      },
    ]);
  });

  it("projeta agenda v2 programada com identidade e produto factuais", () => {
    expect(select({ agendaV2: [agendaV2()] })).toMatchObject([
      {
        id: "sanitario-v2:agenda-v2-1",
        status: "agendado",
        dueDate: "2026-08-25",
        domain: "sanitario",
        productId: "product-v2",
        productName: "Produto v2",
      },
    ]);
  });

  it("preserva produto, unidade e quantidade ausentes sem fallbacks visuais ou executados", () => {
    const [item] = select({
      agendaV2: [
        agendaV2({
          produto_veterinario_id: null,
          produto_snapshot: {},
          produto_classe: "vacina_clostridial",
          metadata: {
            itemLabel: "Vacinação",
            dose_num: 2,
            execution_evento_id: "event-1",
          },
          protocol_item_snapshot: { dose: 1, doseUnit: "dose" },
        }),
      ],
    });

    expect(item).toMatchObject({
      productId: null,
      productName: null,
      productUnit: null,
      quantityPerAnimal: null,
    });
    expect(JSON.stringify(item)).not.toContain("Produto definido na execução");
  });

  it.each([
    ["executada", "concluido"],
    ["fechada", "concluido"],
    ["cancelada", "cancelado"],
    ["dispensada", "cancelado"],
  ] as const)("mapeia status final %s sem deixá-lo aberto", (status, expected) => {
    expect(select({ agendaV2: [agendaV2({ status })] })[0].status).toBe(expected);
  });

  it("conta somente relações planejadas, válidas e únicas", () => {
    const animals = [animal(), animal({ id: "animal-2" })];
    const [item] = select({
      agendaV2: [agendaV2()],
      animals,
      agendaAnimalsV2: [
        relation(),
        relation(),
        relation({ animal_id: "animal-2" }),
        relation({ animal_id: "animal-executed", planned_status: "executado" }),
        relation({ animal_id: "missing" }),
      ],
    });

    expect(item.animalCount).toBe(2);
  });

  it("conta lote inteiro somente com marcador explícito", () => {
    const animals = [animal(), animal({ id: "animal-2" })];
    const agendas = [
      agendaV2({
        id: "whole-lot",
        lote_id: "lot-1",
        metadata: { targetAnimalScope: "lote_sem_animais_explicitos" },
      }),
      agendaV2({ id: "lot-without-contract", lote_id: "lot-1", metadata: {} }),
    ];

    const result = select({ agendaV2: agendas, animals });
    expect(result[0].animalCount).toBe(2);
    expect(result[1].animalCount).toBeNull();
  });

  it("não fabrica demanda para lote inteiro comprovadamente vazio", () => {
    const result = select({
      agendaV2: [
        agendaV2({
          lote_id: "lot-1",
          metadata: { targetAnimalScope: "lote_sem_animais_explicitos" },
        }),
      ],
      animals: [],
    });

    expect(result).toEqual([]);
  });

  it("não fabrica demanda legacy para lote comprovadamente vazio", () => {
    const result = select({
      legacyItems: [legacy({ animal_id: null, lote_id: "lot-1" })],
      animals: [],
    });

    expect(result).toEqual([]);
  });

  it("isola todas as fontes por fazenda", () => {
    expect(
      select({
        legacyItems: [legacy({ fazenda_id: "farm-2" })],
        agendaV2: [agendaV2({ fazenda_id: "farm-2" })],
        agendaAnimalsV2: [relation({ fazenda_id: "farm-2" })],
        animals: [animal({ fazenda_id: "farm-2" })],
        lots: [lot({ fazenda_id: "farm-2" })],
      }),
    ).toEqual([]);
  });

  it("remove legacy somente quando há vínculo explícito com v2", () => {
    const result = select({
      legacyItems: [legacy({ source_ref: { agenda_v2_id: "agenda-v2-1" } })],
      agendaV2: [agendaV2()],
    });
    expect(result.map((item) => item.id)).toEqual(["sanitario-v2:agenda-v2-1"]);
    expect(result[0].possibleSourceOverlap).toBe(false);
  });

  it("mantém legacy semelhante sem vínculo explícito", () => {
    const result = select({
      legacyItems: [legacy()],
      agendaV2: [
        agendaV2({
          produto_veterinario_id: "product-legacy",
          produto_snapshot: { productName: "Produto legacy" },
        }),
      ],
    });
    expect(result.map((item) => item.id)).toEqual([
      "legacy-1",
      "sanitario-v2:agenda-v2-1",
    ]);
    expect(result.every((item) => item.possibleSourceOverlap)).toBe(true);
  });

  it("não sinaliza sobreposição para fontes legacy e v2 claramente distintas", () => {
    const result = select({
      legacyItems: [legacy()],
      agendaV2: [
        agendaV2({
          metadata: { target: { scope: "animal", id: "animal-2" } },
          produto_veterinario_id: "product-other",
          produto_snapshot: { productName: "Outro produto" },
        }),
      ],
      animals: [animal(), animal({ id: "animal-2" })],
    });

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.possibleSourceOverlap === false)).toBe(true);
  });
});
