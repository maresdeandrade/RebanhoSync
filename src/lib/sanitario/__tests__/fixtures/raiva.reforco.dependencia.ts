/**
 * Fixture: Raiva — Reforço com Dependência
 *
 * Cenário: Dose 2 de raiva depende de dose 1 completada,
 * intervalo de 30 dias desde última dose
 * Resultado esperado: ready (se dose 1 > 30 dias)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SchedulerNowContext,
  ComputeNextSanitaryOccurrenceResult,
} from "../domain";

export const raivaReforçoDependencia = {
  domain: {
    identity: {
      protocolId: "prot-raiva-v1",
      itemId: "item-raiva-dose-2",
      familyCode: "raiva",
      itemCode: "dose_2",
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    schedule: {
      mode: "rotina_recorrente",
      anchor: "conclusao_etapa_dependente",
      intervalDays: 30,
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      dependsOnItemCode: "dose_1",
      generatesAgenda: true,
      operationalLabel: "Vacinação contra raiva (reforço)",
      notes: "30 dias após dose 1",
      instructions: "Via parenteral, 1 dose 2 mL",
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
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

  history: [
    {
      occurrenceId: "occ-raiva-dose-1",
      familyCode: "raiva",
      itemCode: "dose_1",
      regimenVersion: 1,
      scopeType: "animal",
      scopeId: "animal-vaca-002",
      completedAt: "2026-06-20",
      executionDate: "2026-06-20",
      sourceEventId: null,
      dedupKey: "sanitario:animal:animal-vaca-002:raiva:dose_1:v1:campaign:2026-06",
      status: "completed",
    },
  ] as SanitaryExecutionRecord[],

  now: {
    currentDate: "2026-07-25", // 35 dias depois
  } as SchedulerNowContext,

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-07-25",
    dedupKey: "sanitario:animal:animal-vaca-002:raiva:dose_2:v1:interval:2026-07-20",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
