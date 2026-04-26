/**
 * Testes para PR2: Protocol Agenda Eligibility (Single Gate)
 *
 * Cobertura obrigatória:
 * - Metadados de camada (activation_state, superseded)
 * - gera_agenda=true/false
 * - Aplicabilidade
 * - Elegibilidade
 * - Dependência
 * - Modo de calendário válido
 * - Dedup check
 */

import { describe, expect, it } from "vitest";
import { computeProtocolAgendaEligibility } from "@/lib/sanitario/scheduler";
import type { SanitaryProtocolMetadata } from "@/lib/sanitario/protocolLayers";
import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SchedulerNowContext,
} from "@/lib/sanitario/domain";
import { buildSchedulerNowContext } from "./helpers/schedulerNow";

// Builders
const buildMetadata = (
  overrides?: Partial<SanitaryProtocolMetadata>,
): SanitaryProtocolMetadata => ({
  protocolId: "proto-1",
  familyCode: "test_family",
  layer: "official",
  activationState: "active_official",
  supersededByProtocolId: null,
  supersededByFamilyCode: null,
  hiddenFromPrimaryList: false,
  operationalComplement: false,
  ...overrides,
});

const buildItem = (
  overrides?: Partial<SanitaryProtocolItemDomain>,
): SanitaryProtocolItemDomain => ({
  identity: {
    protocolId: "proto-1",
    itemId: "item-1",
    familyCode: "test_family",
    itemCode: "dose_1",
    regimenVersion: 1,
    layer: "official",
    scopeType: "animal",
  },
  schedule: {
    generatesAgenda: true,
    mode: "campanha",
    anchor: "nascimento",
    intervalDays: 30,
    campaignMonths: [3, 9],
    ageStartDays: 0,
    ageEndDays: 36500,
    dependsOnItemCode: null,
  },
  eligibility: {
    sexTarget: "sem_restricao",
    ageMinDays: null,
    ageMaxDays: null,
    speciesAllowed: null,
    categoryCodes: null,
  },
  applicability: {
    type: "sempre",
    jurisdiction: null,
    risk: null,
    event: null,
    animalProfile: null,
  },
  compliance: {
    isComplianceRequired: false,
    complianceDocType: null,
  },
  ...(overrides as Partial<typeof BASE_ITEM>),
} as SanitaryProtocolItemDomain);

const BASE_ITEM: SanitaryProtocolItemDomain = {
  identity: {
    protocolId: "proto-1",
    itemId: "item-1",
    familyCode: "test_family",
    itemCode: "dose_1",
    regimenVersion: 1,
    layer: "official",
    scopeType: "animal",
  },
  schedule: {
    generatesAgenda: true,
    mode: "campanha",
    anchor: "nascimento",
    intervalDays: 30,
    campaignMonths: [3, 9],
    ageStartDays: 0,
    ageEndDays: 36500,
    dependsOnItemCode: null,
  },
  eligibility: {
    sexTarget: "sem_restricao",
    ageMinDays: null,
    ageMaxDays: null,
    speciesAllowed: null,
    categoryCodes: null,
  },
  applicability: {
    type: "sempre",
    jurisdiction: null,
    risk: null,
    event: null,
    animalProfile: null,
  },
  compliance: {
    isComplianceRequired: false,
    complianceDocType: null,
  },
} as SanitaryProtocolItemDomain;

const buildSubject = (
  overrides?: Partial<SanitarySubjectContext>,
): SanitarySubjectContext => ({
  animal: {
    id: "animal-1",
    species: "bovino",
    sex: "F",
    birthDate: "2025-01-15",
    categoryCode: "bezerroa",
  },
  fazenda: {
    id: "farm-1",
    uf: "SP",
    now: "2026-04-12",
  },
  activeRisks: [],
  activeEvents: [],
  ...overrides,
} as SanitarySubjectContext);

const buildNow = (
  overrides?: Partial<SchedulerNowContext>,
): SchedulerNowContext => ({
  ...buildSchedulerNowContext("2026-04-12"),
  ...overrides,
} as SchedulerNowContext);

describe("PR2: computeProtocolAgendaEligibility", () => {
  it("eligible: active_official with valid setup", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata(),
      item: buildItem(),
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(true);
    expect(result.blockedBy).toBeNull();
  });

  it("eligible: active_custom with operational_complement=true", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata({
        activationState: "active_custom",
        operationalComplement: true,
      }),
      item: buildItem(),
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(true);
    expect(result.blockedBy).toBeNull();
  });

  it("ineligible: superseded_legacy hidden from list", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata({
        activationState: "superseded_legacy",
        hiddenFromPrimaryList: true,
      }),
      item: buildItem(),
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toContain("superseded");
  });

  it("ineligible: draft_template not active", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata({
        activationState: "draft_template",
      }),
      item: buildItem(),
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toContain("not_active");
  });

  it("ineligible: gera_agenda=false", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata(),
      item: {
        ...BASE_ITEM,
        schedule: {
          ...BASE_ITEM.schedule,
          generatesAgenda: false,
        },
      },
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toContain("agenda_disabled");
  });

  it("ineligible: invalid calendar_mode", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: buildMetadata(),
      item: {
        ...BASE_ITEM,
        schedule: {
          generatesAgenda: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mode: "unknown_mode" as any,
          anchor: "nascimento",
          intervalDays: 30,
          campaignMonths: [3, 9],
          ageStartDays: 0,
          ageEndDays: 36500,
          dependsOnItemCode: null,
        },
      },
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedBy).toContain("calendar_mode_not_materializable");
  });

  it("backward compat: null metadata still checks other gates", () => {
    const result = computeProtocolAgendaEligibility({
      protocolMetadata: null,
      item: buildItem(),
      subject: buildSubject(),
      history: [],
      now: buildNow(),
    });

    // Should not be blocked by missing metadata
    expect(result.blockedBy?.includes("superseded")).toBeFalsy();
  });
});
