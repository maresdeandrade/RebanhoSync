import type { SanitaryDemandGroup } from "../demand/sanitaryDemand";

export type SanitaryOperationalPreview = {
  referenceDate: string;
  groups: SanitaryPreviewGroup[];
  blocked: SanitaryPreviewBlockedItem[];
  summary: {
    totalGroups: number;
    actionableGroups: number;
    blockedGroups: number;
    totalAnimals: number;
    actionableAnimals: number;
    blockedAnimals: number;
  };
  source: {
    demandSource: "SanitaryDemandGroup";
    materialization: "none";
  };
};

export type SanitaryPreviewGroup = {
  previewGroupId: string;
  protocolRuleId: string;
  protocolName?: string;
  protocolItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productClass?: string | null;
  actionType?: string | null;
  loteId?: string | null;
  loteName?: string | null;
  windowStart?: string;
  windowEnd?: string;
  suggestedExecutionDate?: string;
  actionableAnimalIds: string[];
  editableFields: {
    executionDate: boolean;
    responsibleId: boolean;
    notes: boolean;
  };
  sourceDemandKey: string;
};

export type SanitaryPreviewBlockedItem = {
  protocolRuleId: string;
  protocolName?: string;
  protocolItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productClass?: string | null;
  actionType?: string | null;
  loteId?: string | null;
  loteName?: string | null;
  windowStart?: string;
  windowEnd?: string;
  reason: "insufficient_data";
  animalIds: string[];
  limitations: string[];
  sourceDemandKey: string;
};

export type CreateSanitaryOperationalPreviewInput = {
  referenceDate: string;
  demandGroups: readonly SanitaryDemandGroup[];
};

const EDITABLE_FIELDS: SanitaryPreviewGroup["editableFields"] = {
  executionDate: true,
  responsibleId: true,
  notes: true,
};

function toDateKey(value: string | null | undefined): string | undefined {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "")?.[1];
}

function compareDateKey(left: string | undefined, right: string | undefined): number {
  return (left ?? "").localeCompare(right ?? "");
}

function stablePart(value: string | null | undefined): string {
  return value ?? "";
}

function sourceDemandKey(group: SanitaryDemandGroup): string {
  return [
    group.protocolRuleId,
    group.protocolItemId ?? null,
    group.productId ?? null,
    group.productClass ?? null,
    group.actionType ?? null,
    group.loteId ?? null,
    group.windowStart ?? null,
    group.windowEnd ?? null,
  ].join("\u0001");
}

function previewGroupId(group: SanitaryDemandGroup): string {
  return [
    "sanitary-preview",
    `protocol:${group.protocolRuleId}`,
    `item:${group.protocolItemId ?? "none"}`,
    `product:${group.productId ?? "none"}`,
    `class:${group.productClass ?? "none"}`,
    `action:${group.actionType ?? "none"}`,
    `lote:${group.loteId ?? "none"}`,
    `start:${group.windowStart ?? "none"}`,
    `end:${group.windowEnd ?? "none"}`,
  ].join("|");
}

function comparePreviewGroups(left: SanitaryPreviewGroup, right: SanitaryPreviewGroup): number {
  return (
    stablePart(left.protocolRuleId).localeCompare(stablePart(right.protocolRuleId)) ||
    stablePart(left.protocolItemId).localeCompare(stablePart(right.protocolItemId)) ||
    stablePart(left.productId).localeCompare(stablePart(right.productId)) ||
    stablePart(left.productClass).localeCompare(stablePart(right.productClass)) ||
    stablePart(left.actionType).localeCompare(stablePart(right.actionType)) ||
    stablePart(left.loteId).localeCompare(stablePart(right.loteId)) ||
    compareDateKey(left.windowStart, right.windowStart) ||
    compareDateKey(left.windowEnd, right.windowEnd) ||
    stablePart(left.productName).localeCompare(stablePart(right.productName)) ||
    stablePart(left.loteName).localeCompare(stablePart(right.loteName))
  );
}

function compareBlockedItems(
  left: SanitaryPreviewBlockedItem,
  right: SanitaryPreviewBlockedItem,
): number {
  return left.sourceDemandKey.localeCompare(right.sourceDemandKey);
}

function suggestedExecutionDate(input: {
  referenceDate: string;
  windowStart?: string;
  windowEnd?: string;
}): string | undefined {
  const referenceDate = toDateKey(input.referenceDate);
  const windowStart = toDateKey(input.windowStart);
  const windowEnd = toDateKey(input.windowEnd);
  if (!referenceDate) return windowStart;

  if (windowStart && referenceDate < windowStart) return windowStart;
  if (windowEnd && referenceDate > windowEnd) return undefined;
  return referenceDate;
}

function copyNullableFields(group: SanitaryDemandGroup): Omit<
  SanitaryPreviewGroup,
  | "previewGroupId"
  | "suggestedExecutionDate"
  | "actionableAnimalIds"
  | "editableFields"
  | "sourceDemandKey"
> {
  return {
    protocolRuleId: group.protocolRuleId,
    protocolName: group.protocolName,
    protocolItemId: group.protocolItemId,
    productId: group.productId,
    productName: group.productName,
    productClass: group.productClass,
    actionType: group.actionType,
    loteId: group.loteId,
    loteName: group.loteName,
    windowStart: group.windowStart,
    windowEnd: group.windowEnd,
  };
}

function actionablePreviewGroup(
  group: SanitaryDemandGroup,
  referenceDate: string,
): SanitaryPreviewGroup | null {
  if (group.actionableAnimalIds.length === 0) return null;

  return {
    previewGroupId: previewGroupId(group),
    ...copyNullableFields(group),
    suggestedExecutionDate: suggestedExecutionDate({
      referenceDate,
      windowStart: group.windowStart,
      windowEnd: group.windowEnd,
    }),
    actionableAnimalIds: [...group.actionableAnimalIds].sort(),
    editableFields: { ...EDITABLE_FIELDS },
    sourceDemandKey: sourceDemandKey(group),
  };
}

function blockedPreviewItem(group: SanitaryDemandGroup): SanitaryPreviewBlockedItem | null {
  const animalIds = group.animalIdsByStatus.insufficient_data;
  if (animalIds.length === 0) return null;

  return {
    protocolRuleId: group.protocolRuleId,
    protocolName: group.protocolName,
    protocolItemId: group.protocolItemId,
    productId: group.productId,
    productName: group.productName,
    productClass: group.productClass,
    actionType: group.actionType,
    loteId: group.loteId,
    loteName: group.loteName,
    windowStart: group.windowStart,
    windowEnd: group.windowEnd,
    reason: "insufficient_data",
    animalIds: [...animalIds].sort(),
    limitations: [...group.limitations].sort(),
    sourceDemandKey: sourceDemandKey(group),
  };
}

export function createSanitaryOperationalPreview(
  input: CreateSanitaryOperationalPreviewInput,
): SanitaryOperationalPreview {
  const groups = input.demandGroups
    .map((group) => actionablePreviewGroup(group, input.referenceDate))
    .filter((group): group is SanitaryPreviewGroup => group !== null)
    .sort(comparePreviewGroups);

  const blocked = input.demandGroups
    .map(blockedPreviewItem)
    .filter((item): item is SanitaryPreviewBlockedItem => item !== null)
    .sort(compareBlockedItems);

  const actionableAnimals = groups.reduce(
    (total, group) => total + group.actionableAnimalIds.length,
    0,
  );
  const blockedAnimals = blocked.reduce((total, item) => total + item.animalIds.length, 0);

  return {
    referenceDate: input.referenceDate,
    groups,
    blocked,
    summary: {
      totalGroups: groups.length + blocked.length,
      actionableGroups: groups.length,
      blockedGroups: blocked.length,
      totalAnimals: actionableAnimals + blockedAnimals,
      actionableAnimals,
      blockedAnimals,
    },
    source: {
      demandSource: "SanitaryDemandGroup",
      materialization: "none",
    },
  };
}
