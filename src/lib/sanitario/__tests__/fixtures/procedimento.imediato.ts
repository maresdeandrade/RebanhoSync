/**
 * Fixture: Procedimento Imediato — Notificação de Evento
 *
 * Cenário: Tarefa gerada imediatamente quando evento ativo é registrado
 * Exemplo: Notificação SVO (evento regulatório)
 * Resultado esperado: ready (evento presente), not_applicable (evento ausente)
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  ComputeNextSanitaryOccurrenceResult,
} from "@/lib/sanitario/models/domain";
import { buildSchedulerNowContext } from "../helpers/schedulerNow";

export const procedimentoImediatoNotificacao = {
  domain: {
    identity: {
      protocolId: "prot-notificacao-svo",
      itemId: "item-notificacao-imediata",
      familyCode: "notificacao",
      itemCode: "notificacao_svo",
      regimenVersion: 1,
      layer: "official",
      scopeType: "fazenda",
    },
    schedule: {
      mode: "procedimento_imediato",
      anchor: "sem_ancora",
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      intervalDays: null,
      dependsOnItemCode: null,
      generatesAgenda: false, // Procedimento imediato não gera agenda recorrente
      operationalLabel: "Notificação SVO — Evento Regulatório",
      notes: "Material imediatamente quando evento SVO é registrado",
      instructions: "Contato com OVA; documentação obrigatória",
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
      categoryCodes: null,
    },
    applicability: {
      type: "evento",
      event: "notificacao_svo",
    },
    compliance: {
      level: "obrigatorio",
      mandatory: true,
      requiresVeterinarian: true,
      requiresDocument: true,
      requiredDocumentTypes: ["notificacao_original"],
      blocksExecutionWithoutVeterinarian: true,
      blocksCompletionWithoutDocument: true,
    },
    executionPolicy: {
      allowsManualExecution: false,
      createsInstantTaskOnEvent: true,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: false,
    },
  } as SanitaryProtocolItemDomain,

  subject: {
    scopeType: "fazenda",
    scopeId: "faz-001",
    animal: null,
    lote: null,
    fazenda: { id: "faz-001", uf: "GO", municipio: "Goiânia" },
    activeRisks: [],
    activeEvents: [
      {
        eventId: "evt-notif-20260715",
        eventCode: "notificacao_svo",
        openedAt: "2026-07-15",
        closedAt: null,
      },
    ],
  } as SanitarySubjectContext,

  history: [] as SanitaryExecutionRecord[],

  now: buildSchedulerNowContext("2026-07-15"),

  expectedResult: {
    materialize: true,
    reasonCode: "ready",
    dueDate: "2026-07-15",
    dedupKey: "sanitario:fazenda:faz-001:notificacao:notificacao_svo:v1:event:evt-notif-20260715",
  } as Partial<ComputeNextSanitaryOccurrenceResult>,
};
