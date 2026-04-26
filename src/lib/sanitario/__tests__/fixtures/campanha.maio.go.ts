/**
 * Fixture: Campanha Maio — Goiás (Jurisdição específica)
 *
 * Cenário: Protocolo aplicável apenas em Goiás, no mês de maio
 * Resultado esperado: ready (em maio em GO), not_due_yet (fora de maio)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  ComputeNextSanitaryOccurrenceResult,
} from "../domain";
import { buildSchedulerNowContext } from "../helpers/schedulerNow";

export const campnhaMaioGO = {
  domain: {
    identity: {
      protocolId: "prot-campanha-maio-go",
      itemId: "item-campanha-maio",
      familyCode: "campanha_estadual",
      itemCode: "maio_go",
      regimenVersion: 1,
      layer: "official",
      scopeType: "lote",
    },
    schedule: {
      mode: "campanha",
      anchor: "entrada_fazenda",
      campaignMonths: [5], // apenas maio
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: "Campanha estadual maio (GO)",
      notes: "Campanha sanitária sazonal — apenas Goiás",
      instructions: "Aplicação conforme protocolo estadual",
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
      categoryCodes: null,
    },
    applicability: {
      type: "jurisdicao",
      jurisdiction: "GO",
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
      supportsBatchExecution: true,
    },
  } as SanitaryProtocolItemDomain,

  subject: {
    scopeType: "lote",
    scopeId: "lote-001",
    animal: null,
    lote: { id: "lote-001", name: "Lote Reprodução" },
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [],
    activeEvents: [],
  } as SanitarySubjectContext,

  history: [] as SanitaryExecutionRecord[],

  now: buildSchedulerNowContext("2026-05-20"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-05-20",
    dedupKey: "sanitario:lote:lote-001:campanha_estadual:maio_go:v1:campaign:2026-05:GO",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
