import type {
  SanitaryProtocolItemDomain,
  SanitaryScopeType,
  SanitaryExecutionStatus,
  ComplianceLevel
} from "./domain";
import { buildSanitaryDedupKey } from "./dedup";

export interface SanitarySubjectContext {
  scopeType: SanitaryScopeType;
  scopeId: string;

  animal?: {
    id: string;
    birthDate: string | null;
    sex: "macho" | "femea";
    species: "bovino" | "bubalino";
    categoryCode: string | null;
    reproductionStatus?: string | null;
  } | null;

  lote?: {
    id: string;
    categoryCode?: string | null;
  } | null;

  fazenda: {
    id: string;
    uf: string | null;
    municipio: string | null;
    regiaoSanitaria?: string | null;
    classificacaoSanitaria?: string | null;
  };

  activeRisks: string[];
  activeEvents: Array<{
    eventId: string;
    eventCode: string;
    openedAt: string;
    closedAt: string | null;
  }>;
}

export interface SanitaryExecutionRecord {
  occurrenceId: string;
  familyCode: string;
  itemCode: string;
  regimenVersion: number;
  scopeType: SanitaryScopeType;
  scopeId: string;
  completedAt: string | null;
  executionDate: string | null;
  sourceEventId: string | null;
  dedupKey: string;
  status: SanitaryExecutionStatus;
}

export interface SchedulerNowContext {
  nowIso: string;
  timezone: string; // ex: America/Sao_Paulo
}

export interface ComputeNextSanitaryOccurrenceInput {
  item: SanitaryProtocolItemDomain;
  subject: SanitarySubjectContext;
  history: SanitaryExecutionRecord[];
  now: SchedulerNowContext;
}

export type OccurrenceBlockReason =
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

export interface ComputeNextSanitaryOccurrenceResult {
  materialize: boolean;
  dueDate: string | null;
  availableAt: string | null;
  dedupKey: string | null;
  reasonCode: OccurrenceBlockReason | "ready";
  reasonMessage: string;
  actionable: boolean;
  complianceLevel: ComplianceLevel;
  blockedBy: OccurrenceBlockReason | null;
}

function resolveEligibility(item: SanitaryProtocolItemDomain, subject: SanitarySubjectContext): boolean {
  if (item.identity.scopeType === "animal" && subject.animal) {
    if (item.eligibility.sexTarget !== "sem_restricao") {
      if (item.eligibility.sexTarget !== subject.animal.sex) return false;
    }
  }
  return true;
}

function resolveApplicability(item: SanitaryProtocolItemDomain, subject: SanitarySubjectContext): boolean {
  if (item.applicability.type === "evento") {
    const requiredEvents = item.applicability.event?.eventCodes;
    if (requiredEvents && requiredEvents.length > 0) {
      const hasActive = subject.activeEvents.some(evt => requiredEvents.includes(evt.eventCode));
      if (!hasActive) return false;
    }
  }
  return true;
}

export function computeNextSanitaryOccurrence(
  input: ComputeNextSanitaryOccurrenceInput,
): ComputeNextSanitaryOccurrenceResult {
  const { item, subject, history, now } = input;

  if (!item.schedule.generatesAgenda) {
    return {
      materialize: false,
      dueDate: null,
      availableAt: null,
      dedupKey: null,
      reasonCode: "agenda_disabled",
      reasonMessage: "Protocol item does not generate agenda.",
      actionable: false,
      complianceLevel: item.compliance.level,
      blockedBy: "agenda_disabled"
    };
  }

  if (!resolveApplicability(item, subject)) {
    return {
      materialize: false,
      dueDate: null,
      availableAt: null,
      dedupKey: null,
      reasonCode: "not_applicable",
      reasonMessage: "Applicability constraints not met.",
      actionable: false,
      complianceLevel: item.compliance.level,
      blockedBy: "not_applicable"
    };
  }

  if (!resolveEligibility(item, subject)) {
    return {
      materialize: false,
      dueDate: null,
      availableAt: null,
      dedupKey: null,
      reasonCode: "not_eligible",
      reasonMessage: "Eligibility constraints not met.",
      actionable: false,
      complianceLevel: item.compliance.level,
      blockedBy: "not_eligible"
    };
  }

  if (item.schedule.dependsOnItemCode) {
    const dependencyCompleted = history.some(h =>
      h.itemCode === item.schedule.dependsOnItemCode &&
      h.familyCode === item.identity.familyCode &&
      h.status === "completed"
    );
    if (!dependencyCompleted) {
      return {
        materialize: false,
        dueDate: null,
        availableAt: null,
        dedupKey: null,
        reasonCode: "dependency_not_satisfied",
        reasonMessage: `Aguardando conclusao de ${item.schedule.dependsOnItemCode}.`,
        actionable: false,
        complianceLevel: item.compliance.level,
        blockedBy: "dependency_not_satisfied"
      };
    }
  }

  // Handle specific modes
  if (item.schedule.mode === "janela_etaria") {
    if (subject.animal?.birthDate) {
      const birthDate = new Date(subject.animal.birthDate);
      const today = new Date(now.nowIso);
      const ageDays = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

      if (item.schedule.ageStartDays !== null && ageDays < item.schedule.ageStartDays) {
        return {
          materialize: false,
          dueDate: null,
          availableAt: null,
          dedupKey: null,
          reasonCode: "before_window",
          reasonMessage: "Animal is below minimum age window.",
          actionable: false,
          complianceLevel: item.compliance.level,
          blockedBy: "before_window"
        };
      }

      if (item.schedule.ageEndDays !== null && ageDays > item.schedule.ageEndDays) {
        return {
          materialize: false,
          dueDate: null,
          availableAt: null,
          dedupKey: null,
          reasonCode: "window_expired",
          reasonMessage: "Animal exceeded maximum age window.",
          actionable: false,
          complianceLevel: item.compliance.level,
          blockedBy: "window_expired"
        };
      }

      // Calculate due date based on start of window
      const due = new Date(birthDate.getTime() + (item.schedule.ageStartDays ?? 0) * 24 * 60 * 60 * 1000);
      const dedupKey = buildSanitaryDedupKey({
        identity: item.identity,
        scopeId: subject.scopeId,
        mode: item.schedule.mode,
        windowStartIso: item.schedule.ageStartDays ? "life" : null // simplification for now
      });

      return {
        materialize: true,
        dueDate: due.toISOString().split("T")[0],
        availableAt: due.toISOString().split("T")[0],
        dedupKey,
        reasonCode: "ready",
        reasonMessage: "Janela etaria ativa.",
        actionable: true,
        complianceLevel: item.compliance.level,
        blockedBy: null
      };
    }
  }

  if (item.schedule.mode === "rotina_recorrente") {
    let recurrenceOriginIso = now.nowIso.split("T")[0]; // fallback to today if no origin
    if (item.schedule.anchor === "ultima_conclusao_mesma_familia" && history.length > 0) {
      const lastCompleted = history
        .filter(h => h.familyCode === item.identity.familyCode && h.status === "completed")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
      if (lastCompleted?.completedAt) {
        recurrenceOriginIso = lastCompleted.completedAt.split("T")[0];
      }
    }

    const dedupKey = buildSanitaryDedupKey({
      identity: item.identity,
      scopeId: subject.scopeId,
      mode: item.schedule.mode,
      recurrenceOriginIso
    });

    return {
      materialize: true,
      dueDate: recurrenceOriginIso, // simplification
      availableAt: recurrenceOriginIso,
      dedupKey,
      reasonCode: "ready",
      reasonMessage: "Rotina recorrente.",
      actionable: true,
      complianceLevel: item.compliance.level,
      blockedBy: null
    };
  }

  // Default block for unhandled/unmatched scenarios
  return {
    materialize: false,
    dueDate: null,
    availableAt: null,
    dedupKey: null,
    reasonCode: "not_applicable",
    reasonMessage: "Condicoes de agenda nao atendidas.",
    actionable: false,
    complianceLevel: item.compliance.level,
    blockedBy: "not_applicable"
  };
}
