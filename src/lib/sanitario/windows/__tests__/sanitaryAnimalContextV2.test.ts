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
  createGroupedManualSanitaryAgendasV2,
  loadSanitaryProtocolWindowSourceV2,
  EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
  type SanitaryOperationalContextV2,
  type SanitaryProtocolWindowSourceV2,
} from "../sanitaryProtocolWindowsV2";
import { resolveSanitaryAnimalContextV2 } from "../sanitaryAnimalContextV2";
import {
  previewSanitaryAutomaticPlanV2,
  generateSanitaryAutomaticAgendasV2,
} from "../../agenda/sanitaryAutomaticGenerationV2";
import { sanitaryAutomaticIdentityV2 } from "../../agenda/sanitaryAutomaticIdentityV2";
import {
  selectSanitaryAutomationRuleV2,
  saveSanitaryAutomationPlanV2,
} from "../../agenda/sanitaryAutomationPlanV2";
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
  allows_agenda_auto: true,
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
      allows_agenda_auto: true,
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

  it("snapshot de lote heterogêneo registra contextos por animal, sem herdar o contexto do primeiro", async () => {
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
      await saveSanitaryAutomationPlanV2({
        fazendaId: "farm",
        actorId: "actor",
        expectedRevision: 0,
        enabled: true,
        confirmed: true,
        draft: {
          context: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 },
          rules: [selectSanitaryAutomationRuleV2(protocol, item)],
        },
      });
      expect(
        (
          await generateSanitaryAutomaticAgendasV2({
            fazendaId: "farm",
            referenceDate: "2026-07-04",
          })
        ).created,
      ).toBe(2);
      const automatic = (await db.ops_sanitario_agenda_v2.toArray()).filter(
        (agenda) => typeof agenda.metadata.automationKey === "string",
      );
      for (const agenda of automatic) {
        const link = (await db.ops_sanitario_agenda_animais_v2.toArray()).find(
          (entry) => entry.agenda_id === agenda.id,
        )!;
        expect(agenda.protocol_item_snapshot.operationalContext).toEqual(
          rows.find((row) => row.animalId === link.animal_id)!
            .contextResolution!.context,
        );
      }
      for (const agenda of automatic) await cancelLocalSanitaryAgendaV2({ agendaId: agenda.id, fazendaId: "farm" });
      await createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: "farm",
        plannedFor: "2026-07-04",
        confirmed: true,
      });
      const saved = (await db.ops_sanitario_agenda_v2.toArray()).find((agenda) => agenda.lote_id === "lot" && agenda.status === "programada")!;
      expect(saved.protocol_item_snapshot.operationalContext).toBeNull();
      expect(
        saved.protocol_item_snapshot.planningEvidence
          .operationalContextsByAnimalId,
      ).toEqual(
        Object.fromEntries(
          rows.map((row) => [row.animalId, row.contextResolution!.context]),
        ),
      );
    } finally {
      await Promise.all(db.tables.map((table) => table.clear()));
      vi.unstubAllGlobals();
    }
  });

  it("separa ciclos gestacionais sob a mesma programação genérica e preserva retry do ciclo", () => {
    const genericItem = {
      ...item,
      operationalWindowRule: { anchor: "parturition" },
    };
    const declared = {
      ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
      scheduledContext: {
        date: "2026-07-04",
        animalIds: ["matrix"],
        reference: "Avaliação programada",
      },
    };
    const firstSource = source({
      catalog: { ...source().catalog, items: [genericItem] },
    });
    const firstRow = buildSanitaryProtocolWindowV2({
      source: firstSource,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
      generationMode: "automatic",
    })!.rows[0];
    const first = sanitaryAutomaticIdentityV2(
      firstSource,
      firstRow,
      "2026-07-04",
      declared,
    );
    const secondCycle = reproduction().map((event) => ({
      ...event,
      id: `${event.id}-2`,
      occurred_at: event.occurred_at.replace("2026", "2027"),
      details: {
        ...event.details!,
        payload:
          event.details!.tipo === "diagnostico"
            ? {
                schema_version: 1,
                resultado: "positivo",
                episode_evento_id: "service-2",
                data_prevista_parto: "2027-08-10",
              }
            : event.details!.payload,
      },
    }));
    const secondSource = source({
      catalog: firstSource.catalog,
      reproductiveEvents: [...reproduction(), ...secondCycle],
      executedHistory: [{ animalId: "matrix", events: [{ eventId: "prior-cycle-assessment", protocolId: protocol.id, familyCode: protocol.familyCode, itemKey: item.logicalItemKey, executedAt: "2026-07-04", source: "event" }] }],
    });
    const secondRow = buildSanitaryProtocolWindowV2({
      source: secondSource,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2027-07-04",
      operationalContext: declared,
      generationMode: "automatic",
    })!.rows[0];
    const second = sanitaryAutomaticIdentityV2(
      secondSource,
      secondRow,
      "2027-07-04",
      declared,
    );
    expect(firstRow.canSelect && secondRow.canSelect).toBe(true);
    expect(second.key).not.toBe(first.key);
    expect(second.completed).toBe(false);
    expect(
      sanitaryAutomaticIdentityV2(
        secondSource,
        secondRow,
        "2027-07-05",
        declared,
      ).key,
    ).toBe(second.key);
  });

  it("mantém chave legada do mesmo ciclo sem reescrever intenção ou operações pendentes", () => {
    const declared = {
      ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
      scheduledContext: {
        date: "2026-07-04",
        animalIds: ["matrix"],
        reference: "Avaliação programada",
      },
    };
    const genericItem = {
      ...item,
      operationalWindowRule: { anchor: "parturition" },
    };
    const legacyKey =
      "sanitary-auto-v2|farm|matrix|protocol|1|item|1|context:2026-07-04";
    const local = source({
      catalog: { ...source().catalog, items: [genericItem] },
      agendas: [
        {
          id: "legacy",
          fazenda_id: "farm",
          protocolo_id: protocol.id,
          data_programada: "2026-07-04",
          status: "cancelada",
          metadata: {
            automationKey: legacyKey,
            automationWindowKey: "context:2026-07-04",
          },
          protocol_item_snapshot: { itemKey: item.logicalItemKey },
        } as never,
      ],
      agendaAnimals: [{ agenda_id: "legacy", animal_id: "matrix" } as never],
    });
    const before = JSON.stringify(local);
    const row = buildSanitaryProtocolWindowV2({
      source: local,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
      generationMode: "automatic",
    })!.rows[0];
    expect(
      sanitaryAutomaticIdentityV2(local, row, "2026-07-04", declared),
    ).toMatchObject({ key: legacyKey, windowKey: "context:2026-07-04" });
    expect(
      previewSanitaryAutomaticPlanV2(
        local,
        {
          context: declared,
          rules: [selectSanitaryAutomationRuleV2(protocol, genericItem)],
        },
        "2026-07-04",
      ).toCreate,
    ).toBe(0);
    expect(JSON.stringify(local)).toBe(before);
  });

  it.each(["programada", "cancelada"])("preserva bloqueio legado %s quando histórico offline não comprova outro episódio", (status) => {
    const declared = { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 };
    const local = source({
      agendas: [{ id: "unknown-cycle", fazenda_id: "farm", protocolo_id: protocol.id, data_programada: "2025-07-04", status, metadata: {}, protocol_item_snapshot: { itemKey: item.logicalItemKey } } as never],
      agendaAnimals: [{ agenda_id: "unknown-cycle", animal_id: "matrix" } as never],
    });
    const before = JSON.stringify(local);
    expect(previewSanitaryAutomaticPlanV2(local, { context: declared, rules: [selectSanitaryAutomationRuleV2(protocol, item)] }, "2026-07-04").toCreate).toBe(0);
    expect(JSON.stringify(local)).toBe(before);
  });

  it("nova DPP no mesmo episódio não renumera a intenção automática", () => {
    const declared = { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 };
    const local = source();
    const row = buildSanitaryProtocolWindowV2({
      source: local,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
    })!.rows[0];
    const original = sanitaryAutomaticIdentityV2(
      local,
      row,
      "2026-07-04",
      declared,
    );
    const changed = source({
      reproductiveEvents: [
        ...reproduction(),
        {
          ...reproduction()[1],
          id: "updated-diagnosis",
          occurred_at: "2026-07-01",
          details: {
            tipo: "diagnostico",
            payload: {
              schema_version: 1,
              resultado: "positivo",
              episode_evento_id: "service",
              data_prevista_parto: "2026-08-20",
            },
          },
        },
      ],
    });
    const updatedRow = buildSanitaryProtocolWindowV2({
      source: changed,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
    })!.rows[0];
    expect(updatedRow.canSelect).toBe(true);
    expect(
      updatedRow.contextResolution!.context.scheduledContext!.date,
    ).not.toBe(row.contextResolution!.context.scheduledContext!.date);
    expect(
      sanitaryAutomaticIdentityV2(changed, updatedRow, "2026-07-04", declared)
        .key,
    ).toBe(original.key);
  });

  it.each([
    ["programada", "episode"], ["cancelada", "episode"],
    ["programada", "legacy-auto"], ["cancelada", "legacy-auto"],
    ["programada", "legacy-manual"], ["cancelada", "legacy-manual"],
  ])("gera uma intenção por ciclo com anterior %s / %s, concorrência, restart e retry", async (status, identityKind) => {
    vi.stubGlobal("localStorage", {
      getItem: () => "cycles-client",
      setItem: vi.fn(),
    });
    await Promise.all(db.tables.map((table) => table.clear()));
    try {
      const genericItem = {
        ...item,
        operationalWindowRule: { anchor: "parturition" },
      };
      await seedContextTargets([animal()], reproduction(), genericItem);
      const declared = {
        ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
        scheduledContext: {
          date: "2026-07-04",
          animalIds: ["matrix"],
          reference: "Avaliação programada",
        },
      };
      await saveSanitaryAutomationPlanV2({
        fazendaId: "farm",
        actorId: "actor",
        expectedRevision: 0,
        enabled: true,
        confirmed: true,
        draft: {
          context: declared,
          rules: [selectSanitaryAutomationRuleV2(protocol, genericItem)],
        },
      });
      const firstRuns = await Promise.all([
        generateSanitaryAutomaticAgendasV2({
          fazendaId: "farm",
          referenceDate: "2026-07-04",
        }),
        generateSanitaryAutomaticAgendasV2({
          fazendaId: "farm",
          referenceDate: "2026-07-04",
        }),
      ]);
      expect(
        firstRuns.reduce((count, result) => count + result.created, 0),
      ).toBe(1);
      const first = (await db.ops_sanitario_agenda_v2.toArray())[0];
      if (status === "cancelada") await cancelLocalSanitaryAgendaV2({
        agendaId: first.id,
        fazendaId: "farm",
      });
      if (identityKind !== "episode") {
        const metadata = { ...first.metadata };
        delete metadata.automationKey;
        delete metadata.automationWindowKey;
        if (identityKind === "legacy-auto") {
          metadata.automationKey = "sanitary-auto-v2|farm|matrix|protocol|1|item|1|context:2026-07-04";
          metadata.automationWindowKey = "context:2026-07-04";
        }
        await db.ops_sanitario_agenda_v2.update(first.id, { metadata });
      }
      expect((await generateSanitaryAutomaticAgendasV2({ fazendaId: "farm", referenceDate: "2026-07-05" })).created).toBe(0);
      const oldQueue = await db.queue_ops.toArray();
      const oldAgenda = await db.ops_sanitario_agenda_v2.get(first.id);
      const nextCycle = reproduction().map((event) => ({
        ...event,
        id: `${event.id}-2`,
        occurred_at: event.occurred_at.replace("2026", "2027"),
        details: {
          ...event.details!,
          payload:
            event.details!.tipo === "diagnostico"
              ? {
                  schema_version: 1,
                  resultado: "positivo",
                  episode_evento_id: "service-2",
                  data_prevista_parto: "2027-08-10",
                }
              : event.details!.payload,
        },
      }));
      for (const event of nextCycle) {
        await db.event_eventos.put({
          ...event,
          dominio: "reproducao",
          payload: {},
        } as never);
        await db.event_eventos_reproducao.put({
          evento_id: event.id,
          fazenda_id: "farm",
          tipo: event.details.tipo,
          payload: event.details.payload,
          deleted_at: null,
        } as never);
      }
      const secondRuns = await Promise.all([
        generateSanitaryAutomaticAgendasV2({
          fazendaId: "farm",
          referenceDate: "2027-07-04",
        }),
        generateSanitaryAutomaticAgendasV2({
          fazendaId: "farm",
          referenceDate: "2027-07-04",
        }),
      ]);
      expect(
        secondRuns.reduce((count, result) => count + result.created, 0),
      ).toBe(1);
      const currentSource = await loadSanitaryProtocolWindowSourceV2("farm");
      const currentRows = buildSanitaryProtocolWindowV2({ source: currentSource, protocolId: protocol.id, itemId: item.id, evaluatedAt: "2027-07-04", operationalContext: declared })!.rows;
      const secondAgenda = currentSource.agendas.find((agenda) => agenda.id !== first.id)!;
      expect(currentRows[0].alreadyPlanned).toBe(true);
      const beforeRevalidation = await db.queue_ops.toArray();
      const reused = await createGroupedManualSanitaryAgendasV2({ rows: currentRows, fazendaId: "farm", plannedFor: "2027-07-04", confirmed: true, operationalContext: declared });
      expect(reused).toHaveLength(1);
      expect(reused[0]).toMatchObject({ agendaId: secondAgenda.id, created: false });
      expect(await db.queue_ops.toArray()).toEqual(beforeRevalidation);
      expect(
        new Set(
          (await db.ops_sanitario_agenda_v2.toArray()).map(
            (agenda) => agenda.metadata.automationKey,
          ),
        ).size,
      ).toBe(2);
      expect(await db.ops_sanitario_agenda_v2.get(first.id)).toEqual(oldAgenda);
      for (const op of oldQueue)
        expect(await db.queue_ops.get(op.client_op_id)).toEqual(op);
      db.close();
      await db.open();
      const queueBeforeRetry = await db.queue_ops.toArray();
      expect(
        (
          await generateSanitaryAutomaticAgendasV2({
            fazendaId: "farm",
            referenceDate: "2027-07-05",
          })
        ).created,
      ).toBe(0);
      expect(await db.queue_ops.toArray()).toEqual(queueBeforeRetry);
    } finally {
      await Promise.all(db.tables.map((table) => table.clear()));
      vi.unstubAllGlobals();
    }
  });
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

  it("lote heterogêneo usa a mesma resolução no manual e automático e identidade estável na janela", async () => {
    const heterogeneous = source({
      animals: [animal(), animal("calf", { data_nascimento: "2026-03-01" })],
    });
    const declared = { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 };
    const input = {
      source: heterogeneous,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: "2026-07-04",
      operationalContext: declared,
    };
    const counts = await Promise.all([
      db.event_eventos.count(),
      db.ops_sanitario_agenda_v2.count(),
      db.queue_ops.count(),
    ]);
    const manual = buildSanitaryProtocolWindowV2({
      ...input,
      generationMode: "manual",
    })!;
    const automatic = buildSanitaryProtocolWindowV2({
      ...input,
      generationMode: "automatic",
    })!;
    expect(manual.rows.map((row) => row.contextResolution)).toEqual(
      automatic.rows.map((row) => row.contextResolution),
    );
    expect(
      automatic.rows.filter((row) => row.canSelect).map((row) => row.animalId),
    ).toEqual(["matrix"]);
    const preview = previewSanitaryAutomaticPlanV2(
      heterogeneous,
      {
        context: declared,
        rules: [selectSanitaryAutomationRuleV2(protocol, item)],
      },
      "2026-07-04",
    );
    expect(
      preview.entries.filter((row) => row.eligible).map((row) => row.animalId),
    ).toEqual(["matrix"]);
    const row = automatic.rows.find((entry) => entry.animalId === "matrix")!;
    expect(
      sanitaryAutomaticIdentityV2(heterogeneous, row, "2026-07-04", declared)
        .key,
    ).toBe(
      sanitaryAutomaticIdentityV2(heterogeneous, row, "2026-07-05", declared)
        .key,
    );
    expect(
      await Promise.all([
        db.event_eventos.count(),
        db.ops_sanitario_agenda_v2.count(),
        db.queue_ops.count(),
      ]),
    ).toEqual(counts);
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
        allows_agenda_auto: true,
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
      await saveSanitaryAutomationPlanV2({
        fazendaId: "farm",
        actorId: "actor",
        expectedRevision: 0,
        enabled: true,
        confirmed: true,
        draft: {
          context: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 },
          rules: [selectSanitaryAutomationRuleV2(protocol, item)],
        },
      });
      const facts = await db.event_eventos.count();
      expect(
        (
          await generateSanitaryAutomaticAgendasV2({
            fazendaId: "farm",
            referenceDate: "2026-07-04",
          })
        ).created,
      ).toBe(1);
      expect(
        (
          await generateSanitaryAutomaticAgendasV2({
            fazendaId: "farm",
            referenceDate: "2026-07-05",
          })
        ).created,
      ).toBe(0);
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
});
