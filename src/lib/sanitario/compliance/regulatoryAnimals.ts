import type { Animal } from "@/lib/offline/types";
import {
  getRegulatoryAnalyticsSubareaLabel,
  type RegulatoryAnalyticsImpactKey,
  type RegulatoryAnalyticsSubareaKey,
  type RegulatoryOperationalReadModel,
} from "@/lib/sanitario/compliance/regulatoryReadModel";

export interface AnimalRegulatoryRestriction {
  key: RegulatoryAnalyticsImpactKey;
  label: string;
  tone: "warning" | "danger";
  message: string;
  blockerCount: number;
  warningCount: number;
}

export interface AnimalRegulatoryProfile {
  animalId: string;
  restrictions: AnimalRegulatoryRestriction[];
  activeSubareas: RegulatoryAnalyticsSubareaKey[];
  hasIssues: boolean;
  hasBlockingIssues: boolean;
}

export interface AnimalRegulatoryFilterInput {
  impact?: RegulatoryAnalyticsImpactKey | "all";
  subarea?: RegulatoryAnalyticsSubareaKey | "all";
}

function intersects<T extends string>(left: T[], right: T[]) {
  return left.some((item) => right.includes(item));
}

export function getAnimalRegulatoryImpactLabel(
  key: RegulatoryAnalyticsImpactKey,
  tone: "warning" | "danger",
) {
  if (key === "nutrition") {
    return tone === "danger" ? "Nutricao bloqueada" : "Nutricao em revisao";
  }
  if (key === "movementInternal") {
    return tone === "danger"
      ? "Movimentacao bloqueada"
      : "Movimentacao sob revisao";
  }
  return tone === "danger"
    ? "Venda/transito bloqueados"
    : "Venda/transito em revisao";
}

export function buildAnimalRegulatoryProfile(
  animal: Pick<Animal, "id" | "status" | "deleted_at">,
  readModel: RegulatoryOperationalReadModel,
): AnimalRegulatoryProfile {
  if (animal.deleted_at || animal.status !== "ativo") {
    return {
      animalId: animal.id,
      restrictions: [],
      activeSubareas: [],
      hasIssues: false,
      hasBlockingIssues: false,
    };
  }

  const restrictions = readModel.analytics.impacts
    .filter((impact) => impact.totalCount > 0)
    .map((impact) => ({
      key: impact.key,
      label: getAnimalRegulatoryImpactLabel(
        impact.key,
        impact.tone === "danger" ? "danger" : "warning",
      ),
      tone: impact.tone === "danger" ? "danger" : "warning",
      message: impact.message,
      blockerCount: impact.blockerCount,
      warningCount: impact.warningCount,
    }));

  const activeImpactKeys = restrictions.map((restriction) => restriction.key);
  const activeSubareas = readModel.analytics.subareas
    .filter(
      (subarea) =>
        subarea.openCount > 0 &&
        intersects(subarea.affectedImpacts, activeImpactKeys),
    )
    .map((subarea) => subarea.key);

  return {
    animalId: animal.id,
    restrictions,
    activeSubareas,
    hasIssues: restrictions.length > 0,
    hasBlockingIssues: restrictions.some(
      (restriction) => restriction.blockerCount > 0,
    ),
  };
}

export function matchesAnimalRegulatoryFilters(
  profile: AnimalRegulatoryProfile | undefined,
  filters: AnimalRegulatoryFilterInput,
) {
  if (!profile) {
    return filters.impact === "all" && filters.subarea === "all";
  }

  if ((filters.impact && filters.impact !== "all") || (filters.subarea && filters.subarea !== "all")) {
    if (!profile.hasIssues) return false;
  }

  if (
    filters.impact &&
    filters.impact !== "all" &&
    !profile.restrictions.some((restriction) => restriction.key === filters.impact)
  ) {
    return false;
  }

  if (
    filters.subarea &&
    filters.subarea !== "all" &&
    !profile.activeSubareas.includes(filters.subarea)
  ) {
    return false;
  }

  return true;
}

function escapeCsvValue(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildAnimalRegulatoryExportCsv(input: {
  animals: Array<
    Pick<Animal, "id" | "identificacao" | "sexo" | "status" | "lote_id">
  >;
  profilesByAnimalId: Map<string, AnimalRegulatoryProfile>;
  resolveLoteName: (loteId: string | null | undefined) => string;
  resolveCategoryLabel?: (animalId: string) => string;
}) {
  const lines = [
    [
      "animal_id",
      "identificacao",
      "sexo",
      "status",
      "lote",
      "categoria",
      "restricoes",
      "subareas",
      "mensagem_critica",
    ].join(";"),
  ];

  for (const animal of input.animals) {
    const profile = input.profilesByAnimalId.get(animal.id);
    if (!profile?.hasIssues) continue;

    const criticalMessage =
      profile.restrictions.find((restriction) => restriction.blockerCount > 0)
        ?.message ??
      profile.restrictions[0]?.message ??
      "";

    lines.push(
      [
        animal.id,
        animal.identificacao ?? "",
        animal.sexo === "F" ? "Femea" : "Macho",
        animal.status,
        input.resolveLoteName(animal.lote_id),
        input.resolveCategoryLabel?.(animal.id) ?? "",
        profile.restrictions
          .map((restriction) => restriction.label)
          .join(" | "),
        profile.activeSubareas
          .map((subarea) => getRegulatoryAnalyticsSubareaLabel(subarea))
          .join(" | "),
        criticalMessage,
      ]
        .map((value) => escapeCsvValue(String(value)))
        .join(";"),
    );
  }

  return lines.join("\r\n");
}
