import type { Evento, EventoMovimentacao } from "@/lib/offline/types";

export interface TimestampedEvidence {
  eventId: string;
  timestamp: number;
}

export interface SourcedInterval {
  sourceEventIds: string[];
}

interface ClosableSourcedInterval extends SourcedInterval {
  leftAt: string | null;
  endBoundary: string;
}

export interface BoundaryInterval {
  startBoundary: "KNOWN" | "LEFT_BOUND_UNKNOWN";
  endBoundary: "KNOWN" | "OPEN" | "RIGHT_BOUND_UNKNOWN";
}

export type HistoricalCoverage =
  | "NO_HISTORY"
  | "PARTIAL_HISTORY"
  | "CONTIGUOUS_HISTORY"
  | "CONFLICTED_HISTORY";

export interface EvidenceCoverageCounts {
  history: HistoricalCoverage;
  leftBoundary:
    | "KNOWN_LEFT_BOUND"
    | "LEFT_BOUND_UNKNOWN"
    | "NOT_AVAILABLE";
  rightBoundary:
    | "KNOWN_RIGHT_BOUND"
    | "OPEN_RIGHT_BOUND"
    | "RIGHT_BOUND_UNKNOWN"
    | "NOT_AVAILABLE";
  inputEventCount: number;
  scopedEventCount: number;
  usableMovementCount: number;
  appliedMovementCount: number;
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
}

export interface EvidenceCoverageInput {
  intervals: readonly BoundaryInterval[];
  hasConflicts: boolean;
  hasCoverageLimitation: boolean;
  inputEventCount: number;
  scopedEventCount: number;
  usableMovementCount: number;
  appliedMovementCount: number;
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
}

export interface CoverageEvidence {
  limitations: readonly { affectsCoverage: boolean }[];
  conflicts: readonly unknown[];
  movements: readonly unknown[];
  scopedEventCount: number;
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
}

export interface FactualEvidenceIndex {
  eventGroups: Map<string, Evento[]>;
  detailGroups: Map<string, EventoMovimentacao[]>;
  scopedEventCount: number;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function stableSignature(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function groupByKey<T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const group = grouped.get(groupKey) ?? [];
    group.push(item);
    grouped.set(groupKey, group);
  }
  return grouped;
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function sortTimestamped<T extends TimestampedEvidence>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      left.timestamp - right.timestamp ||
      left.eventId.localeCompare(right.eventId),
  );
}

export function cloneSourced<T extends SourcedInterval>(value: T): T {
  return { ...value, sourceEventIds: [...value.sourceEventIds] };
}

export function buildFactualEvidenceIndex(
  events: readonly Evento[],
  details: readonly EventoMovimentacao[],
  fazendaId: string,
  includesEvent: (event: Evento) => boolean,
): FactualEvidenceIndex {
  const scopedEvents = events.filter(
    (event) => event.fazenda_id === fazendaId && includesEvent(event),
  );
  return {
    eventGroups: groupByKey(scopedEvents, (event) => event.id),
    detailGroups: groupByKey(
      details.filter((detail) => detail.fazenda_id === fazendaId),
      (detail) => detail.evento_id,
    ),
    scopedEventCount: scopedEvents.length,
  };
}

export function closeSourcedInterval<T extends ClosableSourcedInterval>(
  current: T,
  occurredAt: string,
  eventId: string,
): T {
  current.leftAt = occurredAt;
  current.endBoundary = "KNOWN";
  current.sourceEventIds.push(eventId);
  return cloneSourced(current);
}

export function finalizeSourcedInterval<T extends ClosableSourcedInterval>(
  current: T,
  truncated: boolean,
): T {
  current.endBoundary = truncated ? "RIGHT_BOUND_UNKNOWN" : "OPEN";
  return cloneSourced(current);
}

export function appendFinalSourcedInterval<T extends ClosableSourcedInterval>(
  intervals: T[],
  current: T | null,
  truncated: boolean,
  hasBlockingEvidence: boolean,
): void {
  if (!current) return;
  intervals.push(
    finalizeSourcedInterval(current, truncated || hasBlockingEvidence),
  );
}

export function resolveHistoricalCoverage(
  intervals: readonly BoundaryInterval[],
  hasConflicts: boolean,
  hasCoverageLimitation: boolean,
): HistoricalCoverage {
  if (hasConflicts) return "CONFLICTED_HISTORY";
  if (intervals.length === 0) return "NO_HISTORY";
  const hasUnknownBoundary = intervals.some(
    (interval) =>
      interval.startBoundary === "LEFT_BOUND_UNKNOWN" ||
      interval.endBoundary === "RIGHT_BOUND_UNKNOWN",
  );
  return hasUnknownBoundary || hasCoverageLimitation
    ? "PARTIAL_HISTORY"
    : "CONTIGUOUS_HISTORY";
}

export function resolveLeftCoverage(
  intervals: readonly BoundaryInterval[],
): "KNOWN_LEFT_BOUND" | "LEFT_BOUND_UNKNOWN" | "NOT_AVAILABLE" {
  if (intervals.length === 0) return "NOT_AVAILABLE";
  return intervals.some(
    (interval) => interval.startBoundary === "LEFT_BOUND_UNKNOWN",
  )
    ? "LEFT_BOUND_UNKNOWN"
    : "KNOWN_LEFT_BOUND";
}

export function resolveRightCoverage(
  intervals: readonly BoundaryInterval[],
):
  | "KNOWN_RIGHT_BOUND"
  | "OPEN_RIGHT_BOUND"
  | "RIGHT_BOUND_UNKNOWN"
  | "NOT_AVAILABLE" {
  const last = intervals[intervals.length - 1];
  if (!last) return "NOT_AVAILABLE";
  if (last.endBoundary === "OPEN") return "OPEN_RIGHT_BOUND";
  return last.endBoundary === "RIGHT_BOUND_UNKNOWN"
    ? "RIGHT_BOUND_UNKNOWN"
    : "KNOWN_RIGHT_BOUND";
}

export function buildEvidenceCoverage(
  input: EvidenceCoverageInput,
): EvidenceCoverageCounts {
  return {
    history: resolveHistoricalCoverage(
      input.intervals,
      input.hasConflicts,
      input.hasCoverageLimitation,
    ),
    leftBoundary: resolveLeftCoverage(input.intervals),
    rightBoundary: resolveRightCoverage(input.intervals),
    inputEventCount: input.inputEventCount,
    scopedEventCount: input.scopedEventCount,
    usableMovementCount: input.usableMovementCount,
    appliedMovementCount: input.appliedMovementCount,
    deduplicatedEventCount: input.deduplicatedEventCount,
    deduplicatedDetailCount: input.deduplicatedDetailCount,
  };
}

export function coverageFromEvidence(
  inputEventCount: number,
  evidence: CoverageEvidence,
  intervals: readonly BoundaryInterval[],
  appliedMovementCount: number,
): EvidenceCoverageCounts {
  return buildEvidenceCoverage({
    intervals,
    hasConflicts: evidence.conflicts.length > 0,
    hasCoverageLimitation: evidence.limitations.some(
      (limitation) => limitation.affectsCoverage,
    ),
    inputEventCount,
    scopedEventCount: evidence.scopedEventCount,
    usableMovementCount: evidence.movements.length,
    appliedMovementCount,
    deduplicatedEventCount: evidence.deduplicatedEventCount,
    deduplicatedDetailCount: evidence.deduplicatedDetailCount,
  });
}

export function statusFromHistory(
  history: HistoricalCoverage,
): "READY" | "PARTIAL" | "NO_HISTORY" | "CONFLICT" {
  if (history === "CONFLICTED_HISTORY") return "CONFLICT";
  if (history === "NO_HISTORY") return "NO_HISTORY";
  if (history === "PARTIAL_HISTORY") return "PARTIAL";
  return "READY";
}
