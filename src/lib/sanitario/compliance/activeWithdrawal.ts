/**
 * Active Withdrawal Period computation (F1 - TS parity)
 *
 * Pure function mirroring `vw_animais_carencia_ativa` logic.
 * Computes active withdrawal periods from sanitary events.
 */

import type { OfficialItemWithdrawal } from "./withdrawalPeriod";

export interface SanitaryEventForWithdrawal {
  animal_id: string | null;
  fazenda_id: string;
  occurred_at: string;
  deleted_at?: string | null;
  produto: string;
  detail_deleted_at?: string | null;
  carencia_carne_dias?: number | null;
  carencia_leite_dias?: number | null;
  carencia_carne_ate?: string | null;
  carencia_leite_ate?: string | null;
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

function toDateStr(isoString: string): string {
  return isoString.split("T")[0];
}

export function computeActiveWithdrawals(
  events: SanitaryEventForWithdrawal[],
  _officialItems: OfficialItemLookup,
  asOf: Date = new Date(),
): ActiveWithdrawal[] {
  const asOfDate = asOf.toISOString().split("T")[0];
  const results: ActiveWithdrawal[] = [];

  for (const event of events) {
    if (!event.animal_id) continue;
    if (event.deleted_at) continue;
    if (event.detail_deleted_at) continue;

    const inicio = toDateStr(event.occurred_at);
    const types: Array<{
      key: "carne" | "leite";
      dias: number | null;
      fim: string | null;
    }> = [
      {
        key: "carne",
        dias: event.carencia_carne_dias ?? null,
        fim: event.carencia_carne_ate ?? null,
      },
      {
        key: "leite",
        dias: event.carencia_leite_dias ?? null,
        fim: event.carencia_leite_ate ?? null,
      },
    ];

    for (const { key, dias, fim } of types) {
      if (dias == null || dias <= 0 || !fim) continue;
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
