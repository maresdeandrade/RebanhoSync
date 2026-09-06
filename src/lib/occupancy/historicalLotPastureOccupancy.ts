import type { Evento, EventoMovimentacao } from "@/lib/offline/types";
import {
  appendFinalSourcedInterval,
  buildFactualEvidenceIndex,
  closeSourcedInterval,
  coverageFromEvidence,
  groupByKey,
  sortTimestamped,
  stableSignature,
  statusFromHistory,
  uniqueSorted,
} from "./historicalOccupancyInternals";

export type HistoricalLotPastureStatus =
  | "READY"
  | "PARTIAL"
  | "NO_HISTORY"
  | "CONFLICT";

export type HistoricalLotPastureStartBoundary =
  | "KNOWN"
  | "LEFT_BOUND_UNKNOWN";

export type HistoricalLotPastureEndBoundary =
  | "KNOWN"
  | "OPEN"
  | "RIGHT_BOUND_UNKNOWN";

export interface HistoricalLotPastureInterval {
  loteId: string;
  fazendaId: string;
  pastoId: string;
  enteredAt: string | null;
  leftAt: string | null;
  startBoundary: HistoricalLotPastureStartBoundary;
  endBoundary: HistoricalLotPastureEndBoundary;
  sourceEventIds: string[];
}

export type HistoricalLotPastureLimitationCode =
  | "INVALID_EVENT_DATE_IGNORED"
  | "FUTURE_EVENT_IGNORED"
  | "MISSING_MOVEMENT_DETAIL"
  | "TOMBSTONED_EVENT_IGNORED"
  | "TOMBSTONED_DETAIL_IGNORED"
  | "NO_PASTURE_CHANGE_IGNORED"
  | "NOT_LOT_PASTURE_MOVEMENT_IGNORED";

export interface HistoricalLotPastureLimitation {
  code: HistoricalLotPastureLimitationCode;
  eventIds: string[];
  affectsCoverage: boolean;
}

export type HistoricalLotPastureConflictCode =
  | "INVALID_REFERENCE_DATE"
  | "EVENT_IDENTITY_CONFLICT"
  | "DETAIL_IDENTITY_CONFLICT"
  | "LOT_IDENTITY_CONFLICT"
  | "SAME_TIMESTAMP_CONFLICT"
  | "BROKEN_CHAIN"
  | "UNSUPPORTED_CORRECTION";

export interface HistoricalLotPastureConflict {
  code: HistoricalLotPastureConflictCode;
  occurredAt: string | null;
  eventIds: string[];
  description: string;
}

export type HistoricalLotPastureHistoryCoverage =
  | "NO_HISTORY"
  | "PARTIAL_HISTORY"
  | "CONTIGUOUS_HISTORY"
  | "CONFLICTED_HISTORY";

export interface HistoricalLotPastureCoverage {
  history: HistoricalLotPastureHistoryCoverage;
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

export interface HistoricalLotPastureResult {
  status: HistoricalLotPastureStatus;
  loteId: string;
  fazendaId: string;
  referenceDate: string;
  intervals: HistoricalLotPastureInterval[];
  coverage: HistoricalLotPastureCoverage;
  limitations: HistoricalLotPastureLimitation[];
  conflicts: HistoricalLotPastureConflict[];
}

export interface SelectHistoricalLotPastureInput {
  loteId: string;
  fazendaId: string;
  referenceDate: string;
  events: readonly Evento[];
  movementDetails: readonly EventoMovimentacao[];
}

interface PastureMovement {
  eventId: string;
  occurredAt: string;
  timestamp: number;
  fromPastoId: string | null;
  toPastoId: string | null;
}

interface Evidence {
  movements: PastureMovement[];
  limitations: HistoricalLotPastureLimitation[];
  conflicts: HistoricalLotPastureConflict[];
  scopedEventCount: number;
  deduplicatedEventCount: number;
  deduplicatedDetailCount: number;
  blockingTimestamp: number | null;
  hasUnpositionedIssue: boolean;
}

type EvidenceState = Omit<Evidence, "scopedEventCount">;

interface ReconstructionState {
  intervals: HistoricalLotPastureInterval[];
  current: HistoricalLotPastureInterval | null;
  expectedPastoId: string | null | undefined;
  appliedMovementCount: number;
  truncated: boolean;
}

function eventSignature(event: Evento): string {
  return stableSignature({
    id: event.id,
    fazendaId: event.fazenda_id,
    dominio: event.dominio,
    occurredAt: event.occurred_at,
    animalId: event.animal_id,
    loteId: event.lote_id,
    correctionId: event.corrige_evento_id,
    payload: event.payload,
    deletedAt: event.deleted_at,
  });
}

function detailSignature(detail: EventoMovimentacao): string {
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
  state: EvidenceState,
  code: HistoricalLotPastureLimitationCode,
  eventIds: readonly string[],
  affectsCoverage: boolean,
): void {
  state.limitations.push({
    code,
    eventIds: uniqueSorted(eventIds),
    affectsCoverage,
  });
}

function addConflict(
  state: EvidenceState,
  code: HistoricalLotPastureConflictCode,
  occurredAt: string | null,
  eventIds: readonly string[],
  description: string,
): void {
  state.conflicts.push({
    code,
    occurredAt,
    eventIds: uniqueSorted(eventIds),
    description,
  });
}

function markBlocking(state: EvidenceState, timestamp: number): void {
  state.blockingTimestamp =
    state.blockingTimestamp === null
      ? timestamp
      : Math.min(state.blockingTimestamp, timestamp);
}

function isMarkedLotPastureEvent(event: Evento): boolean {
  return event.payload?.tipo_movimentacao === "lote_pasto";
}

function isLotPastureDetail(
  detail: EventoMovimentacao,
  loteId: string,
): boolean {
  return detail.from_lote_id === loteId && detail.to_lote_id === loteId;
}

function selectUniqueEvent(
  copies: readonly Evento[],
  state: EvidenceState,
): Evento | null {
  if (new Set(copies.map(eventSignature)).size === 1) {
    state.deduplicatedEventCount += copies.length - 1;
    return copies[0];
  }
  const timestamps = uniqueSorted(copies.map((event) => event.occurred_at));
  const parsed = timestamps.map(Date.parse).filter(Number.isFinite);
  const timestamp = parsed.length === 1 ? parsed[0] : null;
  addConflict(
    state,
    "EVENT_IDENTITY_CONFLICT",
    timestamp === null ? null : copies[0].occurred_at,
    [copies[0].id],
    "Copias divergentes compartilham a identidade do Evento lote-pasto.",
  );
  if (timestamp === null) state.hasUnpositionedIssue = true;
  else markBlocking(state, timestamp);
  return null;
}

function selectUniqueDetail(
  event: Evento,
  copies: readonly EventoMovimentacao[],
  state: EvidenceState,
): EventoMovimentacao | null {
  if (copies.length === 0) return null;
  if (new Set(copies.map(detailSignature)).size > 1) {
    addConflict(
      state,
      "DETAIL_IDENTITY_CONFLICT",
      event.occurred_at,
      [event.id],
      "Details divergentes compartilham a identidade do Evento lote-pasto.",
    );
    const timestamp = Date.parse(event.occurred_at);
    if (Number.isFinite(timestamp)) markBlocking(state, timestamp);
    else state.hasUnpositionedIssue = true;
    return null;
  }
  state.deduplicatedDetailCount += copies.length - 1;
  return copies[0];
}

function validateTimestamp(
  event: Evento,
  referenceTimestamp: number,
  state: EvidenceState,
): number | null {
  const timestamp = Date.parse(event.occurred_at);
  if (!Number.isFinite(timestamp)) {
    addLimitation(state, "INVALID_EVENT_DATE_IGNORED", [event.id], true);
    state.hasUnpositionedIssue = true;
    return null;
  }
  if (timestamp > referenceTimestamp) {
    addLimitation(state, "FUTURE_EVENT_IGNORED", [event.id], false);
    return null;
  }
  return timestamp;
}

function validateCandidate(
  input: SelectHistoricalLotPastureInput,
  event: Evento,
  detail: EventoMovimentacao | null,
  timestamp: number,
  state: EvidenceState,
): EventoMovimentacao | null {
  const marked = isMarkedLotPastureEvent(event);
  if (!detail) {
    if (marked) {
      addLimitation(state, "MISSING_MOVEMENT_DETAIL", [event.id], true);
      markBlocking(state, timestamp);
    }
    return null;
  }
  const factualShape = isLotPastureDetail(detail, input.loteId);
  if (!marked && !factualShape) {
    addLimitation(
      state,
      "NOT_LOT_PASTURE_MOVEMENT_IGNORED",
      [event.id],
      false,
    );
    return null;
  }
  if (!factualShape) {
    addConflict(
      state,
      "LOT_IDENTITY_CONFLICT",
      event.occurred_at,
      [event.id],
      "Evento marcado lote-pasto diverge do lote identificado no detail.",
    );
    markBlocking(state, timestamp);
    return null;
  }
  return detail;
}

function addMovement(
  event: Evento,
  detail: EventoMovimentacao,
  timestamp: number,
  state: EvidenceState,
): void {
  if (event.deleted_at) {
    addLimitation(state, "TOMBSTONED_EVENT_IGNORED", [event.id], true);
    markBlocking(state, timestamp);
    return;
  }
  if (detail.deleted_at) {
    addLimitation(state, "TOMBSTONED_DETAIL_IGNORED", [event.id], true);
    markBlocking(state, timestamp);
    return;
  }
  if (event.corrige_evento_id) {
    addConflict(
      state,
      "UNSUPPORTED_CORRECTION",
      event.occurred_at,
      [event.id, event.corrige_evento_id],
      "Movimentacao lote-pasto corrigida nao possui resolvedor canonico.",
    );
    markBlocking(state, timestamp);
    return;
  }
  if (detail.from_pasto_id === detail.to_pasto_id) {
    addLimitation(state, "NO_PASTURE_CHANGE_IGNORED", [event.id], false);
    return;
  }
  state.movements.push({
    eventId: event.id,
    occurredAt: event.occurred_at,
    timestamp,
    fromPastoId: detail.from_pasto_id,
    toPastoId: detail.to_pasto_id,
  });
}

function collectEvidence(
  input: SelectHistoricalLotPastureInput,
  referenceTimestamp: number,
): Evidence {
  const index = buildFactualEvidenceIndex(
    input.events,
    input.movementDetails,
    input.fazendaId,
    (event) =>
      event.dominio === "movimentacao" &&
      event.animal_id === null &&
      event.lote_id === input.loteId,
  );
  const state: EvidenceState = {
    movements: [],
    limitations: [],
    conflicts: [],
    deduplicatedEventCount: 0,
    deduplicatedDetailCount: 0,
    blockingTimestamp: null,
    hasUnpositionedIssue: false,
  };

  for (const eventId of [...index.eventGroups.keys()].sort((a, b) => a.localeCompare(b))) {
    const event = selectUniqueEvent(index.eventGroups.get(eventId)!, state);
    if (!event) continue;
    const timestamp = validateTimestamp(event, referenceTimestamp, state);
    if (timestamp === null) continue;
    const detail = selectUniqueDetail(
      event,
      index.detailGroups.get(event.id) ?? [],
      state,
    );
    const candidate = validateCandidate(input, event, detail, timestamp, state);
    if (candidate) addMovement(event, candidate, timestamp, state);
  }

  return {
    ...state,
    movements: sortTimestamped(state.movements),
    scopedEventCount: index.scopedEventCount,
  };
}

function closeCurrent(
  movement: PastureMovement,
  state: ReconstructionState,
): void {
  if (!state.current) return;
  state.intervals.push(
    closeSourcedInterval(state.current, movement.occurredAt, movement.eventId),
  );
  state.current = null;
}

function openDestination(
  input: SelectHistoricalLotPastureInput,
  movement: PastureMovement,
  state: ReconstructionState,
): void {
  if (movement.toPastoId === null) return;
  state.current = {
    loteId: input.loteId,
    fazendaId: input.fazendaId,
    pastoId: movement.toPastoId,
    enteredAt: movement.occurredAt,
    leftAt: null,
    startBoundary: "KNOWN",
    endBoundary: "OPEN",
    sourceEventIds: [movement.eventId],
  };
}

function addUnknownOrigin(
  input: SelectHistoricalLotPastureInput,
  movement: PastureMovement,
  state: ReconstructionState,
): void {
  if (movement.fromPastoId === null) return;
  state.intervals.push({
    loteId: input.loteId,
    fazendaId: input.fazendaId,
    pastoId: movement.fromPastoId,
    enteredAt: null,
    leftAt: movement.occurredAt,
    startBoundary: "LEFT_BOUND_UNKNOWN",
    endBoundary: "KNOWN",
    sourceEventIds: [movement.eventId],
  });
}

function applyMovement(
  input: SelectHistoricalLotPastureInput,
  movement: PastureMovement,
  state: ReconstructionState,
  evidence: Evidence,
): boolean {
  if (
    state.expectedPastoId !== undefined &&
    movement.fromPastoId !== state.expectedPastoId
  ) {
    addConflict(
      evidence,
      "BROKEN_CHAIN",
      movement.occurredAt,
      [movement.eventId],
      `Origem ${movement.fromPastoId ?? "null"} diverge do pasto esperado ${state.expectedPastoId ?? "null"}.`,
    );
    return false;
  }
  if (state.expectedPastoId === undefined) addUnknownOrigin(input, movement, state);
  else closeCurrent(movement, state);
  openDestination(input, movement, state);
  state.expectedPastoId = movement.toPastoId;
  state.appliedMovementCount += 1;
  return true;
}

function processMovementGroup(
  input: SelectHistoricalLotPastureInput,
  timestamp: number,
  group: readonly PastureMovement[],
  evidence: Evidence,
  state: ReconstructionState,
): boolean {
  if (
    evidence.blockingTimestamp !== null &&
    timestamp >= evidence.blockingTimestamp
  ) {
    return false;
  }
  if (group.length > 1) {
    addConflict(
      evidence,
      "SAME_TIMESTAMP_CONFLICT",
      group[0].occurredAt,
      group.map((movement) => movement.eventId),
      "Movimentos lote-pasto no mesmo instante nao possuem ordem factual.",
    );
    return false;
  }
  return applyMovement(input, group[0], state, evidence);
}

function completeReconstruction(
  state: ReconstructionState,
  evidence: Evidence,
): void {
  appendFinalSourcedInterval(
    state.intervals,
    state.current,
    state.truncated,
    evidence.blockingTimestamp !== null || evidence.conflicts.length > 0,
  );
}

function reconstruct(
  input: SelectHistoricalLotPastureInput,
  evidence: Evidence,
): { intervals: HistoricalLotPastureInterval[]; appliedMovementCount: number } {
  const state: ReconstructionState = {
    intervals: [],
    current: null,
    expectedPastoId: undefined,
    appliedMovementCount: 0,
    truncated: evidence.hasUnpositionedIssue,
  };
  const groups = groupByKey(evidence.movements, (movement) => String(movement.timestamp));
  for (const timestamp of [...groups.keys()].map(Number).sort((a, b) => a - b)) {
    const group = groups.get(String(timestamp))!;
    if (!processMovementGroup(input, timestamp, group, evidence, state)) {
      state.truncated = true;
      break;
    }
  }
  completeReconstruction(state, evidence);
  return {
    intervals: state.intervals,
    appliedMovementCount: state.appliedMovementCount,
  };
}

function statusFromCoverage(
  coverage: HistoricalLotPastureCoverage,
): HistoricalLotPastureStatus {
  return statusFromHistory(coverage.history);
}

export function selectHistoricalLotPastureOccupancy(
  input: SelectHistoricalLotPastureInput,
): HistoricalLotPastureResult {
  const referenceTimestamp = Date.parse(input.referenceDate);
  if (!Number.isFinite(referenceTimestamp)) {
    return {
      status: "CONFLICT",
      loteId: input.loteId,
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
      conflicts: [
        {
          code: "INVALID_REFERENCE_DATE",
          occurredAt: null,
          eventIds: [],
          description: "referenceDate deve representar um instante valido.",
        },
      ],
    };
  }
  const evidence = collectEvidence(input, referenceTimestamp);
  const reconstruction = reconstruct(input, evidence);
  const coverage = coverageFromEvidence(
    input.events.length,
    evidence,
    reconstruction.intervals,
    reconstruction.appliedMovementCount,
  );
  return {
    status: statusFromCoverage(coverage),
    loteId: input.loteId,
    fazendaId: input.fazendaId,
    referenceDate: input.referenceDate,
    intervals: reconstruction.intervals,
    coverage,
    limitations: evidence.limitations,
    conflicts: evidence.conflicts,
  };
}
