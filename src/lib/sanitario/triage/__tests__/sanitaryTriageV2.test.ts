import { describe, expect, it } from "vitest";
import type {
  Animal,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { buildSanitaryProtocolWindowV2, type SanitaryProtocolWindowSourceV2 } from "../../windows/sanitaryProtocolWindowsV2";
import { triageSanitaryProtocolIntervalV2 } from "../sanitaryTriageV2";

const protocol = (familyCode = "clostridioses"): SanitaryProtocolV2ReadModel => ({
  id: "protocol-1",
  familyCode,
  name: "Protocolo de teste",
  scope: "global",
  fazendaId: null,
  speciesScope: {},
  jurisdictionScope: {},
  legalStatus: "manual_only",
  version: 1,
  status: "active",
  approvalStatus: "approved",
  sourceRefsSnapshot: [],
  metadata: {},
});

function strongFieldSource(field: string) {
  return {
    kind: "norma_oficial" as const,
    scope: "global" as const,
    title: "Fonte oficial de teste",
    strength: "forte" as const,
    evidenceStatus: "SIM_NORMA" as const,
    fieldKeys: [field],
  };
}

const item = (
  overrides: Partial<SanitaryProtocolItemV2ReadModel> = {},
): SanitaryProtocolItemV2ReadModel => ({
  id: "item-1",
  protocolId: "protocol-1",
  logicalItemKey: "age-window-8-months",
  version: 1,
  itemStatus: "recomendado",
  actionType: "manejo_sanitario",
  productRequirementKind: "none",
  productId: null,
  productClass: null,
  productClassGroupId: null,
  eligibilityRule: {
    species: ["bovino"],
    age_min_months: 8,
    age_max_months: 8,
  },
  operationalWindowRule: {},
  doseRule: {},
  routeRule: {},
  boosterRule: {},
  speciesAuthorization: {},
  sourceRefsByField: {
    eligibility_rule: [strongFieldSource("eligibility_rule")],
    operational_window: [strongFieldSource("operational_window")],
    product_requirement: [strongFieldSource("product_requirement")],
  },
  limitations: [],
  snapshotTemplate: {},
  requiresMvResponsavel: false,
  status: "active",
  ...overrides,
});

function animal(id: string, birth: string | null, farmId = "farm-1"): Animal {
  return {
    id,
    fazenda_id: farmId,
    identificacao: id,
    nome: null,
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: birth,
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    rfid: null,
    especie: "bovino",
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "triage-test",
    client_op_id: `op-${id}`,
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  };
}

function source(input: {
  item?: SanitaryProtocolItemV2ReadModel;
  familyCode?: string;
  birth?: string | null;
  animals?: Animal[];
  agendas?: SanitarioAgendaLocalV2[];
  agendaAnimals?: SanitarioAgendaAnimalLocalV2[];
  executedHistory?: SanitaryProtocolWindowSourceV2["executedHistory"];
} = {}): SanitaryProtocolWindowSourceV2 {
  const selectedItem = input.item ?? item();
  const catalog: SanitaryProtocolCatalogReadModelV2 = {
    protocols: [protocol(input.familyCode)],
    items: [selectedItem],
    productClassGroups: [],
  };
  return {
    fazendaId: "farm-1",
    catalog,
    animals: input.animals ?? [animal("animal-1", input.birth === undefined ? "2025-09-01" : input.birth)],
    lots: [],
    executedHistory: input.executedHistory ?? [],
    executedEvents: [],
    agendas: input.agendas ?? [],
    agendaAnimals: input.agendaAnimals ?? [],
  };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function findEvaluation(
  result: ReturnType<typeof triageSanitaryProtocolIntervalV2>,
  animalId = "animal-1",
) {
  return result.evaluations.find((entry) => entry.animalId === animalId);
}

describe("triageSanitaryProtocolIntervalV2", () => {
  it.each([30, 60, 90])("classifica horizonte de %i dias sem confundir janela futura com elegibilidade atual", (days) => {
    const result = triageSanitaryProtocolIntervalV2({
      source: source(),
      startDate: "2026-01-01",
      endDate: addDays("2026-01-01", days - 1),
    });
    expect(findEvaluation(result)).toMatchObject({
      status: "not_yet_eligible",
      disposition: "future_opportunity",
      intervalStart: "2026-05-01",
      intervalEnd: "2026-05-31",
      planningAllowed: false,
    });
  });

  it("detecta oportunidade integral do 120º ao 150º dia embora o animal não seja elegível na data atual", () => {
    const currentSource = source();
    const current = buildSanitaryProtocolWindowV2({
      source: currentSource,
      protocolId: "protocol-1",
      itemId: "item-1",
      evaluatedAt: "2026-01-01",
    })!.rows[0];
    expect(current).toMatchObject({
      status: "not_yet_eligible",
      temporalWindow: {
        resolution: "determined",
        intervals: [{ startDate: "2026-05-01", endDate: "2026-05-31" }],
      },
    });

    const before = structuredClone(currentSource);
    const result = triageSanitaryProtocolIntervalV2({
      source: currentSource,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(result.evaluations).toHaveLength(1);
    expect(findEvaluation(result)).toMatchObject({
      status: "in_action_window",
      disposition: "opportunity_in_window",
      intersectsPeriod: true,
      intervalStart: "2026-05-01",
      intervalEnd: "2026-05-31",
      planningAllowed: false,
    });
    expect(result.summary.opportunity_in_window).toBe(1);
    expect(result.source).toEqual({
      type: "SanitaryProtocolWindowSourceV2",
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
    });
    expect(currentSource).toEqual(before);
  });

  it("reconhece janela parcialmente intersectada mesmo que a elegibilidade ainda não tenha começado no primeiro dia", () => {
    const result = triageSanitaryProtocolIntervalV2({
      source: source(),
      startDate: "2026-04-15",
      endDate: "2026-05-10",
    });
    expect(findEvaluation(result)).toMatchObject({
      status: "not_yet_eligible",
      disposition: "opportunity_in_window",
      intersectsPeriod: true,
      intervalStart: "2026-05-01",
      intervalEnd: "2026-05-31",
    });
  });

  it("trata limite superior aberto sem inventar uma data final", () => {
    const openEnded = item({
      eligibilityRule: { species: ["bovino"], age_min_months: 8 },
    });
    const result = triageSanitaryProtocolIntervalV2({
      source: source({ item: openEnded }),
      startDate: "2026-05-01",
      endDate: "2026-06-30",
    });
    expect(findEvaluation(result)).toMatchObject({
      disposition: "opportunity_in_window",
      temporalWindow: { structure: "open", intervals: [{ startDate: "2026-05-01" }] },
      intervalStart: "2026-05-01",
      intervalEnd: undefined,
    });
  });

  it("não determina oportunidade quando falta a âncora de nascimento", () => {
    const result = triageSanitaryProtocolIntervalV2({
      source: source({ birth: null }),
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(findEvaluation(result)).toMatchObject({
      status: "insufficient_data",
      disposition: "insufficient_data",
      intersectsPeriod: false,
      temporalWindow: { resolution: "insufficient", intervals: [] },
      planningAllowed: false,
    });
  });

  it("classifica Agenda existente sem materializar uma nova", () => {
    const agenda = {
      id: "agenda-1",
      fazenda_id: "farm-1",
      status: "programada",
      protocolo_id: "protocol-1",
      protocol_item_snapshot: { itemKey: "age-window-8-months" },
      data_programada: "2026-05-15",
      execution_evento_id: null,
      deleted_at: null,
      metadata: {},
    } as unknown as SanitarioAgendaLocalV2;
    const target = {
      agenda_id: "agenda-1",
      animal_id: "animal-1",
      fazenda_id: "farm-1",
    } as SanitarioAgendaAnimalLocalV2;
    const result = triageSanitaryProtocolIntervalV2({
      source: source({ agendas: [agenda], agendaAnimals: [target] }),
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(findEvaluation(result)).toMatchObject({
      disposition: "scheduled",
      alreadyPlanned: true,
      plannedFor: "2026-05-15",
      planningAllowed: false,
    });
  });

  it("preserva Evento factual concluído como evidência histórica", () => {
    const b19Protocol = { ...protocol("brucelose_b19"), id: "protocol-b19" };
    const b19Item = item({
      id: "item-b19",
      protocolId: "protocol-b19",
      logicalItemKey: "b19_femeas_3_8_meses",
      productRequirementKind: "product_class",
      productClass: "vacina_brucelose_b19",
      eligibilityRule: {
        species: ["bovino", "bubalino"],
        sex: "femea",
        age_min_months: 3,
        age_max_months: 8,
      },
    });
    const factualHistory = [
      {
        animalId: "animal-1",
        events: [
          {
            eventId: "event-b19",
            protocolId: "protocol-b19",
            familyCode: "brucelose_b19",
            itemKey: "b19_femeas_3_8_meses",
            executedAt: "2026-01-01",
            source: "external_documented",
            evidenceClass: "documented",
            evidenceReference: "certificado-b19",
            evidenceCoveredFields: ["protocol_item_completion"],
          },
        ],
      },
    ] as unknown as SanitaryProtocolWindowSourceV2["executedHistory"];
    const b19Source = source({
      item: b19Item,
      familyCode: b19Protocol.familyCode,
      birth: "2025-09-01",
      executedHistory: factualHistory,
    });
    b19Source.catalog.protocols = [b19Protocol];
    const result = triageSanitaryProtocolIntervalV2({
      source: b19Source,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(findEvaluation(result)).toMatchObject({
      status: "completed",
      disposition: "factual_completed",
      planningAllowed: false,
    });
  });

  it("mantém restrições técnicas no resultado da triagem", () => {
    const restricted = item({ itemStatus: "bloqueado" });
    const result = triageSanitaryProtocolIntervalV2({
      source: source({ item: restricted }),
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(findEvaluation(result)).toMatchObject({
      disposition: "restricted",
      blockers: expect.arrayContaining([expect.stringMatching(/Item sem liberação/)]),
      planningAllowed: false,
    });
  });

  it("avalia a fazenda do source sem incluir animais de outro tenant e não altera o source", () => {
    const farmSource = source({
      animals: [
        animal("animal-1", "2025-09-01", "farm-1"),
        animal("animal-2", "2025-09-01", "farm-1"),
        animal("foreign-animal", "2025-09-01", "farm-2"),
      ],
    });
    const before = structuredClone(farmSource);
    const result = triageSanitaryProtocolIntervalV2({
      source: farmSource,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    expect(result.evaluations.map((entry) => entry.animalId)).toEqual(["animal-1", "animal-2"]);
    expect(farmSource).toEqual(before);
    expect(result.source.createsAgenda).toBe(false);
    expect(result.source.createsEvent).toBe(false);
  });

  it("rejeita datas impossíveis e intervalos invertidos", () => {
    expect(() =>
      triageSanitaryProtocolIntervalV2({
        source: source(),
        startDate: "2026-02-30",
        endDate: "2026-03-31",
      }),
    ).toThrow("Período sanitário inválido.");
    expect(() =>
      triageSanitaryProtocolIntervalV2({
        source: source(),
        startDate: "2026-06-01",
        endDate: "2026-05-31",
      }),
    ).toThrow("Período sanitário inválido.");
  });
});
