/**
 * Fixture: Raiva — Risco Ativo, Primeira Dose
 *
 * Cenário: Animal com risco de raiva ativado, apresenta ocorrência em campanha
 * Resultado esperado: ready (materialize=true, campanha mai-jun-jul)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  ComputeNextSanitaryOccurrenceResult,
} from "@/lib/sanitario/models/domain";
import { buildSchedulerNowContext } from "../helpers/schedulerNow";

export const raivaRiscoPrimoVacinacao = {
  domain: {
    identity: {
      protocolId: "prot-raiva-v1",
      itemId: "item-raiva-dose-1",
      familyCode: "raiva",
      itemCode: "dose_1",
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    schedule: {
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [5, 6, 7], // maio, junho, julho
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: "Vacinação contra raiva (dose 1)",
      notes: "Campanha anual maio-julho",
      instructions: "Via parenteral, 1 dose 2 mL",
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: 60,
      ageMaxDays: null,
      species: ["bovino"],
      categoryCodes: null,
    },
    applicability: {
      type: "risco",
      risk: "raiva",
    },
    compliance: {
      level: "obrigatorio",
      mandatory: true,
      requiresVeterinarian: true,
      requiresDocument: true,
      requiredDocumentTypes: ["laudo_vacinacao"],
      blocksExecutionWithoutVeterinarian: true,
      blocksCompletionWithoutDocument: false,
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: true,
    },
  } as SanitaryProtocolItemDomain,

  subject: {
    scopeType: "animal",
    scopeId: "animal-vaca-002",
    animal: {
      id: "animal-vaca-002",
      birthDate: "2025-01-15",
      sex: "femea",
      species: "bovino",
      categoryCode: "vaca",
      payload: { taxonomy_facts: {} },
    },
    lote: { id: "lote-002", name: "Matriz" },
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [
      { riskCode: "raiva", activatedAt: "2026-06-01", closedAt: null },
    ],
    activeEvents: [],
  } as SanitarySubjectContext,

  history: [] as SanitaryExecutionRecord[],

  now: buildSchedulerNowContext("2026-06-20"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-06-20",
    dedupKey: "sanitario:animal:animal-vaca-002:raiva:dose_1:v1:campaign:2026-06",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
