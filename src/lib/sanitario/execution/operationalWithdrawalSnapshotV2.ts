import type {
  SanitarioFonteCoberturaCampoLocalV2,
  SanitarioFonteTecnicaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
  SanitarioProdutoFonteLocalV2,
  SanitarioTechnicalAptitudeV2,
  SanitarioTechnicalDoseBasisV2,
  SanitarioTechnicalSpeciesCodeV2,
} from "@/lib/offline/types";
import type {
  OperationalWithdrawalPurposeResultV2,
  OperationalWithdrawalSnapshotV2,
} from "@/lib/sanitario/rules/sanitarySnapshotsV2";
import type { SanitarySourceRefV2 } from "@/lib/sanitario/rules/sanitarySourceV2";

const WITHDRAWAL_TIMEZONE = "America/Sao_Paulo" as const;
const PROVEN_EVIDENCE = new Set(["SIM_BULA", "SIM_NORMA"]);

export type OperationalWithdrawalAnimalContextV2 = {
  animalId: string;
  speciesCode: SanitarioTechnicalSpeciesCodeV2 | null;
  aptitude: Exclude<SanitarioTechnicalAptitudeV2, "all"> | null;
};

export type BuildOperationalWithdrawalSnapshotInputV2 = {
  eventId: string;
  fazendaId: string;
  productId: string;
  productCatalogUpdatedAt: string | null;
  factualReferenceAt: string;
  route: string;
  doseBasis: SanitarioTechnicalDoseBasisV2;
  animals: OperationalWithdrawalAnimalContextV2[];
  rules: SanitarioProdutoCarenciaRuleLocalV2[];
  productSources: SanitarioProdutoFonteLocalV2[];
  sources: SanitarioFonteTecnicaLocalV2[];
  coverages: SanitarioFonteCoberturaCampoLocalV2[];
};

function sourceRef(source: SanitarioFonteTecnicaLocalV2): SanitarySourceRefV2 {
  return {
    id: source.id,
    kind: source.kind,
    scope: source.scope,
    fazendaId: source.fazenda_id,
    title: source.title,
    issuer: source.issuer,
    version: source.version,
    publishedAt: source.published_at,
    accessedAt: source.accessed_at,
    url: source.url,
    jurisdictionCountry: source.jurisdiction_country,
    jurisdictionUf: source.jurisdiction_uf,
    jurisdictionZone: source.jurisdiction_zone,
    strength: source.strength,
    evidenceStatus: source.evidence_status,
    fieldKeys: ["withdrawal"],
    limitations: source.limitations.map((value) =>
      typeof value === "string" ? value : JSON.stringify(value)
    ).sort(),
    metadata: source.metadata,
    createdBy: source.created_by,
  };
}

function nominalDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WITHDRAWAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addNominalDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function localMidnightUtc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: WITHDRAWAL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    candidate += target - represented;
  }
  return candidate;
}

export function calculateOperationalWithdrawalEndV2(input: {
  factualReferenceAt: string;
  value: number;
  unit: "days" | "hours";
}): { endsAt: string; endsOn: string } {
  if (!Number.isInteger(input.value) || input.value <= 0) {
    throw new Error("SANITARY_WITHDRAWAL_PERIOD_INVALID");
  }
  if (input.unit === "hours") {
    const endsAt = new Date(
      new Date(input.factualReferenceAt).getTime() + input.value * 60 * 60 * 1_000,
    ).toISOString();
    return { endsAt, endsOn: nominalDate(endsAt) };
  }
  const endsOn = addNominalDays(nominalDate(input.factualReferenceAt), input.value);
  const nextDay = addNominalDays(endsOn, 1);
  return { endsAt: new Date(localMidnightUtc(nextDay) - 1).toISOString(), endsOn };
}

function semanticRule(rule: SanitarioProdutoCarenciaRuleLocalV2) {
  return JSON.stringify({
    applicability: rule.applicability,
    meat_days: rule.meat_days,
    milk_days: rule.milk_days,
    milk_hours: rule.milk_hours,
    species_code: rule.species_code,
    aptitude: rule.aptitude,
    route: rule.route,
    dose_basis: rule.dose_basis,
  });
}

function evidence(input: BuildOperationalWithdrawalSnapshotInputV2) {
  const candidates = input.productSources.flatMap((link) => {
    if (link.product_id !== input.productId || link.field_key !== "withdrawal") return [];
    const source = input.sources.find((entry) =>
      entry.id === link.source_id && !entry.deleted_at &&
      (entry.scope === "global" || entry.fazenda_id === input.fazendaId) &&
      entry.strength === "forte" && PROVEN_EVIDENCE.has(entry.evidence_status)
    );
    const coverage = input.coverages.find((entry) =>
      entry.source_id === link.source_id && entry.field_key === "withdrawal" &&
      !entry.deleted_at && entry.coverage_status === "covers"
    );
    return source && coverage ? [{ link, source, coverage }] : [];
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function unknownResult(
  input: BuildOperationalWithdrawalSnapshotInputV2,
  animal: OperationalWithdrawalAnimalContextV2,
  purpose: "meat" | "milk",
  state: "unknown" | "ambiguous",
  reason: string,
): OperationalWithdrawalPurposeResultV2 {
  return {
    purpose,
    state,
    reason,
    period: null,
    startsAt: input.factualReferenceAt,
    endsAt: null,
    endsOn: null,
    endInclusivity: "inclusive",
    ruleId: null,
    equivalentRuleIds: [],
    applicability: null,
    sourceRef: null,
    sourceCoverageId: null,
    productSource: null,
    qualifiers: {
      speciesCode: animal.speciesCode,
      aptitude: animal.aptitude,
      route: input.route,
      doseBasis: input.doseBasis,
      animalId: animal.animalId,
    },
  };
}

function resultForPurpose(
  input: BuildOperationalWithdrawalSnapshotInputV2,
  animal: OperationalWithdrawalAnimalContextV2,
  purpose: "meat" | "milk",
): OperationalWithdrawalPurposeResultV2 {
  if (!input.productCatalogUpdatedAt) {
    return unknownResult(input, animal, purpose, "unknown", "technical_product_unavailable");
  }
  if (!animal.speciesCode) return unknownResult(input, animal, purpose, "unknown", "species_missing");
  const date = nominalDate(input.factualReferenceAt);
  const base = input.rules.filter((rule) =>
    !rule.deleted_at && rule.status_curatorial === "ativo" &&
    rule.product_id === input.productId && rule.species_code === animal.speciesCode &&
    (!rule.route || rule.route === input.route) &&
    (!rule.dose_basis || rule.dose_basis === input.doseBasis) &&
    (!rule.valid_from || rule.valid_from <= date) &&
    (!rule.valid_until || rule.valid_until >= date)
  );
  if (!animal.aptitude && base.some((rule) => rule.aptitude !== "all")) {
    return unknownResult(input, animal, purpose, "unknown", "aptitude_missing");
  }
  const applicable = base.filter((rule) =>
    rule.aptitude === "all" || rule.aptitude === animal.aptitude
  );
  if (!applicable.length) return unknownResult(input, animal, purpose, "unknown", "no_applicable_rule");
  const semantics = new Set(applicable.map(semanticRule));
  if (semantics.size > 1) return unknownResult(input, animal, purpose, "ambiguous", "ambiguous_rule");
  const selected = [...applicable].sort((left, right) => left.id.localeCompare(right.id))[0];
  const proof = evidence(input);
  if (!proof) return unknownResult(input, animal, purpose, "unknown", "withdrawal_evidence_missing_or_ambiguous");
  const period = purpose === "meat"
    ? (selected.meat_days != null ? { value: selected.meat_days, unit: "days" as const } : null)
    : (selected.milk_hours != null
      ? { value: selected.milk_hours, unit: "hours" as const }
      : selected.milk_days != null
      ? { value: selected.milk_days, unit: "days" as const }
      : null);
  const common = {
    purpose,
    startsAt: input.factualReferenceAt,
    endInclusivity: "inclusive" as const,
    ruleId: selected.id,
    equivalentRuleIds: applicable.map((rule) => rule.id).sort(),
    applicability: selected.applicability,
    sourceRef: sourceRef(proof.source),
    sourceCoverageId: proof.coverage.id,
    productSource: {
      productId: proof.link.product_id,
      sourceId: proof.link.source_id,
      fieldKey: "withdrawal" as const,
    },
    qualifiers: {
      speciesCode: animal.speciesCode,
      aptitude: animal.aptitude,
      route: input.route,
      doseBasis: input.doseBasis,
      animalId: animal.animalId,
    },
  };
  if (selected.applicability === "not_permitted") {
    return { ...common, state: "not_permitted", reason: "use_not_permitted", period: null, endsAt: null, endsOn: null };
  }
  if (selected.applicability === "zero" || selected.applicability === "not_applicable") {
    return { ...common, state: "explicit_absence", reason: "explicit_no_withdrawal", period: null, endsAt: null, endsOn: null };
  }
  if (selected.applicability !== "period" || !period || period.value === 0) {
    return unknownResult(input, animal, purpose, "unknown", "purpose_not_explicitly_covered");
  }
  const calculated = calculateOperationalWithdrawalEndV2({
    factualReferenceAt: input.factualReferenceAt,
    ...period,
  });
  return { ...common, state: "calculated", reason: "explicit_period", period, ...calculated };
}

export function buildOperationalWithdrawalSnapshotV2(
  input: BuildOperationalWithdrawalSnapshotInputV2,
): OperationalWithdrawalSnapshotV2 {
  const results = input.animals.flatMap((animal) =>
    (["meat", "milk"] as const).map((purpose) => resultForPurpose(input, animal, purpose))
  ).sort((left, right) =>
    `${left.qualifiers.animalId}:${left.purpose}`.localeCompare(
      `${right.qualifiers.animalId}:${right.purpose}`,
    )
  );
  return {
    schemaVersion: "sanitario-operational-withdrawal-snapshot-v2",
    eventId: input.eventId,
    productId: input.productId,
    productCatalogUpdatedAt: input.productCatalogUpdatedAt,
    factualReferenceAt: input.factualReferenceAt,
    timezone: WITHDRAWAL_TIMEZONE,
    results,
    limitations: Array.from(new Set(results
      .filter((result) => result.state !== "calculated" && result.state !== "explicit_absence")
      .map((result) => result.reason))).sort(),
  };
}

export function projectOperationalWithdrawalLegacyFieldsV2(
  snapshot: OperationalWithdrawalSnapshotV2 | undefined,
) {
  const results = snapshot?.results ?? [];
  const legacy = (purpose: "meat" | "milk") => {
    const purposeResults = results.filter((result) => result.purpose === purpose);
    const calculated = purposeResults.filter((result) => result.state === "calculated");
    if (!calculated.length || calculated.length !== purposeResults.length) {
      return { days: null, end: null };
    }
    const signatures = new Set(calculated.map((result) =>
      `${result.period?.unit}:${result.period?.value}:${result.endsAt}:${result.endsOn}`
    ));
    if (signatures.size !== 1) return { days: null, end: null };
    const value = calculated[0];
    return {
      days: value.period?.unit === "days" ? value.period.value : null,
      end: value.period?.unit === "days" ? value.endsOn : value.endsAt,
    };
  };
  const meat = legacy("meat");
  const milk = legacy("milk");
  return {
    carneDias: meat.days,
    leiteDias: milk.days,
    carneAte: meat.end,
    leiteAte: milk.end,
    createsActiveWithdrawal: results.some((result) => result.state === "calculated"),
    reason: snapshot ? "operational_withdrawal_snapshot" : "withdrawal_unknown",
  };
}
