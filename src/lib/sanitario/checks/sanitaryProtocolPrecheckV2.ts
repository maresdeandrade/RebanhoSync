import {
  formatSanitaryProtocolItemLabelV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";

export type SanitaryProtocolPrecheckScopeV2 = "animal" | "lote";

export type SanitaryPrecheckAnimalResumoV2 = {
  id: string;
  especie?: "bovino" | "bubalino" | string | null;
  sexo?: "macho" | "femea" | "M" | "F" | string | null;
  nascimento?: string | null;
  categoria?: string | null;
  aptidao?: string | null;
  fazendaId: string;
  riskArea?: boolean | null;
  regionalRiskArea?: boolean | null;
  pregnancyOrPeripartumContext?: boolean | null;
  sanitaryCadence?: "annual" | "semiannual" | null;
  managementContext?:
    | "pre_weaning"
    | "rearing"
    | "pre_feedlot"
    | "deferred_pasture"
    | null;
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
  executedAt: string;
  source:
    | "event"
    | "internal_execution"
    | "external_documented"
    | "external_declared"
    | "legacy_import";
  evidenceClass?: "documented" | "declared" | "unknown";
  dateApproximate?: boolean;
};

export type SanitaryExecutedHistoryV2 = {
  animalId: string;
  events: SanitaryExecutedHistoryEventV2[];
};

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

function normalizeSex(value: string | null | undefined): "femea" | "macho" | null {
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

function isDocumentedHistorySource(event: SanitaryExecutedHistoryEventV2): boolean {
  return (
    event.source === "event" ||
    event.source === "internal_execution" ||
    event.source === "external_documented" ||
    (event.source === "legacy_import" && event.evidenceClass === "documented")
  );
}

function isDeclaredHistorySource(event: SanitaryExecutedHistoryEventV2): boolean {
  return (
    event.source === "external_declared" ||
    event.evidenceClass === "declared" ||
    (event.source === "legacy_import" && event.evidenceClass !== "documented")
  );
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
      if (event.protocolId && event.protocolId !== input.protocolId) return false;
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
      if (!isDocumentedHistorySource(event)) return false;
      if (event.dateApproximate) return false;
      if (!event.familyCode || !event.itemKey) return false;
      if (event.familyCode !== input.familyCode) return false;
      if (event.protocolId && event.protocolId !== input.protocolId) return false;
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

function protocolIsBlocked(
  protocol: SanitaryProtocolV2ReadModel,
): boolean {
  return (
    protocol.familyCode === "febre_aftosa" ||
    protocol.status === "retired" ||
    protocol.legalStatus === "bloqueado"
  );
}

function hasRiskAreaInfo(
  animal: SanitaryPrecheckAnimalResumoV2,
): boolean {
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
}): { minDays: number; maxDays: number } | null {
  if (input.requirement.kind === "previous_dose") {
    const minDays = readNumber(input.item.operationalWindowRule.min_offset_days);
    const maxDays = readNumber(input.item.operationalWindowRule.max_offset_days);
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
      warnings: ["Contexto operacional não substitui fonte técnica nem execução."],
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
  });
  const elapsedDays = daysBetween(historyEvent.executedAt, input.today);
  if (!window || elapsedDays === null) {
    return baseResult({
      protocol: input.protocol,
      item: input.item,
      status: "insufficient_data",
      reasons: ["Histórico executado existe, mas a janela desta etapa está incompleta."],
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

function evaluateB19(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  executedHistory: SanitaryExecutedHistoryV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today, executedHistory } = input;
  const speciesStatus = evaluateSpecies(animal, item);
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

  if (ageMonths < 3) {
    return baseResult({
      protocol,
      item,
      status: "not_yet_eligible",
      reasons: ["Animal ainda abaixo da janela B19 de 3 a 8 meses."],
      warnings: ["Exige MV habilitado, registro oficial e produto real na execução."],
    });
  }
  if (ageMonths > 8) {
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
        reasons: ["B19 comprovada por histórico sanitário documentado anterior."],
        warnings: [
          "Histórico anterior não registra execução da fazenda nem movimenta estoque.",
        ],
      });
    }
    const declaredHistory = compatibleHistory.find(isDeclaredHistorySource);
    if (declaredHistory) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: ["B19 informada apenas por declaração sem documento suficiente."],
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
      warnings: ["Não planejar vacinação B19 fora da janela sem comprovação técnica."],
      documentaryPending: true,
      documentaryPendingReasons: [
        "Fêmea adulta exige comprovação documental de B19.",
      ],
    });
  }

  return baseResult({
    protocol,
    item,
    status: "in_action_window",
    reasons: ["Fêmea bovina/bubalina dentro da janela B19 de 3 a 8 meses."],
    warnings: ["Exige MV habilitado, registro oficial e produto real na execução."],
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

  if (!hasRiskAreaInfo(animal)) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Protocolo de raiva depende de dado regional/de área de risco."],
      warnings: ["A pré-checagem não infere área de risco."],
    });
  }

  if (resolveRiskArea(animal) !== true) {
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
    reasons: ["Área de risco informada explicitamente para avaliação técnica."],
    warnings: ["Produto real e avaliação técnica continuam obrigatórios na execução."],
  });
}

function evaluateAntiparasitic(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  historyRequirement: ResolvedHistoryRequirementV2 | null;
  executedHistory: SanitaryExecutedHistoryV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const {
    protocol,
    item,
    animal,
    today,
    historyRequirement,
    executedHistory,
  } = input;
  const speciesStatus = evaluateSpecies(animal, item);
  if (speciesStatus) {
    return baseResult({
      protocol,
      item,
      status: speciesStatus,
      reasons:
        speciesStatus === "insufficient_data"
          ? ["Espécie ausente para avaliar antiparasitário."]
          : ["Espécie fora da regra antiparasitária do catálogo."],
      warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
    });
  }

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
      warnings: ["Contexto operacional não substitui produto, dose nem carência."],
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
      warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
    });
  }

  const requiredCategory = readString(item.eligibilityRule.category);
  if (requiredCategory) {
    const category = normalizeToken(animal.categoria);
    if (!category) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: ["Categoria ausente para avaliar antiparasitário."],
        warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
      });
    }
    if (category !== requiredCategory) {
      return baseResult({
        protocol,
        item,
        status: "not_applicable",
        reasons: ["Categoria do animal fora da regra antiparasitária."],
        warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
      });
    }
  }

  if (readBoolean(item.eligibilityRule.requires_pregnancy_or_peripartum_context)) {
    if (animal.pregnancyOrPeripartumContext !== true) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: ["Pré-parto exige contexto gestacional/periparto explícito."],
        warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
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
        reasons: ["Data de referência inválida para avaliar janela de calendário."],
        warnings: ["Grupo técnico de produtos não valida execução, dose nem carência."],
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
    reasons: ["Item antiparasitário avaliável tecnicamente com os dados informados."],
    warnings: [
      "Grupo técnico de produtos não valida execução, dose nem carência.",
      "Produto real obrigatório na execução.",
    ],
  });
}

function evaluateGenericItem(input: {
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
          ? ["Espécie ausente para avaliar item do catálogo."]
          : ["Espécie fora da regra do item."],
    });
  }

  const sexRule = readString(item.eligibilityRule.sex);
  if (sexRule) {
    const sex = normalizeSex(animal.sexo);
    if (!sex) {
      return baseResult({
        protocol,
        item,
        status: "insufficient_data",
        reasons: ["Sexo ausente para avaliar item do catálogo."],
      });
    }
    if (sex !== normalizeSex(sexRule)) {
      return baseResult({
        protocol,
        item,
        status: "not_applicable",
        reasons: ["Sexo fora da regra do item."],
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

  const productWarnings =
    item.productRequirementKind === "product_class_group"
      ? [
          "Grupo técnico de produtos não valida execução, dose nem carência.",
          "Produto real obrigatório na execução.",
        ]
      : item.productRequirementKind === "product_class"
        ? ["Produto real obrigatório na execução.", "Carência depende do produto executado."]
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

function evaluateItemForAnimal(input: {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  animal: SanitaryPrecheckAnimalResumoV2;
  today: string;
  historyRequirement: ResolvedHistoryRequirementV2 | null;
  executedHistory: SanitaryExecutedHistoryV2[];
}): SanitaryProtocolPrecheckResultV2 {
  const {
    protocol,
    item,
    animal,
    today,
    historyRequirement,
    executedHistory,
  } = input;

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
    blockers: Array.from(new Set(animalResults.flatMap((entry) => entry.blockers))),
    warnings: Array.from(new Set(animalResults.flatMap((entry) => entry.warnings))),
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
        historyRequirement: resolveHistoryRequirement(item, input.catalog.items),
        executedHistory: input.executedHistory ?? [],
      });

      return {
        ...result,
        productClassGroupName: item.productClassGroupId
          ? (productClassGroupsById.get(item.productClassGroupId)?.name ?? null)
          : null,
      };
    })
    .filter((entry): entry is SanitaryProtocolPrecheckResultV2 => entry !== null);

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
          historyRequirement: resolveHistoryRequirement(item, input.catalog.items),
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
    .filter((entry): entry is SanitaryProtocolPrecheckResultV2 => entry !== null);

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
