import { describe, expect, it } from "vitest";

import {
  buildSanitaryBaseCalendarPayload,
  readSanitaryBaseCalendar,
} from "@/lib/sanitario/engine/calendar";
import { buildSanitaryDedupKey } from "@/lib/sanitario/engine/dedup";
import type {
  SanitaryCalendarAnchor,
  SanitaryCalendarMode,
  SanitaryExecutionRecord,
  SanitaryProtocolItemDomain,
  SanitaryScheduleKind,
  SanitarySubjectContext,
} from "@/lib/sanitario/models/domain";
import {
  STANDARD_PROTOCOLS,
  buildStandardProtocolItemPayload,
} from "@/lib/sanitario/catalog/baseProtocols";
import {
  findSanitaryFamilyConflict,
  resolveProtocolPrecedence,
} from "@/lib/sanitario/engine/protocolLayers";
import { computeNextSanitaryOccurrence } from "@/lib/sanitario/engine/scheduler";
import { readCanonicalBaselineMigration } from "../../../../../tests/helpers/supabaseMigrations";

const FARM_ID = "farm-1";
const ANIMAL_ID = "11111111-1111-1111-1111-111111111111";

const SQL_CALENDAR_MODES = new Set([
  "campaign",
  "age_window",
  "rolling_interval",
  "immediate",
  "clinical_protocol",
]);

function now(date: string) {
  return {
    nowIso: `${date}T12:00:00.000Z`,
    timezone: "America/Sao_Paulo",
  };
}

function buildSubject(
  animal: Partial<NonNullable<SanitarySubjectContext["animal"]>> = {},
): SanitarySubjectContext {
  return {
    scopeType: "animal",
    scopeId: ANIMAL_ID,
    animal: {
      id: ANIMAL_ID,
      birthDate: "2026-01-01",
      sex: "femea",
      species: "bovino",
      categoryCode: "bezerra",
      reproductionStatus: null,
      ...animal,
    },
    lote: null,
    fazenda: {
      id: FARM_ID,
      uf: "GO",
      municipio: "Goiania",
    },
    activeRisks: ["raiva"],
    activeEvents: [],
  };
}

function buildItem(input: {
  familyCode: string;
  itemCode: string;
  mode: SanitaryCalendarMode;
  anchor: SanitaryCalendarAnchor;
  intervalDays?: number | null;
  campaignMonths?: number[] | null;
  ageStartDays?: number | null;
  ageEndDays?: number | null;
  dependsOnItemCode?: string | null;
  generatesAgenda?: boolean;
  sexTarget?: "macho" | "femea" | "sem_restricao";
  layer?: "official" | "standard" | "custom";
  scheduleKind?: SanitaryScheduleKind | null;
}): SanitaryProtocolItemDomain {
  return {
    identity: {
      protocolId: `protocol-${input.familyCode}`,
      itemId: `item-${input.itemCode}`,
      familyCode: input.familyCode,
      itemCode: input.itemCode,
      regimenVersion: 1,
      layer: input.layer ?? "official",
      scopeType: "animal",
    },
    applicability: { type: "sempre" },
    eligibility: {
      sexTarget: input.sexTarget ?? "sem_restricao",
      ageMinDays: input.ageStartDays ?? null,
      ageMaxDays: input.ageEndDays ?? null,
      species: ["bovino"],
      categoryCodes: null,
    },
    schedule: {
      mode: input.mode,
      anchor: input.anchor,
      scheduleKind: input.scheduleKind ?? null,
      intervalDays: input.intervalDays ?? null,
      campaignMonths: input.campaignMonths ?? null,
      ageStartDays: input.ageStartDays ?? null,
      ageEndDays: input.ageEndDays ?? null,
      dependsOnItemCode: input.dependsOnItemCode ?? null,
      generatesAgenda: input.generatesAgenda ?? true,
      operationalLabel: null,
      notes: null,
      instructions: null,
    },
    compliance: {
      level: "obrigatorio",
      mandatory: true,
      requiresVeterinarian: false,
      requiresDocument: false,
      requiredDocumentTypes: null,
      blocksExecutionWithoutVeterinarian: false,
      blocksCompletionWithoutDocument: false,
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: false,
    },
  };
}

function completedRecord(input: {
  familyCode: string;
  itemCode: string;
  completedAt: string;
  dedupKey: string;
}): SanitaryExecutionRecord {
  return {
    occurrenceId: `occ-${input.itemCode}`,
    familyCode: input.familyCode,
    itemCode: input.itemCode,
    regimenVersion: 1,
    scopeType: "animal",
    scopeId: ANIMAL_ID,
    completedAt: input.completedAt,
    executionDate: input.completedAt,
    sourceEventId: `evt-${input.itemCode}`,
    dedupKey: input.dedupKey,
    status: "completed",
  };
}

function renderSqlCanonicalDedupKey(input: {
  scopeType: "animal" | "lote" | "fazenda";
  scopeId: string;
  familyCode: string;
  itemCode: string;
  regimenVersion: number;
  periodMode: string;
  periodKey: string;
  jurisdiction?: string | null;
}) {
  const key = [
    "sanitario",
    input.scopeType.toLowerCase(),
    input.scopeId,
    input.familyCode.toLowerCase(),
    input.itemCode.toLowerCase(),
    `v${input.regimenVersion}`,
    input.periodMode.toLowerCase(),
    input.periodKey,
  ].join(":");

  return input.jurisdiction ? `${key}:${input.jurisdiction.toUpperCase()}` : key;
}

describe("sanitario engine golden/parity contracts", () => {
  it("golden: brucelose female 3-8 months produces one agenda candidate with stable dedup", () => {
    const item = buildItem({
      familyCode: "brucelose",
      itemCode: "brucelose-b19",
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 90,
      ageEndDays: 240,
      sexTarget: "femea",
    });
    const subject = buildSubject({ birthDate: "2026-02-01", sex: "femea" });

    const first = computeNextSanitaryOccurrence({
      item,
      subject,
      history: [],
      now: now("2026-06-30"),
    });

    expect(first).toMatchObject({
      materialize: true,
      dueDate: "2026-06-30",
      reasonCode: "ready",
      dedupKey: `sanitario:animal:${ANIMAL_ID}:brucelose:brucelose-b19:v1:window:2026-05-02`,
    });

    const duplicate = computeNextSanitaryOccurrence({
      item,
      subject,
      history: [
        {
          ...completedRecord({
            familyCode: "brucelose",
            itemCode: "brucelose-b19",
            completedAt: "2026-06-30",
            dedupKey: first.dedupKey ?? "",
          }),
          status: "pending",
        },
      ],
      now: now("2026-06-30"),
    });

    expect(duplicate).toMatchObject({
      materialize: false,
      reasonCode: "already_materialized",
      dedupKey: first.dedupKey,
    });
  });

  it("golden: raiva D1 is generated while D2 is blocked without D1 history", () => {
    const d1 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_d1",
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 90,
    });
    const d2 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_reforco_30d",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 30,
      dependsOnItemCode: "raiva_d1",
      scheduleKind: "after_previous_completion",
    });
    const subject = buildSubject({ birthDate: "2026-01-01" });

    const d1Result = computeNextSanitaryOccurrence({
      item: d1,
      subject,
      history: [],
      now: now("2026-06-30"),
    });
    const d2WithoutHistory = computeNextSanitaryOccurrence({
      item: d2,
      subject,
      history: [],
      now: now("2026-06-30"),
    });

    expect(d1Result).toMatchObject({
      materialize: true,
      reasonCode: "ready",
      dedupKey: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
    });
    expect(d2WithoutHistory).toMatchObject({
      materialize: false,
      reasonCode: "dependency_not_satisfied",
      dedupKey: null,
    });
  });

  it("golden: raiva D1 completed schedules D2 in 30 days without recreating D1", () => {
    const d1 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_d1",
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 90,
    });
    const d2 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_reforco_30d",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 30,
      dependsOnItemCode: "raiva_d1",
      scheduleKind: "after_previous_completion",
    });
    const subject = buildSubject({ birthDate: "2026-01-01" });
    const d1Dedup = `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`;
    const history = [
      completedRecord({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d1",
        completedAt: "2026-06-30",
        dedupKey: d1Dedup,
      }),
    ];

    const d1Replay = computeNextSanitaryOccurrence({
      item: d1,
      subject,
      history,
      now: now("2026-07-30"),
    });
    const d2Result = computeNextSanitaryOccurrence({
      item: d2,
      subject,
      history,
      now: now("2026-07-30"),
    });

    expect(d1Replay.reasonCode).toBe("already_materialized");
    expect(d2Result).toMatchObject({
      materialize: true,
      dueDate: "2026-07-30",
      reasonCode: "ready",
      dedupKey: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_reforco_30d:v1:interval:2026-07-30`,
    });
    expect(d2Result.dedupKey).not.toBe(d1Dedup);
  });

  it("golden: raiva D1 and D2 completed schedules annual without recreating D2", () => {
    const d1 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_d1",
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 90,
    });
    const d2 = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_reforco_30d",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 30,
      dependsOnItemCode: "raiva_d1",
      scheduleKind: "after_previous_completion",
    });
    const annual = buildItem({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_anual",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 365,
      dependsOnItemCode: "raiva_reforco_30d",
      scheduleKind: "rolling_from_last_completion",
    });
    const subject = buildSubject({ birthDate: "2026-01-01" });
    const history = [
      completedRecord({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d1",
        completedAt: "2026-06-30",
        dedupKey: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
      }),
      completedRecord({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_reforco_30d",
        completedAt: "2026-07-30",
        dedupKey: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_reforco_30d:v1:interval:2026-07-30`,
      }),
    ];

    expect(
      computeNextSanitaryOccurrence({ item: d1, subject, history, now: now("2027-07-30") })
        .reasonCode,
    ).toBe("already_materialized");
    const d2Replay = computeNextSanitaryOccurrence({
      item: d2,
      subject,
      history,
      now: now("2027-07-30"),
    });

    expect(d2Replay).toMatchObject({
      materialize: false,
      reasonCode: "already_materialized",
      dedupKey: null,
    });

    const annualResult = computeNextSanitaryOccurrence({
      item: annual,
      subject,
      history,
      now: now("2027-07-30"),
    });

    expect(annualResult).toMatchObject({
      materialize: true,
      dueDate: "2027-07-30",
      reasonCode: "ready",
      dedupKey: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_anual:v1:interval:2027-07-30`,
    });
  });

  it("contract: clostridioses official/custom overlap has deterministic layer precedence", () => {
    const protocols = [
      {
        id: "official-clostridioses",
        deleted_at: null,
        payload: { origem: "catalogo_oficial", family_code: "clostridioses" },
      },
      {
        id: "custom-clostridioses",
        deleted_at: null,
        payload: {
          origem: "customizado_fazenda",
          family_code: "clostridioses",
          operational_complement: true,
        },
      },
    ];

    expect(resolveProtocolPrecedence(protocols, "clostridioses")).toEqual({
      winnerId: "official-clostridioses",
      losers: ["custom-clostridioses"],
    });
    expect(
      findSanitaryFamilyConflict({
        protocols,
        candidateFamilyCode: "clostridioses",
        candidateLayer: "custom",
      }),
    ).toEqual({
      familyCode: "clostridioses",
      reason: "official_family_already_active",
      existingLayer: "official",
      protocolId: "official-clostridioses",
    });
  });

  it.each([
    ["PNEFA/aftosa", "febre_aftosa_vigilancia", "sindrome_vesicular_alerta"],
    ["IN50/notificaveis", "doencas_notificaveis", "doencas_notificaveis_alerta"],
    ["GTA/checklist", "transito_documental", "gta_checklist"],
  ])("contract: %s remains compliance-only and does not enter agenda", (_label, familyCode, itemCode) => {
    const item = buildItem({
      familyCode,
      itemCode,
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [6],
      generatesAgenda: false,
    });

    const result = computeNextSanitaryOccurrence({
      item,
      subject: buildSubject(),
      history: [],
      now: now("2026-06-30"),
    });

    expect(result).toMatchObject({
      materialize: false,
      reasonCode: "agenda_disabled",
      dedupKey: null,
    });
  });

  it("contract: vermifugacao agenda materialization is controlled by gera_agenda, not vaccine-only type", () => {
    const baseline = readCanonicalBaselineMigration();
    const vermifugacao = STANDARD_PROTOCOLS.find(
      (protocol) => protocol.family_code === "controle_estrategico_parasitas",
    );
    const maio = vermifugacao?.itens.find((item) => item.item_code === "seca-maio");

    expect(baseline).toContain("psi.gera_agenda");
    expect(baseline).not.toContain("and psi.tipo = 'vacinacao'");
    expect(maio?.gera_agenda).toBe(true);
    expect(
      renderSqlCanonicalDedupKey({
        scopeType: "animal",
        scopeId: ANIMAL_ID,
        familyCode: "controle_estrategico_parasitas",
        itemCode: "seca-maio",
        regimenVersion: 1,
        periodMode: "campaign",
        periodKey: "2026-05",
      }),
    ).toBe(
      `sanitario:animal:${ANIMAL_ID}:controle_estrategico_parasitas:seca-maio:v1:campaign:2026-05`,
    );
  });

  it("contract: medicamento/carencia is metadata for this engine, not an agenda blocker", () => {
    const baseline = readCanonicalBaselineMigration();
    const medicationPayload = {
      tipo: "medicamento",
      produto: "Oxitetraciclina L.A.",
      gera_agenda: false,
      carencia_regra_json: { leite_dias: 7, carne_dias: 28 },
    };

    expect(medicationPayload.carencia_regra_json).toEqual({
      leite_dias: 7,
      carne_dias: 28,
    });
    expect(baseline).toContain("carencia_regra_json jsonb");
    expect(baseline).not.toContain("withholding");
  });

  it("contract: agenda closing remains a transactional SQL RPC boundary", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("public.sanitario_complete_agenda_with_event");
    expect(baseline).toContain("for update");
    expect(baseline).toContain("where id = _agenda_item_id");
    expect(baseline).toContain("source_task_id");
    expect(baseline).toContain("source_client_op_id");
    expect(baseline).toContain("'sanitary_completion'");
    expect(baseline).toContain("'sanitary_completion_key', v_agenda.dedup_key");
    expect(baseline).toContain("v_enriched_payload");
    expect(baseline).toContain("perform public.sanitario_recompute_agenda_core");
  });
});

describe("sanitario engine SQL contracts", () => {
  it("contract: calendario_base emitted by TS uses SQL-recognized vocabulary", () => {
    const tsPayloads = [
      buildSanitaryBaseCalendarPayload({
        mode: "campanha",
        anchor: "sem_ancora",
        label: "Campanha",
        months: [5],
      }),
      buildSanitaryBaseCalendarPayload({
        mode: "janela_etaria",
        anchor: "nascimento",
        label: "Janela etaria",
        ageStartDays: 90,
        ageEndDays: 240,
      }),
      buildSanitaryBaseCalendarPayload({
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        label: "Rotina recorrente",
        intervalDays: 365,
      }),
    ];

    const observed = tsPayloads.map((payload) => {
      const rawRule = payload.calendario_base as Record<string, unknown>;
      const rule = readSanitaryBaseCalendar(payload);
      return {
        emittedMode: rawRule.mode,
        readMode: rule?.mode,
        sqlRecognizesEmittedMode: SQL_CALENDAR_MODES.has(
          typeof rawRule.mode === "string" ? rawRule.mode : "",
        ),
      };
    });

    expect(observed).toEqual([
      {
        emittedMode: "campaign",
        readMode: "campanha",
        sqlRecognizesEmittedMode: true,
      },
      {
        emittedMode: "age_window",
        readMode: "janela_etaria",
        sqlRecognizesEmittedMode: true,
      },
      {
        emittedMode: "rolling_interval",
        readMode: "rotina_recorrente",
        sqlRecognizesEmittedMode: true,
      },
    ]);
  });

  it("contract: SQL core still documents the English calendar vocabulary", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("case coalesce(_calendar_mode, 'legacy')");
    expect(baseline).toContain("when 'campaign' then");
    expect(baseline).toContain("when 'age_window' then");
    expect(baseline).toContain("when 'rolling_interval' then");
    expect(baseline).toContain("when 'immediate' then");
    expect(baseline).toContain("when 'clinical_protocol' then");
  });

  it("contract: SQL agenda recompute stays scoped to active animals and agenda-enabled items", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("create or replace function public.sanitario_recompute_agenda_core");
    expect(baseline).toContain("psi.gera_agenda");
    expect(baseline).toContain("a.especie as animal_especie");
    expect(baseline).toContain("a.status = 'ativo'");
    expect(baseline).toContain("(_animal_id is null or a.id = _animal_id)");
    expect(baseline).toContain("data_nascimento is not null");
    expect(baseline).toContain("or sexo = 'F'::public.sexo_enum");
  });

  it("contract: SQL agenda recompute applies the transitional species gate", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("psi.payload->'species'");
    expect(baseline).toContain("psi.payload->'especies_alvo'");
    expect(baseline).toContain("psi.payload #> '{gatilho_json,species}'");
    expect(baseline).toContain("raw.species_targets_json is not null as has_explicit_species_target");
    expect(baseline).toContain("when a.especie is null then true");
    expect(baseline).toContain("animal_especie is null");
    expect(baseline).toContain("'brucelose'");
    expect(baseline).toContain("'raiva_herbivoros'");
    expect(baseline).toContain("and animal_especie in ('bovino', 'bubalino')");
    expect(baseline).toContain("has_explicit_species_target and species_target_matches");
  });

  it("contract: SQL agenda recompute gates rabies by farm risk config and explicit activation", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("left join public.fazenda_sanidade_config fsc");
    expect(baseline).toContain("fsc.deleted_at is null");
    expect(baseline).toContain("psi.payload->>'family_code'");
    expect(baseline).toContain("psi.payload #>> '{regime_sanitario,family_code}'");
    expect(baseline).toContain("psi.payload #>> '{agenda_activation,explicit}'");
    expect(baseline).toContain("psi.payload #>> '{gatilho_json,requires_explicit_activation}'");
    expect(baseline).toContain("psi.payload #> '{agenda_activation,risk_values}'");
    expect(baseline).toContain("psi.payload #> '{gatilho_json,risk_values}'");
    expect(baseline).toContain("jsonb_array_elements_text(raw.risk_values_json)");
    expect(baseline).toContain("rv.value = fsc.zona_raiva_risco");
    expect(baseline).toContain("coalesce(family_code, '') <> 'raiva_herbivoros'");
    expect(baseline).toContain("zona_raiva_risco is not null");
    expect(baseline).toContain("has_explicit_agenda_activation");
    expect(baseline).toContain("rabies_risk_allowed");
  });

  it("contract: SQL agenda recompute gates recommended technical protocols by explicit activation", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("fsc.pressao_helmintos");
    expect(baseline).toContain("fsc.pressao_carrapato");
    expect(baseline).toContain("'clostridioses'");
    expect(baseline).toContain("'leptospirose_ibr_bvd'");
    expect(baseline).toContain("'controle_parasitario'");
    expect(baseline).toContain("'controle_carrapato'");
    expect(baseline).toContain("or has_explicit_agenda_activation");
    expect(baseline).toContain("pressao_helmintos is not null");
    expect(baseline).toContain("and helminth_risk_allowed");
    expect(baseline).toContain("pressao_carrapato is not null");
    expect(baseline).toContain("and tick_risk_allowed");
  });

  it("contract: SQL core uses canonical sanitary dedup instead of free templates", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("public.render_sanitario_canonical_dedup_key");
    expect(baseline).toContain("public.sanitario_dedup_period_mode");
    expect(baseline).toContain("coalesce(payload->>'official_item_code'");
    expect(baseline).toContain("(data_nascimento + age_min_days)::text");
    expect(baseline).toContain("as candidate_dedup_key");
    expect(baseline).toContain("ai.dedup_key = p.candidate_dedup_key");
    expect(baseline).toContain("ai.status = 'concluido'");
    expect(baseline).toContain("ai.source_evento_id is not null");
    expect(baseline).toContain("join public.eventos_sanitario es");
    expect(baseline).toContain("es.payload #>> '{sanitary_completion,sanitary_completion_key}' = p.candidate_dedup_key");
    expect(baseline).toContain("on conflict (fazenda_id, dedup_key)");
  });

  it("contract: legacy SQL dedup wrapper ignores free templates and delegates to canonical key", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("create or replace function public.render_dedup_key");
    expect(baseline).toContain("_dedup_template text");
    expect(baseline).toContain("public.render_sanitario_canonical_dedup_key");
    expect(baseline).toContain("Wrapper legado mantido por assinatura; ignora templates livres");
  });

  it("contract: active agenda unique index still protects canonical dedup", () => {
    const baseline = readCanonicalBaselineMigration();

    expect(baseline).toContain("create unique index ux_agenda_dedup_active");
    expect(baseline).toContain("on public.agenda_itens(fazenda_id, dedup_key)");
    expect(baseline).toContain("where status = 'agendado' and deleted_at is null and dedup_key is not null");
  });

  it("contract: standard library and official calendar payloads both emit SQL vocabulary", () => {
    const standardClostridioses = STANDARD_PROTOCOLS.find(
      (protocol) => protocol.family_code === "clostridioses",
    );
    const clostridioItem = standardClostridioses?.itens[0];
    const standardPayload =
      standardClostridioses && clostridioItem
        ? buildStandardProtocolItemPayload(standardClostridioses, clostridioItem)
        : {};
    const standardRule = readSanitaryBaseCalendar(standardPayload);
    const officialStylePayload = buildSanitaryBaseCalendarPayload({
      mode: "janela_etaria",
      anchor: "nascimento",
      label: "Brucelose B19",
      ageStartDays: 90,
      ageEndDays: 240,
    });
    const standardRawRule = standardPayload.calendario_base as Record<
      string,
      unknown
    >;
    const officialRawRule = officialStylePayload.calendario_base as Record<
      string,
      unknown
    >;
    const officialRule = readSanitaryBaseCalendar(officialStylePayload);

    expect({
      emittedStandardMode: standardRawRule.mode,
      readStandardMode: standardRule?.mode,
      sqlRecognizesStandardMode: SQL_CALENDAR_MODES.has(
        typeof standardRawRule.mode === "string" ? standardRawRule.mode : "",
      ),
      emittedOfficialMode: officialRawRule.mode,
      readOfficialMode: officialRule?.mode,
      sqlRecognizesOfficialMode: SQL_CALENDAR_MODES.has(
        typeof officialRawRule.mode === "string" ? officialRawRule.mode : "",
      ),
    }).toEqual({
      emittedStandardMode: "rolling_interval",
      readStandardMode: "rotina_recorrente",
      sqlRecognizesStandardMode: true,
      emittedOfficialMode: "age_window",
      readOfficialMode: "janela_etaria",
      sqlRecognizesOfficialMode: true,
    });
  });

  it("contract: standard protocol library no longer emits free dedup templates", () => {
    const templates = STANDARD_PROTOCOLS.flatMap((protocol) =>
      protocol.itens
        .map((item) => item.dedup_template)
        .filter((template): template is string => Boolean(template)),
    );

    expect(templates).toEqual([]);
  });

  it("contract: TS dedup keys and SQL canonical outputs are equivalent", () => {
    const rows = [
      {
        case: "Brucelose",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "brucelose",
          itemCode: "brucelose-b19",
          regimenVersion: 1,
          mode: "janela_etaria",
          periodKey: "2026-05-02",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "brucelose",
          itemCode: "brucelose-b19",
          regimenVersion: 1,
          periodMode: "window",
          periodKey: "2026-05-02",
        }),
      },
      {
        case: "Raiva D1",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_d1",
          regimenVersion: 1,
          mode: "janela_etaria",
          periodKey: "2026-04-01",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_d1",
          regimenVersion: 1,
          periodMode: "window",
          periodKey: "2026-04-01",
        }),
      },
      {
        case: "Raiva D2",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_reforco_30d",
          regimenVersion: 1,
          mode: "rotina_recorrente",
          periodKey: "2026-07-30",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_reforco_30d",
          regimenVersion: 1,
          periodMode: "interval",
          periodKey: "2026-07-30",
        }),
      },
      {
        case: "Raiva anual",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_anual",
          regimenVersion: 1,
          mode: "rotina_recorrente",
          periodKey: "2027-07-30",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_anual",
          regimenVersion: 1,
          periodMode: "interval",
          periodKey: "2027-07-30",
        }),
      },
      {
        case: "Clostridioses",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "clostridioses",
          itemCode: "clostridio-anual",
          regimenVersion: 1,
          mode: "rotina_recorrente",
          periodKey: "2026-01-01",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "clostridioses",
          itemCode: "clostridio-anual",
          regimenVersion: 1,
          periodMode: "interval",
          periodKey: "2026-01-01",
        }),
      },
      {
        case: "Vermifugacao",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "controle_estrategico_parasitas",
          itemCode: "seca-maio",
          regimenVersion: 1,
          mode: "campanha",
          periodKey: "2026-05",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "controle_estrategico_parasitas",
          itemCode: "seca-maio",
          regimenVersion: 1,
          periodMode: "campaign",
          periodKey: "2026-05",
        }),
      },
      {
        case: "GTA/checklist",
        dedupTs: null,
        dedupSql: null,
      },
      {
        case: "Custom vs oficial",
        dedupTs: buildSanitaryDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_d1",
          regimenVersion: 1,
          mode: "janela_etaria",
          periodKey: "2026-04-01",
        }),
        dedupSql: renderSqlCanonicalDedupKey({
          scopeType: "animal",
          scopeId: ANIMAL_ID,
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_d1",
          regimenVersion: 1,
          periodMode: "window",
          periodKey: "2026-04-01",
        }),
      },
    ].map((row) => ({
      ...row,
      equivalent: row.dedupTs === row.dedupSql,
    }));

    expect(rows).toEqual([
      {
        case: "Brucelose",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:brucelose:brucelose-b19:v1:window:2026-05-02`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:brucelose:brucelose-b19:v1:window:2026-05-02`,
        equivalent: true,
      },
      {
        case: "Raiva D1",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
        equivalent: true,
      },
      {
        case: "Raiva D2",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_reforco_30d:v1:interval:2026-07-30`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_reforco_30d:v1:interval:2026-07-30`,
        equivalent: true,
      },
      {
        case: "Raiva anual",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_anual:v1:interval:2027-07-30`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_anual:v1:interval:2027-07-30`,
        equivalent: true,
      },
      {
        case: "Clostridioses",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:clostridioses:clostridio-anual:v1:interval:2026-01-01`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:clostridioses:clostridio-anual:v1:interval:2026-01-01`,
        equivalent: true,
      },
      {
        case: "Vermifugacao",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:controle_estrategico_parasitas:seca-maio:v1:campaign:2026-05`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:controle_estrategico_parasitas:seca-maio:v1:campaign:2026-05`,
        equivalent: true,
      },
      {
        case: "GTA/checklist",
        dedupTs: null,
        dedupSql: null,
        equivalent: true,
      },
      {
        case: "Custom vs oficial",
        dedupTs: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
        dedupSql: `sanitario:animal:${ANIMAL_ID}:raiva_herbivoros:raiva_d1:v1:window:2026-04-01`,
        equivalent: true,
      },
    ]);
  });
});
