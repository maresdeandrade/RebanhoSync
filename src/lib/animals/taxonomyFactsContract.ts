export const TAXONOMY_FACTS_SCHEMA_VERSION = 1 as const;

export type TaxonomyFactsWriter = "manual" | "reproduction_event";

export interface TaxonomyFactsValidationIssue {
  code: string;
  field: string;
  message: string;
}

export class TaxonomyFactsValidationError extends Error {
  issues: TaxonomyFactsValidationIssue[];

  constructor(issues: TaxonomyFactsValidationIssue[]) {
    super(issues[0]?.message ?? "Invalid taxonomy facts payload.");
    this.name = "TaxonomyFactsValidationError";
    this.issues = issues;
  }
}

export interface AnimalTaxonomyFactsContractV1 {
  schema_version: typeof TAXONOMY_FACTS_SCHEMA_VERSION;
  castrado?: boolean;
  puberdade_confirmada?: boolean;
  secagem_realizada?: boolean;
  data_secagem?: string;
  em_lactacao?: boolean;
  prenhez_confirmada?: boolean;
  data_prevista_parto?: string;
  data_ultimo_parto?: string;
}

export type AnimalTaxonomyFactsPatch = Partial<
  Omit<AnimalTaxonomyFactsContractV1, "schema_version">
>;

type TaxonomyFactField = keyof AnimalTaxonomyFactsPatch;

type TaxonomyFactOwnershipRule = {
  primary_writer: TaxonomyFactsWriter;
  manual_override: boolean;
  event_derived: boolean;
  description: string;
};

export const TAXONOMY_FACT_OWNERSHIP: Record<
  TaxonomyFactField,
  TaxonomyFactOwnershipRule
> = {
  castrado: {
    primary_writer: "manual",
    manual_override: true,
    event_derived: false,
    description: "Fato de manejo estrutural. Escrita manual apenas.",
  },
  puberdade_confirmada: {
    primary_writer: "manual",
    manual_override: true,
    event_derived: true,
    description:
      "Pode ser confirmado manualmente e tambem promovido por evento reprodutivo conclusivo.",
  },
  secagem_realizada: {
    primary_writer: "manual",
    manual_override: true,
    event_derived: true,
    description:
      "Pode ser ajustado manualmente; evento de parto pode limpar o estado quando um novo ciclo comeca.",
  },
  data_secagem: {
    primary_writer: "manual",
    manual_override: true,
    event_derived: true,
    description:
      "Data operacional associada a secagem. Hoje manual, com abertura para evento futuro.",
  },
  em_lactacao: {
    primary_writer: "manual",
    manual_override: true,
    event_derived: true,
    description:
      "Pode ser marcado manualmente; parto recente pode reabrir lactacao automaticamente.",
  },
  prenhez_confirmada: {
    primary_writer: "reproduction_event",
    manual_override: false,
    event_derived: true,
    description:
      "Fato ownership do ciclo reprodutivo. Origem esperada: diagnostico e parto.",
  },
  data_prevista_parto: {
    primary_writer: "reproduction_event",
    manual_override: false,
    event_derived: true,
    description:
      "Ownership do ciclo reprodutivo. Origem esperada: servico/diagnostico.",
  },
  data_ultimo_parto: {
    primary_writer: "reproduction_event",
    manual_override: false,
    event_derived: true,
    description: "Ownership do evento de parto.",
  },
};

const BOOLEAN_FIELDS = new Set<TaxonomyFactField>([
  "castrado",
  "puberdade_confirmada",
  "secagem_realizada",
  "em_lactacao",
  "prenhez_confirmada",
]);

const DATE_FIELDS = new Set<TaxonomyFactField>([
  "data_secagem",
  "data_prevista_parto",
  "data_ultimo_parto",
]);

const WRITER_ALLOWED_FIELDS: Record<TaxonomyFactsWriter, Set<TaxonomyFactField>> = {
  manual: new Set([
    "castrado",
    "puberdade_confirmada",
    "secagem_realizada",
    "data_secagem",
    "em_lactacao",
  ]),
  reproduction_event: new Set([
    "puberdade_confirmada",
    "secagem_realizada",
    "data_secagem",
    "em_lactacao",
    "prenhez_confirmada",
    "data_prevista_parto",
    "data_ultimo_parto",
  ]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function readTaxonomyFactsRecord(payload: unknown) {
  if (!isRecord(payload)) return null;
  const record = payload.taxonomy_facts;
  return isRecord(record) ? record : null;
}

export function validateAnimalTaxonomyFactsContract(
  value: unknown,
): { success: true; data: AnimalTaxonomyFactsContractV1 } | {
  success: false;
  issues: TaxonomyFactsValidationIssue[];
} {
  if (!isRecord(value)) {
    return {
      success: false,
      issues: [
        {
          code: "INVALID_TYPE",
          field: "taxonomy_facts",
          message: "taxonomy_facts deve ser um objeto.",
        },
      ],
    };
  }

  const issues: TaxonomyFactsValidationIssue[] = [];
  const schemaVersion = value.schema_version;

  if (schemaVersion !== TAXONOMY_FACTS_SCHEMA_VERSION) {
    issues.push({
      code: "INVALID_SCHEMA_VERSION",
      field: "schema_version",
      message: `taxonomy_facts.schema_version deve ser ${TAXONOMY_FACTS_SCHEMA_VERSION}.`,
    });
  }

  for (const [field, rawValue] of Object.entries(value)) {
    if (field === "schema_version") continue;
    if (!(field in TAXONOMY_FACT_OWNERSHIP)) {
      issues.push({
        code: "UNKNOWN_FIELD",
        field,
        message: `Campo ${field} nao faz parte do contrato canonico.`,
      });
      continue;
    }

    const key = field as TaxonomyFactField;
    if (rawValue === undefined) continue;

    if (BOOLEAN_FIELDS.has(key) && typeof rawValue !== "boolean") {
      issues.push({
        code: "INVALID_BOOLEAN",
        field,
        message: `Campo ${field} deve ser boolean.`,
      });
    }

    if (DATE_FIELDS.has(key)) {
      if (typeof rawValue !== "string" || !isIsoDate(rawValue)) {
        issues.push({
          code: "INVALID_DATE",
          field,
          message: `Campo ${field} deve usar formato YYYY-MM-DD.`,
        });
      }
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  const normalizedData: AnimalTaxonomyFactsContractV1 = {
    schema_version: TAXONOMY_FACTS_SCHEMA_VERSION,
    ...(typeof value.castrado === "boolean" ? { castrado: value.castrado } : {}),
    ...(typeof value.puberdade_confirmada === "boolean"
      ? { puberdade_confirmada: value.puberdade_confirmada }
      : {}),
    ...(typeof value.secagem_realizada === "boolean"
      ? { secagem_realizada: value.secagem_realizada }
      : {}),
    ...(typeof value.data_secagem === "string"
      ? { data_secagem: value.data_secagem }
      : {}),
    ...(typeof value.em_lactacao === "boolean"
      ? { em_lactacao: value.em_lactacao }
      : {}),
    ...(typeof value.prenhez_confirmada === "boolean"
      ? { prenhez_confirmada: value.prenhez_confirmada }
      : {}),
    ...(typeof value.data_prevista_parto === "string"
      ? { data_prevista_parto: value.data_prevista_parto }
      : {}),
    ...(typeof value.data_ultimo_parto === "string"
      ? { data_ultimo_parto: value.data_ultimo_parto }
      : {}),
  };

  return {
    success: true,
    data: normalizedData,
  };
}

export function assertValidAnimalTaxonomyFactsContract(value: unknown) {
  const result = validateAnimalTaxonomyFactsContract(value);
  if (result.success === false) {
    throw new TaxonomyFactsValidationError(result.issues);
  }

  return result.data;
}

export function assertAllowedTaxonomyFactsWriterPatch(
  patch: AnimalTaxonomyFactsPatch,
  writer: TaxonomyFactsWriter,
) {
  const issues: TaxonomyFactsValidationIssue[] = [];
  const allowed = WRITER_ALLOWED_FIELDS[writer];

  for (const field of Object.keys(patch) as TaxonomyFactField[]) {
    if (!allowed.has(field)) {
      issues.push({
        code: "WRITER_NOT_ALLOWED",
        field,
        message: `Writer ${writer} nao pode alterar ${field}.`,
      });
    }
  }

  if (issues.length > 0) {
    throw new TaxonomyFactsValidationError(issues);
  }
}

export function buildAnimalTaxonomyFactsContract(
  currentFacts: unknown,
  patch: AnimalTaxonomyFactsPatch,
  writer: TaxonomyFactsWriter,
) {
  assertAllowedTaxonomyFactsWriterPatch(patch, writer);

  let baseRecord: AnimalTaxonomyFactsContractV1 = {
    schema_version: TAXONOMY_FACTS_SCHEMA_VERSION,
  };

  if (isRecord(currentFacts)) {
    const candidate = {
      schema_version: TAXONOMY_FACTS_SCHEMA_VERSION,
      ...currentFacts,
    };
    delete (candidate as Record<string, unknown>).schema_version;
    (candidate as Record<string, unknown>).schema_version =
      TAXONOMY_FACTS_SCHEMA_VERSION;
    baseRecord = assertValidAnimalTaxonomyFactsContract(candidate);
  }

  const nextFacts: Record<string, unknown> = {
    ...baseRecord,
    schema_version: TAXONOMY_FACTS_SCHEMA_VERSION,
  };

  for (const [field, value] of Object.entries(patch) as Array<
    [TaxonomyFactField, AnimalTaxonomyFactsPatch[TaxonomyFactField]]
  >) {
    if (value === undefined || value === null || value === "") {
      delete nextFacts[field];
      continue;
    }
    nextFacts[field] = value;
  }

  if (Object.keys(nextFacts).length === 1) {
    return null;
  }

  return assertValidAnimalTaxonomyFactsContract(nextFacts);
}
