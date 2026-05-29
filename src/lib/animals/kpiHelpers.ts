// src/lib/animals/kpiHelpers.ts

import { differenceInDays, parseISO } from "date-fns";

export interface PesagemInput {
  peso_kg: number;
  occurred_at: string;
  deleted_at?: string | null;
}

export interface IndividualGmdResult {
  pesoInicialKg: number;
  pesoFinalKg: number;
  ganhoKg: number;
  diasIntervalo: number;
  gmdKgDia: number;
  isValid: boolean;
  reason?: string;
}

/**
 * Pure helper to compute GMD for an individual animal.
 * Requirements:
 * - ganhoKg = pesoFinalKg - pesoInicialKg
 * - diasIntervalo = days between occurred_at of first and last weight
 * - gmdKgDia = ganhoKg / diasIntervalo
 * - Block if < 2 weights or diasIntervalo <= 0.
 */
export function calculateIndividualGmd(pesagens: readonly PesagemInput[]): IndividualGmdResult {
  const validPesagens = pesagens
    .filter(p => !p.deleted_at && p.peso_kg > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  if (validPesagens.length < 2) {
    return {
      pesoInicialKg: 0,
      pesoFinalKg: 0,
      ganhoKg: 0,
      diasIntervalo: 0,
      gmdKgDia: 0,
      isValid: false,
      reason: "Menos de 2 pesagens registradas",
    };
  }

  const first = validPesagens[0];
  const last = validPesagens[validPesagens.length - 1];

  const firstDate = parseISO(first.occurred_at.slice(0, 10));
  const lastDate = parseISO(last.occurred_at.slice(0, 10));
  const diasIntervalo = differenceInDays(lastDate, firstDate);

  if (diasIntervalo <= 0) {
    return {
      pesoInicialKg: first.peso_kg,
      pesoFinalKg: last.peso_kg,
      ganhoKg: last.peso_kg - first.peso_kg,
      diasIntervalo,
      gmdKgDia: 0,
      isValid: false,
      reason: "Intervalo entre pesagens de 0 dias ou negativo",
    };
  }

  const ganhoKg = last.peso_kg - first.peso_kg;
  const gmdKgDia = ganhoKg / diasIntervalo;

  return {
    pesoInicialKg: first.peso_kg,
    pesoFinalKg: last.peso_kg,
    ganhoKg,
    diasIntervalo,
    gmdKgDia,
    isValid: true,
  };
}

export interface UaLotacaoResult {
  uaTotal: number;
  taxaLotacaoUaHa: number | null;
  status: "complete" | "partial" | "empty" | "bloqueado";
  reason?: string;
  source: string;
  limitation?: string;
}

/**
 * Pure helper to calculate UA (Unidade Animal) and Stocking Rate (Taxa de Lotação).
 * - uaTotal = sum(live weight) / 450
 * - taxaLotacaoUaHa = uaTotal / areaHa
 * - Block if areaHa <= 0 or missing
 * - Mark partial if using outdated/partial weight
 */
export function calculateUaLotacao(
  animalWeights: readonly { pesoKg: number; isConfiavel: boolean; isMissing: boolean }[],
  areaHa: number | null | undefined
): UaLotacaoResult {
  if (animalWeights.length === 0) {
    return {
      uaTotal: 0,
      taxaLotacaoUaHa: null,
      status: "empty",
      reason: "Sem animais ativos",
      source: "Sem dados",
    };
  }

  const totalWeight = animalWeights.reduce((sum, w) => sum + w.pesoKg, 0);
  const uaTotal = totalWeight / 450;

  if (areaHa === undefined) {
    const hasMissing = animalWeights.some(w => w.isMissing);
    const hasOutdated = animalWeights.some(w => !w.isConfiavel && !w.isMissing);

    let status: "complete" | "partial" = "complete";
    let limitation: string | undefined = undefined;
    let source = "Pesagem factual fresca";

    if (hasMissing || hasOutdated) {
      status = "partial";
      const missingCount = animalWeights.filter(w => w.isMissing).length;
      const outdatedCount = animalWeights.filter(w => !w.isConfiavel && !w.isMissing).length;
      limitation = `Cálculo parcial: ${missingCount} sem peso, ${outdatedCount} desatualizados`;
      source = "Último peso registrado (parcial)";
    }

    return {
      uaTotal,
      taxaLotacaoUaHa: null,
      status,
      source,
      limitation,
    };
  }

  if (areaHa === null || areaHa <= 0) {
    return {
      uaTotal,
      taxaLotacaoUaHa: null,
      status: "bloqueado",
      reason: "Área do pasto não informada ou inválida",
      source: "Parcial",
      limitation: "Área do pasto ausente ou menor que zero",
    };
  }

  const taxaLotacaoUaHa = uaTotal / areaHa;

  const hasMissing = animalWeights.some(w => w.isMissing);
  const hasOutdated = animalWeights.some(w => !w.isConfiavel && !w.isMissing);

  let status: "complete" | "partial" = "complete";
  let limitation: string | undefined = undefined;
  let source = "Pesagem factual fresca";

  if (hasMissing || hasOutdated) {
    status = "partial";
    const missingCount = animalWeights.filter(w => w.isMissing).length;
    const outdatedCount = animalWeights.filter(w => !w.isConfiavel && !w.isMissing).length;
    limitation = `Cálculo parcial: ${missingCount} sem peso, ${outdatedCount} desatualizados`;
    source = "Último peso registrado (parcial)";
  }

  return {
    uaTotal,
    taxaLotacaoUaHa,
    status,
    source,
    limitation,
  };
}
