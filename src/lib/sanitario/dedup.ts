import type { SanitaryIdentity, SanitaryCalendarMode } from "./domain";

export interface BuildDedupKeyInput {
  identity: SanitaryIdentity;
  scopeId: string;
  mode: SanitaryCalendarMode;
  jurisdictionKey?: string | null;
  campaignYear?: number | null;
  campaignMonth?: number | null;
  windowStartIso?: string | null;
  recurrenceOriginIso?: string | null;
  sourceEventId?: string | null;
}

export function buildSanitaryDedupKey(input: BuildDedupKeyInput): string {
  const prefix = `sanitario:${input.identity.scopeType}:${input.scopeId}:${input.identity.familyCode}:${input.identity.itemCode}:v${input.identity.regimenVersion}`;

  switch (input.mode) {
    case "campanha":
      return `${prefix}:jur:${input.jurisdictionKey ?? "global"}:ym:${input.campaignYear}-${input.campaignMonth}`;

    case "janela_etaria":
      return `${prefix}:window:${input.windowStartIso ?? "life"}`;

    case "rotina_recorrente":
      return `${prefix}:origin:${input.recurrenceOriginIso ?? "unknown"}`;

    case "procedimento_imediato":
      return `${prefix}:event:${input.sourceEventId ?? "manual"}`;

    case "nao_estruturado":
    default:
      return `${prefix}:legacy`;
  }
}
