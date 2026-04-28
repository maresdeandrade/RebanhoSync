/**
 * Fixture: Vermifugação — Rotina Recorrente a cada 60 dias
 *
 * Cenário: Protocolo recorrente que se repete a cada 60 dias desde nascimento
 * Resultado esperado: ready (intervalDays vencido), not_due_yet (não vencido)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  ComputeNextSanitaryOccurrenceResult,
} from "@/lib/sanitario/models/domain";
import { buildSchedulerNowContext } from "../helpers/schedulerNow";

export const vermifugacaoRecorrente = {
  domain: {
    identity: {
      protocolId: "prot-vermifugacao-v1",
      itemId: "item-vermifugacao-rotina",
      familyCode: "vermifugacao",
      itemCode: "rotina_60d",
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    schedule: {
      mode: "rotina_recorrente",
      anchor: "nascimento",
      intervalDays: 60,
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: "Vermifugação rotineira",
      notes: "Repetir a cada 60 dias desde nascimento",
      instructions: "Doses conforme peso: até 100kg = 50mL, 100-200kg = 100mL",
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: 45,
      ageMaxDays: null,
      species: ["bovino"],
      categoryCodes: null,
    },
    applicability: { type: "sempre" },
    compliance: {
      level: "recomendado",
      mandatory: false,
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
    scopeType: "animal",
    scopeId: "animal-novilho-003",
    animal: {
      id: "animal-novilho-003",
      birthDate: "2026-01-01",
      sex: "macho",
      species: "bovino",
      categoryCode: "novilho",
      payload: { taxonomy_facts: {} },
    },
    lote: { id: "lote-003", name: "Recria Machos" },
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [],
    activeEvents: [],
  } as SanitarySubjectContext,

  history: [
    {
      occurrenceId: "occ-verm-1",
      familyCode: "vermifugacao",
      itemCode: "rotina_60d",
      regimenVersion: 1,
      scopeType: "animal",
      scopeId: "animal-novilho-003",
      completedAt: "2026-05-15",
      executionDate: "2026-05-15",
      sourceEventId: null,
      dedupKey: "sanitario:animal:animal-novilho-003:vermifugacao:rotina_60d:v1:interval:2026-05-15",
      status: "completed",
    },
  ] as SanitaryExecutionRecord[],

  now: buildSchedulerNowContext("2026-07-20"), // 66 dias depois

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-07-20",
    dedupKey: "sanitario:animal:animal-novilho-003:vermifugacao:rotina_60d:v1:interval:2026-07-14",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
