import type { Evento, EventoMovimentacao } from "@/lib/offline/types";

export type HistoricalLotOccupancyStatus =
  | "READY"
  | "PARTIAL"
  | "NO_HISTORY"
  | "CONFLICT";

export type HistoricalLotOccupancyStartBoundary =
  | "KNOWN"
  | "LEFT_BOUND_UNKNOWN";

export type HistoricalLotOccupancyEndBoundary =
  | "KNOWN"
  | "OPEN"
  | "RIGHT_BOUND_UNKNOWN";

export interface HistoricalLotOccupancyInterval {
  animalId: string;
  fazendaId: string;
  loteId: string;
  enteredAt: string | null;
  leftAt: string | null;
  startBoundary: HistoricalLotOccupancyStartBoundary;
  endBoundary: HistoricalLotOccupancyEndBoundary;
  sourceEventIds: string[];
}

export type HistoricalLotOccupancyLimitationCode =
  | "INVALID_EVENT_DATE_IGNORED"
  | "FUTURE_EVENT_IGNORED"
  | "MISSING_MOVEMENT_DETAIL"
  | "TOMBSTONED_EVENT_IGNORED"
  | "TOMBSTONED_DETAIL_IGNORED"
  | "NO_LOT_CHANGE_IGNORED"
  | "NON_CANONICAL_NULL_DESTINATION";

export interface HistoricalLotOccupancyLimitation {
  code: HistoricalLotOccupancyLimitationCode;
  eventIds: string[];
  affectsCoverage: boolean;
}

export type HistoricalLotOccupancyConflictCode =
  | "INVALID_REFERENCE_DATE"
  | "EVENT_IDENTITY_CONFLICT"
  | "DETAIL_IDENTITY_CONFLICT"
  | "SAME_TIMESTAMP_CONFLICT"
  | "BROKEN_CHAIN"
  | "UNSUPPORTED_CORRECTION";

export interface HistoricalLotOccupancyConflict {
  code: HistoricalLotOccupancyConflictCode;
  occurredAt: string | null;
  eventIds: string[];
  description: string;
}

export type HistoricalLotOccupancyHistoryCoverage =
  | "NO_HISTORY"
  | "PARTIAL_HISTORY"
  | "CONTIGUOUS_HISTORY"
  | "CONFLICTED_HISTORY";

export interface HistoricalLotOccupancyCoverage {
  history: HistoricalLotOccupancyHistoryCoverage;
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

export interface HistoricalLotOccupancyResult {
  status: HistoricalLotOccupancyStatus;
  animalId: string;
  fazendaId: string;
  referenceDate: string;
  intervals: HistoricalLotOccupancyInterval[];
  coverage: HistoricalLotOccupancyCoverage;
  limitations: HistoricalLotOccupancyLimitation[];
  conflicts: HistoricalLotOccupancyConflict[];
}

export interface SelectHistoricalLotOccupancyInput {
  animalId: string;
  fazendaId: string;
  referenceDate: string;
  events: readonly Evento[];
  movementDetails: readonly EventoMovimentacao[];
}

interface MovementEvidence {
  eventId: string;
  occurredAt: string;
  timestamp: number;
  fromLoteId: string | null;
  toLoteId: string | null;
}

interface MutableInterval extends HistoricalLotOccupancyInterval {
  sourceEventIds: string[];
}

interface EvidenceCollection {
  movements: MovementEvidence[];
  limitations: HistoricalLotOccupancyLimitation[];
  conflicts: HistoricalLotOccupancyConflict[];
  scopedEventCount: number;
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
  blockingTimestamp: number | null;
  hasUnpositionedGap: boolean;
  hasUnpositionedConflict: boolean;
}

interface EvidenceAccumulator {
  movements: MovementEvidence[];
  limitations: HistoricalLotOccupancyLimitation[];
  conflicts: HistoricalLotOccupancyConflict[];
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
  blockingTimestamp: number | null;
  hasUnpositionedGap: boolean;
  hasUnpositionedConflict: boolean;
}

interface ReconstructionState {
  intervals: HistoricalLotOccupancyInterval[];
  current: MutableInterval | null;
  expectedLoteId: string | null | undefined;
  appliedMovementCount: number;
  truncated: boolean;
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

function signature(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function semanticEventSignature(event: Evento): string {
  const timestamp = Date.parse(event.occurred_at);
  return signature({
    id: event.id,
    fazendaId: event.fazenda_id,
    dominio: event.dominio,
    occurredAt: Number.isFinite(timestamp) ? timestamp : event.occurred_at,
    animalId: event.animal_id,
    corrigeEventoId: event.corrige_evento_id,
    payload: event.payload,
    deletedAt: event.deleted_at,
  });
}

function semanticDetailSignature(detail: EventoMovimentacao): string {
  return signature({
    eventoId: detail.evento_id,
    fazendaId: detail.fazenda_id,
    fromLoteId: detail.from_lote_id,
    toLoteId: detail.to_lote_id,
    fromPastoId: detail.from_pasto_id,
    toPastoId: detail.to_pasto_id,
    payload: detail.payload,
    deletedAt: detail.deleted_at,
  });
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const group = grouped.get(id) ?? [];
    group.push(item);
    grouped.set(id, group);
  }
  return grouped;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function addLimitation(
  limitations: HistoricalLotOccupancyLimitation[],
  code: HistoricalLotOccupancyLimitationCode,
  eventIds: readonly string[],
  affectsCoverage: boolean,
): void {
  limitations.push({
    code,
    eventIds: uniqueSorted(eventIds),
    affectsCoverage,
  });
}

function addConflict(
  conflicts: HistoricalLotOccupancyConflict[],
  code: HistoricalLotOccupancyConflictCode,
  occurredAt: string | null,
  eventIds: readonly string[],
  description: string,
): void {
  conflicts.push({
    code,
    occurredAt,
    eventIds: uniqueSorted(eventIds),
    description,
  });
}

function earliestTimestamp(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function eventConflictTimestamp(events: readonly Evento[]): number | null {
  const timestamps = uniqueSorted(events.map((event) => event.occurred_at))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return timestamps.length === 1 ? timestamps[0] : null;
}

function markBlockingTimestamp(
  state: EvidenceAccumulator,
  timestamp: number,
): void {
  state.blockingTimestamp = earliestTimestamp(
    state.blockingTimestamp,
    timestamp,
  );
}

function selectUniqueEvent(
  copies: readonly Evento[],
  state: EvidenceAccumulator,
): Evento | null {
  const eventVariants = new Set(copies.map(semanticEventSignature));
  if (eventVariants.size === 1) {
    state.deduplicatedEventCount += copies.length - 1;
    return copies[0];
  }
  const conflictTimestamp = eventConflictTimestamp(copies);
  addConflict(
    state.conflicts,
    "EVENT_IDENTITY_CONFLICT",
    conflictTimestamp === null ? null : copies[0].occurred_at,
    [copies[0].id],
    "Copias divergentes compartilham a mesma identidade de Evento.",
  );
  if (conflictTimestamp === null) state.hasUnpositionedConflict = true;
  else markBlockingTimestamp(state, conflictTimestamp);
  return null;
}

function validateEventForReference(
  event: Evento,
  referenceTimestamp: number,
  state: EvidenceAccumulator,
): number | null {
  const timestamp = Date.parse(event.occurred_at);
  if (!Number.isFinite(timestamp)) {
    addLimitation(
      state.limitations,
      "INVALID_EVENT_DATE_IGNORED",
      [event.id],
      true,
    );
    state.hasUnpositionedGap = true;
    return null;
  }
  if (timestamp > referenceTimestamp) {
    addLimitation(
      state.limitations,
      "FUTURE_EVENT_IGNORED",
      [event.id],
      false,
    );
    return null;
  }
  if (event.deleted_at) {
    addLimitation(
      state.limitations,
      "TOMBSTONED_EVENT_IGNORED",
      [event.id],
      true,
    );
    markBlockingTimestamp(state, timestamp);
    return null;
  }
  if (event.corrige_evento_id) {
    addConflict(
      state.conflicts,
      "UNSUPPORTED_CORRECTION",
      event.occurred_at,
      [event.id, event.corrige_evento_id],
      "Movimentacao em cadeia de correcao nao possui resolvedor canonico.",
    );
    markBlockingTimestamp(state, timestamp);
    return null;
  }
  return timestamp;
}

function selectUniqueDetail(
  event: Evento,
  timestamp: number,
  detailCopies: readonly EventoMovimentacao[],
  state: EvidenceAccumulator,
): EventoMovimentacao | null {
  if (detailCopies.length === 0) {
    addLimitation(
      state.limitations,
      "MISSING_MOVEMENT_DETAIL",
      [event.id],
      true,
    );
    markBlockingTimestamp(state, timestamp);
    return null;
  }
  const detailVariants = new Set(detailCopies.map(semanticDetailSignature));
  if (detailVariants.size > 1) {
    addConflict(
      state.conflicts,
      "DETAIL_IDENTITY_CONFLICT",
      event.occurred_at,
      [event.id],
      "Details divergentes compartilham a identidade do mesmo Evento.",
    );
    markBlockingTimestamp(state, timestamp);
    return null;
  }
  state.deduplicatedDetailCount += detailCopies.length - 1;
  const detail = detailCopies[0];
  if (!detail.deleted_at) return detail;
  addLimitation(
    state.limitations,
    "TOMBSTONED_DETAIL_IGNORED",
    [event.id],
    true,
  );
  markBlockingTimestamp(state, timestamp);
  return null;
}

function addMovementEvidence(
  event: Evento,
  detail: EventoMovimentacao,
  timestamp: number,
  state: EvidenceAccumulator,
): void {
  if (detail.from_lote_id === detail.to_lote_id) {
    addLimitation(
      state.limitations,
      "NO_LOT_CHANGE_IGNORED",
      [event.id],
      false,
    );
    return;
  }
  if (detail.to_lote_id === null) {
    addLimitation(
      state.limitations,
      "NON_CANONICAL_NULL_DESTINATION",
      [event.id],
      true,
    );
  }
  state.movements.push({
    eventId: event.id,
    occurredAt: event.occurred_at,
    timestamp,
    fromLoteId: detail.from_lote_id,
    toLoteId: detail.to_lote_id,
  });
}

function collectEvidence(
  input: SelectHistoricalLotOccupancyInput,
  referenceTimestamp: number,
): EvidenceCollection {
  const scopedEvents = input.events.filter(
    (event) =>
      event.fazenda_id === input.fazendaId &&
      event.animal_id === input.animalId &&
      event.dominio === "movimentacao",
  );
  const eventGroups = groupBy(scopedEvents, (event) => event.id);
  const detailGroups = groupBy(
    input.movementDetails.filter(
      (detail) => detail.fazenda_id === input.fazendaId,
    ),
    (detail) => detail.evento_id,
  );
  const state: EvidenceAccumulator = {
    movements: [],
    limitations: [],
    conflicts: [],
    deduplicatedEventCount: 0,
    deduplicatedDetailCount: 0,
    blockingTimestamp: null,
    hasUnpositionedGap: false,
    hasUnpositionedConflict: false,
  };

  for (const eventId of [...eventGroups.keys()].sort((a, b) => a.localeCompare(b))) {
    const copies = eventGroups.get(eventId)!;
    const event = selectUniqueEvent(copies, state);
    if (!event) continue;
    const timestamp = validateEventForReference(
      event,
      referenceTimestamp,
      state,
    );
    if (timestamp === null) continue;
    const detail = selectUniqueDetail(
      event,
      timestamp,
      detailGroups.get(event.id) ?? [],
      state,
    );
    if (!detail) continue;
    addMovementEvidence(event, detail, timestamp, state);
  }

  return {
    ...state,
    movements: [...state.movements].sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        left.eventId.localeCompare(right.eventId),
    ),
    scopedEventCount: scopedEvents.length,
  };
}

function cloneInterval(interval: MutableInterval): HistoricalLotOccupancyInterval {
  return { ...interval, sourceEventIds: [...interval.sourceEventIds] };
}

function movementsByTimestamp(
  movements: readonly MovementEvidence[],
): Map<number, MovementEvidence[]> {
  const grouped = new Map<number, MovementEvidence[]>();
  for (const movement of movements) {
    const group = grouped.get(movement.timestamp) ?? [];
    group.push(movement);
    grouped.set(movement.timestamp, group);
  }
  return grouped;
}

function recordSameTimestampConflict(
  group: readonly MovementEvidence[],
  conflicts: HistoricalLotOccupancyConflict[],
): void {
  addConflict(
    conflicts,
    "SAME_TIMESTAMP_CONFLICT",
    group[0].occurredAt,
    group.map((movement) => movement.eventId),
    "Movimentos distintos no mesmo instante nao possuem ordem factual.",
  );
}

function closeCurrentInterval(
  movement: MovementEvidence,
  state: ReconstructionState,
): void {
  if (!state.current) return;
  state.current.leftAt = movement.occurredAt;
  state.current.endBoundary = "KNOWN";
  state.current.sourceEventIds.push(movement.eventId);
  state.intervals.push(cloneInterval(state.current));
  state.current = null;
}

function openDestinationInterval(
  input: SelectHistoricalLotOccupancyInput,
  movement: MovementEvidence,
  state: ReconstructionState,
): void {
  if (movement.toLoteId === null) return;
  state.current = {
    animalId: input.animalId,
    fazendaId: input.fazendaId,
    loteId: movement.toLoteId,
    enteredAt: movement.occurredAt,
    leftAt: null,
    startBoundary: "KNOWN",
    endBoundary: "OPEN",
    sourceEventIds: [movement.eventId],
  };
}

function addUnknownInitialInterval(
  input: SelectHistoricalLotOccupancyInput,
  movement: MovementEvidence,
  state: ReconstructionState,
): void {
  if (movement.fromLoteId === null) return;
  state.intervals.push({
    animalId: input.animalId,
    fazendaId: input.fazendaId,
    loteId: movement.fromLoteId,
    enteredAt: null,
    leftAt: movement.occurredAt,
    startBoundary: "LEFT_BOUND_UNKNOWN",
    endBoundary: "KNOWN",
    sourceEventIds: [movement.eventId],
  });
}

function applyMovement(
  input: SelectHistoricalLotOccupancyInput,
  movement: MovementEvidence,
  state: ReconstructionState,
  conflicts: HistoricalLotOccupancyConflict[],
): boolean {
  if (
    state.expectedLoteId !== undefined &&
    movement.fromLoteId !== state.expectedLoteId
  ) {
    addConflict(
      conflicts,
      "BROKEN_CHAIN",
      movement.occurredAt,
      [movement.eventId],
      `Origem ${movement.fromLoteId ?? "null"} diverge do lote esperado ${state.expectedLoteId ?? "null"}.`,
    );
    return false;
  }
  if (state.expectedLoteId === undefined) {
    addUnknownInitialInterval(input, movement, state);
  } else {
    closeCurrentInterval(movement, state);
  }
  openDestinationInterval(input, movement, state);
  state.expectedLoteId = movement.toLoteId;
  state.appliedMovementCount += 1;
  return true;
}

function processTimestampGroup(
  input: SelectHistoricalLotOccupancyInput,
  timestamp: number,
  group: readonly MovementEvidence[],
  evidence: EvidenceCollection,
  state: ReconstructionState,
): boolean {
  if (
    evidence.blockingTimestamp !== null &&
    timestamp >= evidence.blockingTimestamp
  ) {
    return false;
  }
  if (group.length > 1) {
    recordSameTimestampConflict(group, evidence.conflicts);
    return false;
  }
  return applyMovement(input, group[0], state, evidence.conflicts);
}

function reconstructIntervals(
  input: SelectHistoricalLotOccupancyInput,
  evidence: EvidenceCollection,
): { intervals: HistoricalLotOccupancyInterval[]; appliedMovementCount: number } {
  const state: ReconstructionState = {
    intervals: [],
    current: null,
    expectedLoteId: undefined,
    appliedMovementCount: 0,
    truncated: evidence.hasUnpositionedGap || evidence.hasUnpositionedConflict,
  };
  const groupedByTimestamp = movementsByTimestamp(evidence.movements);

  for (const timestamp of [...groupedByTimestamp.keys()].sort((a, b) => a - b)) {
    const group = groupedByTimestamp.get(timestamp)!;
    if (!processTimestampGroup(input, timestamp, group, evidence, state)) {
      state.truncated = true;
      break;
    }
  }

  if (evidence.blockingTimestamp !== null || evidence.conflicts.length > 0) {
    state.truncated = true;
  }
  if (state.current) {
    state.current.endBoundary = state.truncated ? "RIGHT_BOUND_UNKNOWN" : "OPEN";
    state.intervals.push(cloneInterval(state.current));
  }
  return {
    intervals: state.intervals,
    appliedMovementCount: state.appliedMovementCount,
  };
}

function resolveHistoryCoverage(
  evidence: EvidenceCollection,
  intervals: readonly HistoricalLotOccupancyInterval[],
): HistoricalLotOccupancyHistoryCoverage {
  if (evidence.conflicts.length > 0) return "CONFLICTED_HISTORY";
  if (intervals.length === 0) return "NO_HISTORY";
  const unknownBoundary = intervals.some(
    (interval) =>
      interval.startBoundary === "LEFT_BOUND_UNKNOWN" ||
      interval.endBoundary === "RIGHT_BOUND_UNKNOWN",
  );
  const incompleteSource = evidence.limitations.some(
    (limitation) => limitation.affectsCoverage,
  );
  return unknownBoundary || incompleteSource
    ? "PARTIAL_HISTORY"
    : "CONTIGUOUS_HISTORY";
}

function resolveLeftBoundary(
  intervals: readonly HistoricalLotOccupancyInterval[],
): HistoricalLotOccupancyCoverage["leftBoundary"] {
  if (intervals.length === 0) return "NOT_AVAILABLE";
  return intervals.some(
    (interval) => interval.startBoundary === "LEFT_BOUND_UNKNOWN",
  )
    ? "LEFT_BOUND_UNKNOWN"
    : "KNOWN_LEFT_BOUND";
}

function resolveRightBoundary(
  intervals: readonly HistoricalLotOccupancyInterval[],
): HistoricalLotOccupancyCoverage["rightBoundary"] {
  const last = intervals[intervals.length - 1];
  if (!last) return "NOT_AVAILABLE";
  if (last.endBoundary === "OPEN") return "OPEN_RIGHT_BOUND";
  if (last.endBoundary === "RIGHT_BOUND_UNKNOWN") {
    return "RIGHT_BOUND_UNKNOWN";
  }
  return "KNOWN_RIGHT_BOUND";
}

function coverageFor(
  input: SelectHistoricalLotOccupancyInput,
  evidence: EvidenceCollection,
  intervals: readonly HistoricalLotOccupancyInterval[],
  appliedMovementCount: number,
): HistoricalLotOccupancyCoverage {
  return {
    history: resolveHistoryCoverage(evidence, intervals),
    leftBoundary: resolveLeftBoundary(intervals),
    rightBoundary: resolveRightBoundary(intervals),
    inputEventCount: input.events.length,
    scopedEventCount: evidence.scopedEventCount,
    usableMovementCount: evidence.movements.length,
    appliedMovementCount,
    deduplicatedEventCount: evidence.deduplicatedEventCount,
    deduplicatedDetailCount: evidence.deduplicatedDetailCount,
  };
}

function statusFor(
  coverage: HistoricalLotOccupancyCoverage,
): HistoricalLotOccupancyStatus {
  if (coverage.history === "CONFLICTED_HISTORY") return "CONFLICT";
  if (coverage.history === "NO_HISTORY") return "NO_HISTORY";
  if (coverage.history === "PARTIAL_HISTORY") return "PARTIAL";
  return "READY";
}

export function selectHistoricalLotOccupancy(
  input: SelectHistoricalLotOccupancyInput,
): HistoricalLotOccupancyResult {
  const referenceTimestamp = Date.parse(input.referenceDate);
  if (!Number.isFinite(referenceTimestamp)) {
    const conflict: HistoricalLotOccupancyConflict = {
      code: "INVALID_REFERENCE_DATE",
      occurredAt: null,
      eventIds: [],
      description: "referenceDate deve representar um instante valido.",
    };
    return {
      status: "CONFLICT",
      animalId: input.animalId,
      fazendaId: input.fazendaId,
      referenceDate: input.referenceDate,
      intervals: [],
      coverage: {
        history: "CONFLICTED_HISTORY",
        leftBoundary: "NOT_AVAILABLE",
        rightBoundary: "NOT_AVAILABLE",
        inputEventCount: input.events.length,
        scopedEventCount: 0,
        usableMovementCount: 0,
        appliedMovementCount: 0,
        deduplicatedEventCount: 0,
        deduplicatedDetailCount: 0,
      },
      limitations: [],
      conflicts: [conflict],
    };
  }

  const evidence = collectEvidence(input, referenceTimestamp);
  const reconstruction = reconstructIntervals(input, evidence);
  const coverage = coverageFor(
    input,
    evidence,
    reconstruction.intervals,
    reconstruction.appliedMovementCount,
  );
  return {
    status: statusFor(coverage),
    animalId: input.animalId,
    fazendaId: input.fazendaId,
    referenceDate: input.referenceDate,
    intervals: reconstruction.intervals,
    coverage,
    limitations: evidence.limitations,
    conflicts: evidence.conflicts,
  };
}
