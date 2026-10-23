import {
  formatSanitaryProtocolItemLabelV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";
import { isSanitaryClassSchemeV2, sanitaryClassHistoryMatchesV2 } from "../agenda/sanitaryClassSchemeV2";

export type SanitaryProtocolPrecheckScopeV2 = "animal" | "lote";

export type SanitaryPrecheckAnimalResumoV2 = {
  id: string;
  especie?: "bovino" | "bubalino" | string | null;
  sexo?: "macho" | "femea" | "M" | "F" | string | null;
  nascimento?: string | null;
  categoria?: string | null;
  lifeStage?: string | null;
  aptidao?: string | null;
  fazendaId: string;
  uf?: string | null;
  riskArea?: boolean | null;
  regionalRiskArea?: boolean | null;
  riskContext?: boolean | null;
  pregnancyOrPeripartumContext?: boolean | null;
  sanitaryCadence?: "annual" | "semiannual" | null;
  managementContext?:
    | "pre_weaning"
    | "rearing"
    | "pre_feedlot"
    | "deferred_pasture"
    | null;
  maternalVaccination?: { status: "vaccinated" | "unvaccinated"; evidenceReference: string } | null;
  rabiesManualPlanning?: boolean;
};

export type SanitaryPrecheckLoteResumoV2 = {
  id: string;
  fazendaId: string;
  animalIds?: string[];
  categoria?: string | null;
  riskArea?: boolean | null;
};

export type SanitaryExecutedHistoryEventV2 = {
  eventId: string;
  protocolId?: string;
  familyCode?: string;
  itemKey?: string;
  productClass?: string | null;
  productId?: string | null;
  productName?: string | null;
  classSchemeCoverageId?: string | null;
  doseQuantity?: number | null;
  doseUnit?: string | null;
  route?: string | null;
  responsibleName?: string | null;
  stockStatus?: "with_movement" | "without_movement" | "not_applicable";
  withdrawalStatus?: "generated" | "without_rule" | "not_applicable";
  originLabel?: string | null;
  executedAt: string;
  source:
    | "event"
    | "internal_execution"
    | "external_documented"
    | "external_declared"
    | "legacy_import";
  evidenceClass?: "documented" | "declared" | "unknown";
  evidenceReference?: string | null;
  evidenceCoveredFields?: string[];
  dateApproximate?: boolean;
};

export type SanitaryExecutedHistoryV2 = {
  animalId: string;
  events: SanitaryExecutedHistoryEventV2[];
};

// A compatible maternal vaccination before birth is positive factual evidence.
// No matching event never proves that the mother was unvaccinated.
export function readMaternalVaccinationEvidenceV2(input: {
  motherId?: string | null; birthDate?: string | null; item: SanitaryProtocolItemV2ReadModel;
  history: readonly SanitaryExecutedHistoryV2[];
}): SanitaryPrecheckAnimalResumoV2["maternalVaccination"] {
  if (!input.motherId || !parseDateKey(input.birthDate ?? "") || !isSanitaryClassSchemeV2(input.item)) return null;
  const event = input.history.find(entry => entry.animalId === input.motherId)?.events.find(entry =>
    isDocumentedHistorySource(entry) && !entry.dateApproximate && parseDateKey(entry.executedAt) &&
    entry.executedAt.slice(0, 10) <= input.birthDate!.slice(0, 10) && sanitaryClassHistoryMatchesV2(input.item, entry));
  return event ? { status: "vaccinated", evidenceReference: `event:${event.eventId}` } : null;
}

export type SanitaryHistoryRequirementKindV2 =
  | "previous_dose"
  | "previous_execution";

export type SanitaryProtocolPrecheckResultV2 = {
  protocolId: string;
  familyCode: string;
  protocolName: string;
  itemKey: string;
  itemLabel: string;
  productRequirementKind: string;
  productClass: string | null;
  productClassGroupId: string | null;
  productClassGroupName: string | null;
  status: SanitaryEligibilityStatus;
  reasons: string[];
  blockers: string[];
  warnings: string[];
  historyRequirementKind: SanitaryHistoryRequirementKindV2 | null;
  missingExecutedHistory: boolean;
  documentaryPending: boolean;
  documentaryPendingReasons: string[];
  createsAgenda: false;
  createsEvent: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
};

export type SanitaryProtocolPrecheckV2 = {
  animalOrLotId: string;
  scope: SanitaryProtocolPrecheckScopeV2;
  evaluatedAt: string;
  results: SanitaryProtocolPrecheckResultV2[];
};

export type PrecheckSanitaryProtocolsForAnimalV2Input = {
  scope: "animal";
  animal: SanitaryPrecheckAnimalResumoV2;
  catalog: SanitaryProtocolCatalogReadModelV2;
  executedHistory?: SanitaryExecutedHistoryV2[];
  today: string;
};

export type PrecheckSanitaryProtocolsForLotV2Input = {
  scope: "lote";
  lote: SanitaryPrecheckLoteResumoV2;
  animals?: SanitaryPrecheckAnimalResumoV2[];
  catalog: SanitaryProtocolCatalogReadModelV2;
  executedHistory?: SanitaryExecutedHistoryV2[];
  today: string;
};

export type PrecheckSanitaryProtocolsV2Input =
  | PrecheckSanitaryProtocolsForAnimalV2Input
  | PrecheckSanitaryProtocolsForLotV2Input;

const MS_PER_DAY = 86_400_000;

const OPERATIONAL_FALSE_FLAGS = {
  createsAgenda: false,
  createsEvent: false,
  createsStockMovement: false,
  createsActiveWithdrawal: false,
} as const;

type ResolvedHistoryRequirementV2 = {
  kind: SanitaryHistoryRequirementKindV2;
  previousItemKey: string | null;
};

const HISTORY_DEPENDENT_RECURRENCE_KINDS = new Set([
  "annual",
  "annual_if_risk_area",
  "annual_or_semester_by_risk",
]);

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? null;
}

function parseDateKey(value: string | null | undefined): Date | null {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === dateKey ? date : null;
}

function monthsBetween(fromDate: string, toDate: string): number | null {
  const from = parseDateKey(fromDate);
  const to = parseDateKey(toDate);
  if (!from || !to) return null;

  const rawMonths =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? rawMonths - 1 : rawMonths;
}

function daysBetween(fromDate: string, toDate: string): number | null {
  const from = parseDateKey(fromDate);
  const to = parseDateKey(toDate);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function normalizeSex(
  value: string | null | undefined,
): "femea" | "macho" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "f" || normalized === "femea" || normalized === "fêmea") {
    return "femea";
  }
  if (normalized === "m" || normalized === "macho") return "macho";
  return null;
}

function normalizeToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRecurrenceKind(
  item: SanitaryProtocolItemV2ReadModel,
): string | null {
  return readString(readRecord(item.boosterRule.recurrenceRule).kind);
}

function resolveHistoryRequirement(
  item: SanitaryProtocolItemV2ReadModel,
  catalogItems: SanitaryProtocolItemV2ReadModel[],
): ResolvedHistoryRequirementV2 | null {
  const explicitPreviousItemKey =
    readString(item.eligibilityRule.requires_previous_dose) ??
    readString(item.boosterRule.previous_logical_item_key);
  // A reviewed class booster follows either completed primary series or its own last booster.
  if (isSanitaryClassSchemeV2(item) && readRecurrenceKind(item) === "annual") {
    return { kind: "previous_execution", previousItemKey: null };
  }
  if (explicitPreviousItemKey) {
    return { kind: "previous_dose", previousItemKey: explicitPreviousItemKey };
  }

  const recurrenceKind = readRecurrenceKind(item);
  const windowAnchor = readString(item.operationalWindowRule.anchor);
  if (
    recurrenceKind === "primovaccination_dose_2" ||
    windowAnchor === "previous_dose"
  ) {
    const previousDose = catalogItems.find(
      (candidate) =>
        candidate.protocolId === item.protocolId &&
        readRecurrenceKind(candidate) === "primovaccination_dose_1",
    );
    return {
      kind: "previous_dose",
      previousItemKey: previousDose?.logicalItemKey ?? null,
    };
  }

  if (
    windowAnchor === "last_execution" ||
    (recurrenceKind !== null &&
      HISTORY_DEPENDENT_RECURRENCE_KINDS.has(recurrenceKind))
  ) {
    return { kind: "previous_execution", previousItemKey: null };
  }

  return null;
}

function isDocumentedHistorySource(
  event: SanitaryExecutedHistoryEventV2,
): boolean {
  const hasLinkedEvidence = Boolean(event.evidenceReference?.trim());
  const coversProtocolItem =
    event.evidenceCoveredFields?.includes("protocol_item_completion") ?? false;
  return (
    event.source === "event" ||
    event.source === "internal_execution" ||
    (event.source === "external_documented" &&
      event.evidenceClass === "documented" &&
      hasLinkedEvidence &&
      coversProtocolItem) ||
    (event.source === "legacy_import" &&
      event.evidenceClass === "documented" &&
      hasLinkedEvidence &&
      coversProtocolItem)
  );
}

function isDeclaredHistorySource(
  event: SanitaryExecutedHistoryEventV2,
): boolean {
  return (
    event.source === "external_declared" ||
    event.evidenceClass === "declared" ||
    (event.source === "legacy_import" && !isDocumentedHistorySource(event))
  );
}

export function readSanitaryPlanningHistoryV2(input: {
  catalog: SanitaryProtocolCatalogReadModelV2; protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel; animalId: string;
  history: SanitaryExecutedHistoryV2[]; today: string;
}) {
  const requirement = resolveHistoryRequirement(input.item, input.catalog.items);
  const common = { history: input.history, animalId: input.animalId,
    protocolId: input.protocol.id, familyCode: input.protocol.familyCode, today: input.today };
  const anchor = requirement ? findRequiredExecutedHistory({ ...common, requirement, productId: input.item.productId, item: input.item }) : null;
  const completion = findCompatibleHistoryEvents({ ...common, itemKey: input.item.logicalItemKey })
    .find((event) => isDocumentedHistorySource(event) && !event.dateApproximate && (!input.item.productId || event.productId === input.item.productId) && sanitaryClassHistoryMatchesV2(input.item, event));
  return { anchor, completion, requirement, completedInitial: !requirement && Boolean(completion) };
}

function findCompatibleHistoryEvents(input: {
  history: SanitaryExecutedHistoryV2[];
  animalId: string;
  protocolId: string;
  familyCode: string;
  itemKey?: string;
  today: string;
}): SanitaryExecutedHistoryEventV2[] {
  const animalHistory = input.history.find(
    (entry) => entry.animalId === input.animalId,
  );
  if (!animalHistory) return [];

  return animalHistory.events
    .filter((event) => {
      if (!event.familyCode || !event.itemKey) return false;
      if (event.familyCode !== input.familyCode) return false;
      if (event.protocolId && event.protocolId !== input.protocolId)
        return false;
      if (input.itemKey && event.itemKey !== input.itemKey) return false;
      const daysSinceExecution = daysBetween(event.executedAt, input.today);
      return daysSinceExecution !== null && daysSinceExecution >= 0;
    })
    .sort((left, right) => right.executedAt.localeCompare(left.executedAt));
}

function findRequiredExecutedHistory(input: {
  requirement: ResolvedHistoryRequirementV2;
  history: SanitaryExecutedHistoryV2[];
  animalId: string;
  protocolId: string;
  familyCode: string;
  today: string;
  productId?: string | null;
  item: SanitaryProtocolItemV2ReadModel;
}): SanitaryExecutedHistoryEventV2 | null {
  if (
    input.requirement.kind === "previous_dose" &&
    !input.requirement.previousItemKey
  ) {
    return null;
  }

  const animalHistory = input.history.find(
    (entry) => entry.animalId === input.animalId,
  );
  if (!animalHistory) return null;

  const compatibleEvents = animalHistory.events
    .filter((event) => {
      if (input.productId && event.productId !== input.productId) return false;
      if (!sanitaryClassHistoryMatchesV2(input.item, event)) return false;
      if (!isDocumentedHistorySource(event)) return false;
      if (event.dateApproximate) return false;
      if (!event.familyCode || !event.itemKey) return false;
      if (event.familyCode !== input.familyCode) return false;
      if (event.protocolId && event.protocolId !== input.protocolId)
        return false;
      if (
        input.requirement.previousItemKey &&
        event.itemKey !== input.requirement.previousItemKey
      ) {
        return false;
      }
      const daysSinceExecution = daysBetween(event.executedAt, input.today);
      return daysSinceExecution !== null && daysSinceExecution >= 0;
    })
    .sort((left, right) => right.executedAt.localeCompare(left.executedAt));

  return compatibleEvents[0] ?? null;
}

function readRequiredSpecies(item: SanitaryProtocolItemV2ReadModel): string[] {
  return readStringArray(item.eligibilityRule.species).map((entry) =>
    entry.trim().toLowerCase(),
  );
}

function protocolIsBlocked(protocol: SanitaryProtocolV2ReadModel): boolean {
  return (
    protocol.familyCode === "febre_aftosa" ||
    protocol.status === "retired" ||
    protocol.legalStatus === "bloqueado"
  );
}

function hasRiskAreaInfo(animal: SanitaryPrecheckAnimalResumoV2): boolean {
  return animal.riskArea !== undefined || animal.regionalRiskArea !== undefined;
}

function resolveRiskArea(
  animal: SanitaryPrecheckAnimalResumoV2,
): boolean | null {
  if (animal.riskArea !== undefined) return animal.riskArea;
  if (animal.regionalRiskArea !== undefined) return animal.regionalRiskArea;
  return null;
}

function baseResult(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  status: SanitaryEligibilityStatus;
  reasons?: string[];
  blockers?: string[];
  warnings?: string[];
  historyRequirementKind?: SanitaryHistoryRequirementKindV2 | null;
  missingExecutedHistory?: boolean;
  documentaryPending?: boolean;
  documentaryPendingReasons?: string[];
}): SanitaryProtocolPrecheckResultV2 {
  return {
    protocolId: input.protocol.id,
    familyCode: input.protocol.familyCode,
    protocolName: input.protocol.name,
    itemKey: input.item.logicalItemKey,
    itemLabel: formatSanitaryProtocolItemLabelV2(input.item.logicalItemKey),
    productRequirementKind: input.item.productRequirementKind,
    productClass: input.item.productClass,
    productClassGroupId: input.item.productClassGroupId,
    productClassGroupName: null,
    status: input.status,
    reasons: input.reasons ?? [],
    blockers: input.blockers ?? [],
    warnings: [
      ...(input.warnings ?? []),
      ...(input.item.allowsAgendaAuto
        ? ["Catálogo sanitário v2 não cria agenda nesta pré-checagem."]
        : []),
    ],
    historyRequirementKind: input.historyRequirementKind ?? null,
    missingExecutedHistory: input.missingExecutedHistory ?? false,
    documentaryPending: input.documentaryPending ?? false,
    documentaryPendingReasons: input.documentaryPendingReasons ?? [],
    ...OPERATIONAL_FALSE_FLAGS,
  };
}

function resolveHistoryWindowDays(input: {
  item: SanitaryProtocolItemV2ReadModel;
  requirement: ResolvedHistoryRequirementV2;
  cadence?: SanitaryPrecheckAnimalResumoV2["sanitaryCadence"];
  anchorDate?: string;
}): { minDays: number; maxDays: number } | null {
  if (input.requirement.kind === "previous_dose") {
    const minDays = readNumber(
      input.item.operationalWindowRule.min_offset_days,
    );
    const maxDays = readNumber(
      input.item.operationalWindowRule.max_offset_days,
    );
    return minDays !== null && maxDays !== null && maxDays >= minDays
      ? { minDays, maxDays }
      : null;
  }

  const recurrenceKind = readRecurrenceKind(input.item);
  if (recurrenceKind === "annual_or_semester_by_risk") {
    if (!input.cadence) return null;
    const intervalDays = input.cadence === "semiannual" ? 182 : 365;
    const toleranceDays =
      readNumber(readRecord(input.item.boosterRule.tolerance).days) ?? 0;
    return {
      minDays: intervalDays - toleranceDays,
      maxDays: intervalDays + toleranceDays,
    };
  }
  if (recurrenceKind !== "annual" && recurrenceKind !== "annual_if_risk_area") {
    return null;
  }
  const toleranceDays =
    readNumber(readRecord(input.item.boosterRule.tolerance).days) ?? 0;
  if (isSanitaryClassSchemeV2(input.item) && input.anchorDate) {
    const anchor = parseDateKey(input.anchorDate);
    if (!anchor) return null;
    const anniversary = new Date(anchor);
    anniversary.setUTCDate(1);
    anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
    const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate();
    anniversary.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
    const interval = daysBetween(input.anchorDate, anniversary.toISOString().slice(0, 10));
    if (interval === null) return null;
    return { minDays: interval - toleranceDays, maxDays: interval + toleranceDays };
  }
  return {
    minDays: 365 - toleranceDays,
    maxDays: 365 + toleranceDays,
  };
}

function evaluateHistoryRequirement(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  requirement: ResolvedHistoryRequirementV2 | null;
  history: SanitaryExecutedHistoryV2[];
  today: string;
}): SanitaryProtocolPrecheckResultV2 | null {
  if (!input.requirement) return null;

  if (
    readRecurrenceKind(input.item) === "annual_or_semester_by_risk" &&
    input.animal.sanitaryCadence === null
  ) {
    return baseResult({
      protocol: input.protocol,
      item: input.item,
      status: "insufficient_data",
      reasons: ["Cadência sanitária anual ou semestral não informada."],
      warnings: [
        "Contexto operacional não substitui fonte técnica nem execução.",
      ],
      historyRequirementKind: input.requirement.kind,
      missingExecutedHistory: false,
    });
  }

  const historyEvent = findRequiredExecutedHistory({
    requirement: input.requirement,
    history: input.history,
    animalId: input.animal.id,
    protocolId: input.protocol.id,
    familyCode: input.protocol.familyCode,
    today: input.today,
    productId: input.item.productId,
    item: input.item,
  });

  if (!historyEvent) {
    return baseResult({
      protocol: input.protocol,
      item: input.item,
      status: "insufficient_data",
      reasons: [
        input.requirement.kind === "previous_dose"
          ? "Dose anterior não informada."
          : "Histórico sanitário anterior necessário para avaliar este reforço.",
      ],
      warnings: ["Dados insuficientes para planejar esta etapa."],
      historyRequirementKind: input.requirement.kind,
      missingExecutedHistory: true,
    });
  }

  const window = resolveHistoryWindowDays({
    item: input.item,
    requirement: input.requirement,
    cadence: input.animal.sanitaryCadence,
    anchorDate: historyEvent.executedAt,
  });
  const elapsedDays = daysBetween(historyEvent.executedAt, input.today);
  if (!window || elapsedDays === null) {
    return baseResult({
      protocol: input.protocol,
      item: input.item,
      status: "insufficient_data",
      reasons: [
        "Histórico executado existe, mas a janela desta etapa está incompleta.",
      ],
      warnings: ["Dados insuficientes para planejar esta etapa."],
      historyRequirementKind: input.requirement.kind,
      missingExecutedHistory: false,
    });
  }

  let status: SanitaryEligibilityStatus;
  let reason: string;
  if (elapsedDays < window.minDays) {
    const daysUntilWindow = window.minDays - elapsedDays;
    status = daysUntilWindow <= 7 ? "eligible_soon" : "not_yet_eligible";
    reason = `Janela calculada pelo histórico abre em ${daysUntilWindow} dia(s).`;
  } else if (elapsedDays > window.maxDays) {
    status = "overdue";
    reason = "Janela calculada pelo histórico executado já foi ultrapassada.";
  } else if (
    window.maxDays > window.minDays &&
    window.maxDays - elapsedDays <= 7
  ) {
    status = "near_deadline";
    reason = "Etapa próxima do limite calculado pelo histórico executado.";
  } else {
    status = "in_action_window";
    reason = "Etapa dentro da janela calculada pelo histórico executado.";
  }

  return baseResult({
    protocol: input.protocol,
    item: input.item,
    status,
    reasons: [reason],
    warnings: ["Produto real continua obrigatório somente na execução."],
    historyRequirementKind: input.requirement.kind,
    missingExecutedHistory: false,
  });
}

function evaluateSpecies(
  animal: SanitaryPrecheckAnimalResumoV2,
  item: SanitaryProtocolItemV2ReadModel,
): SanitaryEligibilityStatus | null {
  const requiredSpecies = readRequiredSpecies(item);
  if (requiredSpecies.length === 0) return null;

  const species = normalizeToken(animal.especie);
  if (!species) return "insufficient_data";
  return requiredSpecies.includes(species) ? null : "not_applicable";
}

function evaluateB19Jurisdiction(
  protocol: SanitaryProtocolV2ReadModel,
  item: SanitaryProtocolItemV2ReadModel,
  animal: SanitaryPrecheckAnimalResumoV2,
): SanitaryProtocolPrecheckResultV2 | null {
  const uf = animal.uf?.trim().toUpperCase();
  const excluded = ["SC", ...readStringArray(protocol.metadata.excluded_ufs), ...readStringArray(item.eligibilityRule.excluded_ufs)].map((value) => value.toUpperCase());
  if (!uf) return baseResult({ protocol, item, status: "insufficient_data",
    blockers: ["UF ausente para verificar exceções e proibições regionais de B19."],
  });
  if (excluded.includes(uf)) return baseResult({ protocol, item, status: "not_applicable",
    blockers: ["B19 não autorizada na UF conforme fonte oficial regional do catálogo."],
  });
  return null;
}

type B19PrecheckInput = {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  executedHistory: SanitaryExecutedHistoryV2[];
};

function evaluateAdultB19History(
  input: B19PrecheckInput,
  jurisdictionBlock: SanitaryProtocolPrecheckResultV2 | null,
): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, executedHistory } = input;
  const jurisdictionBlockers = jurisdictionBlock?.blockers ?? [];
  const compatibleHistory = findCompatibleHistoryEvents({
    history: executedHistory,
    animalId: animal.id,
    protocolId: protocol.id,
    familyCode: protocol.familyCode,
    itemKey: item.logicalItemKey,
    today,
  });
  const documentedHistory = compatibleHistory.find(isDocumentedHistorySource);
  if (documentedHistory) {
    return baseResult({
      protocol,
      item,
      status: "completed",
      reasons: [
        "B19 comprovada por histórico sanitário documentado anterior.",
      ],
      warnings: [
        "Histórico anterior não registra execução da fazenda nem movimenta estoque.",
        ...jurisdictionBlockers,
      ],
    });
  }
  if (jurisdictionBlock?.status === "not_applicable") return jurisdictionBlock;
  const declaredHistory = compatibleHistory.find(isDeclaredHistorySource);
  if (declaredHistory) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: [
        "B19 informada apenas por declaração sem documento suficiente.",
      ],
      blockers: jurisdictionBlockers,
      warnings: [
        "Declaração sem documento pode não liberar pendências críticas.",
      ],
      documentaryPending: true,
      documentaryPendingReasons: [
        "Fêmea adulta exige comprovação documental de B19.",
      ],
    });
  }
  return baseResult({
    protocol,
    item,
    status: "insufficient_data",
    reasons: ["Fêmea adulta sem comprovação documental de B19."],
    blockers: jurisdictionBlockers,
    warnings: [
      "Não planejar vacinação B19 fora da janela sem comprovação técnica.",
    ],
    documentaryPending: true,
    documentaryPendingReasons: [
      "Fêmea adulta exige comprovação documental de B19.",
    ],
  });
}

function evaluateB19Species(animal: SanitaryPrecheckAnimalResumoV2, item: SanitaryProtocolItemV2ReadModel) {
  if (!animal.especie) return "insufficient_data" as const;
  if (!["bovino", "bubalino"].includes(normalizeToken(animal.especie)!)) return "not_applicable" as const;
  return evaluateSpecies(animal, item);
}

function evaluateB19Completion(input: B19PrecheckInput) {
  const { protocol, item, animal, today } = input;
  const prior = findCompatibleHistoryEvents({ history: input.executedHistory, animalId: animal.id,
    protocolId: protocol.id, familyCode: protocol.familyCode, itemKey: item.logicalItemKey, today });
  if (prior.some(isDocumentedHistorySource)) {
    return baseResult({ protocol, item, status: "completed", reasons: ["B19 já comprovada por Evento/histórico documentado."] });
  }
  if (prior.length) {
    return baseResult({ protocol, item, status: "insufficient_data", documentaryPending: true,
      documentaryPendingReasons: ["Conferir comprovação de B19 antes de planejar nova vacinação."] });
  }
  return null;
}

function evaluateB19(input: B19PrecheckInput): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today } = input;
  const jurisdictionBlock = evaluateB19Jurisdiction(protocol, item, animal);
  const speciesStatus = evaluateB19Species(animal, item);
  if (speciesStatus) {
    return baseResult({
      protocol,
      item,
      status: speciesStatus,
      reasons:
        speciesStatus === "insufficient_data"
          ? ["Espécie ausente para avaliar B19."]
          : ["B19 se aplica apenas às espécies previstas na regra."],
    });
  }

  const sex = normalizeSex(animal.sexo);
  if (!sex) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Sexo ausente para avaliar B19."],
    });
  }
  if (sex !== "femea") {
    return baseResult({
      protocol,
      item,
      status: "not_applicable",
      reasons: ["B19 se aplica a fêmeas bovinas/bubalinas."],
    });
  }

  const birthDate = toDateKey(animal.nascimento);
  if (!birthDate) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Nascimento ausente para calcular janela B19."],
    });
  }

  const ageMonths = monthsBetween(birthDate, today);
  if (ageMonths === null) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Data de nascimento inválida para calcular janela B19."],
    });
  }

  if (ageMonths <= 8 && jurisdictionBlock) return jurisdictionBlock;
  if (ageMonths < 3) {
    return baseResult({
      protocol,
      item,
      status: "not_yet_eligible",
      reasons: ["Animal ainda abaixo da janela B19 de 3 a 8 meses."],
      warnings: [
        "Exige MV cadastrado no SVE, registro oficial e produto real na execução.",
      ],
    });
  }
  if (ageMonths > 8) return evaluateAdultB19History(input, jurisdictionBlock);

  const completion = evaluateB19Completion(input);
  if (completion) return completion;

  return baseResult({
    protocol,
    item,
    status: "in_action_window",
    reasons: ["Fêmea bovina/bubalina dentro da janela B19 de 3 a 8 meses."],
    warnings: [
      "Exige MV cadastrado no SVE, registro oficial e produto real na execução.",
    ],
  });
}

function evaluateRaiva(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  historyRequirement: ResolvedHistoryRequirementV2 | null;
  executedHistory: SanitaryExecutedHistoryV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, historyRequirement, executedHistory } =
    input;
  const speciesStatus = evaluateSpecies(animal, item);
  if (speciesStatus) {
    return baseResult({
      protocol,
      item,
      status: speciesStatus,
      reasons:
        speciesStatus === "insufficient_data"
          ? ["Espécie ausente para avaliar raiva."]
          : ["Raiva dos herbívoros se aplica apenas às espécies previstas."],
    });
  }

  if (!animal.rabiesManualPlanning && !hasRiskAreaInfo(animal)) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: [
        "Protocolo de raiva depende de dado regional/de área de risco.",
      ],
      warnings: ["A pré-checagem não infere área de risco."],
    });
  }

  if (!animal.rabiesManualPlanning && resolveRiskArea(animal) !== true) {
    return baseResult({
      protocol,
      item,
      status: "not_applicable",
      reasons: ["Animal sem indicação explícita de área de risco."],
    });
  }

  const historyResult = evaluateHistoryRequirement({
    protocol,
    item,
    animal,
    requirement: historyRequirement,
    history: executedHistory,
    today,
  });
  if (historyResult) return historyResult;

  return baseResult({
    protocol,
    item,
    status: "in_action_window",
    reasons: [animal.rabiesManualPlanning ? "Consulta e planejamento manual; não presume obrigatoriedade regional." : "Área de risco informada explicitamente para avaliação técnica."],
    warnings: [
      "Produto real e avaliação técnica continuam obrigatórios na execução.",
    ],
  });
}

type SanitaryItemEvaluationInputV2 = {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  historyRequirement: ResolvedHistoryRequirementV2 | null;
  executedHistory: SanitaryExecutedHistoryV2[];
};

function evaluateAntiparasitic(input: SanitaryItemEvaluationInputV2): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, historyRequirement, executedHistory } =
    input;
  const prerequisite = evaluateItemPrerequisites(input);
  if (prerequisite) return prerequisite;

  const requiredManagement = (() => {
    if (protocol.familyCode === "vermifugacao_pre_desmama") {
      return ["pre_weaning"];
    }
    if (protocol.familyCode === "controle_parasitario_recria_5_7_9") {
      return ["rearing"];
    }
    if (protocol.familyCode === "vermifugacao_pre_confinamento_pasto_vedado") {
      return ["pre_feedlot", "deferred_pasture"];
    }
    return null;
  })();
  if (requiredManagement && animal.managementContext === null) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Manejo necessário para avaliar este item não informado."],
      warnings: [
        "Contexto operacional não substitui produto, dose nem carência.",
      ],
    });
  }
  if (
    requiredManagement &&
    animal.managementContext &&
    !requiredManagement.includes(animal.managementContext)
  ) {
    return baseResult({
      protocol,
      item,
      status: "not_applicable",
      reasons: ["Manejo informado não corresponde à condição deste item."],
      warnings: [
        "Grupo técnico de produtos não valida execução, dose nem carência.",
      ],
    });
  }

  if (
    readBoolean(item.eligibilityRule.requires_pregnancy_or_peripartum_context)
  ) {
    if (animal.pregnancyOrPeripartumContext !== true) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: ["Pré-parto exige contexto gestacional/periparto explícito."],
        warnings: [
          "Grupo técnico de produtos não valida execução, dose nem carência.",
        ],
      });
    }
  }

  const historyResult = evaluateHistoryRequirement({
    protocol,
    item,
    animal,
    requirement: historyRequirement,
    history: executedHistory,
    today,
  });
  if (historyResult) return historyResult;

  const months = Array.isArray(item.operationalWindowRule.calendar_months)
    ? item.operationalWindowRule.calendar_months
    : [];
  if (months.length > 0) {
    const date = parseDateKey(today);
    if (!date) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: [
          "Data de referência inválida para avaliar janela de calendário.",
        ],
        warnings: [
          "Grupo técnico de produtos não valida execução, dose nem carência.",
        ],
      });
    }
    const currentMonth = date.getUTCMonth() + 1;
    const monthNumbers = months.filter(
      (entry): entry is number => typeof entry === "number",
    );
    return baseResult({
      protocol,
      item,
      status: monthNumbers.includes(currentMonth)
        ? "in_action_window"
        : "not_yet_eligible",
      reasons: monthNumbers.includes(currentMonth)
        ? ["Mês atual dentro da janela estratégica do item."]
        : ["Mês atual fora da janela estratégica do item."],
      warnings: [
        "Grupo técnico de produtos não valida execução, dose nem carência.",
        "Produto real obrigatório na execução.",
      ],
    });
  }

  return baseResult({
    protocol,
    item,
    status: "in_action_window",
    reasons: [
      "Item antiparasitário avaliável tecnicamente com os dados informados.",
    ],
    warnings: [
      "Grupo técnico de produtos não valida execução, dose nem carência.",
      "Produto real obrigatório na execução.",
    ],
  });
}

function genericSpeciesReasons(status: SanitaryEligibilityStatus) {
  return status === "insufficient_data" ? ["Espécie ausente para avaliar item do catálogo."] : ["Espécie fora da regra do item."];
}

function evaluateItemPrerequisites(input: {
  protocol: SanitaryProtocolV2ReadModel; item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2; today: string;
}) {
  const failure = evaluateGenericEligibilityContext(input.item, input.animal, input.today);
  const status = failure?.status ?? evaluateSpecies(input.animal, input.item);
  if (!status) return null;
  return baseResult({ protocol: input.protocol, item: input.item, status,
    reasons: failure?.reasons ?? genericSpeciesReasons(status) });
}

function evaluateGenericItem(input: SanitaryItemEvaluationInputV2): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, historyRequirement, executedHistory } =
    input;
  const prerequisite = evaluateItemPrerequisites(input);
  if (prerequisite) return prerequisite;

  const historyResult = evaluateHistoryRequirement({
    protocol,
    item,
    animal,
    requirement: historyRequirement,
    history: executedHistory,
    today,
  });
  if (historyResult) return historyResult;

  const productWarnings =
    item.productRequirementKind === "product_class_group"
      ? [
          "Grupo técnico de produtos não valida execução, dose nem carência.",
          "Produto real obrigatório na execução.",
        ]
      : item.productRequirementKind === "product_class"
        ? [
            "Produto real obrigatório na execução.",
            "Carência depende do produto executado.",
          ]
        : item.productRequirementKind === "none"
          ? ["Item sem produto executável."]
          : ["Produto específico deve ser confirmado na execução."];

  return baseResult({
    protocol,
    item,
    status: "in_action_window",
    reasons: ["Item avaliável tecnicamente pelo catálogo read-only."],
    warnings: [
      ...productWarnings,
      "Pré-checagem não cria agenda nem autoriza execução.",
    ],
  });
}

function evaluateAgeContext(
  item: SanitaryProtocolItemV2ReadModel, animal: SanitaryPrecheckAnimalResumoV2, today: string,
): { status: SanitaryEligibilityStatus; reasons: string[] } | null {
  const min = readNumber(item.eligibilityRule.age_min_months);
  const max = readNumber(item.eligibilityRule.age_max_months);
  if ([min, max].every((value) => value === null)) return null;
  const age = monthsBetween(animal.nascimento ?? "", today);
  if (age === null) return { status: "insufficient_data", reasons: ["Nascimento válido obrigatório para avaliar idade do esquema."] };
  if (age < (min ?? 0)) return { status: "not_yet_eligible", reasons: ["Idade abaixo do mínimo do esquema."] };
  if (age > (max ?? Infinity)) return { status: "not_applicable", reasons: ["Idade acima do máximo do esquema."] };
  return null;
}

function matchesSanitaryCategory(required: string, animal: SanitaryPrecheckAnimalResumoV2) {
  const category = normalizeToken(animal.categoria);
  if (required === "recria") return animal.lifeStage === "recria" || category === "recria";
  if (required === "bezerro") return category === "bezerro" || category === "bezerra";
  return category === normalizeToken(required);
}

function evaluateSexContext(item: SanitaryProtocolItemV2ReadModel, animal: SanitaryPrecheckAnimalResumoV2): { status: SanitaryEligibilityStatus; reasons: string[] } | null {
  const required = normalizeSex(readString(item.eligibilityRule.sex));
  if (!required) return null;
  const sex = normalizeSex(animal.sexo);
  if (!sex) return { status: "insufficient_data", reasons: ["Sexo necessário para esta regra."] };
  return sex === required ? null : { status: "not_applicable", reasons: ["Sexo fora da regra do item."] };
}

function evaluateGenericEligibilityContext(
  item: SanitaryProtocolItemV2ReadModel, animal: SanitaryPrecheckAnimalResumoV2, today: string,
): { status: SanitaryEligibilityStatus; reasons: string[] } | null {
  const ageFailure = evaluateAgeContext(item, animal, today);
  if (ageFailure) return ageFailure;
  const maternalFailure = evaluateMaternalAgeContext(item, animal, today);
  if (maternalFailure) return maternalFailure;
  const sexFailure = evaluateSexContext(item, animal);
  if (sexFailure) return sexFailure;
  if (item.eligibilityRule.requires_risk_context === true && animal.riskContext !== true)
    return { status: "insufficient_data", reasons: ["Contexto de risco sanitário deste item não confirmado."] };
  return evaluateCategoryContext(item, animal);
}

// Opt-in by item version. Unknown maternal history is never a negative history.
function evaluateMaternalAgeContext(
  item: SanitaryProtocolItemV2ReadModel, animal: SanitaryPrecheckAnimalResumoV2, today: string,
): { status: SanitaryEligibilityStatus; reasons: string[] } | null {
  const conditions = item.eligibilityRule.maternal_age_conditions;
  if (!conditions) return null;
  const evidence = animal.maternalVaccination;
  const birth = parseDateKey(animal.nascimento ?? "");
  const at = parseDateKey(today);
  const condition = readRecord(readRecord(conditions)[evidence?.status ?? "unknown"]);
  if (!evidence?.evidenceReference?.trim() || !["vaccinated", "unvaccinated"].includes(evidence.status) ||
    !birth || !at || at < birth || Object.keys(condition).length === 0) {
    return { status: "insufficient_data", reasons: ["Histórico materno documentado e condição etária da variante necessários."] };
  }
  const months = readNumber(condition.min_months);
  const days = readNumber(condition.min_days);
  if (months === null && days === null) {
    return condition.no_minimum_in_source === true ? null :
      { status: "insufficient_data", reasons: ["Condição etária materna incompleta nesta variante."] };
  }
  if ((months !== null && (!Number.isInteger(months) || months < 0)) ||
    (days !== null && (!Number.isInteger(days) || days < 0))) {
    return { status: "insufficient_data", reasons: ["Condição etária materna inválida nesta variante."] };
  }
  const minimum = new Date(birth);
  if (months !== null) {
    minimum.setUTCDate(1);
    minimum.setUTCMonth(minimum.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(minimum.getUTCFullYear(), minimum.getUTCMonth() + 1, 0)).getUTCDate();
    minimum.setUTCDate(Math.min(birth.getUTCDate(), lastDay));
  }
  if (days !== null) minimum.setUTCDate(minimum.getUTCDate() + days);
  return at < minimum || (condition.exclusive === true && at.getTime() === minimum.getTime())
    ? { status: "not_yet_eligible", reasons: ["Idade abaixo da condição específica do histórico materno desta variante."] }
    : null;
}

function evaluateCategoryContext(item: SanitaryProtocolItemV2ReadModel, animal: SanitaryPrecheckAnimalResumoV2): { status: SanitaryEligibilityStatus; reasons: string[] } | null {
  const category = readString(item.eligibilityRule.category);
  if (category && !animal.categoria) return { status: "insufficient_data", reasons: [item.productRequirementKind === "product_class_group" ? "Categoria ausente para avaliar antiparasitário." : "Categoria necessária para este esquema."] };
  if (category && !matchesSanitaryCategory(category, animal)) {
    return { status: "not_applicable", reasons: ["Categoria fora da regra do esquema."] };
  }
  return null;
}

function evaluateItemForAnimal(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  historyRequirement: ResolvedHistoryRequirementV2 | null;
  executedHistory: SanitaryExecutedHistoryV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, historyRequirement, executedHistory } =
    input;

  if (protocolIsBlocked(protocol)) {
    return baseResult({
      protocol,
      item,
      status: "not_applicable",
      blockers: ["Protocolo bloqueado ou retirado no catálogo sanitário v2."],
      warnings: ["Não criar agenda para protocolo bloqueado."],
    });
  }

  if (protocol.familyCode === "brucelose_b19") {
    return evaluateB19({ protocol, item, animal, today, executedHistory });
  }

  if (protocol.familyCode === "raiva_herbivoros") {
    return evaluateRaiva({
      protocol,
      item,
      animal,
      today,
      historyRequirement,
      executedHistory,
    });
  }

  if (item.productRequirementKind === "product_class_group") {
    return evaluateAntiparasitic({
      protocol,
      item,
      animal,
      today,
      historyRequirement,
      executedHistory,
    });
  }

  return evaluateGenericItem({
    protocol,
    item,
    animal,
    today,
    historyRequirement,
    executedHistory,
  });
}

function statusRank(status: SanitaryEligibilityStatus): number {
  const rank: Record<SanitaryEligibilityStatus, number> = {
    overdue: 8,
    near_deadline: 7,
    in_action_window: 6,
    eligible_soon: 5,
    insufficient_data: 4,
    not_yet_eligible: 3,
    completed: 2,
    not_applicable: 1,
  };
  return rank[status];
}

function aggregateLotReasons(input: {
  item: SanitaryProtocolItemV2ReadModel;
  strongest: SanitaryProtocolPrecheckResultV2;
}): string[] {
  const { item, strongest } = input;
  if (strongest.missingExecutedHistory) {
    return strongest.reasons;
  }
  if (item.logicalItemKey === "b19_femeas_3_8_meses") {
    if (strongest.status === "overdue") {
      return ["Há animais acima da janela B19."];
    }
    if (strongest.status === "in_action_window") {
      return ["Há fêmeas do lote dentro da janela B19 de 3 a 8 meses."];
    }
  }
  if (strongest.status === "insufficient_data") {
    return ["Dados insuficientes para avaliar o lote."];
  }
  if (strongest.status === "not_applicable") {
    return ["Este item não se aplica aos animais informados no lote."];
  }
  if (strongest.status === "overdue") {
    return ["Parte do lote está fora da janela deste item."];
  }
  if (
    strongest.status === "in_action_window" ||
    strongest.status === "near_deadline" ||
    strongest.status === "eligible_soon"
  ) {
    return ["Há animais do lote candidatos a este item."];
  }
  return ["Resultado agregado para os animais informados no lote."];
}

function aggregateLotResult(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animalResults: SanitaryProtocolPrecheckResultV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animalResults } = input;
  if (animalResults.length === 0) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Lote sem animais informados para pré-checagem sanitária."],
    });
  }

  const sorted = [...animalResults].sort(
    (left, right) => statusRank(right.status) - statusRank(left.status),
  );
  const strongest =
    animalResults.find((result) => result.missingExecutedHistory) ?? sorted[0];

  return {
    ...strongest,
    reasons: aggregateLotReasons({ item, strongest }),
    blockers: Array.from(
      new Set(animalResults.flatMap((entry) => entry.blockers)),
    ),
    warnings: Array.from(
      new Set(animalResults.flatMap((entry) => entry.warnings)),
    ),
    protocolId: protocol.id,
    familyCode: protocol.familyCode,
    protocolName: protocol.name,
    itemKey: item.logicalItemKey,
    itemLabel: formatSanitaryProtocolItemLabelV2(item.logicalItemKey),
    ...OPERATIONAL_FALSE_FLAGS,
  };
}

export function precheckSanitaryProtocolsForAnimalV2(
  input: PrecheckSanitaryProtocolsForAnimalV2Input,
): SanitaryProtocolPrecheckV2 {
  const protocolsById = new Map(
    input.catalog.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const productClassGroupsById = new Map(
    input.catalog.productClassGroups.map((group) => [group.id, group]),
  );

  const results = input.catalog.items
    .map((item) => {
      const protocol = protocolsById.get(item.protocolId);
      if (!protocol) return null;
      const result = evaluateItemForAnimal({
        protocol,
        item,
        animal: input.animal,
        today: input.today,
        historyRequirement: resolveHistoryRequirement(
          item,
          input.catalog.items,
        ),
        executedHistory: input.executedHistory ?? [],
      });

      return {
        ...result,
        productClassGroupName: item.productClassGroupId
          ? (productClassGroupsById.get(item.productClassGroupId)?.name ?? null)
          : null,
      };
    })
    .filter(
      (entry): entry is SanitaryProtocolPrecheckResultV2 => entry !== null,
    );

  return {
    animalOrLotId: input.animal.id,
    scope: "animal",
    evaluatedAt: input.today,
    results,
  };
}

export function precheckSanitaryProtocolsForLotV2(
  input: PrecheckSanitaryProtocolsForLotV2Input,
): SanitaryProtocolPrecheckV2 {
  const protocolsById = new Map(
    input.catalog.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const productClassGroupsById = new Map(
    input.catalog.productClassGroups.map((group) => [group.id, group]),
  );
  const animals = input.animals ?? [];

  const results = input.catalog.items
    .map((item) => {
      const protocol = protocolsById.get(item.protocolId);
      if (!protocol) return null;

      const animalResults = animals.map((animal) =>
        evaluateItemForAnimal({
          protocol,
          item,
          animal: {
            ...animal,
            categoria: animal.categoria ?? input.lote.categoria,
            riskArea: animal.riskArea ?? input.lote.riskArea,
          },
          today: input.today,
          historyRequirement: resolveHistoryRequirement(
            item,
            input.catalog.items,
          ),
          executedHistory: (input.executedHistory ?? []).filter(
            (entry) => entry.animalId === animal.id,
          ),
        }),
      );

      const result = aggregateLotResult({ protocol, item, animalResults });
      return {
        ...result,
        productClassGroupName: item.productClassGroupId
          ? (productClassGroupsById.get(item.productClassGroupId)?.name ?? null)
          : null,
      };
    })
    .filter(
      (entry): entry is SanitaryProtocolPrecheckResultV2 => entry !== null,
    );

  return {
    animalOrLotId: input.lote.id,
    scope: "lote",
    evaluatedAt: input.today,
    results,
  };
}

export function precheckSanitaryProtocolsV2(
  input: PrecheckSanitaryProtocolsV2Input,
): SanitaryProtocolPrecheckV2 {
  if (input.scope === "animal") {
    return precheckSanitaryProtocolsForAnimalV2(input);
  }
  return precheckSanitaryProtocolsForLotV2(input);
}
