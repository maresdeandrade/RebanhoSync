import type {
  ComplianceKind,
  MaterializationMode,
  ProtocolKind,
  SanitaryProtocolItemDomain,
} from "@/lib/sanitario/models/domain";

type TaxonomyRecord = Record<string, unknown>;
type TaxonomyInput = SanitaryProtocolItemDomain | TaxonomyRecord | null | undefined;

const PROTOCOL_KINDS: readonly ProtocolKind[] = [
  "vacinacao",
  "antiparasitario",
  "medicamento",
  "biosseguranca",
  "nutricao",
  "documental",
  "notificacao",
  "clinico",
  "outro",
];

const MATERIALIZATION_MODES: readonly MaterializationMode[] = [
  "agenda",
  "compliance_only",
  "execution_only",
  "none",
];

const COMPLIANCE_KINDS: readonly ComplianceKind[] = [
  "checklist",
  "document_required",
  "feed_ban",
  "withholding_period",
  "quarantine",
  "none",
];

const VACCINATION_FAMILIES = new Set([
  "brucelose",
  "raiva_herbivoros",
  "clostridioses",
  "reprodutiva",
]);

const ANTIPARASITIC_FAMILIES = new Set([
  "controle_estrategico_parasitas",
  "vermifugacao",
  "vermifugacao_desmama",
]);

const MEDICINE_FAMILIES = new Set([
  "cura_umbigo",
  "tristeza_parasitaria_bovina",
  "terapia_vaca_seca",
]);

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is TaxonomyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDomainItem(input: TaxonomyInput): input is SanitaryProtocolItemDomain {
  return (
    isRecord(input) &&
    isRecord(input.identity) &&
    isRecord(input.schedule) &&
    isRecord(input.compliance)
  );
}

function getField(input: TaxonomyInput, ...keys: string[]): unknown {
  if (!isRecord(input)) return undefined;
  for (const key of keys) {
    if (key in input) return input[key];
  }
  const payload = input.payload;
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    if (key in payload) return payload[key];
  }
  return undefined;
}

function readBoolean(input: TaxonomyInput, ...keys: string[]): boolean | null {
  const value = getField(input, ...keys);
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
}

function hasNonEmptyObject(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function hasArrayEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function readKind<T extends string>(
  input: TaxonomyInput,
  allowed: readonly T[],
  ...keys: string[]
): T | null {
  const normalized = normalizeToken(getField(input, ...keys));
  return normalized && allowed.includes(normalized as T) ? (normalized as T) : null;
}

function readTextTokens(input: TaxonomyInput): Set<string> {
  const tokens = [
    getField(input, "tipo", "type"),
    getField(input, "categoria", "category"),
    getField(input, "area"),
    getField(input, "codigo", "code", "item_code", "itemCode"),
    getField(input, "subarea"),
    getField(input, "execution_mode", "executionMode"),
    getField(input, "protocol_kind", "protocolKind"),
  ]
    .map(normalizeToken)
    .filter((entry): entry is string => Boolean(entry));

  return new Set(tokens);
}

function resolveProtocolKindFromFamily(input: TaxonomyInput): ProtocolKind | null {
  if (!isDomainItem(input)) return null;
  const familyCode = normalizeToken(input.identity.familyCode);
  if (!familyCode) return null;
  if (VACCINATION_FAMILIES.has(familyCode)) return "vacinacao";
  if (ANTIPARASITIC_FAMILIES.has(familyCode)) return "antiparasitario";
  if (MEDICINE_FAMILIES.has(familyCode)) return "medicamento";
  return null;
}

export function resolveProtocolKind(input: TaxonomyInput): ProtocolKind {
  const explicit = readKind(
    input,
    PROTOCOL_KINDS,
    "protocol_kind",
    "protocolKind",
  );
  if (explicit) return explicit;

  const tokens = readTextTokens(input);
  if (tokens.has("vacinacao") || tokens.has("vacinas") || tokens.has("vacina")) {
    return "vacinacao";
  }
  if (
    tokens.has("vermifugacao") ||
    tokens.has("vermifugo") ||
    tokens.has("parasitas") ||
    tokens.has("antiparasitario")
  ) {
    return "antiparasitario";
  }
  if (tokens.has("medicamento") || tokens.has("medicamentos")) {
    return "medicamento";
  }
  if (tokens.has("nutricao")) return "nutricao";
  if (tokens.has("biosseguranca")) return "biosseguranca";
  if (tokens.has("notificacao")) return "notificacao";
  if (
    tokens.has("documental") ||
    tokens.has("documento") ||
    tokens.has("transito") ||
    tokens.has("gta")
  ) {
    return "documental";
  }
  if (tokens.has("clinico") || tokens.has("clinical_protocol")) return "clinico";

  const familyKind = resolveProtocolKindFromFamily(input);
  return familyKind ?? "outro";
}

export function resolveComplianceKind(input: TaxonomyInput): ComplianceKind {
  const explicit = readKind(
    input,
    COMPLIANCE_KINDS,
    "compliance_kind",
    "complianceKind",
  );
  if (explicit) return explicit;

  const complianceState = normalizeToken(
    getField(input, "compliance_state", "complianceState"),
  );
  if (complianceState === "documentation_required") {
    return "document_required";
  }

  const tokens = readTextTokens(input);
  if (tokens.has("feed_ban") || tokens.has("feedban")) return "feed_ban";
  if (tokens.has("quarentena") || tokens.has("quarantine")) return "quarantine";
  if (
    tokens.has("document_required") ||
    tokens.has("document_required") ||
    tokens.has("documental") ||
    tokens.has("gta") ||
    tokens.has("atualizacao_rebanho") ||
    tokens.has("comprovacao_brucelose")
  ) {
    return "document_required";
  }

  if (
    readBoolean(input, "requires_document", "requiresDocument") === true ||
    readBoolean(input, "requires_gta", "requiresGta", "requiresGTA") === true ||
    hasArrayEntries(getField(input, "required_document_types", "requiredDocumentTypes"))
  ) {
    return "document_required";
  }

  if (
    hasNonEmptyObject(getField(input, "carencia_regra_json", "withholding")) ||
    readBoolean(input, "has_withholding", "hasWithholding", "carencia") === true ||
    normalizeToken(getField(input, "withholding_kind", "withholdingKind")) !== null
  ) {
    return "withholding_period";
  }

  if (
    tokens.has("checklist") ||
    tokens.has("execution_mode_checklist") ||
    normalizeToken(getField(input, "execution_mode", "executionMode")) === "checklist"
  ) {
    return "checklist";
  }

  return "none";
}

export function resolveMaterializationMode(
  input: TaxonomyInput,
): MaterializationMode {
  const explicit = readKind(
    input,
    MATERIALIZATION_MODES,
    "materialization_mode",
    "materializationMode",
  );
  if (explicit) return explicit;

  const generatesAgenda = isDomainItem(input)
    ? input.schedule.generatesAgenda
    : readBoolean(input, "gera_agenda", "generates_agenda", "generatesAgenda");

  if (generatesAgenda === true) return "agenda";

  const complianceKind = resolveComplianceKind(input);
  if (generatesAgenda === false && complianceKind !== "none") {
    return "compliance_only";
  }

  if (generatesAgenda === false && resolveProtocolKind(input) === "medicamento") {
    return "execution_only";
  }

  return "none";
}

export function isAgendaMaterializable(input: TaxonomyInput): boolean {
  return resolveMaterializationMode(input) === "agenda";
}

export function isComplianceOnly(input: TaxonomyInput): boolean {
  return resolveMaterializationMode(input) === "compliance_only";
}

export function isExecutionOnly(input: TaxonomyInput): boolean {
  return resolveMaterializationMode(input) === "execution_only";
}
