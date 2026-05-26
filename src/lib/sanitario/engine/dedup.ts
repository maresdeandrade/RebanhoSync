/**
 * Engine de Deduplicação Determinística
 *
 * Gera chave única (dedup_key) para cada ocorrência de protocolo sanitário.
 * Mesma chave garante idempotência: mesmo animal + protocolo + período = mesma ocorrência.
 *
 * Invariante: mesma combinação de (scope, family, item, versão, período) = mesma chave
 */

import type { SanitaryProtocolItemDomain, SanitaryScopeType, SanitaryCalendarMode } from "@/lib/sanitario/models/domain";

export interface DedupKeyInput {
  scopeType: SanitaryScopeType;
  scopeId: string;
  familyCode: string;
  itemCode: string;
  regimenVersion: number;
  mode: SanitaryCalendarMode;
  /**
   * Identificador único por período/ocorrência.
   * - Campanha: string 'YYYY-MM' (ano-mês, ex: '2026-05')
   * - Janela etária: ISO string da data de início da janela (ex: '2026-07-01')
   * - Rotina recorrente: ISO string da próxima data devido (ex: '2026-09-15')
   * - Procedimento imediato: ID do evento que acionou (ex: 'evt-77')
   * Usado para garantir que mesma ocorrência reutiliza mesma chave.
   */
  periodKey: string;
  /**
   * Opcional: jurisdiction (se protocolo é jurisdiction-specific).
   * Exemplo: "GO" (Goiás)
   */
  jurisdiction?: string | null;
}

/**
 * Constrói chave de deduplicação determinística.
 *
 * Formato:
 * `sanitario:<scopeType>:<scopeId>:<family>:<item>:v<version>:<periodType>:<periodKey>[:<jurisdiction>]`
 *
 * Exemplos:
 * - Campanha animal 123, raiva, dose_1, v1, maio 2026:
 *   `sanitario:animal:123:raiva:dose_1:v1:campaign:2026-05`
 *
 * - Janela etária, animal 456, brucelose, v2, janela começando 2026-07-01:
 *   `sanitario:animal:456:brucelose:dose_1:v2:window:2026-07-01`
 *
 * - Rotina recorrente, lote 789, vermifugação, interval começa 2026-09-15:
 *   `sanitario:lote:789:vermifugacao:dose:v1:interval:2026-09-15`
 *
 * - Procedimento imediato, fazenda 999, notificação SVO, evento evt-77:
 *   `sanitario:fazenda:999:notificacao:imediata:v1:event:evt-77`
 *
 * - Com jurisdição:
 *   `sanitario:animal:123:raiva:dose_1:v1:campaign:2026-05:GO`
 */
export function buildSanitaryDedupKey(input: DedupKeyInput): string {
  const { scopeType, scopeId, familyCode, itemCode, regimenVersion, mode, periodKey, jurisdiction } =
    input;

  for (const [field, value] of [
    ["scopeId", scopeId],
    ["familyCode", familyCode],
    ["itemCode", itemCode],
    ["periodKey", periodKey],
  ] as const) {
    if (!value.trim()) {
      throw new Error(`Dedup key invalida: ${field} vazio.`);
    }
  }
  if (!Number.isInteger(regimenVersion) || regimenVersion <= 0) {
    throw new Error("Dedup key invalida: regimenVersion deve ser inteiro positivo.");
  }

  // Normalizar strings
  const normalized = [
    "sanitario",
    scopeType.toLowerCase(),
    scopeId,
    familyCode.toLowerCase(),
    itemCode.toLowerCase(),
    `v${regimenVersion}`,
    modeToPeriodicType(mode),
    periodKey,
  ];

  if (jurisdiction) {
    normalized.push(jurisdiction.toUpperCase());
  }

  return normalized.join(":");
}

/**
 * Mapeia modo de calendário para tipo de período na chave de dedup.
 */
function modeToPeriodicType(mode: SanitaryCalendarMode): string {
  switch (mode) {
    case "campanha":
      return "campaign";
    case "janela_etaria":
      return "window";
    case "rotina_recorrente":
      return "interval";
    case "procedimento_imediato":
      return "event";
    case "nao_estruturado":
      return "unstructured";
    default:
      return "unknown";
  }
}

/**
 * Parse dedup_key e retorna componentes (falha se formato invalido).
 * Útil para logging/debug.
 */
export function parseDedupKey(
  dedupKey: string
): {
  scopeType?: SanitaryScopeType;
  scopeId?: string;
  familyCode?: string;
  itemCode?: string;
  regimenVersion?: number;
  periodType?: string;
  periodKey?: string;
  jurisdiction?: string;
} {
  const parts = dedupKey.split(":");
  if (parts.length < 8 || parts[0] !== "sanitario") {
    return {};
  }

  const periodType = parts[6];
  const periodParts = parts.slice(7);
  const lastPeriodPart = periodParts.at(-1);
  const hasJurisdiction =
    periodParts.length > 1 &&
    typeof lastPeriodPart === "string" &&
    /^[A-Z]{2,5}$/.test(lastPeriodPart);
  const jurisdiction = hasJurisdiction ? lastPeriodPart : undefined;
  const periodKey = (hasJurisdiction ? periodParts.slice(0, -1) : periodParts).join(":");
  const regimenVersion = /^v\d+$/.test(parts[5])
    ? parseInt(parts[5].substring(1), 10)
    : undefined;

  if (!parts[1] || !parts[2] || !parts[3] || !parts[4] || !regimenVersion || !periodKey) {
    return {};
  }

  return {
    scopeType: parts[1] as SanitaryScopeType,
    scopeId: parts[2],
    familyCode: parts[3],
    itemCode: parts[4],
    regimenVersion,
    periodType,
    periodKey,
    jurisdiction,
  };
}

/**
 * Gera período-key para campanha (YYYY-MM).
 * Entrada: date ISO string (ex: '2026-05-15')
 * Saída: '2026-05'
 */
export function campaignPeriodKey(dateIso: string): string {
  const [year, month] = dateIso.split("-");
  return `${year}-${month}`;
}

/**
 * Gera período-key para janela etária (ISO data de início).
 * Entrada: data de início da janela (ex: '2026-07-01')
 * Saída: '2026-07-01'
 */
export function windowPeriodKey(windowStartDateIso: string): string {
  // Normalizar para YYYY-MM-DD se necessário
  const [year, month, day] = windowStartDateIso.split("-");
  return `${year}-${month}-${day}`;
}

/**
 * Gera período-key para rotina recorrente (ISO data de próxima ocorrência).
 * Entrada: data de próxima execução (ex: '2026-09-15')
 * Saída: '2026-09-15'
 */
export function intervalPeriodKey(nextDueDateIso: string): string {
  const [year, month, day] = nextDueDateIso.split("-");
  return `${year}-${month}-${day}`;
}

/**
 * Gera período-key para procedimento imediato (ID do evento).
 * Entrada: ID do evento (ex: 'evt-77')
 * Saída: 'evt-77'
 */
export function eventPeriodKey(eventId: string): string {
  return eventId;
}
