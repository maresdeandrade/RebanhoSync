/**
 * Scheduler Determinístico de Ocorrências Sanitárias
 *
 * Núcleo da computação: dados um protocolo, animal e histórico,
 * decide se/quando materializar agenda sanitária.
 *
 * Fluxo: 9 passos decisórios sequenciais, estateless, determinístico, testável.
 * Contrato: sem I/O (supabase, dexie, http), apenas funções puras.
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SchedulerNowContext,
  ComputeNextSanitaryOccurrenceResult,
} from "./domain";

import { blockingCategory, isBlockingReason, reasonCodeMessage, type OccurrenceBlockReason } from "./reasonCodes";
import { buildSanitaryDedupKey, campaignPeriodKey, eventPeriodKey, intervalPeriodKey, windowPeriodKey } from "./dedup";
import { addDays, daysBetween, resolveAnchorDate } from "./anchorResolution";

export interface ComputeNextSanitaryOccurrenceInput {
  item: SanitaryProtocolItemDomain;
  subject: SanitarySubjectContext;
  history: SanitaryExecutionRecord[];
  now: SchedulerNowContext;
}

/**
 * PASSO 1: Verifica se protocolo gera agenda recorrente.
 * Se não, retorna não-acionável imediatamente.
 */
function step1CheckGeneratesAgenda(item: SanitaryProtocolItemDomain): OccurrenceBlockReason | "continue" {
  if (!item.schedule.generatesAgenda) {
    return "agenda_disabled";
  }
  return "continue";
}

/**
 * PASSO 2: Verifica se protocolo é aplicável
 * (jurisdição, risco, evento, perfil de animal).
 */
function step2CheckApplicability(item: SanitaryProtocolItemDomain, subject: SanitarySubjectContext): OccurrenceBlockReason | "continue" {
  const applicability = item.applicability;

  if (applicability.type === "sempre") {
    return "continue";
  }

  if (applicability.type === "jurisdicao") {
    const farmedaUF = subject.fazenda?.uf;
    if (applicability.jurisdiction && farmedaUF !== applicability.jurisdiction) {
      return "jurisdiction_not_allowed";
    }
  }

  if (applicability.type === "risco") {
    const activeRisks = subject.activeRisks ?? [];
    if (applicability.risk && !activeRisks.some((r) => r.riskCode === applicability.risk)) {
      return "risk_not_active";
    }
  }

  if (applicability.type === "evento") {
    const activeEvents = subject.activeEvents ?? [];
    if (applicability.event && !activeEvents.some((e) => e.eventCode === applicability.event)) {
      return "event_not_active";
    }
  }

  if (applicability.type === "perfil_animal") {
    if (!subject.animal) {
      return "not_applicable";
    }
    const profile = subject.animal.categoryCode ?? "";
    if (applicability.animalProfile && !profile.includes(applicability.animalProfile)) {
      return "not_applicable";
    }
  }

  return "continue";
}

/**
 * PASSO 3: Verifica se animal é elegível
 * (sexo, idade, espécie, categoria).
 */
function step3CheckEligibility(item: SanitaryProtocolItemDomain, subject: SanitarySubjectContext): OccurrenceBlockReason | "continue" {
  if (!subject.animal) {
    return "not_eligible";
  }

  const eligibility = item.eligibility;

  // Verificar sexo
  if (eligibility.sexTarget !== "sem_restricao") {
    const requiredSex = eligibility.sexTarget;
    if (subject.animal.sex !== requiredSex) {
      return "not_eligible";
    }
  }

  // Verificar espécie
  if (eligibility.species) {
    if (!eligibility.species.includes(subject.animal.species ?? "")) {
      return "not_eligible";
    }
  }

  // Verificar categoria
  if (eligibility.categoryCodes) {
    const animalCategory = subject.animal.categoryCode ?? "";
    if (!eligibility.categoryCodes.includes(animalCategory)) {
      return "not_eligible";
    }
  }

  // Verificar idade (só se houver bounds)
  if (eligibility.ageMinDays !== null && eligibility.ageMinDays !== undefined) {
    const birthDate = subject.animal.birthDate;
    if (birthDate) {
      const ageNowDays = daysBetween(birthDate, subject.fazenda?.now ?? new Date().toISOString());
      if (ageNowDays < eligibility.ageMinDays) {
        return "not_eligible"; // Será tratado por before_window se tiver janela
      }
    }
  }

  if (eligibility.ageMaxDays !== null && eligibility.ageMaxDays !== undefined) {
    const birthDate = subject.animal.birthDate;
    if (birthDate) {
      const ageNowDays = daysBetween(birthDate, subject.fazenda?.now ?? new Date().toISOString());
      if (ageNowDays > eligibility.ageMaxDays) {
        return "not_eligible";
      }
    }
  }

  return "continue";
}

/**
 * PASSO 4: Verifica se dependência foi satisfeita.
 */
function step4CheckDependency(item: SanitaryProtocolItemDomain, history: SanitaryExecutionRecord[]): OccurrenceBlockReason | "continue" {
  if (!item.schedule.dependsOnItemCode) {
    return "continue";
  }

  const dependsOn = item.schedule.dependsOnItemCode;
  const dependencyCompleted = history.some(
    (h) => h.itemCode === dependsOn && h.status === "completed"
  );

  if (!dependencyCompleted) {
    return "dependency_not_satisfied";
  }

  return "continue";
}

/**
 * PASSO 5: Resolve data de ancoragem.
 * Necessária para cálculos de janela, intervalo, campanha.
 */
function step5ResolveAnchor(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
): { anchorDate: string | null; reason: OccurrenceBlockReason | "continue" } {
  const anchorDate = resolveAnchorDate(item.schedule.anchor, subject, history);

  // Se não conseguir resolver âncora e não for nao_estruturado, bloqueia
  if (!anchorDate && item.schedule.mode !== "nao_estruturado" && item.schedule.mode !== "procedimento_imediato") {
    return { anchorDate: null, reason: "not_applicable" };
  }

  return { anchorDate, reason: "continue" };
}

/**
 * PASSO 6: Avalia modo e calcula próxima ocorrência.
 */
function step6EvaluateMode(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
  anchorDate: string | null,
  now: SchedulerNowContext,
): {
  dueDate: string | null;
  reason: OccurrenceBlockReason;
  periodKey: string | null;
} {
  const mode = item.schedule.mode;
  const nowDate = now.currentDate ?? new Date().toISOString().split("T")[0]!;

  if (mode === "campanha") {
    return evaluateCampagnaMode(item, nowDate);
  }

  if (mode === "janela_etaria") {
    return evaluateJanelaEtariaMode(item, subject, anchorDate, nowDate);
  }

  if (mode === "rotina_recorrente") {
    return evaluateRotinaRecorrenteMode(item, subject, history, anchorDate, nowDate);
  }

  if (mode === "procedimento_imediato") {
    return evaluateProcedimentoImediatoMode(item, subject);
  }

  // nao_estruturado: sem regra temporal
  return { dueDate: null, reason: "not_due_yet", periodKey: null };
}

/**
 * Avalia CAMPANHA: mês deve estar em campaignMonths.
 */
function evaluateCampagnaMode(
  item: SanitaryProtocolItemDomain,
  nowDate: string,
): { dueDate: string | null; reason: OccurrenceBlockReason; periodKey: string | null } {
  const months = item.schedule.campaignMonths ?? [];
  const [, month] = nowDate.split("-");
  const currentMonth = parseInt(month, 10);

  if (!months.includes(currentMonth)) {
    return { dueDate: null, reason: "not_due_yet", periodKey: null };
  }

  // Está em campanha
  return {
    dueDate: nowDate,
    reason: "ready",
    periodKey: campaignPeriodKey(nowDate),
  };
}

/**
 * Avalia JANELA_ETARIA: animal deve estar entre ageStartDays e ageEndDays.
 */
function evaluateJanelaEtariaMode(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  anchorDate: string | null,
  nowDate: string,
): { dueDate: string | null; reason: OccurrenceBlockReason; periodKey: string | null } {
  if (!anchorDate || !subject.animal?.birthDate) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  const ageStartDays = item.schedule.ageStartDays ?? 0;
  const ageEndDays = item.schedule.ageEndDays;

  const windowStartDate = addDays(anchorDate, ageStartDays);
  if (!windowStartDate) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  const ageNowDays = daysBetween(anchorDate, nowDate);

  if (ageNowDays < ageStartDays) {
    return { dueDate: null, reason: "before_window", periodKey: null };
  }

  if (ageEndDays !== null && ageEndDays !== undefined && ageNowDays > ageEndDays) {
    return { dueDate: null, reason: "window_expired", periodKey: null };
  }

  // Animal está na janela
  return {
    dueDate: nowDate,
    reason: "ready",
    periodKey: windowPeriodKey(windowStartDate),
  };
}

/**
 * Avalia ROTINA_RECORRENTE: intervalo desde última conclusão ou desde âncora.
 */
function evaluateRotinaRecorrenteMode(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
  anchorDate: string | null,
  nowDate: string,
): { dueDate: string | null; reason: OccurrenceBlockReason; periodKey: string | null } {
  const intervalDays = item.schedule.intervalDays ?? 0;

  if (!anchorDate && history.length === 0) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  // Buscar última execução
  const lastCompletion = history
    .filter((h) => h.itemCode === item.identity.itemCode && h.status === "completed")
    .sort(
      (a, b) =>
        (b.completedAt || b.executionDate || "").localeCompare(a.completedAt || a.executionDate || ""),
    )[0];

  const referenceDate = lastCompletion?.completedAt || lastCompletion?.executionDate || anchorDate;
  if (!referenceDate) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  const nextDueDate = addDays(referenceDate, intervalDays);
  if (!nextDueDate) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  const daysSinceRef = daysBetween(referenceDate, nowDate);

  if (daysSinceRef < intervalDays) {
    return { dueDate: nextDueDate, reason: "not_due_yet", periodKey: intervalPeriodKey(nextDueDate) };
  }

  return {
    dueDate: nextDueDate,
    reason: "ready",
    periodKey: intervalPeriodKey(nextDueDate),
  };
}

/**
 * Avalia PROCEDIMENTO_IMEDIATO: material quando evento ativo dispara.
 */
function evaluateProcedimentoImediatoMode(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
): { dueDate: string | null; reason: OccurrenceBlockReason; periodKey: string | null } {
  const activeEvents = subject.activeEvents ?? [];

  if (activeEvents.length === 0) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  // Usar primeiro evento ativo como trigger
  const eventId = activeEvents[0]?.eventId ?? "unknown";

  return {
    dueDate: new Date().toISOString().split("T")[0] ?? null,
    reason: "ready",
    periodKey: eventPeriodKey(eventId),
  };
}

/**
 * PASSO 7: Construir chave de deduplicação.
 */
function step7BuildDedupKey(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  periodKey: string | null,
): string | null {
  if (!periodKey) {
    return null;
  }

  return buildSanitaryDedupKey({
    scopeType: subject.scopeType,
    scopeId: subject.scopeId,
    familyCode: item.identity.familyCode,
    itemCode: item.identity.itemCode,
    regimenVersion: item.identity.regimenVersion,
    mode: item.schedule.mode,
    periodKey,
    jurisdiction: item.applicability.jurisdiction,
  });
}

/**
 * PASSO 8: Verificar se ocorrência já existe (dedup).
 */
function step8CheckExistingOccurrence(
  dedupKey: string | null,
  history: SanitaryExecutionRecord[],
): OccurrenceBlockReason | "continue" {
  if (!dedupKey) {
    return "continue";
  }

  const alreadyExists = history.some(
    (h) => h.dedupKey === dedupKey && (h.status === "completed" || h.status === "pending"),
  );

  if (alreadyExists) {
    return "already_materialized";
  }

  return "continue";
}

/**
 * PASSO 9: Compilar resultado final.
 */
function step9CompileResult(
  reasonCode: OccurrenceBlockReason,
  dueDate: string | null,
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  dedupKey: string | null,
): ComputeNextSanitaryOccurrenceResult {
  const shouldMaterialize = reasonCode === "ready";
  const actionable = !isBlockingReason(reasonCode);
  const blockedBy = blockingCategory(reasonCode);
  const reasonMessage = reasonCodeMessage(reasonCode);

  return {
    materialize: shouldMaterialize,
    dueDate,
    availableAt: shouldMaterialize ? dueDate : null,
    dedupKey,
    reasonCode,
    reasonMessage,
    actionable,
    blockedBy: blockedBy === "ready" ? null : (blockedBy as "eligibility" | "applicability" | "dependency" | "window" | "schedule" | "dedup"),
  };
}

/**
 * COMPUTAÇÃO PRINCIPAL: Orquestra 9 passos sequencialmente.
 *
 * Fluxo:
 * 1. Verifica se gera agenda (generatesAgenda=true)
 * 2. Verifica aplicabilidade (jurisdição, risco, evento, perfil)
 * 3. Verifica elegibilidade (sexo, idade, espécie, categoria)
 * 4. Verifica dependência (dependsOnItemCode satisfeita)
 * 5. Resolve data de ancoragem (nascimento, entrada, etc.)
 * 6. Avalia modo (campanha, janela, rotina, imediato)
 * 7. Constrói chave de dedup
 * 8. Verifica se já existe (evita duplicação)
 * 9. Compila resultado
 *
 * Cada passo pode retornar bloqueia imediatamente se falhr.
 * Sem I/O, determinístico, testável.
 */
export function computeNextSanitaryOccurrence(
  input: ComputeNextSanitaryOccurrenceInput,
): ComputeNextSanitaryOccurrenceResult {
  const { item, subject, history, now } = input;

  // --- PASSO 1 ---
  let result = step1CheckGeneratesAgenda(item);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  // --- PASSO 2 ---
  result = step2CheckApplicability(item, subject);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  // --- PASSO 3 ---
  result = step3CheckEligibility(item, subject);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  // --- PASSO 4 ---
  result = step4CheckDependency(item, history);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  // --- PASSO 5 ---
  const { anchorDate, reason: anchorReason } = step5ResolveAnchor(item, subject, history);
  if (anchorReason !== "continue") {
    return step9CompileResult(anchorReason, null, item, subject, null);
  }

  // --- PASSO 6 ---
  const { dueDate, reason: modeReason, periodKey } = step6EvaluateMode(item, subject, history, anchorDate, now);

  // --- PASSO 7 ---
  const dedupKey = step7BuildDedupKey(item, subject, periodKey);

  // --- PASSO 8 ---
  const dedupResult = step8CheckExistingOccurrence(dedupKey, history);
  if (dedupResult !== "continue") {
    return step9CompileResult(dedupResult, dueDate, item, subject, dedupKey);
  }

  // --- PASSO 9 ---
  return step9CompileResult(modeReason, dueDate, item, subject, dedupKey);
}
