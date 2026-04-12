import type {
  SanitaryBaseCalendarAnchor,
  SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";

function parseIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function addDays(value: string | null | undefined, days: number) {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;

  parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(days));
  return formatIsoDate(parsed);
}

function compareIsoDates(left: string | null | undefined, right: string | null | undefined) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function startOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1));
}

function readPositiveInteger(record: Record<string, unknown> | null | undefined, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current === "number" && Number.isFinite(current) && current > 0) {
    return Math.trunc(current);
  }

  if (typeof current === "string" && current.trim().length > 0) {
    const numeric = Number(current);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
  }

  return null;
}

export function resolveSanitaryAnchorDate(input: {
  anchor: SanitaryBaseCalendarAnchor | null | undefined;
  birthDate?: string | null;
  animalPayload?: Record<string, unknown> | null;
  farmMetadata?: Record<string, unknown> | null;
}) {
  const { anchor, birthDate, animalPayload, farmMetadata } = input;

  if (anchor === "birth") return birthDate ?? null;

  if (anchor === "weaning") {
    const completedAt =
      animalPayload?.weaning &&
      typeof animalPayload.weaning === "object" &&
      !Array.isArray(animalPayload.weaning) &&
      typeof (animalPayload.weaning as Record<string, unknown>).completed_at === "string"
        ? ((animalPayload.weaning as Record<string, unknown>).completed_at as string)
        : null;

    if (parseIsoDate(completedAt)) return completedAt;

    const fallbackDays = readPositiveInteger(farmMetadata, ["animal_lifecycle", "weaning_days"]) ?? 210;
    return addDays(birthDate, fallbackDays);
  }

  if (anchor === "dry_off") {
    const facts =
      animalPayload?.taxonomy_facts &&
      typeof animalPayload.taxonomy_facts === "object" &&
      !Array.isArray(animalPayload.taxonomy_facts)
        ? (animalPayload.taxonomy_facts as Record<string, unknown>)
        : null;

    const dryOff = typeof facts?.data_secagem === "string" ? facts.data_secagem : null;
    return parseIsoDate(dryOff) ? dryOff : null;
  }

  return null;
}

export function resolveSanitaryCampaignDueDate(input: {
  months?: number[] | null;
  asOf: string;
  notBefore?: string | null;
  lastCompletion?: string | null;
}) {
  const asOfDate = parseIsoDate(input.asOf);
  if (!asOfDate) return null;

  const months = Array.from(
    new Set(
      (input.months ?? [])
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.trunc(entry))
        .filter((entry) => entry >= 1 && entry <= 12),
    ),
  ).sort((left, right) => left - right);

  if (months.length === 0) return null;

  const notBefore = parseIsoDate(input.notBefore ?? null);
  const lastCompletion = parseIsoDate(input.lastCompletion ?? null);

  const firstYear = Math.min(
    asOfDate.getUTCFullYear(),
    (notBefore ?? asOfDate).getUTCFullYear(),
    (lastCompletion ?? asOfDate).getUTCFullYear(),
  );
  const lastYear = Math.max(
    asOfDate.getUTCFullYear(),
    (notBefore ?? asOfDate).getUTCFullYear(),
    (lastCompletion ?? asOfDate).getUTCFullYear(),
  ) + 2;

  const candidates = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const month of months) {
      const candidate = startOfMonth(year, month);
      if (notBefore && candidate < notBefore) continue;
      if (lastCompletion && candidate <= lastCompletion) continue;
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) return null;

  if (lastCompletion) {
    return formatIsoDate(candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null);
  }

  const latestDue = candidates
    .filter((candidate) => candidate <= asOfDate)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  if (latestDue) return formatIsoDate(latestDue);

  const nextDue = candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  return formatIsoDate(nextDue);
}

export function isSanitaryWindowEligible(input: {
  asOf: string;
  eligibilityEndDate?: string | null;
  keepAfterWindow?: boolean;
}) {
  if (input.keepAfterWindow) return true;
  if (!input.eligibilityEndDate) return true;
  return compareIsoDates(input.asOf, input.eligibilityEndDate) <= 0;
}

export function resolveDeclarativeSanitaryDueDate(input: {
  mode: SanitaryBaseCalendarMode | null | undefined;
  anchor: SanitaryBaseCalendarAnchor | null | undefined;
  asOf: string;
  months?: number[] | null;
  intervalDays?: number | null;
  eligibilityStartDate?: string | null;
  anchorDate?: string | null;
  lastCompletion?: string | null;
}) {
  const {
    mode,
    anchor,
    asOf,
    months,
    intervalDays,
    eligibilityStartDate,
    anchorDate,
    lastCompletion,
  } = input;

  const anchorTriggerDue = (() => {
    if (!anchorDate) return null;
    if (!lastCompletion) return anchorDate;
    if ((anchor === "weaning" || anchor === "dry_off") && anchorDate > lastCompletion) {
      return anchorDate;
    }
    return null;
  })();

  if (mode === "campaign") {
    const campaignDue = resolveSanitaryCampaignDueDate({
      months,
      asOf,
      notBefore: eligibilityStartDate,
      lastCompletion,
    });
    if (campaignDue) return campaignDue;
    if (lastCompletion && intervalDays && intervalDays > 0) {
      return addDays(lastCompletion, intervalDays);
    }
    return anchorTriggerDue ?? eligibilityStartDate ?? anchorDate ?? asOf;
  }

  if (mode === "rolling_interval") {
    if (lastCompletion && intervalDays && intervalDays > 0) {
      const byInterval = addDays(lastCompletion, intervalDays);
      return compareIsoDates(byInterval, anchorTriggerDue) >= 0
        ? byInterval
        : anchorTriggerDue;
    }
    return anchorTriggerDue ?? eligibilityStartDate ?? anchorDate ?? asOf;
  }

  if (mode === "age_window") {
    if (anchor === "weaning" || anchor === "dry_off") {
      return anchorTriggerDue ?? (!lastCompletion ? anchorDate ?? null : null);
    }
    if (lastCompletion) return null;
    return eligibilityStartDate ?? anchorTriggerDue ?? anchorDate ?? null;
  }

  if (mode === "immediate") {
    if (anchor === "clinical_need") return null;
    return anchorTriggerDue ?? (!lastCompletion ? anchorDate ?? eligibilityStartDate ?? null : null);
  }

  if (mode === "clinical_protocol") {
    if (anchor === "clinical_need") return null;
    return anchorTriggerDue ?? (!lastCompletion ? anchorDate ?? null : null);
  }

  return null;
}
