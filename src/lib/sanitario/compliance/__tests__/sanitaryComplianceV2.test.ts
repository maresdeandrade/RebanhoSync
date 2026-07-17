import { describe, expect, it } from "vitest";

import type {
  Animal,
  Lote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { buildSanitaryComplianceV2 } from "@/lib/sanitario/compliance/sanitaryComplianceV2";
import type {
  SanitaryExecutedHistoryEventV2,
  SanitaryExecutedHistoryV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

const TODAY = "2026-07-04";

const protocol = (
  overrides: Partial<SanitaryProtocolV2ReadModel> = {},
): SanitaryProtocolV2ReadModel => ({
  id: "protocol-b19",
  familyCode: "brucelose_b19",
  name: "Brucelose B19",
  scope: "global",
  fazendaId: null,
  speciesScope: {},
  jurisdictionScope: {},
  legalStatus: "obrigatorio_norma",
  version: 1,
  status: "draft",
  approvalStatus: "draft",
  sourceRefsSnapshot: [],
  metadata: {},
  ...overrides,
});

const item = (
  overrides: Partial<SanitaryProtocolItemV2ReadModel> = {},
): SanitaryProtocolItemV2ReadModel => ({
  id: "item-b19",
  protocolId: "protocol-b19",
  logicalItemKey: "b19_femeas_3_8_meses",
  version: 1,
  itemStatus: "obrigatorio",
  actionType: "vacinacao",
  productRequirementKind: "product_class",
  productId: null,
  productClass: "vacina_brucelose_b19",
  productClassGroupId: null,
  eligibilityRule: {
    species: ["bovino", "bubalino"],
    sex: "femea",
    age_min_months: 3,
    age_max_months: 8,
  },
  operationalWindowRule: {},
  doseRule: {},
  routeRule: {},
  boosterRule: {},
  speciesAuthorization: {},
  sourceRefsByField: {},
  limitations: [],
  snapshotTemplate: {},
  allowsAgendaAuto: false,
  requiresMvResponsavel: true,
  status: "draft",
  ...overrides,
});

function animal(
  id: string,
  birthDate: string | null,
  lotId = "lot-1",
): Animal {
  return {
    id,
    fazenda_id: "farm-1",
    identificacao: `Animal ${id}`,
    nome: null,
    sexo: "F",
    status: "ativo",
    lote_id: lotId,
    data_nascimento: birthDate,
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
    client_id: "client",
    client_op_id: `op-${id}`,
    client_tx_id: null,
    client_recorded_at: `${TODAY}T00:00:00.000Z`,
    server_received_at: `${TODAY}T00:00:00.000Z`,
    created_at: `${TODAY}T00:00:00.000Z`,
    updated_at: `${TODAY}T00:00:00.000Z`,
    deleted_at: null,
  };
}

const catalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [protocol()],
  items: [item()],
  productClassGroups: [],
};

const lot = {
  id: "lot-1",
  fazenda_id: "farm-1",
  nome: "Bezerras",
  deleted_at: null,
} as Lote;

function historyEvent(
  eventId: string,
  source: SanitaryExecutedHistoryEventV2["source"],
  evidenceClass?: SanitaryExecutedHistoryEventV2["evidenceClass"],
): SanitaryExecutedHistoryEventV2 {
  return {
    eventId,
    protocolId: "protocol-b19",
    familyCode: "brucelose_b19",
    itemKey: "b19_femeas_3_8_meses",
    productClass: "vacina_brucelose_b19",
    productId: "product-b19",
    productName: "Vacina B19",
    executedAt: "2026-04-10T10:00:00.000Z",
    source,
    evidenceClass,
  };
}

function agenda(status: SanitarioAgendaLocalV2["status"] = "programada") {
  return {
    id: "agenda-b19",
    fazenda_id: "farm-1",
    status,
    dedup_key: "agenda-b19",
    client_id: "client",
    client_op_id: "agenda-op",
    client_tx_id: null,
    client_recorded_at: `${TODAY}T00:00:00.000Z`,
    server_received_at: `${TODAY}T00:00:00.000Z`,
    source_demand_key: null,
    preview_group_id: null,
    protocolo_id: "protocol-b19",
    protocol_item_version_id: "item-b19",
    protocol_item_snapshot: { itemKey: "b19_femeas_3_8_meses" },
    janela_inicio: TODAY,
    janela_fim: "2026-08-31",
    data_programada: "2026-07-20",
    lote_id: "lot-1",
    produto_veterinario_id: "product-b19",
    produto_snapshot: { productName: "Vacina B19" },
    produto_classe: "vacina_brucelose_b19",
    acao_sanitaria: "agenda_manual_sanitaria",
    execution_evento_id: null,
    metadata: {},
    created_at: `${TODAY}T00:00:00.000Z`,
    updated_at: `${TODAY}T00:00:00.000Z`,
    deleted_at: null,
  } satisfies SanitarioAgendaLocalV2;
}

function agendaAnimal(
  animalId: string,
  overrides: Partial<SanitarioAgendaAnimalLocalV2> = {},
): SanitarioAgendaAnimalLocalV2 {
  return {
    agenda_id: "agenda-b19",
    fazenda_id: "farm-1",
    animal_id: animalId,
    planned_status: "planejado",
    execution_evento_id: null,
    not_executed_reason: null,
    metadata: {},
    created_at: `${TODAY}T00:00:00.000Z`,
    updated_at: `${TODAY}T00:00:00.000Z`,
    ...overrides,
  };
}

function source(input: {
  animals?: Animal[];
  histories?: SanitaryExecutedHistoryV2[];
  agendas?: SanitarioAgendaLocalV2[];
  agendaAnimals?: SanitarioAgendaAnimalLocalV2[];
  catalogOverride?: SanitaryProtocolCatalogReadModelV2;
} = {}): SanitaryProtocolWindowSourceV2 {
  return {
    catalog: input.catalogOverride ?? catalog,
    animals: input.animals ?? [animal("young", "2026-03-01")],
    lots: [lot],
    executedHistory: input.histories ?? [],
    executedEvents: [],
    agendas: input.agendas ?? [],
    agendaAnimals: input.agendaAnimals ?? [],
  };
}

function row(input: Parameters<typeof source>[0] = {}) {
  return buildSanitaryComplianceV2({
    source: source(input),
    evaluatedAt: TODAY,
  }).rows[0];
}

describe("sanitaryComplianceV2", () => {
  it("evento executado compatível gera compliant", () => {
    expect(
      row({
        histories: [
          { animalId: "young", events: [historyEvent("event-1", "event")] },
        ],
      }),
    ).toMatchObject({
      status: "compliant",
      evidenceOrigin: "executed_event",
      eventId: "event-1",
    });
  });

  it("agenda futura explícita gera planned, nunca compliant", () => {
    expect(
      row({ agendas: [agenda()], agendaAnimals: [agendaAnimal("young")] }),
    ).toMatchObject({ status: "planned", agendaId: "agenda-b19", eventId: null });
  });

  it("histórico externo documentado compatível comprova conformidade", () => {
    expect(
      row({
        animals: [animal("adult", "2024-01-01")],
        histories: [
          {
            animalId: "adult",
            events: [historyEvent("document-1", "external_documented", "documented")],
          },
        ],
      }),
    ).toMatchObject({ status: "compliant", evidenceOrigin: "external_documented" });
  });

  it("declaração sem documento não gera compliant em B19 adulta", () => {
    expect(
      row({
        animals: [animal("adult", "2024-01-01")],
        histories: [
          {
            animalId: "adult",
            events: [historyEvent("declaration-1", "external_declared", "declared")],
          },
        ],
      }),
    ).toMatchObject({ status: "document_pending", evidenceOrigin: "declaration" });
  });

  it("B19 adulta sem documento gera document_pending", () => {
    expect(row({ animals: [animal("adult", "2024-01-01")] }).status).toBe(
      "document_pending",
    );
  });

  it("bezerra entre 3 e 8 meses sem histórico aparece como due_now", () => {
    expect(row().status).toBe("due_now");
  });

  it("item bloqueado gera blocked", () => {
    expect(
      row({
        catalogOverride: {
          ...catalog,
          protocols: [protocol({ legalStatus: "bloqueado" })],
          items: [item({ itemStatus: "bloqueado", status: "blocked" })],
        },
      }).status,
    ).toBe("blocked");
  });

  it("dados ausentes geram insufficient_data", () => {
    expect(row({ animals: [animal("unknown", null)] }).status).toBe(
      "insufficient_data",
    );
  });

  it("evento coletivo já expandido por animal aparece em cada vínculo", () => {
    const shared = historyEvent("lot-event", "event");
    const model = buildSanitaryComplianceV2({
      source: source({
        animals: [
          animal("young-1", "2026-03-01"),
          animal("young-2", "2026-03-01"),
        ],
        histories: [
          { animalId: "young-1", events: [shared] },
          { animalId: "young-2", events: [shared] },
        ],
      }),
      evaluatedAt: TODAY,
    });
    expect(model.rows).toHaveLength(2);
    expect(model.rows.every((entry) => entry.status === "compliant")).toBe(true);
  });

  it("agenda executada ou cancelada não aparece como planejada", () => {
    const executed = agendaAnimal("young", {
      planned_status: "executado",
      execution_evento_id: "event-1",
    });
    expect(row({ agendas: [agenda()], agendaAnimals: [executed] }).status).toBe(
      "due_now",
    );
    expect(
      row({ agendas: [agenda("cancelada")], agendaAnimals: [agendaAnimal("young")] })
        .status,
    ).toBe("due_now");
  });

  it("não cria efeitos operacionais nem libera operações", () => {
    const model = buildSanitaryComplianceV2({ source: source(), evaluatedAt: TODAY });
    expect(model).toMatchObject({
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
      allowsOperationalRelease: false,
    });
  });
});

