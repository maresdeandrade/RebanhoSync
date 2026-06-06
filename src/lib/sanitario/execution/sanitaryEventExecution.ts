import type { SanitaryAgendaMaterializationCommand } from "../agenda/sanitaryAgendaMaterialization";

export type SanitaryEventExecutionProduct = {
  productId?: string | null;
  productName?: string | null;
  productClass?: string | null;
  doseQuantity?: number | null;
  doseUnit?: string | null;
  route?: string | null;
  inventoryLotId?: string | null;
};

export type SanitaryEventExecutionInput = {
  occurredAt: string;
  agendaCommand?: SanitaryAgendaMaterializationCommand;
  protocolRuleId?: string;
  protocolName?: string;
  protocolItemId?: string | null;
  actionType?: string | null;
  loteId?: string | null;
  loteName?: string | null;
  executedAnimalIds: readonly string[];
  nonExecutionReasonsByAnimalId?: Readonly<Record<string, string>>;
  product?: SanitaryEventExecutionProduct;
  responsibleId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;
};

export type SanitaryEventExecutionCommand = {
  dedupKey: string;

  domain: "sanitario";
  executionType: "event_fact";
  eventIntentType: "sanitary_execution";

  occurredAt: string;

  protocolRuleId: string;
  protocolName?: string;
  protocolItemId?: string | null;
  actionType?: string | null;

  loteId?: string | null;
  loteName?: string | null;

  executedAnimalIds: string[];
  notExecutedAnimals: Array<{
    animalId: string;
    reason: string;
  }>;

  product?: SanitaryEventExecutionProduct;
  responsibleId?: string | null;
  responsibleName?: string | null;
  notes?: string | null;

  source: {
    sourceType: "SanitaryAgendaMaterializationCommand" | "manual_sanitary_execution";
    agendaDedupKey?: string;
    previewGroupId?: string;
    sourceDemandKey?: string;
    createsAgenda: false;
    closesAgenda: false;
    persistsEvent: false;
    createsInventoryMovement: false;
  };
};

export type SanitaryEventExecutionRejection = {
  reason:
    | "missing_protocol"
    | "missing_occurred_at"
    | "invalid_occurred_at"
    | "empty_executed_animal_ids"
    | "animal_outside_planned_scope"
    | "missing_non_execution_reason";
  animalId?: string;
};

export type SanitaryEventExecutionResult = {
  command: SanitaryEventExecutionCommand | null;
  rejected: SanitaryEventExecutionRejection[];
  source: {
    creates: "event_execution_intent";
    createsEvent: true;
    persistsEvent: false;
    createsAgenda: false;
    closesAgenda: false;
    createsInventoryMovement: false;
  };
};

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

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? null;
  return trimmed === "" ? null : trimmed;
}

function stablePart(value: string | null | undefined): string {
  return value ?? "none";
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function buildDedupKey(input: {
  agendaCommand?: SanitaryAgendaMaterializationCommand;
  occurredAt: string;
  protocolRuleId: string;
  protocolItemId?: string | null;
  actionType?: string | null;
  loteId?: string | null;
  productId?: string | null;
  productClass?: string | null;
  executedAnimalIds: readonly string[];
}): string {
  return [
    "sanitario-event-execution-v1",
    `agenda:${input.agendaCommand?.dedupKey ?? "none"}`,
    `protocol:${input.protocolRuleId}`,
    `item:${stablePart(input.protocolItemId)}`,
    `product:${stablePart(input.productId)}`,
    `class:${stablePart(input.productClass)}`,
    `action:${stablePart(input.actionType)}`,
    `lote:${stablePart(input.loteId)}`,
    `occurred:${input.occurredAt}`,
    `animals:${input.executedAnimalIds.join(",")}`,
  ].join("|");
}

function plannedAnimalIds(input: SanitaryEventExecutionInput): string[] {
  return input.agendaCommand ? uniqueSorted(input.agendaCommand.animalIds) : [];
}

function reject(reason: SanitaryEventExecutionRejection["reason"], animalId?: string) {
  return { reason, animalId };
}

export function createSanitaryEventExecutionCommand(
  input: SanitaryEventExecutionInput,
): SanitaryEventExecutionResult {
  const rejected: SanitaryEventExecutionRejection[] = [];
  const occurredAt = parseValidDateTimeKey(input.occurredAt);
  const executedAnimalIds = uniqueSorted(input.executedAnimalIds);
  const planned = plannedAnimalIds(input);
  const plannedSet = new Set(planned);
  const protocolRuleId = input.protocolRuleId ?? input.agendaCommand?.protocolRuleId;
  const protocolItemId = input.protocolItemId ?? input.agendaCommand?.protocolItemId;
  const actionType = input.actionType ?? input.agendaCommand?.actionType;
  const loteId = input.loteId ?? input.agendaCommand?.loteId;
  const productId = input.product?.productId ?? input.agendaCommand?.productId;
  const productClass = input.product?.productClass ?? input.agendaCommand?.productClass;

  if (!input.occurredAt) {
    rejected.push(reject("missing_occurred_at"));
  } else if (!occurredAt) {
    rejected.push(reject("invalid_occurred_at"));
  }

  if (!protocolRuleId) {
    rejected.push(reject("missing_protocol"));
  }

  if (executedAnimalIds.length === 0) {
    rejected.push(reject("empty_executed_animal_ids"));
  }

  if (planned.length > 0) {
    for (const animalId of executedAnimalIds) {
      if (!plannedSet.has(animalId)) {
        rejected.push(reject("animal_outside_planned_scope", animalId));
      }
    }

    for (const animalId of planned) {
      if (
        !executedAnimalIds.includes(animalId) &&
        !input.nonExecutionReasonsByAnimalId?.[animalId]?.trim()
      ) {
        rejected.push(reject("missing_non_execution_reason", animalId));
      }
    }
  }

  if (rejected.length > 0 || !occurredAt || !protocolRuleId) {
    return {
      command: null,
      rejected,
      source: {
        creates: "event_execution_intent",
        createsEvent: true,
        persistsEvent: false,
        createsAgenda: false,
        closesAgenda: false,
        createsInventoryMovement: false,
      },
    };
  }

  const notExecutedAnimals = planned
    .filter((animalId) => !executedAnimalIds.includes(animalId))
    .map((animalId) => ({
      animalId,
      reason: input.nonExecutionReasonsByAnimalId?.[animalId]?.trim() ?? "",
    }))
    .sort((left, right) => left.animalId.localeCompare(right.animalId));

  const command: SanitaryEventExecutionCommand = {
    dedupKey: buildDedupKey({
      agendaCommand: input.agendaCommand,
      occurredAt,
      protocolRuleId,
      protocolItemId,
      actionType,
      loteId,
      productId,
      productClass,
      executedAnimalIds,
    }),
    domain: "sanitario",
    executionType: "event_fact",
    eventIntentType: "sanitary_execution",
    occurredAt,
    protocolRuleId,
    protocolName: input.protocolName ?? input.agendaCommand?.protocolName,
    protocolItemId,
    actionType,
    loteId,
    loteName: input.loteName ?? input.agendaCommand?.loteName,
    executedAnimalIds,
    notExecutedAnimals,
    product: input.product
      ? {
          productId: input.product.productId ?? input.agendaCommand?.productId,
          productName: input.product.productName ?? input.agendaCommand?.productName,
          productClass: input.product.productClass ?? input.agendaCommand?.productClass,
          doseQuantity: input.product.doseQuantity,
          doseUnit: normalizeNullableText(input.product.doseUnit),
          route: normalizeNullableText(input.product.route),
          inventoryLotId: normalizeNullableText(input.product.inventoryLotId),
        }
      : undefined,
    responsibleId: input.responsibleId ?? input.agendaCommand?.responsibleId,
    responsibleName: normalizeNullableText(input.responsibleName),
    notes: input.notes ?? input.agendaCommand?.notes,
    source: {
      sourceType: input.agendaCommand
        ? "SanitaryAgendaMaterializationCommand"
        : "manual_sanitary_execution",
      agendaDedupKey: input.agendaCommand?.dedupKey,
      previewGroupId: input.agendaCommand?.source.previewGroupId,
      sourceDemandKey: input.agendaCommand?.source.sourceDemandKey,
      createsAgenda: false,
      closesAgenda: false,
      persistsEvent: false,
      createsInventoryMovement: false,
    },
  };

  return {
    command,
    rejected,
    source: {
      creates: "event_execution_intent",
      createsEvent: true,
      persistsEvent: false,
      createsAgenda: false,
      closesAgenda: false,
      createsInventoryMovement: false,
    },
  };
}
