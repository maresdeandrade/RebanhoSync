import type { SanitaryOperationalPreview, SanitaryPreviewGroup } from "../preview/sanitaryOperationalPreview";

export type SanitaryAgendaMaterializationOverride = {
  scheduledDate?: string;
  responsibleId?: string | null;
  notes?: string | null;
};

export type SanitaryAgendaMaterializationInput = {
  referenceDate: string;
  previewGroups?: readonly SanitaryPreviewGroup[];
  preview?: SanitaryOperationalPreview;
  overridesByPreviewGroupId?: Readonly<Record<string, SanitaryAgendaMaterializationOverride>>;
};

export type SanitaryAgendaMaterializationCommand = {
  dedupKey: string;

  domain: "sanitario";
  materializationType: "agenda_intent";

  protocolRuleId: string;
  protocolName?: string;

  protocolItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productClass?: string | null;
  actionType?: string | null;

  loteId?: string | null;
  loteName?: string | null;

  animalIds: string[];

  scheduledDate: string;
  windowStart?: string;
  windowEnd?: string;

  responsibleId?: string | null;
  notes?: string | null;

  source: {
    previewGroupId: string;
    sourceDemandKey: string;
    sourceType: "SanitaryOperationalPreview";
    materialization: "agenda";
  };
};

export type SanitaryAgendaMaterializationRejection = {
  previewGroupId: string;
  reason:
    | "missing_scheduled_date"
    | "invalid_scheduled_date"
    | "scheduled_date_outside_window"
    | "empty_animal_ids";
  sourceDemandKey: string;
};

export type SanitaryAgendaMaterializationResult = {
  commands: SanitaryAgendaMaterializationCommand[];
  rejected: SanitaryAgendaMaterializationRejection[];
  summary: {
    totalPreviewGroups: number;
    commands: number;
    rejected: number;
    totalAnimals: number;
  };
  source: {
    previewSource: "SanitaryOperationalPreview";
    creates: "agenda_intent";
    createsEvent: false;
    createsInventoryMovement: false;
  };
};

function parseValidDateKey(value: string | null | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return undefined;

  const [, year, month, day] = match;
  const dateKey = `${year}-${month}-${day}`;
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return undefined;

  const normalized = date.toISOString().slice(0, 10);
  return normalized === dateKey ? dateKey : undefined;
}

function stablePart(value: string | null | undefined): string {
  return value ?? "";
}

function compareCommands(
  left: SanitaryAgendaMaterializationCommand,
  right: SanitaryAgendaMaterializationCommand,
): number {
  return left.dedupKey.localeCompare(right.dedupKey);
}

function compareRejections(
  left: SanitaryAgendaMaterializationRejection,
  right: SanitaryAgendaMaterializationRejection,
): number {
  return (
    left.previewGroupId.localeCompare(right.previewGroupId) ||
    left.reason.localeCompare(right.reason) ||
    left.sourceDemandKey.localeCompare(right.sourceDemandKey)
  );
}

function comparePreviewGroups(left: SanitaryPreviewGroup, right: SanitaryPreviewGroup): number {
  return (
    stablePart(left.protocolRuleId).localeCompare(stablePart(right.protocolRuleId)) ||
    stablePart(left.protocolItemId).localeCompare(stablePart(right.protocolItemId)) ||
    stablePart(left.productId).localeCompare(stablePart(right.productId)) ||
    stablePart(left.productClass).localeCompare(stablePart(right.productClass)) ||
    stablePart(left.actionType).localeCompare(stablePart(right.actionType)) ||
    stablePart(left.loteId).localeCompare(stablePart(right.loteId)) ||
    stablePart(left.windowStart).localeCompare(stablePart(right.windowStart)) ||
    stablePart(left.windowEnd).localeCompare(stablePart(right.windowEnd)) ||
    left.previewGroupId.localeCompare(right.previewGroupId)
  );
}

function isOutsideWindow(input: {
  scheduledDate: string;
  windowStart?: string;
  windowEnd?: string;
}): boolean {
  const scheduledDate = parseValidDateKey(input.scheduledDate);
  const windowStart = parseValidDateKey(input.windowStart);
  const windowEnd = parseValidDateKey(input.windowEnd);

  if (!scheduledDate) return true;
  if (windowStart && scheduledDate < windowStart) return true;
  if (windowEnd && scheduledDate > windowEnd) return true;
  return false;
}

function buildDedupKey(input: {
  group: SanitaryPreviewGroup;
  scheduledDate: string;
  animalIds: readonly string[];
}): string {
  return [
    "sanitario-agenda-v2",
    `protocol:${input.group.protocolRuleId}`,
    `item:${input.group.protocolItemId ?? "none"}`,
    `product:${input.group.productId ?? "none"}`,
    `class:${input.group.productClass ?? "none"}`,
    `action:${input.group.actionType ?? "none"}`,
    `lote:${input.group.loteId ?? "none"}`,
    `date:${input.scheduledDate}`,
    `start:${input.group.windowStart ?? "none"}`,
    `end:${input.group.windowEnd ?? "none"}`,
    `animals:${input.animalIds.join(",")}`,
  ].join("|");
}

function rejectGroup(
  group: SanitaryPreviewGroup,
  reason: SanitaryAgendaMaterializationRejection["reason"],
): SanitaryAgendaMaterializationRejection {
  return {
    previewGroupId: group.previewGroupId,
    reason,
    sourceDemandKey: group.sourceDemandKey,
  };
}

function commandForGroup(input: {
  group: SanitaryPreviewGroup;
  scheduledDate: string;
  animalIds: readonly string[];
  override?: SanitaryAgendaMaterializationOverride;
}): SanitaryAgendaMaterializationCommand {
  return {
    dedupKey: buildDedupKey(input),
    domain: "sanitario",
    materializationType: "agenda_intent",
    protocolRuleId: input.group.protocolRuleId,
    protocolName: input.group.protocolName,
    protocolItemId: input.group.protocolItemId,
    productId: input.group.productId,
    productName: input.group.productName,
    productClass: input.group.productClass,
    actionType: input.group.actionType,
    loteId: input.group.loteId,
    loteName: input.group.loteName,
    animalIds: [...input.animalIds],
    scheduledDate: input.scheduledDate,
    windowStart: input.group.windowStart,
    windowEnd: input.group.windowEnd,
    responsibleId: input.override?.responsibleId,
    notes: input.override?.notes,
    source: {
      previewGroupId: input.group.previewGroupId,
      sourceDemandKey: input.group.sourceDemandKey,
      sourceType: "SanitaryOperationalPreview",
      materialization: "agenda",
    },
  };
}

function previewGroupsFromInput(
  input: SanitaryAgendaMaterializationInput,
): readonly SanitaryPreviewGroup[] {
  return input.previewGroups ?? input.preview?.groups ?? [];
}

export function createSanitaryAgendaMaterializationCommands(
  input: SanitaryAgendaMaterializationInput,
): SanitaryAgendaMaterializationResult {
  const commands: SanitaryAgendaMaterializationCommand[] = [];
  const rejected: SanitaryAgendaMaterializationRejection[] = [];
  const previewGroups = [...previewGroupsFromInput(input)].sort(comparePreviewGroups);

  for (const group of previewGroups) {
    const animalIds = [...group.actionableAnimalIds].sort();
    const override = input.overridesByPreviewGroupId?.[group.previewGroupId];
    const rawScheduledDate = override?.scheduledDate ?? group.suggestedExecutionDate;
    const scheduledDate = parseValidDateKey(rawScheduledDate);

    if (animalIds.length === 0) {
      rejected.push(rejectGroup(group, "empty_animal_ids"));
      continue;
    }

    if (!rawScheduledDate) {
      rejected.push(rejectGroup(group, "missing_scheduled_date"));
      continue;
    }

    if (!scheduledDate) {
      rejected.push(rejectGroup(group, "invalid_scheduled_date"));
      continue;
    }

    if (
      isOutsideWindow({
        scheduledDate,
        windowStart: group.windowStart,
        windowEnd: group.windowEnd,
      })
    ) {
      rejected.push(rejectGroup(group, "scheduled_date_outside_window"));
      continue;
    }

    commands.push(commandForGroup({ group, scheduledDate, animalIds, override }));
  }

  const sortedCommands = commands.sort(compareCommands);
  const sortedRejected = rejected.sort(compareRejections);

  return {
    commands: sortedCommands,
    rejected: sortedRejected,
    summary: {
      totalPreviewGroups: previewGroups.length,
      commands: sortedCommands.length,
      rejected: sortedRejected.length,
      totalAnimals: sortedCommands.reduce((total, command) => total + command.animalIds.length, 0),
    },
    source: {
      previewSource: "SanitaryOperationalPreview",
      creates: "agenda_intent",
      createsEvent: false,
      createsInventoryMovement: false,
    },
  };
}
