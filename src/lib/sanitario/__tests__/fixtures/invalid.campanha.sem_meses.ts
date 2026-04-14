/**
 * Fixture Inválido: Campanha Sem Meses
 *
 * Cenário: Protocolo com modo 'campanha' mas sem campaignMonths preenchido
 * Deve ser rejeitado por validation
 * Não deve ser materializado pelo scheduler
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SchedulerNowContext,
} from "../domain";

export const invalidCampanhaSemMeses = {
  domain: {
    identity: {
      protocolId: "prot-campanha-invalida",
      itemId: "item-campanha-vazia",
      familyCode: "teste",
      itemCode: "campanha_sem_meses",
      regimenVersion: 1,
      layer: "custom",
      scopeType: "animal",
    },
    schedule: {
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [], // VAZIO — Inválido!
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: "Campanha sem meses (inválida)",
      notes: null,
      instructions: null,
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
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
      supportsBatchExecution: false,
    },
  } as SanitaryProtocolItemDomain,

  subject: {
    scopeType: "animal",
    scopeId: "animal-test",
    animal: {
      id: "animal-test",
      birthDate: "2026-01-01",
      sex: "femea",
      species: "bovino",
      categoryCode: "bezerra",
      payload: { taxonomy_facts: {} },
    },
    lote: null,
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [],
    activeEvents: [],
  } as SanitarySubjectContext,

  now: {
    currentDate: "2026-07-15",
  } as SchedulerNowContext,

  expectedValidationError: "Campanha deve ter pelo menos um mês",
  expectedSchedulerResult: "not_due_yet", // Fallback quando não há meses
};
