/**
 * Motor de Carência Operacional (F1)
 *
 * Resolves withdrawal period rules for veterinary products.
 * Hierarchy: official catalog item > farm protocol item > event payload > null
 */

export interface WithdrawalRule {
  carne_dias: number | null;
  leite_dias: number | null;
  ovos_dias: number | null;
  mel_dias: number | null;
  source: "catalogo_oficial" | "protocolo_fazenda" | "evento_payload";
}

export interface OfficialItemWithdrawal {
  carencia_regra_json?: {
    carne_dias?: number | null;
    leite_dias?: number | null;
    ovos_dias?: number | null;
    mel_dias?: number | null;
  } | null;
}

export interface ProtocolItemWithdrawal {
  payload?: {
    carencia_regra_json?: {
      carne_dias?: number | null;
      leite_dias?: number | null;
      ovos_dias?: number | null;
      mel_dias?: number | null;
    } | null;
  } | null;
}

export interface EventPayloadWithdrawal {
  carencia_regra_json?: {
    carne_dias?: number | null;
    leite_dias?: number | null;
    ovos_dias?: number | null;
    mel_dias?: number | null;
  } | null;
}

function hasWithdrawalValues(rule: {
  carne_dias?: number | null;
  leite_dias?: number | null;
  ovos_dias?: number | null;
  mel_dias?: number | null;
}): boolean {
  return (
    (rule.carne_dias != null && rule.carne_dias > 0) ||
    (rule.leite_dias != null && rule.leite_dias > 0) ||
    (rule.ovos_dias != null && rule.ovos_dias > 0) ||
    (rule.mel_dias != null && rule.mel_dias > 0)
  );
}

function normalizeRule(
  raw: {
    carne_dias?: number | null;
    leite_dias?: number | null;
    ovos_dias?: number | null;
    mel_dias?: number | null;
  },
  source: WithdrawalRule["source"],
): WithdrawalRule {
  return {
    carne_dias: raw.carne_dias ?? null,
    leite_dias: raw.leite_dias ?? null,
    ovos_dias: raw.ovos_dias ?? null,
    mel_dias: raw.mel_dias ?? null,
    source,
  };
}

export function resolveWithdrawalRule(input: {
  officialItem?: OfficialItemWithdrawal | null;
  protocolItem?: ProtocolItemWithdrawal | null;
  eventPayload?: EventPayloadWithdrawal | null;
}): WithdrawalRule | null {
  if (
    input.officialItem?.carencia_regra_json &&
    hasWithdrawalValues(input.officialItem.carencia_regra_json)
  ) {
    return normalizeRule(
      input.officialItem.carencia_regra_json,
      "catalogo_oficial",
    );
  }

  if (
    input.protocolItem?.payload?.carencia_regra_json &&
    hasWithdrawalValues(input.protocolItem.payload.carencia_regra_json)
  ) {
    return normalizeRule(
      input.protocolItem.payload.carencia_regra_json,
      "protocolo_fazenda",
    );
  }

  if (
    input.eventPayload?.carencia_regra_json &&
    hasWithdrawalValues(input.eventPayload.carencia_regra_json)
  ) {
    return normalizeRule(
      input.eventPayload.carencia_regra_json,
      "evento_payload",
    );
  }

  return null;
}
