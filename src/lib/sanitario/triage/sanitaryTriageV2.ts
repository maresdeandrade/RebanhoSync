import {
  buildSanitaryProtocolWindowV2,
  loadSanitaryProtocolWindowSourceV2,
  type SanitaryProtocolWindowRowV2,
  type SanitaryProtocolWindowSourceV2,
} from "../windows/sanitaryProtocolWindowsV2";
import type { SanitaryTemporalWindowV2 } from "../checks/sanitaryProtocolPrecheckV2";
import { isProtocolMonitoringEnabledV1, readProtocolAdoptionV1 } from "../adoption/protocolAdoptionV1";
import { projectSanitaryAssessmentV1, type AssessmentEvidenceV1 } from "./sanitaryAssessmentProjectionV1";
import { sanitaryCalendarMonthWindowV1 } from "../windows/sanitaryCalendarWindowV1";

export type SanitaryTriageDispositionV2 =
  | "opportunity_in_window"
  | "future_opportunity"
  | "scheduled"
  | "factual_completed"
  | "assessment_completed"
  | "treatment_indicated"
  | "restricted"
  | "insufficient_data"
  | "outside_period";

export type SanitaryTriageEvaluationV2 = {
  animalId: string;
  identification: string;
  animalHref: string;
  lotId: string | null;
  lotLabel: string;
  protocolId: string;
  protocolLabel: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  status: SanitaryProtocolWindowRowV2["status"];
  disposition: SanitaryTriageDispositionV2;
  temporalWindow?: SanitaryTemporalWindowV2;
  intersectsPeriod: boolean;
  intervalStart?: string;
  intervalEnd?: string;
  reason: string;
  assessmentEventId?: string;
  assessmentConflict?: boolean;
  assessmentEvidence?: AssessmentEvidenceV1[];
  warnings: string[];
  blockers: string[];
  documentaryPending: boolean;
  documentaryPendingReasons: string[];
  alreadyPlanned: boolean;
  plannedFor: string | null;
  planningAllowed: false;
  source: "SanitaryProtocolWindowRowV2";
};

export type SanitaryTriageResultV2 = {
  period: { startDate: string; endDate: string };
  evaluatedAt: string;
  evaluations: SanitaryTriageEvaluationV2[];
  summary: Record<SanitaryTriageDispositionV2, number>;
  source: {
    type: "SanitaryProtocolWindowSourceV2";
    createsAgenda: false;
    createsEvent: false;
    createsStockMovement: false;
  };
};

export function resolveSanitaryTriagePlanningRowsV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  evaluatedAt: string;
  evaluations: SanitaryTriageEvaluationV2[];
}): SanitaryProtocolWindowRowV2[] {
  const rowsByProtocolItem = new Map<string, SanitaryProtocolWindowRowV2[]>();

  for (const evaluation of input.evaluations) {
    const key = `${evaluation.protocolId}:${evaluation.itemId}`;
    if (!rowsByProtocolItem.has(key)) {
      rowsByProtocolItem.set(
        key,
        buildSanitaryProtocolWindowV2({
          source: input.source,
          protocolId: evaluation.protocolId,
          itemId: evaluation.itemId,
          evaluatedAt: input.evaluatedAt,
        })?.rows ?? [],
      );
    }
  }

  return input.evaluations.flatMap((evaluation) => {
    const row = rowsByProtocolItem
      .get(`${evaluation.protocolId}:${evaluation.itemId}`)
      ?.find((candidate) => candidate.animalId === evaluation.animalId);
    return row ? [row] : [];
  });
}

function dateKey(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function intervalIntersects(
  interval: { startDate?: string; endDate?: string },
  period: { startDate: string; endDate: string },
): boolean {
  const start = interval.startDate ?? "0000-01-01";
  const end = interval.endDate ?? "9999-12-31";
  return start <= period.endDate && end >= period.startDate;
}

function intervalStartsAfterPeriod(
  interval: { startDate?: string; endDate?: string },
  period: { startDate: string; endDate: string },
): boolean {
  return Boolean(interval.startDate && interval.startDate > period.endDate);
}

function scheduledDateInPeriod(
  plannedFor: string | null,
  period: { startDate: string; endDate: string },
): boolean {
  const scheduledDate = plannedFor?.slice(0, 10);
  return Boolean(
    scheduledDate &&
      scheduledDate >= period.startDate &&
      scheduledDate <= period.endDate,
  );
}

function dispositionForRow(
  row: SanitaryProtocolWindowRowV2,
  period: { startDate: string; endDate: string },
  intersectsPeriod: boolean,
  startsAfterPeriod: boolean,
): SanitaryTriageDispositionV2 {
  if (row.status === "completed") return "factual_completed";
  if (row.alreadyPlanned && scheduledDateInPeriod(row.plannedFor, period)) return "scheduled";
  if (
    row.documentaryPending ||
    row.status === "insufficient_data" ||
    row.temporalWindow?.resolution === "insufficient"
  ) {
    return "insufficient_data";
  }
  if (intersectsPeriod) {
    // A future age window can overlap the requested period even when the
    // animal is not yet eligible at the period's first day.
    if (row.blockers.length || (!row.canSelect && row.status !== "not_yet_eligible"))
      return "restricted";
    return "opportunity_in_window";
  }
  if (startsAfterPeriod && !row.blockers.length) return "future_opportunity";
  if (row.blockers.length || !row.canSelect) return "restricted";
  return "outside_period";
}

function evaluateRow(
  row: SanitaryProtocolWindowRowV2,
  period: { startDate: string; endDate: string },
): SanitaryTriageEvaluationV2 {
  const intervals = row.temporalWindow?.intervals ?? [];
  const intersectsPeriod = intervals.some((interval) =>
    intervalIntersects(interval, period),
  );
  const startsAfterPeriod = intervals.some((interval) =>
    intervalStartsAfterPeriod(interval, period),
  );
  const relevantInterval = intervals.find((interval) =>
    intervalIntersects(interval, period),
  ) ?? intervals[0];
  return {
    animalId: row.animalId,
    identification: row.identification,
    animalHref: row.animalHref,
    lotId: row.lotId,
    lotLabel: row.lotLabel,
    protocolId: row.protocolId,
    protocolLabel: row.protocolLabel,
    itemId: row.itemId,
    itemKey: row.itemKey,
    itemLabel: row.itemLabel,
    status: row.status,
    disposition: dispositionForRow(
      row,
      period,
      intersectsPeriod,
      startsAfterPeriod,
    ),
    temporalWindow: row.temporalWindow,
    intersectsPeriod,
    intervalStart: relevantInterval?.startDate,
    intervalEnd: relevantInterval?.endDate,
    reason: row.reason,
    warnings: row.warnings,
    blockers: row.blockers,
    documentaryPending: row.documentaryPending,
    documentaryPendingReasons: row.documentaryPendingReasons,
    alreadyPlanned: row.alreadyPlanned,
    plannedFor: row.plannedFor,
    planningAllowed: false,
    source: "SanitaryProtocolWindowRowV2",
  };
}

export function triageSanitaryProtocolIntervalV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  startDate: string;
  endDate: string;
}): SanitaryTriageResultV2 {
  const startDate = dateKey(input.startDate);
  const endDate = dateKey(input.endDate);
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("Período sanitário inválido.");
  }
  const period = { startDate, endDate };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const farmId = input.source.fazendaId;
  const adoption = farmId ? readProtocolAdoptionV1(input.source.farmConfig, farmId) : null;
  const evaluations = input.source.catalog.items.flatMap((item) => {
    const protocol = input.source.catalog.protocols.find(entry => entry.id === item.protocolId);
    if (adoption && protocol && !isProtocolMonitoringEnabledV1(input.source.farmConfig, farmId!, protocol.familyCode)) return [];
    const window = buildSanitaryProtocolWindowV2({
      source: input.source,
      protocolId: item.protocolId,
      itemId: item.id,
      evaluatedAt: startDate,
    });
    return window?.rows.map((row) => {
      const evaluation = evaluateRow(row, period);
      const metadata = item.snapshotTemplate.metadata as Record<string, unknown> | undefined;
      if (!farmId || item.actionType !== "manejo_sanitario" || metadata?.planning_scope !== "assessment_only") return evaluation;
      const cycleKey = (evaluation.intervalStart ?? evaluation.intervalEnd ?? startDate).slice(0, 4);
      const lastYear = (evaluation.intervalEnd ?? endDate).slice(0, 4);
      const cycleKeys = new Set([cycleKey]);
      for (const event of input.source.contextEvents ?? []) {
        const value = event.payload?.assessment;
        const candidate = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).cycle_key : null;
        if (typeof candidate === "string" && /^\d{4}$/.test(candidate) && candidate >= cycleKey && candidate <= lastYear) cycleKeys.add(candidate);
      }
      const curatedMonth = protocol?.familyCode === "controle_parasitario_recria_5_7_9"
        ? ({ recria_maio: 5, recria_julho: 7, recria_setembro: 9 } as Record<string, number>)[item.logicalItemKey] ?? null : null;
      const calendarWindows = !row.temporalWindow && curatedMonth !== null
        ? [...cycleKeys].map(year => sanitaryCalendarMonthWindowV1(item.operationalWindowRule, Number(year), curatedMonth)).filter((window): window is NonNullable<typeof window> => window !== null) : [];
      const selectedCalendarWindows = calendarWindows.filter(window => window.startDate <= endDate && window.endDate >= startDate);
      if (calendarWindows.length && !selectedCalendarWindows.length) return evaluation;
      const windows = row.temporalWindow?.resolution === "determined" ? row.temporalWindow.intervals : selectedCalendarWindows;
      const assessment = projectSanitaryAssessmentV1({ events: input.source.contextEvents ?? [], relations: input.source.assessmentEventAnimals ?? [], farmId, animalId: row.animalId, protocolId: item.protocolId, itemId: item.id, itemVersion: item.version, cycleKey, cycleKeys: [...cycleKeys], asOf: endDate < today ? endDate : today, windows: windows.length ? windows : undefined });
      if (!assessment || evaluation.disposition === "factual_completed") return evaluation;
      if (!windows.length) return { ...evaluation, assessmentConflict: false, assessmentEvidence: assessment.evidence, assessmentEventId: assessment.state === "conflict" ? undefined : assessment.eventId, disposition: "insufficient_data" as const, reason: "Avaliação encontrada, mas a janela técnica não pôde ser determinada." };
      if (assessment.state === "no_treatment_indicated") return { ...evaluation, assessmentEventId: assessment.eventId, assessmentEvidence: assessment.evidence, disposition: "assessment_completed" as const, reason: "Avaliação concluída: tratamento não indicado." };
      if (assessment.state === "treatment_indicated") return { ...evaluation, assessmentEventId: assessment.eventId, assessmentEvidence: assessment.evidence, disposition: evaluation.disposition === "opportunity_in_window" ? "treatment_indicated" as const : evaluation.disposition, reason: `Avaliação concluída: tratamento indicado, aplicação não comprovada. ${evaluation.reason}` };
      return { ...evaluation, assessmentConflict: assessment.state === "conflict", assessmentEvidence: assessment.evidence, assessmentEventId: assessment.state === "conflict" ? undefined : assessment.eventId, disposition: "insufficient_data" as const, reason: assessment.state === "conflict" ? "Avaliações concorrentes ou incompletas exigem revisão." : "Avaliação inconclusiva por dados insuficientes." };
    }) ?? [];
  });
  const summary = evaluations.reduce<SanitaryTriageResultV2["summary"]>(
    (current, evaluation) => {
      current[evaluation.disposition] += 1;
      return current;
    },
    {
      opportunity_in_window: 0,
      future_opportunity: 0,
      scheduled: 0,
      factual_completed: 0,
      assessment_completed: 0,
      treatment_indicated: 0,
      restricted: 0,
      insufficient_data: 0,
      outside_period: 0,
    },
  );
  return {
    period,
    evaluatedAt: startDate,
    evaluations,
    summary,
    source: {
      type: "SanitaryProtocolWindowSourceV2",
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
    },
  };
}

export async function loadSanitaryTriageV2(input: {
  fazendaId: string;
  startDate: string;
  endDate: string;
}): Promise<SanitaryTriageResultV2> {
  const source = await loadSanitaryProtocolWindowSourceV2(input.fazendaId);
  return triageSanitaryProtocolIntervalV2({
    source,
    startDate: input.startDate,
    endDate: input.endDate,
  });
}
