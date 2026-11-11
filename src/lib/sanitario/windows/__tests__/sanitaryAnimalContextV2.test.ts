import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";
import type { ReproductiveProjectionEvent } from "@/lib/reproduction/status";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
} from "../../catalog/sanitaryProtocolCatalogV2";
import {
  buildSanitaryProtocolWindowV2,
  buildSanitaryContextualNeedsV2,
  createGroupedManualSanitaryAgendasV2,
  loadSanitaryProtocolWindowSourceV2,
  EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
  type SanitaryOperationalContextV2,
  type SanitaryProtocolWindowSourceV2,
} from "../sanitaryProtocolWindowsV2";
import { resolveSanitaryAnimalContextV2 } from "../sanitaryAnimalContextV2";
import { db } from "@/lib/offline/db";
import { cancelLocalSanitaryAgendaV2 } from "../../agenda/sanitaryLocalAgendaManagementV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({
  requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveWrite: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveAccess: vi.fn().mockResolvedValue(undefined),
}));

// Synthetic, versioned test rule. Does not publish or change the actual catalog.
const fields = [
  "operational_window",
  "eligibility_rule",
  "product_requirement",
];
const sources = Object.fromEntries(
  fields.map((field) => [
    field,
    [
      {
        id: `source-${field}`,
        kind: "mv_responsavel",
        title: "Fixture de decisão técnica",
        strength: "forte",
        evidenceStatus: "SIM_BULA",
        fieldKeys: [field],
      },
    ],
  ]),
);
const protocol = adaptSanitaryProtocolV2Row({
  id: "protocol",
  family_code: "matrizes_pre_parto",
  name: "Avaliação",
  scope: "global",
  fazenda_id: null,
  version: 1,
  status: "active",
  approval_status: "approved",
  metadata: {},
});
const item = adaptSanitaryProtocolItemV2Row({
  id: "item",
  protocol_id: "protocol",
  logical_item_key: "matrizes_pre_parto_antiparasitario",
  version: 1,
  status: "active",
  item_status: "condicional",
  action_type: "manejo_sanitario",
  product_requirement_kind: "none",
  eligibility_rule: {
    species: ["bovino"],
    sex: "femea",
    requires_pregnancy_or_peripartum_context: true,
  },
  operational_window_rule: {
    anchor: "parturition",
    min_offset_days: -60,
    max_offset_days: -20,
  },
  source_refs_by_field: sources,
});
const animal = (id = "matrix", overrides: Partial<Animal> = {}): Animal =>
  ({
    id,
    fazenda_id: "farm",
    identificacao: id,
    sexo: "F",
    especie: "bovino",
    status: "ativo",
    data_nascimento: "2022-01-01",
    lote_id: "lot",
    payload: {},
    deleted_at: null,
    ...overrides,
  }) as Animal;
const reproduction = (animalId = "matrix"): ReproductiveProjectionEvent[] => [
  {
    id: "service",
    animal_id: animalId,
    fazenda_id: "farm",
    occurred_at: "2026-01-01",
    deleted_at: null,
    details: { tipo: "IA", payload: { schema_version: 1 } },
  },
  {
    id: "diagnosis",
    animal_id: animalId,
    fazenda_id: "farm",
    occurred_at: "2026-02-01",
    deleted_at: null,
    details: {
      tipo: "diagnostico",
      payload: {
        schema_version: 1,
        resultado: "positivo",
        episode_evento_id: "service",
        data_prevista_parto: "2026-08-10",
      },
    },
  },
];
const source = (
  overrides: Partial<SanitaryProtocolWindowSourceV2> = {},
): SanitaryProtocolWindowSourceV2 => ({
  fazendaId: "farm",
  animals: [animal()],
  lots: [{ id: "lot", fazenda_id: "farm", deleted_at: null } as never],
  catalog: { protocols: [protocol], items: [item], productClassGroups: [] },
  executedEvents: [],
  executedHistory: [],
  agendas: [],
  agendaAnimals: [],
  reproductiveEvents: reproduction(),
  ...overrides,
});
const resolve = (
  overrides: Partial<Parameters<typeof resolveSanitaryAnimalContextV2>[0]> = {},
) =>
  resolveSanitaryAnimalContextV2({
    animal: animal(),
    source: source(),
    item,
    evaluatedAt: "2026-07-04",
    declared: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 },
    ...overrides,
  });

describe("resolução contextual sanitária por animal", () => {
  it("descoberta do lote preserva resolução conhecida, desconhecida e contraditória por animal", () => {
    const events = [...reproduction(), ...reproduction("conflict").map(event => ({ ...event, id: `conflict-${event.id}`, details: event.details?.tipo === "diagnostico" ? { ...event.details, payload: { ...event.details.payload, episode_evento_id: "conflict-service" } } : event.details }))];
    const local = source({
      animals: [animal(), animal("unknown"), animal("conflict", { payload: { taxonomy_facts: { schema_version: 1, prenhez_confirmada: false } } })],
      reproductiveEvents: events,
    });
    const rows = buildSanitaryContextualNeedsV2({ source: local, evaluatedAt: "2026-07-04", lotId: "lot" });
    expect(rows.find(row => row.animalId === "matrix")).toMatchObject({ canSelect: true, contextResolution: { reproduction: { status: "known" } } });
    expect(rows.find(row => row.animalId === "unknown")).toMatchObject({ canSelect: false, contextResolution: { reproduction: { status: "unknown" } } });
    expect(rows.find(row => row.animalId === "conflict")).toMatchObject({ canSelect: false, contextResolution: { reproduction: { status: "contradictory" } } });
  });
  async function seedContextTargets(
    targets: Animal[],
    events: ReproductiveProjectionEvent[],
    selectedItem = item,
  ) {
    await db.state_animais.bulkPut(targets);
    await db.state_lotes.put({
      id: "lot",
      fazenda_id: "farm",
      nome: "Lote misto",
      status: "ativo",
      payload: {},
      deleted_at: null,
    } as never);
    await db.state_fazenda_sanidade_config.put({
      fazenda_id: "farm",
      uf: "MG",
      payload: {},
      deleted_at: null,
    } as never);
    await db.catalog_sanitario_protocolos_v2.put({
      id: protocol.id,
      name: protocol.name,
      family_code: protocol.familyCode,
      scope: "global",
      fazenda_id: null,
      status: "active",
      approval_status: "approved",
      version: 1,
      metadata: {},
      deleted_at: null,
    } as never);
    await db.catalog_sanitario_protocolo_itens_versions_v2.put({
      id: selectedItem.id,
      protocol_id: protocol.id,
      logical_item_key: selectedItem.logicalItemKey,
      version: 1,
      status: "active",
      item_status: "condicional",
      action_type: "manejo_sanitario",
      product_requirement_kind: "none",
      eligibility_rule: selectedItem.eligibilityRule,
      operational_window_rule: selectedItem.operationalWindowRule,
      source_refs_by_field: sources,
      deleted_at: null,
    } as never);
    for (const event of events) {
      await db.event_eventos.put({
        ...event,
        dominio: "reproducao",
        payload: {},
      } as never);
      await db.event_eventos_reproducao.put({
        evento_id: event.id,
        fazenda_id: event.fazenda_id,
        tipo: event.details!.tipo,
        payload: event.details!.payload,
        deleted_at: null,
      } as never);
    }
  }

  it("resolve idade, sexo, lote, gestação e janela com proveniência sem declaração global", () => {
    const result = resolve();
    expect(result.sex).toMatchObject({ status: "known", value: "F" });
    expect(result.lotId).toMatchObject({ status: "known", value: "lot" });
    expect(result.pregnancy).toMatchObject({ status: "known", value: true });
    expect(result.expectedBirth).toMatchObject({ value: "2026-08-10" });
    expect(result.reproduction).toMatchObject({
      status: "known",
      value: "prepartum",
      sources: expect.arrayContaining(["eventos:diagnosis", "item:item:v1"]),
    });
    expect(result.context.scheduledContext).toMatchObject({
      date: "2026-06-11",
      animalIds: ["matrix"],
    });
  });

  it("cadastro com prenhez/DPP sem Eventos e serviço sem diagnóstico não comprovam gestação offline", () => {
    expect(
      resolve({
        source: source({ reproductiveEvents: [] }),
        animal: animal("matrix", {
          payload: {
            taxonomy_facts: {
              prenhez_confirmada: true,
              data_prevista_parto: "2026-08-10",
            },
          },
        }),
      }).pregnancy.status,
    ).toBe("unknown");
    expect(
      resolve({
        source: source({ reproductiveEvents: reproduction().slice(0, 1) }),
      }).pregnancy.status,
    ).toBe("unknown");
  });

  it("detecta divergência entre sexo, projeção cadastral e Eventos", () => {
    expect(
      resolve({ animal: animal("matrix", { sexo: "M" }) }).pregnancy.status,
    ).toBe("contradictory");
    expect(
      resolve({
        animal: animal("matrix", {
          payload: {
            taxonomy_facts: { schema_version: 1, prenhez_confirmada: false },
          },
        }),
      }).pregnancy.status,
    ).toBe("contradictory");
  });

  it("histórico reprodutivo incompleto ou futuro não sustenta uma gestação atual", () => {
    expect(
      resolve({
        source: source({
          reproductiveEvents: [
            ...reproduction(),
            {
              id: "missing",
              animal_id: "matrix",
              fazenda_id: "farm",
              occurred_at: "2026-06-01",
              deleted_at: null,
            },
          ],
        }),
      }).pregnancy.status,
    ).toBe("unknown");
    const future = reproduction();
    future[1] = { ...future[1], occurred_at: "2026-09-01" };
    expect(
      resolve({ source: source({ reproductiveEvents: future }) }).pregnancy
        .status,
    ).toBe("unknown");
  });

  it("diagnóstico negativo encerra gestação e ausência de janela/fonte impede resolver pré-parto", () => {
    const negative = reproduction();
    negative[1].details!.payload = {
      schema_version: 1,
      resultado: "negativo",
      episode_evento_id: "service",
    };
    expect(
      resolve({ source: source({ reproductiveEvents: negative }) }).pregnancy,
    ).toMatchObject({ status: "known", value: false });
    expect(
      resolve({
        item: { ...item, operationalWindowRule: { anchor: "parturition" } },
      }).reproduction.status,
    ).toBe("unknown");
    expect(
      resolve({ item: { ...item, sourceRefsByField: {} } }).reproduction.status,
    ).toBe("unknown");
    expect(resolve({ evaluatedAt: "2026-08-01" }).reproduction.status).toBe(
      "unknown",
    );
  });

  it("não trata ciclo vazio sem Evento definidor como ausência gestacional comprovada", () => {
    const serviceOnly = reproduction().slice(0, 1);
    const result = resolve({
      source: source({ reproductiveEvents: serviceOnly }),
    });

    expect(result.pregnancy).toMatchObject({ status: "unknown", value: null });
  });

  it("cadência anual pode vir da regra fundamentada; risco e cadência por risco não são inferidos", () => {
    expect(
      resolve({
        item: { ...item, boosterRule: { recurrenceRule: { kind: "annual" } } },
      }).cadence,
    ).toMatchObject({ status: "known", value: "annual" });
    const result = resolve({
      item: {
        ...item,
        boosterRule: { recurrenceRule: { kind: "annual_or_semester_by_risk" } },
      },
      source: source({ farmUf: "MG" }),
    });
    expect(result.risk.status).toBe("unknown");
    expect(result.cadence.status).toBe("unknown");
    expect(result.context.rabiesRiskArea).toBeNull();
    expect(
      resolve({
        item: { ...item, boosterRule: { recurrenceRule: { kind: "annual" } } },
        declared: {
          ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
          sanitaryCadence: "semiannual",
        },
      }).cadence.status,
    ).toBe("contradictory");
  });

  it("usa peso observado e preserva conflito, sem usar peso projetado ou inventar limiar sanitário", () => {
    const event = {
      id: "weight",
      animal_id: "matrix",
      fazenda_id: "farm",
      dominio: "pesagem",
      occurred_at: "2026-07-01T10:00:00Z",
      deleted_at: null,
    } as Evento;
    const detail = {
      evento_id: "weight",
      fazenda_id: "farm",
      peso_kg: 20,
      deleted_at: null,
    } as EventoPesagem;
    expect(
      resolve({
        source: source({ contextEvents: [event], weightDetails: [detail] }),
      }).weight,
    ).toMatchObject({
      status: "known",
      value: 20,
      sources: ["eventos:weight"],
    });
    expect(
      resolve({
        source: source({
          contextEvents: [event],
          weightDetails: [detail, { ...detail, peso_kg: 30 }],
        }),
      }).weight.status,
    ).toBe("contradictory");
    expect(
      resolve({
        animal: animal("matrix", {
          payload: { metrics: { last_weight_kg: 600 } },
        }),
      }).weight.status,
    ).toBe("unknown");
  });

  it("recria é derivada e pré-desmama depende da indicação real, não do seletor global", () => {
    const young = animal("young", { data_nascimento: "2025-05-01", sexo: "M" });
    expect(resolve({ animal: young }).management).toMatchObject({
      status: "known",
      value: "rearing",
    });
    const calf = animal("calf", { data_nascimento: "2026-03-01" });
    const weaningItem = {
      ...item,
      eligibilityRule: { requires_mv_or_management_context: true },
    };
    expect(resolve({ animal: calf, item: weaningItem }).management.status).toBe(
      "unknown",
    );
    expect(
      resolve({
        animal: calf,
        item: weaningItem,
        declared: {
          ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
          preWeaningBasis: {
            kind: "veterinarian",
            reference: "Avaliação da cria",
          },
        },
      }).management,
    ).toMatchObject({ value: "pre_weaning" });
  });

  it.each(["pre_feedlot", "deferred_pasture"] as const)(
    "%s exige referência, data e alvo do manejo programado",
    (management) => {
      const declared = { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, management };
      expect(resolve({ declared }).management.status).toBe("unknown");
      const scheduledContext = {
        date: "2026-07-04",
        animalIds: ["matrix"],
        reference: "Manejo confirmado",
      };
      expect(
        resolve({ declared: { ...declared, scheduledContext } }).management
          .value,
      ).toBe(management);
      expect(
        resolve({
          animal: animal("other"),
          declared: { ...declared, scheduledContext },
        }).management.value,
      ).not.toBe(management);
    },
  );

  it("isola fazendas e mantém campos ausentes desconhecidos", () => {
    const foreign = animal("matrix", { fazenda_id: "other" });
    const result = resolve({ animal: foreign });
    expect([
      result.sex.status,
      result.ageDays.status,
      result.pregnancy.status,
      result.management.status,
      result.weight.status,
    ]).toEqual(Array(5).fill("unknown"));
    expect(
      buildSanitaryProtocolWindowV2({
        source: source({ animals: [foreign] }),
        itemId: item.id,
        protocolId: protocol.id,
        evaluatedAt: "2026-07-04",
      })!.rows,
    ).toEqual([]);
    expect(resolve({ evaluatedAt: "invalid" }).ageDays.status).toBe("unknown");
    expect(resolve({ source: source({ lots: [] }) }).lotId.status).toBe(
      "unknown",
    );
  });

  it("reutiliza desmama programada/factual da jornada, sem converter Agenda concluída em execução", () => {
    const calf = animal("calf", { data_nascimento: "2026-03-01" });
    const agenda = {
      id: "weaning",
      fazenda_id: "farm",
      animal_id: "calf",
      tipo: "desmame",
      status: "agendado",
      data_prevista: "2026-09-01",
      payload: {},
      source_ref: { journey: "cria", milestone_key: "desmame" },
      deleted_at: null,
    } as const;
    expect(
      resolve({
        animal: calf,
        source: source({ managementAgendas: [agenda as never] }),
      }).weaning,
    ).toMatchObject({
      value: { kind: "planned", date: "2026-09-01" },
      sources: ["agenda_itens:weaning"],
    });
    expect(
      resolve({
        animal: calf,
        source: source({
          managementAgendas: [{ ...agenda, status: "concluido" } as never],
        }),
      }).weaning.status,
    ).toBe("unknown");
    expect(
      resolve({
        animal: calf,
        source: source({
          managementAgendas: [
            agenda as never,
            {
              ...agenda,
              id: "other-date",
              data_prevista: "2026-10-01",
            } as never,
          ],
        }),
      }).weaning.status,
    ).toBe("contradictory");
    const completed = {
      id: "weaned",
      animal_id: "calf",
      fazenda_id: "farm",
      dominio: "nutricao",
      occurred_at: "2026-07-01",
      payload: { procedimento: "desmame" },
      deleted_at: null,
    } as Evento;
    const result = resolve({
      animal: calf,
      source: source({ contextEvents: [completed] }),
    });
    expect(result.weaning.value?.kind).toBe("completed");
    expect(result.management.value).toBe("rearing");
  });

  it("avaliação genérica referenciada continua possível sem transformar intenção em gestação comprovada", () => {
    const declared: SanitaryOperationalContextV2 = {
      ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
      scheduledContext: {
        date: "2026-07-04",
        animalIds: ["matrix"],
        reference: "Avaliar manejo",
      },
    };
    const local = source({ reproductiveEvents: [] });
    const result = resolve({ source: local, declared });
    expect(result.genericAssessment).toBe(true);
    expect(result.pregnancy.status).toBe("unknown");
    expect(result.reproduction.status).toBe("unknown");
    const row = buildSanitaryProtocolWindowV2({
      source: local,
      itemId: item.id,
      protocolId: protocol.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
    })!.rows[0];
    expect(row.planningKind).toBe("avaliacao_manejo_generica");
    expect(row.precheck.createsEvent).toBe(false);
    expect(row.reason).toMatch(/Não é recomendação/);
    expect(row.canSelect).toBe(true);
    const definedScheme = {
      ...item,
      productId: "fixture-product",
      productRequirementKind: "specific_product" as const,
    };
    expect(
      resolve({ source: local, declared, item: definedScheme })
        .genericAssessment,
    ).toBe(false);
  });

  it("Dexie → resolução → revalidação → Agenda preserva replay, farm-switch e fatos", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "context-fixture-client",
      setItem: vi.fn(),
    });
    await Promise.all(db.tables.map((table) => table.clear()));
    try {
      await db.state_animais.bulkPut([
        animal(),
        animal("foreign", { fazenda_id: "other" }),
      ]);
      await db.state_fazenda_sanidade_config.put({
        fazenda_id: "farm",
        uf: "MG",
        payload: {},
        deleted_at: null,
      } as never);
      await db.catalog_sanitario_protocolos_v2.put({
        id: protocol.id,
        name: protocol.name,
        family_code: protocol.familyCode,
        scope: "global",
        fazenda_id: null,
        status: "active",
        approval_status: "approved",
        version: 1,
        metadata: {},
        deleted_at: null,
      } as never);
      await db.catalog_sanitario_protocolo_itens_versions_v2.put({
        id: item.id,
        protocol_id: protocol.id,
        logical_item_key: item.logicalItemKey,
        version: 1,
        status: "active",
        item_status: "condicional",
        action_type: "manejo_sanitario",
        product_requirement_kind: "none",
        eligibility_rule: item.eligibilityRule,
        operational_window_rule: item.operationalWindowRule,
        source_refs_by_field: sources,
        deleted_at: null,
      } as never);
      for (const event of reproduction()) {
        await db.event_eventos.put({
          ...event,
          dominio: "reproducao",
          payload: {},
        } as never);
        await db.event_eventos_reproducao.put({
          evento_id: event.id,
          fazenda_id: "farm",
          tipo: event.details!.tipo,
          payload: event.details!.payload,
          deleted_at: null,
        } as never);
      }
      const local = await loadSanitaryProtocolWindowSourceV2("farm");
      expect(local.animals.map((entry) => entry.id)).toEqual(["matrix"]);
      expect(local.reproductiveEvents).toHaveLength(2);
      const rows = buildSanitaryProtocolWindowV2({
        source: local,
        itemId: item.id,
        protocolId: protocol.id,
        evaluatedAt: "2026-07-04",
      })!.rows;
      expect(rows[0].canSelect).toBe(true);
      const facts = await db.event_eventos.count();
      const created = await createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm",
        plannedFor: "2026-07-04",
        confirmed: true,
      });
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ status: "scheduled", created: true });
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
      expect(await db.event_eventos.count()).toBe(facts);
      const saved = (await db.ops_sanitario_agenda_v2.toArray())[0];
      expect(saved.protocol_item_snapshot.operationalContext).toEqual(
        rows[0].contextResolution!.context,
      );
      expect(saved.metadata.contextResolution).toBeUndefined();
      await cancelLocalSanitaryAgendaV2({
        agendaId: saved.id,
        fazendaId: "farm",
      });
      const foreign = await loadSanitaryProtocolWindowSourceV2("other");
      expect(foreign.reproductiveEvents).toEqual([]);
      expect(
        buildSanitaryProtocolWindowV2({
          source: foreign,
          itemId: item.id,
          protocolId: protocol.id,
          evaluatedAt: "2026-07-04",
        })!.rows.every((row) => !row.canSelect),
      ).toBe(true);
      // A newly negative diagnosis invalidates the old preview under the writer's lock.
      await db.event_eventos.put({
        id: "negative",
        animal_id: "matrix",
        fazenda_id: "farm",
        dominio: "reproducao",
        occurred_at: "2026-07-02",
        payload: {},
        deleted_at: null,
      } as never);
      await db.event_eventos_reproducao.put({
        evento_id: "negative",
        fazenda_id: "farm",
        tipo: "diagnostico",
        payload: {
          schema_version: 1,
          resultado: "negativo",
          episode_evento_id: "service",
        },
        deleted_at: null,
      } as never);
      await expect(
        createGroupedManualSanitaryAgendasV2({
          rows,
          fazendaId: "farm",
          plannedFor: "2026-07-04",
          confirmed: true,
        }),
      ).rejects.toThrow();
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    } finally {
      await Promise.all(db.tables.map((table) => table.clear()));
      vi.unstubAllGlobals();
    }
  });
  it("preserva contexto por animal ao agrupar planejamento manual em lote heterogêneo", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "provenance-client",
      setItem: vi.fn(),
    });
    await Promise.all(db.tables.map((table) => table.clear()));
    try {
      const otherEvents = reproduction("other").map((event) => ({
        ...event,
        id: `${event.id}-other`,
        details: {
          ...event.details!,
          payload:
            event.details!.tipo === "diagnostico"
              ? {
                  schema_version: 1,
                  resultado: "positivo",
                  episode_evento_id: "service-other",
                  data_prevista_parto: "2026-08-20",
                }
              : event.details!.payload,
        },
      }));
      await seedContextTargets(
        [animal(), animal("other")],
        [...reproduction(), ...otherEvents],
      );
      const local = await loadSanitaryProtocolWindowSourceV2("farm");
      const rows = buildSanitaryProtocolWindowV2({
        source: local,
        protocolId: protocol.id,
        itemId: item.id,
        evaluatedAt: "2026-07-04",
      })!.rows;
      expect(rows.every((row) => row.canSelect)).toBe(true);
      const contextsByAnimal = Object.fromEntries(
        rows.map((row) => [row.animalId, row.contextResolution!.context]),
      );
      expect(contextsByAnimal.matrix).not.toEqual(contextsByAnimal.other);
      const eventCountBefore = await db.event_eventos.count();

      await createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm",
        plannedFor: "2026-07-04",
        confirmed: true,
      });

      const saved = (await db.ops_sanitario_agenda_v2.toArray()).find(
        (agenda) => agenda.lote_id === "lot" && agenda.status === "programada",
      );
      expect(saved).toBeDefined();
      expect(saved!.protocol_item_snapshot.operationalContext).toBeNull();
      expect(
        saved!.protocol_item_snapshot.planningEvidence
          .operationalContextsByAnimalId,
      ).toEqual(contextsByAnimal);
      expect(
        (await db.ops_sanitario_agenda_animais_v2.toArray())
          .filter((link) => link.agenda_id === saved!.id)
          .map((link) => link.animal_id)
          .sort(),
      ).toEqual(["matrix", "other"]);
      expect(await db.event_eventos.count()).toBe(eventCountBefore);
    } finally {
      await Promise.all(db.tables.map((table) => table.clear()));
      vi.unstubAllGlobals();
    }
  });
});

it("separa Agenda manual antiga pelos Eventos sem confrontar a DPP cadastral do ciclo atual", async () => {
  const { sanitaryAgendaFromOtherEpisodeV2 } = await import("../../agenda/sanitaryAgendaEpisodeV2");
  const nextEvents = reproduction().map((event) => ({
    ...event,
    id: `${event.id}-next`,
    occurred_at: event.occurred_at.replace("2026", "2027"),
    details: {
      ...event.details!,
      payload: event.details!.tipo === "diagnostico"
        ? { schema_version: 1, resultado: "positivo", episode_evento_id: "service-next", data_prevista_parto: "2027-08-10" }
        : event.details!.payload,
    },
  }));
  const current = source({
    animals: [animal("matrix", { payload: { taxonomy_facts: { schema_version: 1, prenhez_confirmada: true, data_prevista_parto: "2027-08-10" } } })],
    reproductiveEvents: [...reproduction(), ...nextEvents],
  });
  const row = buildSanitaryProtocolWindowV2({ source: current, protocolId: protocol.id, itemId: item.id, evaluatedAt: "2027-07-04" })!.rows[0];
  const previous = { id: "manual-old", fazenda_id: "farm", data_programada: "2026-07-04", metadata: {} } as never;
  expect(row.contextResolution!.reproductiveEpisodeId).toBe("service-next");
  expect(sanitaryAgendaFromOtherEpisodeV2(current, row, previous)).toBe(true);
  expect(sanitaryAgendaFromOtherEpisodeV2({ ...current, reproductiveEvents: nextEvents }, row, previous)).toBe(false);
});
