import {
  computeSanitaryEligibility,
  type SanitaryEligibilityAnimal,
  type SanitaryEligibilityLimitation,
  type SanitaryEligibilityProtocolRule,
  type SanitaryEligibilityResult,
  type SanitaryEligibilityStatus,
  type SanitaryEligibilityThresholds,
  type SanitaryExecutedEvent,
} from "../eligibility/sanitaryEligibility";

export type SanitaryDemandAnimal = SanitaryEligibilityAnimal & {
  loteName?: string | null;
};

export type SanitaryDemandRuleMetadata = {
  protocolItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  productClass?: string | null;
  actionType?: string | null;
};

export type SanitaryDemandEligibilityEntry = {
  animal: SanitaryDemandAnimal;
  protocolRule: SanitaryEligibilityProtocolRule;
  eligibility: SanitaryEligibilityResult;
  metadata?: SanitaryDemandRuleMetadata;
};

export type SanitaryDemandStatusSummary = {
  total: number;
  completed: number;
  notApplicable: number;
  insufficientData: number;
  notYetEligible: number;
  eligibleSoon: number;
  inActionWindow: number;
  nearDeadline: number;
  overdue: number;
};

export type SanitaryDemandGroup = {
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

  statusSummary: SanitaryDemandStatusSummary;

  animalIdsByStatus: Record<SanitaryEligibilityStatus, string[]>;

  actionableAnimalIds: string[];

  limitations: SanitaryEligibilityLimitation[];

  source: {
    protocolSource: "SanitaryProtocolRule";
    eligibilitySource: "computeSanitaryEligibility";
    materialization: "none";
  };
};

export type CreateSanitaryDemandGroupsInput = {
  entries: readonly SanitaryDemandEligibilityEntry[];
};

export type ComputeSanitaryDemandGroupsInput = {
  animals: readonly SanitaryDemandAnimal[];
  protocolRules: readonly SanitaryEligibilityProtocolRule[];
  executedEvents: readonly SanitaryExecutedEvent[];
  referenceDate: string;
  thresholds?: SanitaryEligibilityThresholds;
  metadataByProtocolRuleId?: Readonly<Record<string, SanitaryDemandRuleMetadata>>;
};

const STATUSES: readonly SanitaryEligibilityStatus[] = [
  "not_applicable",
  "insufficient_data",
  "not_yet_eligible",
  "eligible_soon",
  "in_action_window",
  "near_deadline",
  "overdue",
  "completed",
];

const SANITARY_ACTIONABLE_STATUSES = new Set<SanitaryEligibilityStatus>([
  "eligible_soon",
  "in_action_window",
  "near_deadline",
  "overdue",
]);

function emptyAnimalIdsByStatus(): Record<SanitaryEligibilityStatus, string[]> {
  return {
    not_applicable: [],
    insufficient_data: [],
    not_yet_eligible: [],
    eligible_soon: [],
    in_action_window: [],
    near_deadline: [],
    overdue: [],
    completed: [],
  };
}

function emptyStatusSummary(): SanitaryDemandStatusSummary {
  return {
    total: 0,
    completed: 0,
    notApplicable: 0,
    insufficientData: 0,
    notYetEligible: 0,
    eligibleSoon: 0,
    inActionWindow: 0,
    nearDeadline: 0,
    overdue: 0,
  };
}

function summaryKeyFor(status: SanitaryEligibilityStatus): keyof SanitaryDemandStatusSummary {
  if (status === "not_applicable") return "notApplicable";
  if (status === "insufficient_data") return "insufficientData";
  if (status === "not_yet_eligible") return "notYetEligible";
  if (status === "eligible_soon") return "eligibleSoon";
  if (status === "in_action_window") return "inActionWindow";
  if (status === "near_deadline") return "nearDeadline";
  return status;
}

function normalizeMetadata(
  protocolRule: SanitaryEligibilityProtocolRule,
  metadata: SanitaryDemandRuleMetadata | undefined,
): Required<SanitaryDemandRuleMetadata> {
  return {
    protocolItemId: metadata?.protocolItemId ?? null,
    productId:
      metadata?.productId ??
      protocolRule.productRequirement?.productId ??
      protocolRule.completionCriteria.compatibleProductId ??
      null,
    productName: metadata?.productName ?? null,
    productClass:
      metadata?.productClass ??
      protocolRule.productRequirement?.classKey ??
      protocolRule.completionCriteria.compatibleProductClass ??
      null,
    actionType: metadata?.actionType ?? null,
  };
}

function groupKey(input: {
  protocolRuleId: string;
  protocolItemId: string | null;
  productId: string | null;
  productClass: string | null;
  actionType: string | null;
  loteId: string | null;
  windowStart: string | undefined;
  windowEnd: string | undefined;
}): string {
  return [
    input.protocolRuleId,
    input.protocolItemId,
    input.productId,
    input.productClass,
    input.actionType,
    input.loteId,
    input.windowStart ?? null,
    input.windowEnd ?? null,
  ].join("\u0001");
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "");
}

function compareGroups(left: SanitaryDemandGroup, right: SanitaryDemandGroup): number {
  return (
    compareOptionalText(left.protocolRuleId, right.protocolRuleId) ||
    compareOptionalText(left.protocolItemId, right.protocolItemId) ||
    compareOptionalText(left.productId, right.productId) ||
    compareOptionalText(left.productClass, right.productClass) ||
    compareOptionalText(left.actionType, right.actionType) ||
    compareOptionalText(left.loteId, right.loteId) ||
    compareOptionalText(left.windowStart, right.windowStart) ||
    compareOptionalText(left.windowEnd, right.windowEnd) ||
    compareOptionalText(left.productName, right.productName) ||
    compareOptionalText(left.loteName, right.loteName)
  );
}

function sortGroup(group: SanitaryDemandGroup): SanitaryDemandGroup {
  const animalIdsByStatus = emptyAnimalIdsByStatus();
  for (const status of STATUSES) {
    animalIdsByStatus[status] = [...group.animalIdsByStatus[status]].sort();
  }

  return {
    ...group,
    animalIdsByStatus,
    actionableAnimalIds: [...group.actionableAnimalIds].sort(),
    limitations: [...group.limitations].sort(),
  };
}

function defineNullable<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | null | undefined,
) {
  if (value !== undefined) {
    target[key] = value ?? null;
  }
}

export function createSanitaryDemandGroupsFromEligibilityResults(
  input: CreateSanitaryDemandGroupsInput,
): SanitaryDemandGroup[] {
  const groups = new Map<string, SanitaryDemandGroup>();

  for (const entry of input.entries) {
    const metadata = normalizeMetadata(entry.protocolRule, entry.metadata);
    const loteId = entry.animal.loteId ?? null;
    const loteName = entry.animal.loteName ?? null;
    const windowStart = entry.eligibility.window?.startDate;
    const windowEnd = entry.eligibility.window?.endDate;
    const key = groupKey({
      protocolRuleId: entry.protocolRule.id,
      protocolItemId: metadata.protocolItemId,
      productId: metadata.productId,
      productClass: metadata.productClass,
      actionType: metadata.actionType,
      loteId,
      windowStart,
      windowEnd,
    });

    let group = groups.get(key);
    if (!group) {
      group = {
        protocolRuleId: entry.protocolRule.id,
        protocolName: entry.protocolRule.name,
        loteId,
        loteName,
        windowStart,
        windowEnd,
        statusSummary: emptyStatusSummary(),
        animalIdsByStatus: emptyAnimalIdsByStatus(),
        actionableAnimalIds: [],
        limitations: [],
        source: {
          protocolSource: "SanitaryProtocolRule",
          eligibilitySource: "computeSanitaryEligibility",
          materialization: "none",
        },
      };
      defineNullable(group, "protocolItemId", metadata.protocolItemId);
      defineNullable(group, "productId", metadata.productId);
      defineNullable(group, "productName", metadata.productName);
      defineNullable(group, "productClass", metadata.productClass);
      defineNullable(group, "actionType", metadata.actionType);
      groups.set(key, group);
    }

    group.statusSummary.total += 1;
    group.statusSummary[summaryKeyFor(entry.eligibility.status)] += 1;
    group.animalIdsByStatus[entry.eligibility.status].push(entry.animal.id);
    if (SANITARY_ACTIONABLE_STATUSES.has(entry.eligibility.status)) {
      group.actionableAnimalIds.push(entry.animal.id);
    }
    for (const limitation of entry.eligibility.limitations) {
      if (!group.limitations.includes(limitation)) {
        group.limitations.push(limitation);
      }
    }
  }

  return Array.from(groups.values()).map(sortGroup).sort(compareGroups);
}

export function computeSanitaryDemandGroups(
  input: ComputeSanitaryDemandGroupsInput,
): SanitaryDemandGroup[] {
  const entries = input.protocolRules.flatMap((protocolRule) =>
    input.animals.map((animal): SanitaryDemandEligibilityEntry => ({
      animal,
      protocolRule,
      metadata: input.metadataByProtocolRuleId?.[protocolRule.id],
      eligibility: computeSanitaryEligibility({
        animal,
        protocolRule,
        executedEvents: input.executedEvents,
        referenceDate: input.referenceDate,
        thresholds: input.thresholds,
      }),
    })),
  );

  return createSanitaryDemandGroupsFromEligibilityResults({ entries });
}
