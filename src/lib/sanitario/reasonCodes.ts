/**
 * Códigos de Razão e Mensagens de Bloqueio
 *
 * Define enum de razões que bloqueiam ou permitem materialização de ocorrência,
 * e funções de mensagem legível para UI/logs.
 */

export type OccurrenceBlockReason =
  | "ready"
  | "agenda_disabled"
  | "not_eligible"
  | "not_applicable"
  | "dependency_not_satisfied"
  | "risk_not_active"
  | "jurisdiction_not_allowed"
  | "event_not_active"
  | "before_window"
  | "window_expired"
  | "not_due_yet"
  | "already_materialized";

/**
 * Retorna mensagem legível para razão de bloqueio/sucesso.
 * Usado em UI, logs, e feedback ao usuário.
 */
export function reasonCodeMessage(code: OccurrenceBlockReason): string {
  const messages: Record<OccurrenceBlockReason, string> = {
    ready: "Pronto para agendar",
    agenda_disabled: "Agenda desativada para este protocolo",
    not_eligible: "Animal não é elegível (sexo, idade, espécie ou categoria não combinam)",
    not_applicable: "Protocolo não se aplica (jurisdição, risco ou evento não ativo)",
    dependency_not_satisfied: "Protocolo dependente não foi concluído",
    risk_not_active: "Risco associado não está ativo",
    jurisdiction_not_allowed: "Protocolo não é permitido para esta jurisdição",
    event_not_active: "Evento associado não está ativo",
    before_window: "Animal não atingiu a idade mínima",
    window_expired: "Animal excedeu a idade máxima",
    not_due_yet: "Não é época de campanha ou intervalo não venceu",
    already_materialized: "Ocorrência já foi materializada neste período",
  };

  return messages[code] ?? "Razão desconhecida";
}

/**
 * Determina se um código de razão é bloqueante (não deve materializar).
 */
export function isBlockingReason(code: OccurrenceBlockReason): boolean {
  return code !== "ready";
}

/**
 * Agrupa razões por categoria de bloqueio.
 */
export function blockingCategory(
  code: OccurrenceBlockReason
): "eligibility" | "applicability" | "dependency" | "window" | "schedule" | "dedup" | "ready" {
  switch (code) {
    case "not_eligible":
      return "eligibility";
    case "not_applicable":
    case "risk_not_active":
    case "jurisdiction_not_allowed":
    case "event_not_active":
      return "applicability";
    case "dependency_not_satisfied":
      return "dependency";
    case "before_window":
    case "window_expired":
      return "window";
    case "not_due_yet":
    case "agenda_disabled":
      return "schedule";
    case "already_materialized":
      return "dedup";
    case "ready":
      return "ready";
    default:
      return "schedule";
  }
}
