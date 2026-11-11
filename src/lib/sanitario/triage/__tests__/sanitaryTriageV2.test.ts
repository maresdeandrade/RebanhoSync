import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { createManualSanitaryAgendaV2 } from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
import { executeSanitaryAgendaV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { getAnimalSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";
import {
  resolveSanitaryTriagePlanningRowsV2,
  triageSanitaryProtocolIntervalV2,
} from "../sanitaryTriageV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({
  getCurrentLocalReadOwnership: vi.fn(async () => ({
    status: "OWNED",
    currentUserId: "triage-owner",
  })),
}));
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "http://127.0.0.1:56421" },
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

let integratedFixtureActive = false;
let sanitaryPushEnabled = false;

afterEach(async () => {
  if (!integratedFixtureActive) return;
  try {
    if (sanitaryPushEnabled) setSanitarioV2PushEnabled(false, "local");
  } finally {
    integratedFixtureActive = false;
    sanitaryPushEnabled = false;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await db.open();
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.queue_ops.clear(),
      db.queue_gestures.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.event_eventos_animais.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.state_animais.clear(),
      db.local_sanitario_participacoes.clear(),
      db.local_ownership.clear(),
      db.sync_sanitario_v2_cutovers.clear(),
    ]);
  }
});

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

  it("preserva Agenda fora do período sem classificá-la como programada no intervalo", () => {
    const agenda = {
      id: "agenda-outside-period",
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
      agenda_id: "agenda-outside-period",
      animal_id: "animal-1",
      fazenda_id: "farm-1",
    } as SanitarioAgendaAnimalLocalV2;
    const result = triageSanitaryProtocolIntervalV2({
      source: source({ agendas: [agenda], agendaAnimals: [target] }),
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(findEvaluation(result)).toMatchObject({
      alreadyPlanned: true,
      plannedFor: "2026-05-15",
      planningAllowed: false,
    });
    expect(findEvaluation(result)?.disposition).not.toBe("scheduled");
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

  it("resolve seleção de triagem para linhas canônicas sem habilitar escrita no resultado derivado", () => {
    const currentSource = source();
    const result = triageSanitaryProtocolIntervalV2({
      source: currentSource,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    const evaluation = findEvaluation(result)!;
    const rows = resolveSanitaryTriagePlanningRowsV2({
      source: currentSource,
      evaluatedAt: result.evaluatedAt,
      evaluations: [evaluation],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      animalId: evaluation.animalId,
      protocolId: evaluation.protocolId,
      itemId: evaluation.itemId,
    });
    expect(result.source.createsAgenda).toBe(false);
  });

  it("percorre triagem, writer manual, fato V3 e leitura local mantendo a identidade da Agenda", async () => {
    integratedFixtureActive = true;
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:56421");
    vi.stubEnv("VITE_BACKEND_ENV", "development");
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    await db.open();
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.queue_ops.clear(),
      db.queue_gestures.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.event_eventos_animais.clear(),
      db.state_insumo_movimentacoes.clear(),
      db.state_animais.clear(),
      db.local_sanitario_participacoes.clear(),
      db.local_ownership.clear(),
      db.sync_sanitario_v2_cutovers.clear(),
    ]);
    const cutoverAt = new Date().toISOString();
    await db.local_ownership.put({
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: "triage-owner",
      updated_at: cutoverAt,
    });
    await db.sync_sanitario_v2_cutovers.put({
      key: "farm-1:3",
      fazenda_id: "farm-1",
      contract_version: 3,
      status: "APPLIED",
      prepared_at: cutoverAt,
      applying_at: null,
      applied_at: cutoverAt,
      failed_at: null,
      last_error: null,
      updated_at: cutoverAt,
    });
    sanitaryPushEnabled = true;
    setSanitarioV2PushEnabled(true, "local");

    const animalId = "11111111-1111-4111-8111-111111111111";
    const currentSource = source({
      animals: [animal(animalId, "2025-09-01")],
    });
    const result = triageSanitaryProtocolIntervalV2({
      source: currentSource,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    const evaluation = findEvaluation(result, animalId)!;
    const row = resolveSanitaryTriagePlanningRowsV2({
      source: currentSource,
      evaluatedAt: result.evaluatedAt,
      evaluations: [evaluation],
    })[0];

    expect(evaluation.disposition).toBe("opportunity_in_window");
    expect(row.canSelect).toBe(true);
    const created = await createManualSanitaryAgendaV2({
      target: { scope: "animal", id: row.animalId, fazendaId: currentSource.fazendaId },
      source: {
        kind: "sanitary_precheck_preview_v2",
        protocolId: row.protocolId,
        protocolItemVersionId: undefined,
        actionType: "manejo_sanitario",
        familyCode: currentSource.catalog.protocols[0].familyCode,
        itemKey: row.itemKey,
        itemLabel: row.itemLabel,
        protocolName: row.protocolLabel,
        precheckStatus: row.status,
        reasons: row.precheck.reasons,
        blockers: row.blockers,
        warnings: row.warnings,
        productRequirementKind: row.precheck.productRequirementKind,
        productClass: row.precheck.productClass,
        productClassGroupId: row.precheck.productClassGroupId,
        productClassGroupName: row.precheck.productClassGroupName,
      },
      plannedFor: "2026-05-10",
      clientOpId: "77777777-7777-4777-8777-777777777777",
      confirmed: true,
      syncContext: { clientId: "triage-integrated", projectRef: "local" },
    });

    expect(created).toMatchObject({ status: "scheduled", created: true, createsEvent: false, createsStockMovement: false, createsActiveWithdrawal: false });
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);

    const selectedAnimal = currentSource.animals.find(
      (entry) => entry.id === row.animalId,
    );
    expect(selectedAnimal).toBeDefined();
    await db.state_animais.put(selectedAnimal!);
    const agendaId = created.agendaId;
    const request = {
      fazendaId: currentSource.fazendaId,
      agendaId,
      animalIds: [row.animalId],
      clientOpId: "88888888-8888-4888-8888-888888888888",
      executedAt: "2026-10-30T23:37:00-03:00",
      registrationMode: "executed_fact" as const,
      confirmation: { userConfirmedExecution: true as const },
      sync: { clientId: "triage-integrated", projectRef: "local" },
    };
    const execution = await executeSanitaryAgendaV2(request);
    const replay = await executeSanitaryAgendaV2(request);
    const factualEvent = await db.event_eventos.get(execution.eventId);
    const factualDetail = await db.event_eventos_sanitario.get(
      execution.eventId,
    );
    const queueOperation = (await db.queue_ops.toArray()).find(
      (operation) =>
        operation.record.payload.event?.id === execution.eventId,
    );

    expect(execution).toMatchObject({
      agendaId,
      agendaStatus: "open",
      createsEvent: true,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
    expect(replay.eventId).toBe(execution.eventId);
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(2);
    expect(factualEvent).toMatchObject({
      id: execution.eventId,
      source_sanitario_agenda_v2_id: agendaId,
      occurred_at: "2026-10-31T02:37:00.000Z",
      occurred_on: "2026-10-30",
    });
    expect(factualEvent?.payload.agenda_id).toBe(agendaId);
    expect(queueOperation?.record.payload.event).toMatchObject({
      id: execution.eventId,
      source_sanitario_agenda_v2_id: agendaId,
    });
    expect(
      await db.event_eventos_animais
        .where("evento_id")
        .equals(execution.eventId)
        .toArray(),
    ).toMatchObject([
      { evento_id: execution.eventId, animal_id: row.animalId },
    ]);
    expect(factualDetail?.carencia_carne_ate).toBeNull();
    expect(factualDetail?.carencia_leite_ate).toBeNull();
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect((await db.ops_sanitario_agenda_v2.get(agendaId))?.status).toBe(
      "programada",
    );
    expect(
      await getAnimalSanitaryExecutedHistoryV2({
        fazendaId: currentSource.fazendaId,
        animalId: row.animalId,
        catalog: currentSource.catalog,
      }),
    ).toEqual([]);

    // O harness HTTP/PostgreSQL comprova o transporte e o pull; este ACK isolado testa a projeção local.
    await db.event_eventos.update(execution.eventId, {
      sanitario_v3_confirmation: "confirmed",
    });
    await db.event_eventos_sanitario.update(execution.eventId, {
      sanitario_v3_confirmation: "confirmed",
    });
    const localHistory = await getAnimalSanitaryExecutedHistoryV2({
      fazendaId: currentSource.fazendaId,
      animalId: row.animalId,
      catalog: currentSource.catalog,
    });
    expect(localHistory[0]?.events[0]).toMatchObject({
      eventId: execution.eventId,
      executedAt: "2026-10-31T02:37:00.000Z",
      originLabel: "agenda sanitária",
      stockStatus: "without_movement",
    });
    expect(localHistory[0]?.events[0].withdrawalStatus).not.toBe("generated");
    expect((await db.ops_sanitario_agenda_v2.get(agendaId))?.status).toBe(
      "programada",
    );

  });
});
