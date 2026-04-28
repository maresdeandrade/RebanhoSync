import {
  readSanitaryBaseCalendar,
  toSqlCalendarMode,
  type SanitarySqlCalendarMode,
} from "@/lib/sanitario/engine/calendar";

export const SANITARY_REGIMEN_VERSION = 1;

export type SanitaryHistoryConfidence = "known" | "partial" | "unknown";

export type SanitaryComplianceState =
  | "scheduled"
  | "catch_up_required"
  | "documentation_required"
  | "evaluation_required";

export type SanitaryCompletionRuleType =
  | "event"
  | "event_or_document"
  | "evaluation";

export type SanitaryScheduleRuleKind =
  | "calendar_base"
  | "after_previous_completion"
  | "rolling_from_last_completion";

export interface SanitaryEligibilityRule {
  sex: "M" | "F" | "todos" | null;
  ageStartDays: number | null;
  ageEndDays: number | null;
  acquisitionMode: "all" | "born_on_farm" | "acquired";
}

export interface SanitaryCompletionRule {
  type: SanitaryCompletionRuleType;
  requiresDocumentation: boolean;
  anchorToLastValidCompletion: boolean;
}

export interface SanitaryScheduleRule {
  kind: SanitaryScheduleRuleKind;
  calendarMode: SanitarySqlCalendarMode | null;
  intervalDays: number | null;
  projectionHorizonDays: number | null;
}

export interface SanitaryRegimenMilestone {
  version: typeof SANITARY_REGIMEN_VERSION;
  family_code: string;
  regimen_version: number;
  milestone_code: string;
  sequence_order: number;
  depends_on_milestone: string | null;
  eligibility_rule: SanitaryEligibilityRule;
  completion_rule: SanitaryCompletionRule;
  schedule_rule: SanitaryScheduleRule;
  history_confidence: SanitaryHistoryConfidence | null;
  compliance_state: SanitaryComplianceState | null;
}

export interface InferSanitaryRegimenMilestoneInput {
  familyCode: string | null | undefined;
  regimenVersion?: number | null;
  milestoneCode?: string | null;
  sequenceOrder?: number | null;
  dependsOnMilestone?: string | null;
  sexoAlvo?: "M" | "F" | "todos" | "" | null;
  idadeMinDias?: number | null;
  idadeMaxDias?: number | null;
  requiresComplianceDocument?: boolean;
  historyConfidence?: SanitaryHistoryConfidence | null;
  complianceState?: SanitaryComplianceState | null;
  acquisitionMode?: SanitaryEligibilityRule["acquisitionMode"];
  scheduleKind?: SanitaryScheduleRuleKind | null;
  payload?: Record<string, unknown> | null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function normalizeCode(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : null;
}

function sanitizeSequenceOrder(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.trunc(value);
}

export function buildSanitaryRegimenDedupTemplate(
  regimen: Pick<SanitaryRegimenMilestone, "family_code" | "milestone_code">,
) {
  return `sanitario:${regimen.family_code}:{animal_id}:milestone:${regimen.milestone_code}`;
}

export function inferSanitaryRegimenMilestone(
  input: InferSanitaryRegimenMilestoneInput,
): SanitaryRegimenMilestone | null {
  const familyCode = normalizeCode(input.familyCode);
  if (!familyCode) return null;

  const calendarRule = readSanitaryBaseCalendar(input.payload);
  const sequenceOrder = sanitizeSequenceOrder(input.sequenceOrder);
  const milestoneCode =
    normalizeCode(input.milestoneCode) ??
    (sequenceOrder > 1 ? `dose_${sequenceOrder}` : "dose_1");
  const dependsOnMilestone = normalizeCode(input.dependsOnMilestone);

  let scheduleKind: SanitaryScheduleRuleKind =
    input.scheduleKind ?? "calendar_base";
  if (!input.scheduleKind && dependsOnMilestone) {
    scheduleKind =
      toSqlCalendarMode(calendarRule?.mode) === "rolling_interval"
        ? "rolling_from_last_completion"
        : "after_previous_completion";
  } else if (
    !input.scheduleKind &&
    toSqlCalendarMode(calendarRule?.mode) === "rolling_interval" &&
    sequenceOrder === 1
  ) {
    scheduleKind = "rolling_from_last_completion";
  }
  const calendarMode = toSqlCalendarMode(calendarRule?.mode);

  return {
    version: SANITARY_REGIMEN_VERSION,
    family_code: familyCode,
    regimen_version:
      typeof input.regimenVersion === "number" &&
      Number.isFinite(input.regimenVersion) &&
      input.regimenVersion > 0
        ? Math.trunc(input.regimenVersion)
        : 1,
    milestone_code: milestoneCode,
    sequence_order: sequenceOrder,
    depends_on_milestone: dependsOnMilestone,
    eligibility_rule: {
      sex:
        input.sexoAlvo === "M" || input.sexoAlvo === "F" || input.sexoAlvo === "todos"
          ? input.sexoAlvo
          : null,
      ageStartDays:
        typeof input.idadeMinDias === "number" && Number.isFinite(input.idadeMinDias)
          ? Math.max(0, Math.trunc(input.idadeMinDias))
          : null,
      ageEndDays:
        typeof input.idadeMaxDias === "number" && Number.isFinite(input.idadeMaxDias)
          ? Math.max(0, Math.trunc(input.idadeMaxDias))
          : null,
      acquisitionMode: input.acquisitionMode ?? "all",
    },
    completion_rule: {
      type: input.requiresComplianceDocument ? "event_or_document" : "event",
      requiresDocumentation: Boolean(input.requiresComplianceDocument),
      anchorToLastValidCompletion:
        scheduleKind === "rolling_from_last_completion" || dependsOnMilestone !== null,
    },
    schedule_rule: {
      kind: scheduleKind,
      calendarMode,
      intervalDays:
        typeof calendarRule?.intervalDays === "number" &&
        Number.isFinite(calendarRule.intervalDays)
          ? Math.max(0, Math.trunc(calendarRule.intervalDays))
          : null,
      projectionHorizonDays:
        typeof calendarRule?.intervalDays === "number" &&
        Number.isFinite(calendarRule.intervalDays)
          ? Math.max(0, Math.trunc(calendarRule.intervalDays))
          : 0,
    },
    history_confidence: input.historyConfidence ?? null,
    compliance_state: input.complianceState ?? null,
  };
}

export function buildSanitaryRegimenPayload(
  milestone: SanitaryRegimenMilestone | null,
): Record<string, unknown> {
  if (!milestone) return {};

  return {
    regime_sanitario: {
      version: milestone.version,
      family_code: milestone.family_code,
      regimen_version: milestone.regimen_version,
      milestone_code: milestone.milestone_code,
      sequence_order: milestone.sequence_order,
      depends_on_milestone: milestone.depends_on_milestone,
      eligibility_rule: {
        sex: milestone.eligibility_rule.sex,
        age_start_days: milestone.eligibility_rule.ageStartDays,
        age_end_days: milestone.eligibility_rule.ageEndDays,
        acquisition_mode: milestone.eligibility_rule.acquisitionMode,
      },
      completion_rule: {
        type: milestone.completion_rule.type,
        requires_documentation: milestone.completion_rule.requiresDocumentation,
        anchor_to_last_valid_completion:
          milestone.completion_rule.anchorToLastValidCompletion,
      },
      schedule_rule: {
        kind: milestone.schedule_rule.kind,
        calendar_mode: milestone.schedule_rule.calendarMode,
        interval_days: milestone.schedule_rule.intervalDays,
        projection_horizon_days: milestone.schedule_rule.projectionHorizonDays,
      },
      history_confidence: milestone.history_confidence,
      compliance_state: milestone.compliance_state,
    },
  };
}

export function readSanitaryRegimen(
  payload: Record<string, unknown> | null | undefined,
): SanitaryRegimenMilestone | null {
  const raw = payload?.regime_sanitario;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const familyCode = normalizeCode(readString(record, "family_code"));
  const milestoneCode = normalizeCode(readString(record, "milestone_code"));
  if (!familyCode || !milestoneCode) return null;

  const eligibilityRaw =
    record.eligibility_rule &&
    typeof record.eligibility_rule === "object" &&
    !Array.isArray(record.eligibility_rule)
      ? (record.eligibility_rule as Record<string, unknown>)
      : {};
  const completionRaw =
    record.completion_rule &&
    typeof record.completion_rule === "object" &&
    !Array.isArray(record.completion_rule)
      ? (record.completion_rule as Record<string, unknown>)
      : {};
  const scheduleRaw =
    record.schedule_rule &&
    typeof record.schedule_rule === "object" &&
    !Array.isArray(record.schedule_rule)
      ? (record.schedule_rule as Record<string, unknown>)
      : {};

  return {
    version: SANITARY_REGIMEN_VERSION,
    family_code: familyCode,
    regimen_version: sanitizeSequenceOrder(readNumber(record, "regimen_version")),
    milestone_code: milestoneCode,
    sequence_order: sanitizeSequenceOrder(readNumber(record, "sequence_order")),
    depends_on_milestone: normalizeCode(
      readString(record, "depends_on_milestone"),
    ),
    eligibility_rule: {
      sex:
        readString(eligibilityRaw, "sex") === "M" ||
        readString(eligibilityRaw, "sex") === "F" ||
        readString(eligibilityRaw, "sex") === "todos"
          ? (readString(eligibilityRaw, "sex") as "M" | "F" | "todos")
          : null,
      ageStartDays: readNumber(eligibilityRaw, "age_start_days"),
      ageEndDays: readNumber(eligibilityRaw, "age_end_days"),
      acquisitionMode:
        readString(eligibilityRaw, "acquisition_mode") === "born_on_farm" ||
        readString(eligibilityRaw, "acquisition_mode") === "acquired"
          ? (readString(eligibilityRaw, "acquisition_mode") as
              | "born_on_farm"
              | "acquired")
          : "all",
    },
    completion_rule: {
      type:
        readString(completionRaw, "type") === "event_or_document" ||
        readString(completionRaw, "type") === "evaluation"
          ? (readString(completionRaw, "type") as SanitaryCompletionRuleType)
          : "event",
      requiresDocumentation:
        readBoolean(completionRaw, "requires_documentation") ?? false,
      anchorToLastValidCompletion:
        readBoolean(completionRaw, "anchor_to_last_valid_completion") ?? false,
    },
    schedule_rule: {
      kind:
        readString(scheduleRaw, "kind") === "after_previous_completion" ||
        readString(scheduleRaw, "kind") === "rolling_from_last_completion"
          ? (readString(scheduleRaw, "kind") as SanitaryScheduleRuleKind)
          : "calendar_base",
      calendarMode: toSqlCalendarMode(readString(scheduleRaw, "calendar_mode")),
      intervalDays: readNumber(scheduleRaw, "interval_days"),
      projectionHorizonDays: readNumber(scheduleRaw, "projection_horizon_days"),
    },
    history_confidence:
      readString(record, "history_confidence") === "known" ||
      readString(record, "history_confidence") === "partial" ||
      readString(record, "history_confidence") === "unknown"
        ? (readString(record, "history_confidence") as SanitaryHistoryConfidence)
        : null,
    compliance_state:
      readString(record, "compliance_state") === "catch_up_required" ||
      readString(record, "compliance_state") === "documentation_required" ||
      readString(record, "compliance_state") === "evaluation_required"
        ? (readString(record, "compliance_state") as SanitaryComplianceState)
        : readString(record, "compliance_state") === "scheduled"
          ? "scheduled"
          : null,
  };
}
