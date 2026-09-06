import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import {
  appendFinalSourcedInterval,
  buildFactualEvidenceIndex,
  cloneSourced,
  closeSourcedInterval,
  coverageFromEvidence,
  groupByKey,
  sortTimestamped,
  stableSignature,
  statusFromHistory,
  uniqueSorted,
} from "./historicalOccupancyInternals";

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

function semanticEventSignature(event: Evento): string {
  const timestamp = Date.parse(event.occurred_at);
  return stableSignature({
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
  return stableSignature({
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
  const index = buildFactualEvidenceIndex(
    input.events,
    input.movementDetails,
    input.fazendaId,
    (event) =>
      event.animal_id === input.animalId && event.dominio === "movimentacao",
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

  for (const eventId of [...index.eventGroups.keys()].sort((a, b) => a.localeCompare(b))) {
    const copies = index.eventGroups.get(eventId)!;
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
      index.detailGroups.get(event.id) ?? [],
      state,
    );
    if (!detail) continue;
    addMovementEvidence(event, detail, timestamp, state);
  }

  return {
    ...state,
    movements: sortTimestamped(state.movements),
    scopedEventCount: index.scopedEventCount,
  };
}

function cloneInterval(interval: MutableInterval): HistoricalLotOccupancyInterval {
  return cloneSourced(interval);
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
  state.intervals.push(
    closeSourcedInterval(state.current, movement.occurredAt, movement.eventId),
  );
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

  appendFinalSourcedInterval(
    state.intervals,
    state.current,
    state.truncated,
    evidence.blockingTimestamp !== null || evidence.conflicts.length > 0,
  );
  return {
    intervals: state.intervals,
    appliedMovementCount: state.appliedMovementCount,
  };
}

function statusFor(
  coverage: HistoricalLotOccupancyCoverage,
): HistoricalLotOccupancyStatus {
  return statusFromHistory(coverage.history);
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
  const coverage = coverageFromEvidence(
    input.events.length,
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
