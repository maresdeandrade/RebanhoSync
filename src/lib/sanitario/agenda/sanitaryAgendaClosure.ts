import type { SanitaryEventExecutionCommand } from "../execution/sanitaryEventExecution";
import type { SanitaryAgendaMaterializationCommand } from "./sanitaryAgendaMaterialization";

export type SanitaryAgendaClosureType =
  | "executed_with_event"
  | "partially_executed_with_event"
  | "closed_without_execution"
  | "cancelled"
  | "dismissed";

export type SanitaryAgendaClosureInput = {
  agendaCommand: SanitaryAgendaMaterializationCommand;
  closureType: SanitaryAgendaClosureType;
  eventExecutionCommand?: SanitaryEventExecutionCommand;
  reason?: string | null;
  closedAt: string;
  closedBy?: string | null;
};

export type SanitaryAgendaClosureCommand = {
  dedupKey: string;

  domain: "sanitario";
  commandType: "agenda_closure_intent";

  agendaDedupKey: string;
  closureType: SanitaryAgendaClosureType;

  closedAt: string;
  closedBy?: string | null;
  reason?: string | null;

  plannedAnimalIds: string[];
  executedAnimalIds: string[];
  notExecutedAnimals: Array<{
    animalId: string;
    reason: string;
  }>;

  source: {
    agendaSource: "SanitaryAgendaMaterializationCommand";
    eventSource?: "SanitaryEventExecutionCommand";
    eventDedupKey?: string;
    previewGroupId?: string;
    sourceDemandKey?: string;

    createsEvent: false;
    persistsEvent: false;
    createsInventoryMovement: false;
    calculatesWithdrawal: false;
    createsHistoricalFact: false;
  };
};

export type SanitaryAgendaClosureRejection = {
  reason:
    | "missing_closed_at"
    | "invalid_closed_at"
    | "missing_agenda"
    | "missing_event_for_executed_closure"
    | "event_not_allowed_for_closure_type"
    | "event_does_not_match_agenda"
    | "executed_animal_outside_planned_scope"
    | "missing_reason"
    | "missing_non_execution_reason"
    | "partial_closure_without_not_executed_animals"
    | "invalid_closure_type";
  animalId?: string;
};

export type SanitaryAgendaClosureResult = {
  command: SanitaryAgendaClosureCommand | null;
  rejected: SanitaryAgendaClosureRejection[];
  source: {
    creates: "agenda_closure_intent";
    createsEvent: false;
    persistsEvent: false;
    createsHistoricalFact: false;
    createsInventoryMovement: false;
    calculatesWithdrawal: false;
  };
};

const VALID_CLOSURE_TYPES: readonly SanitaryAgendaClosureType[] = [
  "executed_with_event",
  "partially_executed_with_event",
  "closed_without_execution",
  "cancelled",
  "dismissed",
];

function parseValidDateTimeKey(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const dateKey = `${year}-${month}-${day}`;
    const date = new Date(`${dateKey}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10) === dateKey ? dateKey : undefined;
  }

  const dateTimeMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?Z?$/.exec(value);
  if (!dateTimeMatch) return undefined;

  const [, year, month, day, hour, minute, second = "00", millisecond = "000"] = dateTimeMatch;
  const dateKey = `${year}-${month}-${day}`;
  const candidate = `${dateKey}T${hour}:${minute}:${second}.${millisecond}Z`;
  const date = new Date(candidate);

  if (Number.isNaN(date.getTime())) return undefined;
  if (date.toISOString().slice(0, 10) !== dateKey) return undefined;

  return date.toISOString();
}

function isValidClosureType(value: string): value is SanitaryAgendaClosureType {
  return VALID_CLOSURE_TYPES.includes(value as SanitaryAgendaClosureType);
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? null;
  return trimmed === "" ? null : trimmed;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function resultSource(): SanitaryAgendaClosureResult["source"] {
  return {
    creates: "agenda_closure_intent",
    createsEvent: false,
    persistsEvent: false,
    createsHistoricalFact: false,
    createsInventoryMovement: false,
    calculatesWithdrawal: false,
  };
}

function reject(
  reason: SanitaryAgendaClosureRejection["reason"],
  animalId?: string,
): SanitaryAgendaClosureRejection {
  return { reason, animalId };
}

function requiresReason(closureType: SanitaryAgendaClosureType): boolean {
  return (
    closureType === "closed_without_execution" ||
    closureType === "cancelled" ||
    closureType === "dismissed"
  );
}

function requiresEvent(closureType: SanitaryAgendaClosureType): boolean {
  return closureType === "executed_with_event" || closureType === "partially_executed_with_event";
}

function allowsEvent(closureType: SanitaryAgendaClosureType): boolean {
  return requiresEvent(closureType);
}

function buildDedupKey(input: {
  agendaDedupKey: string;
  closureType: SanitaryAgendaClosureType;
  closedAt: string;
  eventDedupKey?: string;
  plannedAnimalIds: readonly string[];
  executedAnimalIds: readonly string[];
}): string {
  return [
    "sanitario-agenda-closure-v1",
    `agenda:${input.agendaDedupKey}`,
    `type:${input.closureType}`,
    `closed:${input.closedAt}`,
    `event:${input.eventDedupKey ?? "none"}`,
    `planned:${input.plannedAnimalIds.join(",")}`,
    `executed:${input.executedAnimalIds.join(",")}`,
  ].join("|");
}

function notExecutedAnimalsFrom(input: {
  plannedAnimalIds: readonly string[];
  eventExecutionCommand?: SanitaryEventExecutionCommand;
}): SanitaryAgendaClosureCommand["notExecutedAnimals"] {
  const executed = new Set(input.eventExecutionCommand?.executedAnimalIds ?? []);
  const reasons = new Map(
    (input.eventExecutionCommand?.notExecutedAnimals ?? []).map((item) => [
      item.animalId,
      item.reason.trim(),
    ]),
  );

  return input.plannedAnimalIds
    .filter((animalId) => !executed.has(animalId))
    .map((animalId) => ({
      animalId,
      reason: reasons.get(animalId) ?? "",
    }))
    .sort((left, right) => left.animalId.localeCompare(right.animalId));
}

export function createSanitaryAgendaClosureCommand(
  input: SanitaryAgendaClosureInput,
): SanitaryAgendaClosureResult {
  const rejected: SanitaryAgendaClosureRejection[] = [];
  const closedAt = parseValidDateTimeKey(input.closedAt);
  const rawClosureType = input.closureType;
  const closureType = isValidClosureType(rawClosureType) ? rawClosureType : undefined;
  const agendaCommand = input.agendaCommand;
  const agendaDedupKey = agendaCommand?.dedupKey;
  const plannedAnimalIds = uniqueSorted(agendaCommand?.animalIds ?? []);
  const eventExecutionCommand = input.eventExecutionCommand;
  const executedAnimalIds = uniqueSorted(eventExecutionCommand?.executedAnimalIds ?? []);
  const plannedSet = new Set(plannedAnimalIds);
  const reason = normalizeOptionalText(input.reason);

  if (!input.closedAt) {
    rejected.push(reject("missing_closed_at"));
  } else if (!closedAt) {
    rejected.push(reject("invalid_closed_at"));
  }

  if (!agendaCommand || !agendaDedupKey) {
    rejected.push(reject("missing_agenda"));
  }

  if (!closureType) {
    rejected.push(reject("invalid_closure_type"));
  }

  if (closureType && requiresReason(closureType) && !reason) {
    rejected.push(reject("missing_reason"));
  }

  if (closureType && requiresEvent(closureType) && !eventExecutionCommand) {
    rejected.push(reject("missing_event_for_executed_closure"));
  }

  if (closureType && !allowsEvent(closureType) && eventExecutionCommand) {
    rejected.push(reject("event_not_allowed_for_closure_type"));
  }

  if (
    closureType &&
    requiresEvent(closureType) &&
    eventExecutionCommand &&
    eventExecutionCommand.source.agendaDedupKey !== agendaDedupKey
  ) {
    rejected.push(reject("event_does_not_match_agenda"));
  }

  if (closureType && requiresEvent(closureType)) {
    for (const animalId of executedAnimalIds) {
      if (!plannedSet.has(animalId)) {
        rejected.push(reject("executed_animal_outside_planned_scope", animalId));
      }
    }
  }

  const notExecutedAnimals = notExecutedAnimalsFrom({ plannedAnimalIds, eventExecutionCommand });

  if (closureType === "executed_with_event" && notExecutedAnimals.length > 0) {
    for (const item of notExecutedAnimals) {
      rejected.push(reject("missing_non_execution_reason", item.animalId));
    }
  }

  if (closureType === "partially_executed_with_event") {
    if (executedAnimalIds.length === 0) {
      rejected.push(reject("missing_event_for_executed_closure"));
    }

    if (notExecutedAnimals.length === 0) {
      rejected.push(reject("partial_closure_without_not_executed_animals"));
    }

    for (const item of notExecutedAnimals) {
      if (!item.reason) {
        rejected.push(reject("missing_non_execution_reason", item.animalId));
      }
    }
  }

  if (rejected.length > 0 || !closedAt || !closureType || !agendaDedupKey) {
    return {
      command: null,
      rejected,
      source: resultSource(),
    };
  }

  const command: SanitaryAgendaClosureCommand = {
    dedupKey: buildDedupKey({
      agendaDedupKey,
      closureType,
      closedAt,
      eventDedupKey: eventExecutionCommand?.dedupKey,
      plannedAnimalIds,
      executedAnimalIds,
    }),
    domain: "sanitario",
    commandType: "agenda_closure_intent",
    agendaDedupKey,
    closureType,
    closedAt,
    closedBy: normalizeOptionalText(input.closedBy),
    reason,
    plannedAnimalIds,
    executedAnimalIds,
    notExecutedAnimals,
    source: {
      agendaSource: "SanitaryAgendaMaterializationCommand",
      eventSource: eventExecutionCommand ? "SanitaryEventExecutionCommand" : undefined,
      eventDedupKey: eventExecutionCommand?.dedupKey,
      previewGroupId: agendaCommand.source.previewGroupId,
      sourceDemandKey: agendaCommand.source.sourceDemandKey,
      createsEvent: false,
      persistsEvent: false,
      createsInventoryMovement: false,
      calculatesWithdrawal: false,
      createsHistoricalFact: false,
    },
  };

  return {
    command,
    rejected,
    source: resultSource(),
  };
}
