import type { SanitaryProtocolItemDomain } from "./domain";

export interface LegacyPayload {
  [key: string]: unknown;
}

export function parseLegacyProtocolItemToDomain(
  protocolId: string,
  itemId: string,
  payload: LegacyPayload,
): SanitaryProtocolItemDomain {
  // TODO: implement logic to parse variant keys from payload:
  // - idade_min_dias / idade_minima_dias
  // - intervalo_dias / intervaloDias
  // - family_code / familyCode
  // - item_code / itemCode
  // - origem / layer

  // This is a placeholder to satisfy typing until full implementation
  return {
    identity: {
      protocolId,
      itemId,
      familyCode: String(payload.family_code ?? payload.familyCode ?? "legacy_family"),
      itemCode: String(payload.item_code ?? payload.itemCode ?? "legacy_item"),
      regimenVersion: Number(payload.regimen_version ?? 1),
      layer: "custom",
      scopeType: "animal"
    },
    applicability: {
      type: "sempre"
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
      categoryCodes: null
    },
    schedule: {
      mode: "nao_estruturado",
      anchor: "sem_ancora",
      intervalDays: null,
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      dependsOnItemCode: null,
      generatesAgenda: false,
      operationalLabel: null,
      notes: null,
      instructions: null
    },
    compliance: {
      level: "recomendado",
      mandatory: false,
      requiresVeterinarian: false,
      requiresDocument: false,
      requiredDocumentTypes: null,
      blocksExecutionWithoutVeterinarian: false,
      blocksCompletionWithoutDocument: false
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: true
    }
  };
}

export function serializeDomainToLegacyPayload(
  item: SanitaryProtocolItemDomain,
): LegacyPayload {
  // TODO: implement serialization back to the DB format
  return {
    family_code: item.identity.familyCode,
    item_code: item.identity.itemCode,
    origem: item.identity.layer
  };
}
