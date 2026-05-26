/**
 * Active Withdrawal Period computation (F1 - TS parity)
 *
 * Pure function mirroring `vw_animais_carencia_ativa` logic.
 * Computes active withdrawal periods from sanitary events.
 */

import {
  resolveWithdrawalRule,
  type OfficialItemWithdrawal,
  type WithdrawalRule,
} from "./withdrawalPeriod";

export interface SanitaryEventForWithdrawal {
  animal_id: string | null;
  fazenda_id: string;
  occurred_at: string;
  deleted_at?: string | null;
  produto: string;
  detail_deleted_at?: string | null;
  payload?: {
    carencia_regra_json?: {
      carne_dias?: number | null;
      leite_dias?: number | null;
      ovos_dias?: number | null;
      mel_dias?: number | null;
    } | null;
  } | null;
}

export interface OfficialItemLookup {
  [codigo: string]: OfficialItemWithdrawal | undefined;
}

export interface ActiveWithdrawal {
  animal_id: string;
  fazenda_id: string;
  produto: string;
  tipo_carencia: "carne" | "leite" | "ovos" | "mel";
  inicio_carencia: string;
  fim_carencia: string;
  ativa: boolean;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function toDateStr(isoString: string): string {
  return isoString.split("T")[0];
}

export function computeActiveWithdrawals(
  events: SanitaryEventForWithdrawal[],
  officialItems: OfficialItemLookup,
  asOf: Date = new Date(),
): ActiveWithdrawal[] {
  const asOfDate = asOf.toISOString().split("T")[0];
  const results: ActiveWithdrawal[] = [];

  for (const event of events) {
    if (!event.animal_id) continue;
    if (event.deleted_at) continue;
    if (event.detail_deleted_at) continue;

    const rule: WithdrawalRule | null = resolveWithdrawalRule({
      officialItem: officialItems[event.produto] ?? null,
      protocolItem: null,
      eventPayload: event.payload ?? null,
    });

    if (!rule) continue;

    const inicio = toDateStr(event.occurred_at);
    const types: Array<{
      key: "carne" | "leite" | "ovos" | "mel";
      dias: number | null;
    }> = [
      { key: "carne", dias: rule.carne_dias },
      { key: "leite", dias: rule.leite_dias },
      { key: "ovos", dias: rule.ovos_dias },
      { key: "mel", dias: rule.mel_dias },
    ];

    for (const { key, dias } of types) {
      if (dias == null || dias <= 0) continue;
      const fim = addDays(inicio, dias);
      if (fim >= asOfDate) {
        results.push({
          animal_id: event.animal_id,
          fazenda_id: event.fazenda_id,
          produto: event.produto,
          tipo_carencia: key,
          inicio_carencia: inicio,
          fim_carencia: fim,
          ativa: true,
        });
      }
    }
  }

  return results;
}
