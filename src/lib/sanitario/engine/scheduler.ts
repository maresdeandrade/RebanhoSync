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
} from "@/lib/sanitario/models/domain";

import { blockingCategory, isBlockingReason, reasonCodeMessage, type OccurrenceBlockReason } from "@/lib/sanitario/models/reasonCodes";
import { buildSanitaryDedupKey, campaignPeriodKey, eventPeriodKey, intervalPeriodKey, windowPeriodKey } from "@/lib/sanitario/engine/dedup";
import { addDays, daysBetween, resolveAnchorDate } from "@/lib/sanitario/engine/anchorResolution";
import type { SanitaryProtocolMetadata } from "@/lib/sanitario/engine/protocolLayers";

export interface ComputeNextSanitaryOccurrenceInput {
  item: SanitaryProtocolItemDomain;
  subject: SanitarySubjectContext;
  history: SanitaryExecutionRecord[];
  now: SchedulerNowContext;
}

// ============================================================================
// PR2: Gate Único de Geração de Agenda
// ============================================================================

export interface ProtocolAgendaEligibilityCheckInput {
  protocolMetadata: SanitaryProtocolMetadata | null;
  item: SanitaryProtocolItemDomain;
  subject: SanitarySubjectContext;
  history: SanitaryExecutionRecord[];
  now: SchedulerNowContext;
  existingDedupKey?: string | null;
}

export interface ProtocolAgendaEligibilityResult {
  eligible: boolean;
  blockedBy: string[] | null;
  reasons: OccurrenceBlockReason[];
}

/**
 * Gate único para determinar se um protocolo pode gerar agenda.
 *
 * Validações em ordem:
 * 1. Metadados de camada (activation_state, superseded, overlay)
 * 2. Protocolo gera agenda (gera_agenda=true)
 * 3. Protocolo é aplicável
 * 4. Animal é elegível
 * 5. Dependência foi satisfeita
 * 6. Âncora é resolvível
 * 7. Modo de calendário permite materialização
 * 8. Dedup não existe em aberto
 *
 * Retorna bloqueadores em ordem de severidade.
 */
export function computeProtocolAgendaEligibility(
  input: ProtocolAgendaEligibilityCheckInput,
): ProtocolAgendaEligibilityResult {
  const { protocolMetadata, item, subject, history, now, existingDedupKey } = input;
  const reasons: OccurrenceBlockReason[] = [];

  // VALIDAÇÃO 1: Metadados de camada
  if (protocolMetadata) {
    if (protocolMetadata.hiddenFromPrimaryList) {
      reasons.push("superseded_by_layer");
      return { eligible: false, blockedBy: ["superseded"], reasons };
    }

    const { activationState } = protocolMetadata;
    if (
      activationState !== "active_official" &&
      activationState !== "active_custom"
    ) {
      reasons.push("inactive_protocol");
      return { eligible: false, blockedBy: ["not_active"], reasons };
    }
  }

  // VALIDAÇÃO 2: Protocolo gera agenda
  let checkResult = step1CheckGeneratesAgenda(item);
  if (checkResult !== "continue") {
    reasons.push(checkResult);
    return { eligible: false, blockedBy: [checkResult], reasons };
  }

  // VALIDAÇÃO 3: Aplicabilidade
  checkResult = step2CheckApplicability(item, subject);
  if (checkResult !== "continue") {
    reasons.push(checkResult);
    return { eligible: false, blockedBy: [checkResult], reasons };
  }

  // VALIDAÇÃO 4: Elegibilidade
  const nowDateIso = now.nowIso.split("T")[0] ?? now.nowIso;
  checkResult = step3CheckEligibility(item, subject, nowDateIso);  if (checkResult !== "continue") {
    reasons.push(checkResult);
    return { eligible: false, blockedBy: [checkResult], reasons };
  }

  // VALIDAÇÃO 5: Dependência
  checkResult = step4CheckDependency(item, history);
  if (checkResult !== "continue") {
    reasons.push(checkResult);
    return { eligible: false, blockedBy: [checkResult], reasons };
  }

  checkResult = step4bCheckDependentSingleRunCompletion(item, subject, history);
  if (checkResult !== "continue") {
    reasons.push(checkResult);
    return { eligible: false, blockedBy: [checkResult], reasons };
  }

  // VALIDAÇÃO 6: Âncora
  const { anchorDate, reason: anchorReason } = step5ResolveAnchor(item, subject, history);
  if (anchorReason !== "continue") {
    reasons.push(anchorReason);
    return { eligible: false, blockedBy: [anchorReason], reasons };
  }

  // VALIDAÇÃO 7: Modo de calendário permite materialização
  const calendarMode = item.schedule.mode ?? "nao_estruturado";
  const allowedModes = ["campanha", "janela_etaria", "rotina_recorrente", "procedimento_imediato", "nao_estruturado"];
  if (!allowedModes.includes(calendarMode)) {
    reasons.push("calendar_mode_not_materializable");
    return { eligible: false, blockedBy: ["calendar_mode_not_materializable"], reasons };
  }

  // VALIDAÇÃO 8: Dedup
  if (existingDedupKey) {
    const dedupKey = step7BuildDedupKey(item, subject, null);
    if (dedupKey && dedupKey === existingDedupKey) {
      const dedupResult = step8CheckExistingOccurrence(dedupKey, history);
      if (dedupResult !== "continue") {
        reasons.push(dedupResult);
        return { eligible: false, blockedBy: [dedupResult], reasons };
      }
    }
  }

  // Passou em todas as validações
  return { eligible: true, blockedBy: null, reasons: [] };
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
    const jurisdiction = applicability.jurisdiction;
    if (jurisdiction) {
      // Comparar arrays corretamente
      if (jurisdiction.uf && jurisdiction.uf.length > 0 && farmedaUF) {
        if (!jurisdiction.uf.includes(farmedaUF)) {
          return "jurisdiction_not_allowed";
        }
      }
      if (jurisdiction.municipio && jurisdiction.municipio.length > 0 && subject.fazenda.municipio) {
        if (!jurisdiction.municipio.includes(subject.fazenda.municipio)) {
          return "jurisdiction_not_allowed";
        }
      }
      if (jurisdiction.regiaoSanitaria && jurisdiction.regiaoSanitaria.length > 0 && subject.fazenda.regiaoSanitaria) {
        if (!jurisdiction.regiaoSanitaria.includes(subject.fazenda.regiaoSanitaria)) {
          return "jurisdiction_not_allowed";
        }
      }
      if (jurisdiction.classificacaoSanitaria && jurisdiction.classificacaoSanitaria.length > 0 && subject.fazenda.classificacaoSanitaria) {
        if (!jurisdiction.classificacaoSanitaria.includes(subject.fazenda.classificacaoSanitaria)) {
          return "jurisdiction_not_allowed";
        }
      }
    }
  }

  if (applicability.type === "risco") {
    const activeRisks = subject.activeRisks ?? [];
    const risk = applicability.risk;
    if (risk?.riskCodes && risk.riskCodes.length > 0) {
      const hasMatchingRisk = risk.riskCodes.some(code => activeRisks.includes(code));
      if (!hasMatchingRisk) {
        return "risk_not_active";
      }
    }
  }

  if (applicability.type === "evento") {
    const activeEvents = subject.activeEvents ?? [];
    const event = applicability.event;
    if (event?.eventCodes && event.eventCodes.length > 0) {
      const hasMatchingEvent = activeEvents.some(e => event.eventCodes!.includes(e.eventCode));
      if (!hasMatchingEvent) {
        return "event_not_active";
      }
    }
  }

  if (applicability.type === "perfil_animal") {
    if (!subject.animal) {
      return "not_applicable";
    }
    const animal = subject.animal;
    const profile = applicability.animalProfile;
    if (profile) {
      // Verificar espécie
      if (profile.species && profile.species.length > 0) {
        if (!profile.species.includes(animal.species)) {
          return "not_applicable";
        }
      }
      // Verificar categoria
      if (profile.categoryCodes && profile.categoryCodes.length > 0) {
        const animalCategory = animal.categoryCode ?? "";
        if (!profile.categoryCodes.includes(animalCategory)) {
          return "not_applicable";
        }
      }
      // Verificar status reprodutivo
      if (profile.reproductionStatus && profile.reproductionStatus.length > 0) {
        const animalStatus = animal.reproductionStatus ?? "";
        if (!profile.reproductionStatus.includes(animalStatus)) {
          return "not_applicable";
        }
      }
    }
  }

  return "continue";
}

/**
 * PASSO 3: Verifica se animal é elegível
 * (sexo, idade, espécie, categoria).
 */
function step3CheckEligibility(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  nowIso: string,
): OccurrenceBlockReason | "continue" {
  if (!subject.animal) {
    return "not_eligible";
  }

  const animal = subject.animal;
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
    const species = eligibility.species;
    if (species.length > 0 && !species.includes(animal.species)) {
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
      const ageNowDays = daysBetween(birthDate, nowIso);
      if (ageNowDays < eligibility.ageMinDays) {
        return "before_window";
      }
    }
  }

  if (eligibility.ageMaxDays !== null && eligibility.ageMaxDays !== undefined) {
    const birthDate = subject.animal.birthDate;
    if (birthDate) {
      const ageNowDays = daysBetween(birthDate, nowIso);
      if (ageNowDays > eligibility.ageMaxDays) {
        return "window_expired";
      }
    }
  }

  return "continue";
}

/**
 * PASSO 4: Verifica se dependência foi satisfeita.
 * Valida familyCode, itemCode e regimenVersion para evitar dependência cruzada.
 */
function step4CheckDependency(
  item: SanitaryProtocolItemDomain,
  history: SanitaryExecutionRecord[],
): OccurrenceBlockReason | "continue" {
  if (!item.schedule.dependsOnItemCode) {
    return "continue";
  }

  const dependsOn = item.schedule.dependsOnItemCode;
  const { familyCode, regimenVersion } = item.identity;

  // Buscar no histórico: deve ser mesma família, mesmo item de dependência e mesma versão de regimen
  // Fallback para legado: se regimenVersion for 1, aceita histórico sem validação estrita de versão
  const dependencyCompleted = history.some((h) => {
    if (h.status !== "completed") return false;
    if (h.itemCode !== dependsOn) return false;
    if (h.familyCode !== familyCode) return false;

    // Validação estrita de versão para regimen > 1
    // Para regimenVersion === 1, aceitar histórico com versão 1 ou undefined/0 (legado)
    if (regimenVersion > 1) {
      return h.regimenVersion === regimenVersion;
    }
    return h.regimenVersion === regimenVersion || h.regimenVersion === 1 || h.regimenVersion === 0;
  });

  if (!dependencyCompleted) {
    return "dependency_not_satisfied";
  }

  return "continue";
}

function isSameRegimenVersion(
  item: SanitaryProtocolItemDomain,
  record: SanitaryExecutionRecord,
) {
  const { regimenVersion } = item.identity;
  if (regimenVersion > 1) {
    return record.regimenVersion === regimenVersion;
  }
  return record.regimenVersion === regimenVersion || record.regimenVersion === 1 || record.regimenVersion === 0;
}

function hasCompletedCurrentItem(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
) {
  return history.some((h) => {
    if (h.status !== "completed") return false;
    if (h.familyCode !== item.identity.familyCode) return false;
    if (h.itemCode !== item.identity.itemCode) return false;
    if (!isSameRegimenVersion(item, h)) return false;
    if (h.scopeType !== subject.scopeType) return false;
    if (h.scopeId !== subject.scopeId) return false;
    return true;
  });
}

function isExplicitRecurringDependentItem(item: SanitaryProtocolItemDomain) {
  return item.schedule.scheduleKind === "rolling_from_last_completion";
}

function step4bCheckDependentSingleRunCompletion(
  item: SanitaryProtocolItemDomain,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
): OccurrenceBlockReason | "continue" {
  if (!item.schedule.dependsOnItemCode) {
    return "continue";
  }

  if (item.schedule.mode !== "rotina_recorrente") {
    return "continue";
  }

  if (isExplicitRecurringDependentItem(item)) {
    return "continue";
  }

  if (hasCompletedCurrentItem(item, subject, history)) {
    return "already_materialized";
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
  const nowDate = now.nowIso.split("T")[0] ?? now.nowIso;

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
    return evaluateProcedimentoImediatoMode(item, subject, nowDate);
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
  nowIso: string,
): { dueDate: string | null; reason: OccurrenceBlockReason; periodKey: string | null } {
  const activeEvents = subject.activeEvents ?? [];

  if (activeEvents.length === 0) {
    return { dueDate: null, reason: "not_applicable", periodKey: null };
  }

  // Usar primeiro evento ativo como trigger
  const eventId = activeEvents[0]?.eventId ?? "unknown";

  // Extrair data de nowIso (YYYY-MM-DD)
  const dueDate = nowIso.split("T")[0] ?? null;

  return {
    dueDate,
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
    jurisdiction:
      item.applicability.jurisdiction?.uf?.length === 1
        ? item.applicability.jurisdiction.uf[0] ?? null
        : null,
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
  const complianceLevel = item.compliance.level;

  return {
    materialize: shouldMaterialize,
    dueDate,
    availableAt: shouldMaterialize ? dueDate : null,
    dedupKey,
    reasonCode,
    reasonMessage,
    actionable,
    complianceLevel,
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
  const nowDateIso = now.nowIso.split("T")[0] ?? now.nowIso;
  result = step3CheckEligibility(item, subject, nowDateIso);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  // --- PASSO 4 ---
  result = step4CheckDependency(item, history);
  if (result !== "continue") {
    return step9CompileResult(result, null, item, subject, null);
  }

  result = step4bCheckDependentSingleRunCompletion(item, subject, history);
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
