import { describe, expect, it } from "vitest";

import {
  buildHerdFlowReviewRecommendation,
  buildOperationalHistoryReviewRecommendation,
  buildOverdueAgendaRecommendation,
  buildWeightDataQualityRecommendation,
  type BuildHerdFlowReviewInput,
  type BuildOperationalHistoryReviewInput,
  type BuildOverdueAgendaInput,
  type BuildWeightDataQualityInput,
} from "@/lib/insights/decisionRecommendations";
import type { AgendaItem, Evento, EventoPesagem } from "@/lib/offline/types";
import {
  createMetricPeriod,
  createMetricResult,
  type MetricResult,
} from "@/lib/reports/metricContract";

const FARM_ID = "farm-1";
const OTHER_FARM_ID = "farm-2";
const ANIMAL_ID = "animal-1";
const CUTOFF = "2026-08-23T12:00:00.000Z";

function event(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "event-1",
    fazenda_id: FARM_ID,
    dominio: "pesagem",
    occurred_at: "2026-08-20T12:00:00.000Z",
    animal_id: ANIMAL_ID,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-08-20T12:00:00.000Z",
    server_received_at: "2026-08-20T12:00:00.000Z",
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function weightDetail(overrides: Partial<EventoPesagem> = {}): EventoPesagem {
  return {
    evento_id: "event-1",
    fazenda_id: FARM_ID,
    peso_kg: 320,
    payload: {},
    client_id: "client-1",
    client_op_id: "detail-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-08-20T12:00:00.000Z",
    server_received_at: "2026-08-20T12:00:00.000Z",
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function weightInput(
  overrides: Partial<BuildWeightDataQualityInput> = {},
): BuildWeightDataQualityInput {
  return {
    fazendaId: FARM_ID,
    animalId: ANIMAL_ID,
    cutoffAt: CUTOFF,
    timezone: "America/Sao_Paulo",
    timezoneVerified: true,
    freshnessLimitDays: 90,
    events: {
      availability: "loaded",
      records: [event()],
      convergence: { mode: "standard_pull", verified: true },
    },
    weightDetails: {
      availability: "loaded",
      records: [weightDetail()],
      convergence: { mode: "standard_pull", verified: true },
    },
    ...overrides,
  };
}

function agendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-1",
    fazenda_id: FARM_ID,
    dominio: "sanitario",
    tipo: "vacina",
    status: "agendado",
    data_prevista: "2026-08-20",
    animal_id: ANIMAL_ID,
    lote_id: null,
    dedup_key: null,
    source_kind: "manual",
    source_ref: null,
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: null,
    interval_days_applied: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "agenda-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-08-01T12:00:00.000Z",
    server_received_at: "2026-08-01T12:00:00.000Z",
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function agendaInput(
  overrides: Partial<BuildOverdueAgendaInput> = {},
): BuildOverdueAgendaInput {
  return {
    fazendaId: FARM_ID,
    cutoffAt: CUTOFF,
    timezone: "America/Sao_Paulo",
    timezoneVerified: true,
    referenceDate: "2026-08-23",
    agenda: {
      availability: "loaded",
      records: [agendaItem()],
      convergence: { mode: "standard_pull", verified: true },
    },
    ...overrides,
  };
}

function historyMetric(
  overrides: Partial<MetricResult<number>> = {},
  fazendaId = FARM_ID,
): MetricResult<number> {
  return createMetricResult({
    value: 4,
    status: "complete",
    period: createMetricPeriod("2026-08-01", "2026-08-23", {
      timezone: "America/Sao_Paulo",
      timezoneSource: "farm",
    }),
    coverage: {
      kind: "historical",
      state: "verified",
      scope: { fazendaId, domain: "operacional" },
      evidence: ["Cobertura historica verificada para o periodo."],
    },
    sources: [{ name: "event_eventos", role: "primary" }],
    limitations: [],
    ...overrides,
  });
}

function historyInput(
  overrides: Partial<BuildOperationalHistoryReviewInput> = {},
): BuildOperationalHistoryReviewInput {
  return {
    fazendaId: FARM_ID,
    cutoffAt: CUTOFF,
    timezone: "America/Sao_Paulo",
    timezoneVerified: true,
    metrics: {
      availability: "loaded",
      records: [{ metricKey: "eventos_periodo", result: historyMetric() }],
      convergence: { mode: "local_derived", verified: true },
    },
    ...overrides,
  };
}

function herdFlowMetric(
  key: "rebanho_entradas" | "rebanho_saidas",
  overrides: Partial<MetricResult<number>> = {},
  fazendaId = FARM_ID,
): MetricResult<number> {
  return createMetricResult({
    value: key === "rebanho_entradas" ? 6 : 2,
    status: "complete",
    period: createMetricPeriod("2026-08-01", "2026-08-23", {
      timezone: "America/Sao_Paulo",
      timezoneSource: "farm",
    }),
    coverage: {
      kind: "historical",
      state: "verified",
      scope: { fazendaId, domain: "rebanho" },
      evidence: ["Cobertura historica verificada para o periodo."],
    },
    sources: [
      { name: "event_eventos", role: "primary" },
      { name: "event_eventos_comercial", role: "auxiliary" },
      ...(key === "rebanho_entradas"
        ? [
            {
              name: "event_eventos_reproducao",
              role: "auxiliary" as const,
            },
          ]
        : []),
    ],
    limitations: [],
    ...overrides,
  });
}

function herdFlowInput(
  overrides: Partial<BuildHerdFlowReviewInput> = {},
): BuildHerdFlowReviewInput {
  return {
    fazendaId: FARM_ID,
    cutoffAt: CUTOFF,
    timezone: "America/Sao_Paulo",
    timezoneVerified: true,
    metrics: {
      availability: "loaded",
      records: [
        {
          metricKey: "rebanho_entradas",
          result: herdFlowMetric("rebanho_entradas"),
        },
        {
          metricKey: "rebanho_saidas",
          result: herdFlowMetric("rebanho_saidas"),
        },
      ],
      convergence: { mode: "local_derived", verified: true },
    },
    ...overrides,
  };
}

describe("weight data quality recommendation", () => {
  it("returns confirmed with Evento + detail fresh and verified", () => {
    const result = buildWeightDataQualityRecommendation(weightInput());

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({ quality: "fresh", weightKg: 320 });
    expect(result.evidence.primarySources.map((source) => source.name)).toEqual(
      ["eventos", "eventos_pesagem"],
    );
    expect(result.prohibitedActions).toContain("nao autoriza venda ou abate");
  });

  it("returns partial when Evento-base exists without required detail", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        weightDetails: {
          availability: "loaded",
          records: [],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
    expect(result.data).toMatchObject({ quality: "missing_detail" });
    expect(result.statusReason).toMatch(/detail factual obrigatorio/);
  });

  it("returns unknown when the loaded snapshot has no factual weight", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        events: {
          availability: "loaded",
          records: [],
          convergence: { mode: "standard_pull", verified: true },
        },
        weightDetails: {
          availability: "loaded",
          records: [],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("unknown");
    expect(result.data).toBeNull();
  });

  it("returns not_permitted when a mandatory technical source is unavailable", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        weightDetails: {
          availability: "not_available",
          records: null,
          convergence: { mode: "not_verified", verified: false },
        },
      }),
    );

    expect(result.status).toBe("not_permitted");
    expect(result.data).toBeNull();
  });

  it("returns not_permitted when the technical freshness limit is absent", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({ freshnessLimitDays: undefined }),
    );

    expect(result.status).toBe("not_permitted");
    expect(result.statusReason).toMatch(/limite tecnico explicito/);
  });

  it("returns ambiguous for conflicting latest factual details", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        weightDetails: {
          availability: "loaded",
          records: [weightDetail(), weightDetail({ peso_kg: 350 })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("ambiguous");
    expect(result.evidence.conflicts[0].code).toBe(
      "conflicting_weight_details",
    );
  });

  it("returns partial for stale factual weight", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        events: {
          availability: "loaded",
          records: [event({ occurred_at: "2026-01-01T12:00:00.000Z" })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
    expect(result.data).toMatchObject({ quality: "stale" });
  });

  it("ignores cross-farm records for coverage, status and conflict", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        events: {
          availability: "loaded",
          records: [
            event(),
            event({ id: "foreign-event", fazenda_id: OTHER_FARM_ID }),
          ],
          convergence: { mode: "standard_pull", verified: true },
        },
        weightDetails: {
          availability: "loaded",
          records: [
            weightDetail(),
            weightDetail({
              evento_id: "foreign-event",
              fazenda_id: OTHER_FARM_ID,
              peso_kg: 999,
            }),
          ],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({ weightKg: 320 });
    expect(
      result.evidence.primarySources.flatMap((source) => source.recordIds),
    ).not.toContain("foreign-event");
  });

  it("uses the explicit cutoff and ignores future events deterministically", () => {
    const input = weightInput({
      events: {
        availability: "loaded",
        records: [
          event(),
          event({ id: "future", occurred_at: "2026-08-24T12:00:00.000Z" }),
        ],
        convergence: { mode: "standard_pull", verified: true },
      },
      weightDetails: {
        availability: "loaded",
        records: [
          weightDetail(),
          weightDetail({ evento_id: "future", peso_kg: 500 }),
        ],
        convergence: { mode: "standard_pull", verified: true },
      },
    });

    const first = buildWeightDataQualityRecommendation(input);
    const second = buildWeightDataQualityRecommendation(input);

    expect(second).toEqual(first);
    expect(first.data).toMatchObject({ weightKg: 320 });
    expect(first.generatedAt).toBe(CUTOFF);
  });

  it("never confirms when convergence is not verified", () => {
    const result = buildWeightDataQualityRecommendation(
      weightInput({
        weightDetails: {
          availability: "loaded",
          records: [weightDetail()],
          convergence: { mode: "not_verified", verified: false },
        },
      }),
    );

    expect(result.status).toBe("partial");
  });

  it("uses retained queue rejection only as a technical limitation", () => {
    const withRejection = buildWeightDataQualityRecommendation(
      weightInput({ retainedQueueRejectionCount: 1 }),
    );
    const withoutRejection = buildWeightDataQualityRecommendation(
      weightInput({ retainedQueueRejectionCount: 0 }),
    );

    expect(withRejection.status).toBe("confirmed");
    expect(withRejection.evidence.auxiliarySources[0].name).toBe(
      "queue_rejections",
    );
    expect(withRejection.evidence.limitations.join(" ")).toMatch(
      /nao prova nem nega fato/,
    );
    expect(withoutRejection.status).toBe("confirmed");
    expect(withoutRejection.evidence.limitations.join(" ")).toMatch(
      /ausencia nao prova/,
    );
  });
});

describe("overdue agenda recommendation", () => {
  it("returns confirmed for an open overdue Agenda intention", () => {
    const result = buildOverdueAgendaRecommendation(agendaInput());

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({ count: 1 });
    expect(result.evidence.primarySources[0]).toMatchObject({
      name: "state_agenda_itens",
      kind: "state",
    });
    expect(result.prohibitedActions).toContain("nao cria Evento");
  });

  it("returns partial when an open item has incomplete due-date evidence", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "loaded",
          records: [agendaItem({ data_prevista: "invalid" })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
    expect(result.evidence.limitations.join(" ")).toMatch(
      /data prevista valida/,
    );
  });

  it("returns unknown when Agenda was not loaded", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "not_loaded",
          records: null,
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("unknown");
    expect(result.data).toBeNull();
  });

  it("returns not_permitted when the Agenda source is unavailable", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "not_available",
          records: null,
          convergence: { mode: "not_verified", verified: false },
        },
      }),
    );

    expect(result.status).toBe("not_permitted");
  });

  it("returns ambiguous for conflicting current Agenda states", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "loaded",
          records: [agendaItem(), agendaItem({ status: "concluido" })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("ambiguous");
    expect(result.evidence.conflicts[0].code).toBe("conflicting_agenda_state");
  });

  it("does not treat concluded Agenda as execution or historical fact", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "loaded",
          records: [agendaItem({ status: "concluido" })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({ count: 0 });
    expect(result.evidence.primarySources[0].kind).toBe("state");
    expect(result.prohibitedActions).toContain(
      "nao infere execucao a partir de Agenda concluida",
    );
  });

  it("ignores cross-farm Agenda records completely", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "loaded",
          records: [agendaItem({ fazenda_id: OTHER_FARM_ID })],
          convergence: { mode: "standard_pull", verified: true },
        },
      }),
    );

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({ count: 0 });
    expect(result.evidence.primarySources[0].recordIds).toEqual([]);
  });

  it("is deterministic and has no effects on Agenda, Evento or state inputs", () => {
    const record = agendaItem();
    const input = agendaInput({
      agenda: {
        availability: "loaded",
        records: [record],
        convergence: { mode: "standard_pull", verified: true },
      },
    });
    const snapshot = structuredClone(input);

    const first = buildOverdueAgendaRecommendation(input);
    const second = buildOverdueAgendaRecommendation(input);

    expect(second).toEqual(first);
    expect(input).toEqual(snapshot);
  });

  it("never confirms empty local Agenda when convergence is not verified", () => {
    const result = buildOverdueAgendaRecommendation(
      agendaInput({
        agenda: {
          availability: "loaded",
          records: [],
          convergence: { mode: "not_verified", verified: false },
        },
      }),
    );

    expect(result.status).toBe("unknown");
  });
});

describe("operational history review recommendation", () => {
  it("returns confirmed from a complete MetricResult with verified historical coverage", () => {
    const result = buildOperationalHistoryReviewRecommendation(historyInput());

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({
      metricKey: "eventos_periodo",
      observedEventCount: 4,
      metricStatus: "complete",
      coverageState: "verified",
    });
    expect(result.evidence.primarySources[0].name).toBe("event_eventos");
    expect(result.suggestedAction).toBeUndefined();
  });

  it("preserves partial as distinct when historical coverage is incomplete", () => {
    const partialMetric = historyMetric({
      status: "partial",
      coverage: {
        kind: "historical",
        state: "partial",
        scope: { fazendaId: FARM_ID, domain: "operacional" },
        evidence: ["Cobertura local incompleta."],
      },
      limitations: ["Historico completo nao comprovado."],
    });
    const result = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "loaded",
          records: [{ metricKey: "eventos_periodo", result: partialMetric }],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
    expect(result.data?.observedEventCount).toBe(4);
    expect(result.evidence.limitations).toContain(
      "Historico completo nao comprovado.",
    );
    expect(result.suggestedAction).toEqual({
      label: "Revisar relatorios",
      href: "/relatorios",
    });
  });

  it("keeps absent and unavailable sources semantically distinct", () => {
    const absent = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "not_loaded",
          convergence: { mode: "local_derived", verified: false },
        },
      }),
    );
    const unavailable = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "not_available",
          convergence: { mode: "not_applicable", verified: false },
        },
      }),
    );

    expect(absent.status).toBe("unknown");
    expect(unavailable.status).toBe("not_permitted");
  });

  it("returns ambiguous for divergent MetricResult snapshots without choosing a winner", () => {
    const result = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "loaded",
          records: [
            { metricKey: "eventos_periodo", result: historyMetric() },
            {
              metricKey: "eventos_periodo",
              result: historyMetric({ value: 7 }),
            },
          ],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );

    expect(result.status).toBe("ambiguous");
    expect(result.data).toBeNull();
    expect(result.evidence.conflicts).toHaveLength(1);
  });

  it("filters MetricResult explicitly by fazenda and prevents cross-farm contamination", () => {
    const result = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "loaded",
          records: [
            {
              metricKey: "eventos_periodo",
              result: historyMetric({ value: 999 }, OTHER_FARM_ID),
            },
            { metricKey: "eventos_periodo", result: historyMetric() },
          ],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );

    expect(result.status).toBe("confirmed");
    expect(result.data?.observedEventCount).toBe(4);
    expect(result.evidence.coverage).toContain(`fazenda:${FARM_ID}`);
    expect(result.evidence.coverage).not.toContain(`fazenda:${OTHER_FARM_ID}`);
  });

  it("uses the explicit cutoff and timezone without presenting an incomplete period as certain", () => {
    const afterCutoff = historyMetric({
      period: createMetricPeriod("2026-08-01", "2026-08-31", {
        timezone: "America/Sao_Paulo",
        timezoneSource: "farm",
      }),
    });
    const cutoffResult = buildOperationalHistoryReviewRecommendation(
      historyInput({
        metrics: {
          availability: "loaded",
          records: [{ metricKey: "eventos_periodo", result: afterCutoff }],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );
    const timezoneResult = buildOperationalHistoryReviewRecommendation(
      historyInput({ timezone: "UTC" }),
    );

    expect(cutoffResult.status).toBe("partial");
    expect(cutoffResult.evidence.limitations).toContain(
      "O periodo metrico termina depois do cutoff; a leitura representa somente o conjunto observado ate o cutoff.",
    );
    expect(timezoneResult.status).toBe("ambiguous");
    expect(timezoneResult.evidence.conflicts[0].code).toBe(
      "metric_timezone_conflict",
    );
  });

  it("is deterministic, farm-isolated and free of side effects", () => {
    const input = historyInput();
    const snapshot = structuredClone(input);

    const first = buildOperationalHistoryReviewRecommendation(input);
    const second = buildOperationalHistoryReviewRecommendation(input);

    expect(second).toEqual(first);
    expect(input).toEqual(snapshot);
  });
});

describe("herd flow review recommendation", () => {
  it("returns confirmed from complete entry and exit MetricResult values", () => {
    const result = buildHerdFlowReviewRecommendation(herdFlowInput());

    expect(result.status).toBe("confirmed");
    expect(result.data).toMatchObject({
      observedEntries: 6,
      observedExits: 2,
      entryMetricStatus: "complete",
      exitMetricStatus: "complete",
      coverageStates: ["verified", "verified"],
    });
    expect(result.evidence.primarySources[0].name).toBe("event_eventos");
    expect(result.suggestedAction).toEqual({
      label: "Revisar relatorios",
      href: "/relatorios",
    });
  });

  it("preserves partial coverage and factual limitations", () => {
    const partialEntries = herdFlowMetric("rebanho_entradas", {
      status: "partial",
      coverage: {
        kind: "historical",
        state: "partial",
        scope: { fazendaId: FARM_ID, domain: "rebanho" },
        evidence: ["Detalhe reprodutivo incompleto."],
      },
      limitations: ["Ha entrada factual sem detalhe suficiente."],
    });
    const result = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "loaded",
          records: [
            { metricKey: "rebanho_entradas", result: partialEntries },
            {
              metricKey: "rebanho_saidas",
              result: herdFlowMetric("rebanho_saidas"),
            },
          ],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
    expect(result.data?.observedEntries).toBe(6);
    expect(result.evidence.limitations).toContain(
      "Ha entrada factual sem detalhe suficiente.",
    );
  });

  it("keeps missing, not loaded and not permitted sources distinct", () => {
    const missing = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "loaded",
          records: [],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );
    const notLoaded = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "not_loaded",
          convergence: { mode: "local_derived", verified: false },
        },
      }),
    );
    const notPermitted = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "not_available",
          convergence: { mode: "not_applicable", verified: false },
        },
      }),
    );

    expect(missing.status).toBe("unknown");
    expect(notLoaded.status).toBe("unknown");
    expect(notPermitted.status).toBe("not_permitted");
  });

  it("returns ambiguous for conflicting snapshots without choosing a winner", () => {
    const input = herdFlowInput();
    const result = buildHerdFlowReviewRecommendation({
      ...input,
      metrics: {
        ...input.metrics,
        records: [
          ...(input.metrics.records ?? []),
          {
            metricKey: "rebanho_entradas",
            result: herdFlowMetric("rebanho_entradas", { value: 99 }),
          },
        ],
      },
    });

    expect(result.status).toBe("ambiguous");
    expect(result.data).toBeNull();
    expect(result.evidence.conflicts[0].code).toBe(
      "conflicting_herd_flow_metric",
    );
  });

  it("filters both metrics by fazenda and prevents cross-farm contamination", () => {
    const input = herdFlowInput();
    const result = buildHerdFlowReviewRecommendation({
      ...input,
      metrics: {
        ...input.metrics,
        records: [
          {
            metricKey: "rebanho_entradas",
            result: herdFlowMetric(
              "rebanho_entradas",
              { value: 999 },
              OTHER_FARM_ID,
            ),
          },
          {
            metricKey: "rebanho_saidas",
            result: herdFlowMetric(
              "rebanho_saidas",
              { value: 999 },
              OTHER_FARM_ID,
            ),
          },
          ...(input.metrics.records ?? []),
        ],
      },
    });

    expect(result.status).toBe("confirmed");
    expect(result.data?.observedEntries).toBe(6);
    expect(result.data?.observedExits).toBe(2);
    expect(result.evidence.coverage).toContain(`fazenda:${FARM_ID}`);
    expect(result.evidence.coverage).not.toContain(`fazenda:${OTHER_FARM_ID}`);
  });

  it("uses cutoff and timezone without presenting conflicting periods as certain", () => {
    const afterCutoff = herdFlowMetric("rebanho_entradas", {
      period: createMetricPeriod("2026-08-01", "2026-08-31", {
        timezone: "America/Sao_Paulo",
        timezoneSource: "farm",
      }),
    });
    const matchingExit = herdFlowMetric("rebanho_saidas", {
      period: afterCutoff.period,
    });
    const cutoffResult = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "loaded",
          records: [
            { metricKey: "rebanho_entradas", result: afterCutoff },
            { metricKey: "rebanho_saidas", result: matchingExit },
          ],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );
    const timezoneResult = buildHerdFlowReviewRecommendation(
      herdFlowInput({ timezone: "UTC" }),
    );

    expect(cutoffResult.status).toBe("partial");
    expect(cutoffResult.evidence.limitations).toContain(
      "O periodo metrico termina depois do cutoff; a leitura representa somente o conjunto observado ate o cutoff.",
    );
    expect(timezoneResult.status).toBe("ambiguous");
    expect(timezoneResult.evidence.conflicts[0].code).toBe(
      "herd_flow_timezone_conflict",
    );
  });

  it("does not confirm when either metric uses a runtime timezone fallback", () => {
    const runtimeExit = herdFlowMetric("rebanho_saidas", {
      period: createMetricPeriod("2026-08-01", "2026-08-23", {
        timezone: "America/Sao_Paulo",
        timezoneSource: "runtime",
      }),
    });
    const result = buildHerdFlowReviewRecommendation(
      herdFlowInput({
        metrics: {
          availability: "loaded",
          records: [
            {
              metricKey: "rebanho_entradas",
              result: herdFlowMetric("rebanho_entradas"),
            },
            { metricKey: "rebanho_saidas", result: runtimeExit },
          ],
          convergence: { mode: "local_derived", verified: true },
        },
      }),
    );

    expect(result.status).toBe("partial");
  });

  it("is deterministic, farm-isolated and does not mutate inputs", () => {
    const input = herdFlowInput();
    const snapshot = structuredClone(input);

    const first = buildHerdFlowReviewRecommendation(input);
    const second = buildHerdFlowReviewRecommendation(input);

    expect(second).toEqual(first);
    expect(input).toEqual(snapshot);
  });
});
