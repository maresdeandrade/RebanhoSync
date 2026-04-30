import { describe, expect, it } from "vitest";

import { computeNextSanitaryOccurrence } from "@/lib/sanitario/engine/scheduler";
import type {
  SanitaryExecutionRecord,
  SanitaryProtocolItemDomain,
  SanitaryScheduleKind,
  SanitarySubjectContext,
} from "@/lib/sanitario/models/domain";

const FARM_ID = "farm-1";
const ANIMAL_ID = "animal-1";

function now(date: string) {
  return {
    nowIso: `${date}T12:00:00.000Z`,
    timezone: "America/Sao_Paulo",
  };
}

function subject(): SanitarySubjectContext {
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

function item(input: {
  familyCode: string;
  itemCode: string;
  mode: SanitaryProtocolItemDomain["schedule"]["mode"];
  anchor: SanitaryProtocolItemDomain["schedule"]["anchor"];
  intervalDays?: number | null;
  ageStartDays?: number | null;
  dependsOnItemCode?: string | null;
  scheduleKind?: SanitaryScheduleKind | null;
  campaignMonths?: number[] | null;
}): SanitaryProtocolItemDomain {
  return {
    identity: {
      protocolId: `protocol-${input.familyCode}`,
      itemId: `item-${input.itemCode}`,
      familyCode: input.familyCode,
      itemCode: input.itemCode,
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    applicability: { type: "sempre" },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
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
      ageEndDays: null,
      dependsOnItemCode: input.dependsOnItemCode ?? null,
      generatesAgenda: true,
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

function completed(input: {
  familyCode: string;
  itemCode: string;
  completedAt: string;
  dedupKey: string;
}): SanitaryExecutionRecord {
  return {
    occurrenceId: `occ-${input.itemCode}-${input.completedAt}`,
    familyCode: input.familyCode,
    itemCode: input.itemCode,
    regimenVersion: 1,
    scopeType: "animal",
    scopeId: ANIMAL_ID,
    completedAt: input.completedAt,
    executionDate: input.completedAt,
    sourceEventId: `evt-${input.itemCode}-${input.completedAt}`,
    dedupKey: input.dedupKey,
    status: "completed",
  };
}

function rabiesItems() {
  return {
    d1: item({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_d1",
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 90,
      scheduleKind: "calendar_base",
    }),
    d2: item({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_d2",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 30,
      dependsOnItemCode: "raiva_d1",
      scheduleKind: "after_previous_completion",
    }),
    annual: item({
      familyCode: "raiva_herbivoros",
      itemCode: "raiva_anual",
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 365,
      dependsOnItemCode: "raiva_d2",
      scheduleKind: "rolling_from_last_completion",
    }),
  };
}

describe("sanitary scheduler sequential materialization", () => {
  it("raiva sem historico materializa D1 e bloqueia D2/anual", () => {
    const items = rabiesItems();
    const context = subject();

    expect(
      computeNextSanitaryOccurrence({
        item: items.d1,
        subject: context,
        history: [],
        now: now("2026-06-30"),
      }),
    ).toMatchObject({ materialize: true, reasonCode: "ready" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.d2,
        subject: context,
        history: [],
        now: now("2026-06-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "dependency_not_satisfied" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.annual,
        subject: context,
        history: [],
        now: now("2026-06-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "dependency_not_satisfied" });
  });

  it("raiva com D1 concluida agenda D2 em 30 dias e bloqueia anual", () => {
    const items = rabiesItems();
    const context = subject();
    const history = [
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d1",
        completedAt: "2026-06-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_d1:v1:window:2026-04-01",
      }),
    ];

    expect(
      computeNextSanitaryOccurrence({
        item: items.d1,
        subject: context,
        history,
        now: now("2026-07-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "already_materialized" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.d2,
        subject: context,
        history,
        now: now("2026-07-30"),
      }),
    ).toMatchObject({
      materialize: true,
      dueDate: "2026-07-30",
      reasonCode: "ready",
    });
    expect(
      computeNextSanitaryOccurrence({
        item: items.annual,
        subject: context,
        history,
        now: now("2026-07-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "dependency_not_satisfied" });
  });

  it("raiva com D1 e D2 concluidas nao recria D2 e materializa anual", () => {
    const items = rabiesItems();
    const context = subject();
    const history = [
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d1",
        completedAt: "2026-06-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_d1:v1:window:2026-04-01",
      }),
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d2",
        completedAt: "2026-07-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_d2:v1:interval:2026-07-30",
      }),
    ];

    expect(
      computeNextSanitaryOccurrence({
        item: items.d1,
        subject: context,
        history,
        now: now("2027-07-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "already_materialized" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.d2,
        subject: context,
        history,
        now: now("2027-07-30"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "already_materialized" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.annual,
        subject: context,
        history,
        now: now("2027-07-30"),
      }),
    ).toMatchObject({
      materialize: true,
      dueDate: "2027-07-30",
      reasonCode: "ready",
    });
  });

  it("raiva com anual concluido agenda proximo anual e nao reabre D2", () => {
    const items = rabiesItems();
    const context = subject();
    const history = [
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d1",
        completedAt: "2026-06-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_d1:v1:window:2026-04-01",
      }),
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_d2",
        completedAt: "2026-07-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_d2:v1:interval:2026-07-30",
      }),
      completed({
        familyCode: "raiva_herbivoros",
        itemCode: "raiva_anual",
        completedAt: "2027-07-30",
        dedupKey: "sanitario:animal:animal-1:raiva_herbivoros:raiva_anual:v1:interval:2027-07-30",
      }),
    ];

    expect(
      computeNextSanitaryOccurrence({
        item: items.d2,
        subject: context,
        history,
        now: now("2028-07-29"),
      }),
    ).toMatchObject({ materialize: false, reasonCode: "already_materialized" });
    expect(
      computeNextSanitaryOccurrence({
        item: items.annual,
        subject: context,
        history,
        now: now("2028-07-29"),
      }),
    ).toMatchObject({
      materialize: true,
      dueDate: "2028-07-29",
      reasonCode: "ready",
    });
  });

  it("nao altera recorrencia simples de clostridioses nem campanha sequencial de vermifugacao", () => {
    const context = subject();
    const clostridio = item({
      familyCode: "clostridioses",
      itemCode: "clostridio-anual",
      mode: "rotina_recorrente",
      anchor: "ultima_conclusao_mesma_familia",
      intervalDays: 365,
      scheduleKind: "rolling_from_last_completion",
    });
    const secaJulho = item({
      familyCode: "controle_estrategico_parasitas",
      itemCode: "seca-julho",
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [7],
      dependsOnItemCode: "seca-maio",
      scheduleKind: "calendar_base",
    });

    expect(
      computeNextSanitaryOccurrence({
        item: clostridio,
        subject: context,
        history: [
          completed({
            familyCode: "clostridioses",
            itemCode: "clostridio-anual",
            completedAt: "2026-01-01",
            dedupKey: "sanitario:animal:animal-1:clostridioses:clostridio-anual:v1:interval:2026-01-01",
          }),
        ],
        now: now("2027-01-01"),
      }),
    ).toMatchObject({ materialize: true, reasonCode: "ready" });
    expect(
      computeNextSanitaryOccurrence({
        item: secaJulho,
        subject: context,
        history: [
          completed({
            familyCode: "controle_estrategico_parasitas",
            itemCode: "seca-maio",
            completedAt: "2027-05-10",
            dedupKey: "sanitario:animal:animal-1:controle_estrategico_parasitas:seca-maio:v1:campaign:2027-05",
          }),
          completed({
            familyCode: "controle_estrategico_parasitas",
            itemCode: "seca-julho",
            completedAt: "2026-07-10",
            dedupKey: "sanitario:animal:animal-1:controle_estrategico_parasitas:seca-julho:v1:campaign:2026-07",
          }),
        ],
        now: now("2027-07-10"),
      }),
    ).toMatchObject({ materialize: true, reasonCode: "ready" });
  });
});
