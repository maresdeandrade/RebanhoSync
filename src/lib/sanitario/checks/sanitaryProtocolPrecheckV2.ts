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
};

export type SanitaryPrecheckLoteResumoV2 = {
  id: string;
  fazendaId: string;
  animalIds?: string[];
  categoria?: string | null;
  riskArea?: boolean | null;
};

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
  today: string;
};

export type PrecheckSanitaryProtocolsForLotV2Input = {
  scope: "lote";
  lote: SanitaryPrecheckLoteResumoV2;
  animals?: SanitaryPrecheckAnimalResumoV2[];
  catalog: SanitaryProtocolCatalogReadModelV2;
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
    ...OPERATIONAL_FALSE_FLAGS,
  };
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
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today } = input;
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
    return baseResult({
      protocol,
      item,
      status: "overdue",
      reasons: ["Animal acima da janela B19 de 3 a 8 meses."],
      warnings: ["Exige avaliação técnica responsável antes de qualquer execução."],
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
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal } = input;
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

  if (readString(item.eligibilityRule.requires_previous_dose)) {
    return baseResult({
      protocol,
      item,
      status: "insufficient_data",
      reasons: ["Reforço depende de histórico explícito da dose anterior."],
      warnings: ["Histórico sanitário executado não foi informado à pré-checagem."],
    });
  }

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
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today } = input;
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
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal } = input;
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
}): SanitaryProtocolPrecheckResultV2 {
  const { protocol, item, animal, today } = input;

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
    return evaluateB19({ protocol, item, animal, today });
  }

  if (protocol.familyCode === "raiva_herbivoros") {
    return evaluateRaiva({ protocol, item, animal });
  }

  if (item.productRequirementKind === "product_class_group") {
    return evaluateAntiparasitic({ protocol, item, animal, today });
  }

  return evaluateGenericItem({ protocol, item, animal });
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
  const strongest = sorted[0];

  return {
    ...strongest,
    reasons: Array.from(new Set(animalResults.flatMap((entry) => entry.reasons))),
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
