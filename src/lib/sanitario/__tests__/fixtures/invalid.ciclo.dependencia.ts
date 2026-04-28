/**
 * Fixture Inválido: Ciclo de Dependência
 *
 * Cenário: Protocolo A depende de B, B depende de A
 * Este é um fixture para testar detectDependencyCycle durante validação
 * Não deve ser materializado pelo scheduler
 *
 * Nota: Este fixture faz sentido apenas em testes de validação,
 * não em testes de scheduler (que pressupõem domínio válido)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
} from "@/lib/sanitario/models/domain";

export const invalidCicloDependencia = {
  itemA: {
    identity: {
      protocolId: "prot-ciclo",
      itemId: "item-a",
      familyCode: "teste",
      itemCode: "dose_a",
      regimenVersion: 1,
      layer: "custom",
      scopeType: "animal",
    },
    schedule: {
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [6],
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: "dose_b", // Depende de B
      generatesAgenda: true,
      operationalLabel: "Dose A (Ciclo!)",
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

  itemB: {
    identity: {
      protocolId: "prot-ciclo",
      itemId: "item-b",
      familyCode: "teste",
      itemCode: "dose_b",
      regimenVersion: 1,
      layer: "custom",
      scopeType: "animal",
    },
    schedule: {
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [6],
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: "dose_a", // Depende de A — CICLO!
      generatesAgenda: true,
      operationalLabel: "Dose B (Ciclo!)",
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

  expectedValidationError: "Ciclo de dependência detectado",
};
