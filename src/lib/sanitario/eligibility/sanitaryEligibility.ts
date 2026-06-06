import type { SanitaryProtocolRule } from "../rules/sanitaryProtocolRule";

export type SanitaryEligibilityStatus =
  | "not_applicable"
  | "insufficient_data"
  | "not_yet_eligible"
  | "eligible_soon"
  | "in_action_window"
  | "near_deadline"
  | "overdue"
  | "completed";

export type SanitaryEligibilityLimitation =
  | "missing_birth_date"
  | "invalid_birth_date"
  | "estimated_age"
  | "missing_sex"
  | "missing_species"
  | "missing_lote"
  | "missing_protocol_window"
  | "invalid_protocol_rule"
  | "invalid_reference_date"
  | "invalid_event_date"
  | "insufficient_event_history"
  | "missing_anchor_event"
  | "missing_anchor_event_criteria"
  | "ambiguous_anchor_event"
  | "unsupported_required_dose_count";

export type SanitaryEligibilityAnimal = {
  id: string;
  birthDate?: string | null;
  birthDateEstimated?: boolean;
  sex?: string | null;
  species?: string | null;
  categoryKey?: string | null;
  loteId?: string | null;
  loteEnteredAt?: string | null;
  manualAnchorDate?: string | null;
};

export type SanitaryExecutedEvent = {
  id: string;
  animalId: string;
  occurredAt: string;
  deletedAt?: string | null;
  canceledAt?: string | null;
  status?: string | null;
  protocolRuleId?: string | null;
  productId?: string | null;
  productClass?: string | null;
  doseNumber?: number | null;
};

export type SanitaryEligibilityThresholds = {
  eligibleSoonDays?: number;
  nearDeadlineDays?: number;
};

export type SanitaryEligibilityApplicability = {
  sex?: string | readonly string[];
  species?: string | readonly string[];
  categoryKeys?: readonly string[];
  loteIds?: readonly string[];
};

export type SanitaryEligibilityProtocolRule = SanitaryProtocolRule & {
  applicability?: SanitaryEligibilityApplicability;
  anchorEventCriteria?: {
    protocolRuleId?: string;
    productId?: string;
    productClass?: string;
    doseNumber?: number;
  };
};

export type ComputeSanitaryEligibilityInput = {
  animal: SanitaryEligibilityAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  executedEvents: readonly SanitaryExecutedEvent[];
  referenceDate: string;
  thresholds?: SanitaryEligibilityThresholds;
};

export type SanitaryEligibilityResult = {
  status: SanitaryEligibilityStatus;
  limitations: SanitaryEligibilityLimitation[];
  window?: {
    startDate: string;
    endDate?: string;
  };
  matchedEventIds: string[];
};

const DEFAULT_ELIGIBLE_SOON_DAYS = 14;
const DEFAULT_NEAR_DEADLINE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

// Core puro unitario: consumo em massa deve usar batch/worker/read model derivado,
// nao calculo direto em renderizacao de UI.
function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? null;
}

function parseDateKey(value: string | null | undefined): Date | null {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === dateKey ? date : null;
}

function addDays(dateKey: string, days: number): string | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDateKey: string, toDateKeyValue: string): number | null {
  const fromDate = parseDateKey(fromDateKey);
  const toDate = parseDateKey(toDateKeyValue);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
}

function isValidDateKey(value: string | null | undefined): boolean {
  return Boolean(parseDateKey(value));
}

function uniqueLimitations(
  limitations: readonly SanitaryEligibilityLimitation[],
): SanitaryEligibilityLimitation[] {
  return Array.from(new Set(limitations));
}

function includesValue(
  expected: string | readonly string[] | undefined,
  actual: string | null | undefined,
): boolean {
  if (!expected) return true;
  if (!actual) return false;
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

function isDeletedOrCanceled(event: SanitaryExecutedEvent): boolean {
  return Boolean(event.deletedAt) || Boolean(event.canceledAt) || event.status === "canceled";
}

function eventMatchesProtocol(
  event: SanitaryExecutedEvent,
  protocolRule: SanitaryEligibilityProtocolRule,
): boolean {
  if (event.protocolRuleId && event.protocolRuleId === protocolRule.id) return true;

  const productId =
    protocolRule.completionCriteria.compatibleProductId ??
    protocolRule.productRequirement?.productId;
  if (productId && event.productId === productId) return true;

  const productClass =
    protocolRule.completionCriteria.compatibleProductClass ??
    protocolRule.productRequirement?.classKey;
  if (productClass && event.productClass === productClass) return true;

  return false;
}

function findMatchingEvents(
  executedEvents: readonly SanitaryExecutedEvent[],
  protocolRule: SanitaryEligibilityProtocolRule,
  animal: SanitaryEligibilityAnimal,
  referenceDate: string,
  limitations: SanitaryEligibilityLimitation[],
): SanitaryExecutedEvent[] {
  return executedEvents.filter((event) => {
    if (event.animalId !== animal.id || isDeletedOrCanceled(event)) return false;

    const eventDate = toDateKey(event.occurredAt);
    if (!eventDate || !isValidDateKey(eventDate)) {
      limitations.push("invalid_event_date");
      return false;
    }

    const daysFromReference = daysBetween(referenceDate, eventDate);
    if (daysFromReference === null || daysFromReference > 0) return false;

    return eventMatchesProtocol(event, protocolRule);
  });
}

function anchorEventMatchesCriteria(
  event: SanitaryExecutedEvent,
  criteria: NonNullable<SanitaryEligibilityProtocolRule["anchorEventCriteria"]>,
): boolean {
  if (criteria.protocolRuleId && event.protocolRuleId !== criteria.protocolRuleId) return false;
  if (criteria.productId && event.productId !== criteria.productId) return false;
  if (criteria.productClass && event.productClass !== criteria.productClass) return false;
  if (criteria.doseNumber !== undefined && event.doseNumber !== criteria.doseNumber) return false;
  return true;
}

function findAnchorEvents(input: {
  executedEvents: readonly SanitaryExecutedEvent[];
  animal: SanitaryEligibilityAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  referenceDate: string;
  limitations: SanitaryEligibilityLimitation[];
}): SanitaryExecutedEvent[] {
  const criteria = input.protocolRule.anchorEventCriteria;
  if (!criteria || Object.keys(criteria).length === 0) {
    input.limitations.push("missing_anchor_event_criteria");
    return [];
  }

  return input.executedEvents.filter((event) => {
    if (event.animalId !== input.animal.id || isDeletedOrCanceled(event)) return false;
    if (!anchorEventMatchesCriteria(event, criteria)) return false;

    const eventDate = toDateKey(event.occurredAt);
    if (!eventDate || !isValidDateKey(eventDate)) {
      input.limitations.push("invalid_event_date");
      return false;
    }

    const daysFromReference = daysBetween(input.referenceDate, eventDate);
    return daysFromReference !== null && daysFromReference <= 0;
  });
}

function resolveAnchorDate(input: {
  animal: SanitaryEligibilityAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  executedEvents: readonly SanitaryExecutedEvent[];
  referenceDate: string;
  anchor: NonNullable<SanitaryProtocolRule["eligibilityWindow"]>["start"]["anchor"];
  limitations: SanitaryEligibilityLimitation[];
}): string | null {
  const { animal, anchor, limitations, executedEvents, protocolRule, referenceDate } = input;

  if (anchor === "nascimento") {
    const birthDate = toDateKey(animal.birthDate);
    if (!birthDate) {
      limitations.push("missing_birth_date");
      return null;
    }
    if (!isValidDateKey(birthDate)) {
      limitations.push("invalid_birth_date");
      return null;
    }
    return birthDate;
  }

  if (anchor === "entrada_lote") {
    const loteDate = toDateKey(animal.loteEnteredAt);
    if (!animal.loteId || !loteDate) {
      limitations.push("missing_lote");
      return null;
    }
    return loteDate;
  }

  if (anchor === "manual") {
    const manualAnchorDate = toDateKey(animal.manualAnchorDate);
    if (!manualAnchorDate || !isValidDateKey(manualAnchorDate)) {
      limitations.push("invalid_protocol_rule");
      return null;
    }
    return manualAnchorDate;
  }

  const anchorEvents = findAnchorEvents({
    animal,
    executedEvents,
    protocolRule,
    referenceDate,
    limitations,
  });
  if (
    !protocolRule.anchorEventCriteria ||
    Object.keys(protocolRule.anchorEventCriteria).length === 0
  ) {
    return null;
  }
  if (anchorEvents.length === 0) {
    limitations.push("missing_anchor_event");
    return null;
  }
  if (anchorEvents.length > 1) {
    limitations.push("ambiguous_anchor_event");
    return null;
  }

  return toDateKey(anchorEvents[0].occurredAt);
}

function resolveWindow(input: {
  animal: SanitaryEligibilityAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  executedEvents: readonly SanitaryExecutedEvent[];
  referenceDate: string;
  limitations: SanitaryEligibilityLimitation[];
}): SanitaryEligibilityResult["window"] | null {
  const { protocolRule, limitations } = input;
  const eligibilityWindow = protocolRule.eligibilityWindow;
  if (!eligibilityWindow) {
    limitations.push("missing_protocol_window");
    return null;
  }

  const endOffsetDays = eligibilityWindow.end?.offsetDays;
  if (
    eligibilityWindow.start.offsetDays < 0 ||
    (endOffsetDays !== undefined && endOffsetDays < 0)
  ) {
    limitations.push("invalid_protocol_rule");
    return null;
  }

  if (
    eligibilityWindow.end &&
    eligibilityWindow.start.anchor === eligibilityWindow.end.anchor &&
    eligibilityWindow.end.offsetDays < eligibilityWindow.start.offsetDays
  ) {
    limitations.push("invalid_protocol_rule");
    return null;
  }

  const startAnchorDate = resolveAnchorDate({
    ...input,
    anchor: eligibilityWindow.start.anchor,
  });
  if (!startAnchorDate) return null;

  const startDate = addDays(startAnchorDate, eligibilityWindow.start.offsetDays);
  if (!startDate) {
    limitations.push("invalid_protocol_rule");
    return null;
  }

  if (!eligibilityWindow.end) return { startDate };

  const endAnchorDate = resolveAnchorDate({
    ...input,
    anchor: eligibilityWindow.end.anchor,
  });
  if (!endAnchorDate) return null;

  const endDate = addDays(endAnchorDate, eligibilityWindow.end.offsetDays);
  if (!endDate) {
    limitations.push("invalid_protocol_rule");
    return null;
  }

  const windowDays = daysBetween(startDate, endDate);
  if (windowDays !== null && windowDays < 0) {
    limitations.push("invalid_protocol_rule");
    return null;
  }

  return { startDate, endDate };
}

type ApplicabilityResult = "applicable" | "not_applicable" | "insufficient_data";

function evaluateApplicability(input: {
  animal: SanitaryEligibilityAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  limitations: SanitaryEligibilityLimitation[];
}): ApplicabilityResult {
  const { animal, protocolRule, limitations } = input;
  const applicability = protocolRule.applicability;
  if (!applicability) return "applicable";

  if (applicability.sex && !animal.sex) {
    limitations.push("missing_sex");
    return "insufficient_data";
  }
  if (!includesValue(applicability.sex, animal.sex)) return "not_applicable";

  if (applicability.species && !animal.species) {
    limitations.push("missing_species");
    return "insufficient_data";
  }
  if (!includesValue(applicability.species, animal.species)) return "not_applicable";

  if (applicability.categoryKeys && !includesValue(applicability.categoryKeys, animal.categoryKey)) {
    return animal.categoryKey ? "not_applicable" : "insufficient_data";
  }

  if (applicability.loteIds && !animal.loteId) {
    limitations.push("missing_lote");
    return "insufficient_data";
  }
  if (applicability.loteIds && !applicability.loteIds.includes(animal.loteId ?? "")) {
    return "not_applicable";
  }

  return "applicable";
}

export function computeSanitaryEligibility(
  input: ComputeSanitaryEligibilityInput,
): SanitaryEligibilityResult {
  const limitations: SanitaryEligibilityLimitation[] = [];
  const referenceDate = toDateKey(input.referenceDate);

  if (!referenceDate || !isValidDateKey(referenceDate)) {
    return {
      status: "insufficient_data",
      limitations: ["invalid_reference_date"],
      matchedEventIds: [],
    };
  }

  if (input.animal.birthDateEstimated) {
    limitations.push("estimated_age");
  }

  const applicabilityResult = evaluateApplicability({
    animal: input.animal,
    protocolRule: input.protocolRule,
    limitations,
  });
  if (applicabilityResult !== "applicable") {
    return {
      status: applicabilityResult,
      limitations: uniqueLimitations(limitations),
      matchedEventIds: [],
    };
  }

  const matchingEvents = findMatchingEvents(
    input.executedEvents,
    input.protocolRule,
    input.animal,
    referenceDate,
    limitations,
  );
  const requiredDoseCount = input.protocolRule.completionCriteria.requiredDoseCount ?? 1;
  if (requiredDoseCount <= 0) {
    return {
      status: "insufficient_data",
      limitations: uniqueLimitations([...limitations, "invalid_protocol_rule"]),
      matchedEventIds: matchingEvents.map((event) => event.id),
    };
  }
  if (requiredDoseCount > 1) {
    limitations.push("unsupported_required_dose_count");
  }
  if (matchingEvents.length >= requiredDoseCount) {
    if (requiredDoseCount > 1) {
      return {
        status: "overdue",
        limitations: uniqueLimitations(limitations),
        matchedEventIds: matchingEvents.map((event) => event.id),
      };
    }
    return {
      status: "completed",
      limitations: uniqueLimitations(limitations),
      matchedEventIds: matchingEvents.map((event) => event.id),
    };
  }

  if (matchingEvents.length > 0 && matchingEvents.length < requiredDoseCount) {
    limitations.push("insufficient_event_history");
  }

  const window = resolveWindow({
    animal: input.animal,
    protocolRule: input.protocolRule,
    executedEvents: input.executedEvents,
    referenceDate,
    limitations,
  });

  if (!window) {
    return {
      status: "insufficient_data",
      limitations: uniqueLimitations(limitations),
      matchedEventIds: matchingEvents.map((event) => event.id),
    };
  }

  const daysUntilStart = daysBetween(referenceDate, window.startDate);
  if (daysUntilStart === null) {
    return {
      status: "insufficient_data",
      limitations: uniqueLimitations([...limitations, "invalid_protocol_rule"]),
      matchedEventIds: matchingEvents.map((event) => event.id),
      window,
    };
  }

  if (daysUntilStart > 0) {
    const eligibleSoonDays =
      input.thresholds?.eligibleSoonDays ?? DEFAULT_ELIGIBLE_SOON_DAYS;
    return {
      status: daysUntilStart <= eligibleSoonDays ? "eligible_soon" : "not_yet_eligible",
      limitations: uniqueLimitations(limitations),
      matchedEventIds: matchingEvents.map((event) => event.id),
      window,
    };
  }

  if (!window.endDate) {
    return {
      status: "in_action_window",
      limitations: uniqueLimitations(limitations),
      matchedEventIds: matchingEvents.map((event) => event.id),
      window,
    };
  }

  const daysUntilEnd = daysBetween(referenceDate, window.endDate);
  if (daysUntilEnd === null) {
    return {
      status: "insufficient_data",
      limitations: uniqueLimitations([...limitations, "invalid_protocol_rule"]),
      matchedEventIds: matchingEvents.map((event) => event.id),
      window,
    };
  }

  if (daysUntilEnd < 0) {
    return {
      status: "overdue",
      limitations: uniqueLimitations(limitations),
      matchedEventIds: matchingEvents.map((event) => event.id),
      window,
    };
  }

  const nearDeadlineDays =
    input.thresholds?.nearDeadlineDays ?? DEFAULT_NEAR_DEADLINE_DAYS;
  return {
    status: daysUntilEnd <= nearDeadlineDays ? "near_deadline" : "in_action_window",
    limitations: uniqueLimitations(limitations),
    matchedEventIds: matchingEvents.map((event) => event.id),
    window,
  };
}
