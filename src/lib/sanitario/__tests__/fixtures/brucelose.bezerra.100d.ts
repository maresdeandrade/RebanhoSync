/**
 * Fixture: Brucelose — Bezerra com 100 dias de vida
 *
 * Cenário: Animal elegível para dose de brucelose (janela 30-180 dias)
 * Resultado esperado: ready (materialize=true)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  ComputeNextSanitaryOccurrenceResult,
} from "../domain";
import { buildSchedulerNowContext } from "../helpers/schedulerNow";

export const brucelosaBezerra100d = {
  domain: {
    identity: {
      protocolId: "prot-brucelose-v1",
      itemId: "item-brucelose-dose-unica",
      familyCode: "brucelose",
      itemCode: "dose_unica",
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    schedule: {
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 30,
      ageEndDays: 180,
      intervalDays: null,
      campaignMonths: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: "Vacinação contra brucelose (filha)",
      notes: "Aplicar dose única entre 30 e 180 dias de idade",
      instructions: "Via parenteral, 1 dose de 5 mL",
    },
    eligibility: {
      sexTarget: "femea",
      ageMinDays: null,
      ageMaxDays: null,
      species: ["bovino"],
      categoryCodes: ["bezerro", "bezerra"],
    },
    applicability: { type: "sempre" },
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
      expiresWhenWindowEnds: true,
      supportsBatchExecution: false,
    },
  } as SanitaryProtocolItemDomain,

  subject: {
    scopeType: "animal",
    scopeId: "animal-bezerra-001",
    animal: {
      id: "animal-bezerra-001",
      birthDate: "2026-05-07", // 100 dias atrás em 2026-08-15
      sex: "femea",
      species: "bovino",
      categoryCode: "bezerra",
      payload: { taxonomy_facts: {} },
    },
    lote: { id: "lote-001", name: "Lote Reprodução" },
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [],
    activeEvents: [],
  } as SanitarySubjectContext,

  history: [] as SanitaryExecutionRecord[],

  now: buildSchedulerNowContext("2026-08-15"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-08-15",
    dedupKey: "sanitario:animal:animal-bezerra-001:brucelose:dose_unica:v1:window:2026-06-06",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
