export type JsonRecord = Record<string, unknown>;

export type SanitaryProtocolV2ReadModel = {
  id: string;
  familyCode: string;
  name: string;
  scope: "global" | "pack" | "fazenda" | string;
  fazendaId: string | null;
  speciesScope: JsonRecord;
  jurisdictionScope: JsonRecord;
  legalStatus: string;
  version: number;
  status: "draft" | "active" | "retired" | string;
  approvalStatus: string;
  sourceRefsSnapshot: unknown[];
  metadata: JsonRecord;
};

export type SanitaryProtocolItemV2ReadModel = {
  id: string;
  protocolId: string;
  logicalItemKey: string;
  version: number;
  itemStatus: string;
  actionType: string;
  productRequirementKind:
    | "specific_product"
    | "product_class"
    | "product_class_group"
    | "none"
    | string;
  productId: string | null;
  productClass: string | null;
  productClassGroupId: string | null;
  eligibilityRule: JsonRecord;
  operationalWindowRule: JsonRecord;
  doseRule: JsonRecord;
  routeRule: JsonRecord;
  boosterRule: JsonRecord;
  speciesAuthorization: JsonRecord;
  sourceRefsByField: JsonRecord;
  limitations: JsonRecord | string[];
  snapshotTemplate: JsonRecord;
  allowsAgendaAuto: boolean;
  requiresMvResponsavel: boolean;
  status: string;
};

export type SanitaryProductClassGroupV2ReadModel = {
  id: string;
  fazendaId: string | null;
  scope: "global" | "tenant" | string;
  groupKey: string;
  name: string;
  requiresMvForOtherClass: boolean;
  curationStatus: string;
  automationStatus: string;
  limitations: string[];
  metadata: JsonRecord;
};

export type SanitaryProtocolV2WithItems = {
  protocol: SanitaryProtocolV2ReadModel;
  items: SanitaryProtocolItemV2ReadModel[];
};

export type SanitaryProtocolCatalogSummaryV2 = {
  protocolCount: number;
  itemCount: number;
  productClassGroupCount: number;
  memberImportBlockedCount: number;
  hasB19NationalRule: boolean;
  hasAftosaBlockedRule: boolean;
  antiparasiticItemsUseProductClassGroup: boolean;
  hasAgendaAutoEnabled: boolean;
  hasApprovedCatalogProtocol: boolean;
  createsAgenda: false;
  createsEvent: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
  allowsOperationalRelease: false;
  productClassGroupAuthorizesExecution: false;
  productClassGroupAuthorizesDose: false;
  productClassGroupAuthorizesWithdrawal: false;
  requiresRealProductForExecution: true;
};

export type SanitaryProtocolCatalogReadModelV2 = {
  protocols: SanitaryProtocolV2ReadModel[];
  items: SanitaryProtocolItemV2ReadModel[];
  productClassGroups: SanitaryProductClassGroupV2ReadModel[];
};

export type SanitaryItemLimitationPresentationV2 = {
  operational: string[];
  technical: string[];
  auditCodes: string[];
};

export type ProductRequirementDisplayV2 = {
  title: "Produto exigido";
  value: string;
  qualifier?: string;
};

const ITEM_LABELS_PT_BR: Record<string, string> = {
  b19_femeas_3_8_meses: "B19 — fêmeas de 3 a 8 meses",
  clostridial_primovac_dose1: "Primovacinação — dose 1",
  clostridial_primovac_dose2: "Primovacinação — dose 2",
  clostridial_reforco_anual: "Reforço anual",
  raiva_primovac_dose1: "Primovacinação — dose 1",
  raiva_primovac_reforco_30d: "Reforço da primovacinação — 30 dias",
  raiva_reforco_anual_area_risco: "Reforço anual em área de risco",
  recria_maio: "Recria — maio",
  recria_julho: "Recria — julho",
  recria_setembro: "Recria — setembro",
  matrizes_pre_parto_antiparasitario: "Antiparasitário pré-parto",
  pre_confinamento_dose_unica: "Dose única pré-confinamento/pasto vedado",
  pre_desmama_situacional: "Vermifugação pré-desmama situacional",
  fmd_historico_contingencia: "Histórico/contingência de febre aftosa",
  fmd_bloqueio_vacinacao_rotina: "Bloqueio de vacinação de rotina",
  lepto_primovac_dose1: "Primovacinação — dose 1",
  lepto_primovac_dose2: "Primovacinação — dose 2",
  lepto_reforco_anual_semestral: "Reforço anual/semestral",
  ibr_bvd_primovac_dose1: "Primovacinação — dose 1",
  ibr_bvd_primovac_dose2: "Primovacinação — dose 2",
};

const REQUIREMENT_KIND_LABELS_PT_BR: Record<string, string> = {
  product_class: "Classe técnica",
  product_class_group: "Grupo técnico",
  specific_product: "Produto específico",
  none: "Sem produto executável",
};

const PRODUCT_CLASS_LABELS_PT_BR: Record<string, string> = {
  vacina_brucelose_b19: "Vacina contra brucelose B19",
  vacina_clostridial: "Vacina clostridial",
  vacina_clostridial_multivalente: "Vacina clostridial",
  vacina_ibr_bvd: "Vacina IBR/BVD",
  vacina_leptospirose: "Vacina contra leptospirose",
  vacina_raiva_herbivoros: "Vacina contra raiva dos herbívoros",
};

const ACTION_TYPE_LABELS_PT_BR: Record<string, string> = {
  vacinacao: "Vacinação",
  vermifugacao: "Vermifugação",
  alerta: "Alerta",
  orientacao: "Orientação",
};

const STATUS_LABELS_PT_BR: Record<string, string> = {
  obrigatorio: "Obrigatório",
  recomendado: "Recomendado",
  condicional: "Condicional",
  estrategico: "Estratégico",
  bloqueado: "Bloqueado",
  draft: "Rascunho",
  retired: "Retirado",
  manual_only: "Manual",
  preview_allowed: "Prévia permitida",
  blocked: "Bloqueado",
  needs_review: "Requer revisão",
  archived: "Arquivado",
  active: "Ativo",
};

export type SanitaryProtocolCatalogQueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type SanitaryProtocolCatalogQueryBuilder<T extends JsonRecord> =
  PromiseLike<SanitaryProtocolCatalogQueryResult<T>> & {
    select(columns: string): SanitaryProtocolCatalogQueryBuilder<T>;
    is(column: string, value: null): SanitaryProtocolCatalogQueryBuilder<T>;
    eq(column: string, value: string): SanitaryProtocolCatalogQueryBuilder<T>;
    order(
      column: string,
      options?: { ascending?: boolean },
    ): SanitaryProtocolCatalogQueryBuilder<T>;
  };

export type SanitaryProtocolCatalogQueryClient = {
  from<T extends JsonRecord = JsonRecord>(
    table: string,
  ): SanitaryProtocolCatalogQueryBuilder<T>;
};

export type SanitaryProtocolCatalogLocalDb = {
  catalog_sanitario_protocolos_v2: {
    toArray(): Promise<JsonRecord[]>;
  };
  catalog_sanitario_protocolo_itens_versions_v2: {
    toArray(): Promise<JsonRecord[]>;
  };
  catalog_sanitario_product_class_groups_v2: {
    toArray(): Promise<JsonRecord[]>;
  };
};

const PROTOCOL_COLUMNS = [
  "id",
  "family_code",
  "name",
  "scope",
  "fazenda_id",
  "species_scope",
  "jurisdiction_scope",
  "legal_status",
  "version",
  "status",
  "source_refs_snapshot",
  "approval_status",
  "metadata",
].join(", ");

const ITEM_COLUMNS = [
  "id",
  "protocol_id",
  "logical_item_key",
  "version",
  "item_status",
  "action_type",
  "product_requirement_kind",
  "product_id",
  "product_class",
  "product_class_group_id",
  "eligibility_rule",
  "operational_window_rule",
  "dose_rule",
  "route_rule",
  "booster_rule",
  "species_authorization",
  "source_refs_by_field",
  "limitations",
  "snapshot_template",
  "allows_agenda_auto",
  "requires_mv_responsavel",
  "status",
].join(", ");

const GROUP_COLUMNS = [
  "id",
  "fazenda_id",
  "scope",
  "group_key",
  "name",
  "requires_mv_for_other_class",
  "curation_status",
  "automation_status",
  "limitations",
  "metadata",
].join(", ");

const ANTIPARASITIC_ITEM_KEYS = new Set([
  "recria_maio",
  "recria_julho",
  "recria_setembro",
  "pre_desmama_situacional",
  "pre_confinamento_dose_unica",
  "matrizes_pre_parto_antiparasitario",
]);

const RAIVA_ITEM_KEYS = new Set([
  "raiva_primovac_dose1",
  "raiva_primovac_reforco_30d",
  "raiva_reforco_anual_area_risco",
]);

const MATRIX_PREPARTUM_ALLOWED_ITEM_KEYS = new Set([
  "matrizes_pre_parto_antiparasitario",
]);

const INACTIVE_ITEM_STATUSES = new Set(["tombstoned", "inactive", "archived"]);

const DEPRECATED_ITEM_KEYS = new Set([
  "raiva_area_risco_anual",
  "matrizes_pre_parto_lepto_reforco_situacional",
]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const readSpeciesScope = (value: unknown): JsonRecord =>
  Array.isArray(value) ? { especies: readStringArray(value) } : readRecord(value);

const readString = (record: JsonRecord, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const readNumber = (record: JsonRecord, key: string): number => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const readBoolean = (record: JsonRecord, key: string): boolean =>
  record[key] === true;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const readUnknownArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const hasStringEntry = (value: unknown, expected: string): boolean => {
  if (typeof value === "string") return value === expected;
  if (Array.isArray(value)) return value.includes(expected);
  return false;
};

const readAlias = (
  record: JsonRecord,
  primaryKey: string,
  fallbackKey: string,
): unknown => record[primaryKey] ?? record[fallbackKey];

const metadataFlag = (record: { metadata: JsonRecord }, key: string): boolean =>
  record.metadata[key] === true;

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values));

const UUID_LIKE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const SNAKE_CASE_LIKE = /\b[a-z][a-z0-9]+(?:_[a-z0-9]+)+\b/;

const collectStringValues = (value: unknown): string[] => {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }
  return [];
};

const collectPolicyEntries = (value: unknown): string[] => {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([, entry]) => typeof entry === "string" && entry.trim().length > 0)
    .map(([key, entry]) => `${key}: ${String(entry).trim()}`);
};

const normalizeLimitationCode = (value: string): string =>
  value
    .trim()
    .replace(/^lacuna de fonte:\s*/i, "")
    .replace(/^política de fonte:\s*/i, "")
    .replace(/^politica de fonte:\s*/i, "")
    .replace(/^restrição:\s*/i, "")
    .replace(/^restricao:\s*/i, "")
    .replace(/\s+/g, " ");

const humanizeUnknownLimitation = (value: string): string => {
  const text = normalizeLimitationCode(value)
    .replace(UUID_LIKE, "identificador interno")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0 ? text : "Limitação técnica não detalhada.";
};

const sanitizeHumanLimitation = (value: string): string =>
  value
    .replace(UUID_LIKE, "identificador interno")
    .replace(SNAKE_CASE_LIKE, (match) => match.replace(/_/g, " "))
    .replace(/\s+/g, " ")
    .trim();

type LimitationMessageEntry = {
  key: string;
  message: string;
  section: "operational" | "technical";
};

const LIMITATION_MESSAGE_BY_CODE: Record<string, LimitationMessageEntry> = {
  requires_mv_habilitado: {
    key: "enabled_veterinarian",
    message: "Exige médico-veterinário habilitado.",
    section: "operational",
  },
  requires_official_record_flow: {
    key: "official_record",
    message: "Exige fluxo oficial de registro quando aplicável.",
    section: "operational",
  },
  requires_marking_when_applicable: {
    key: "official_marking",
    message:
      "Pode exigir marcação/identificação conforme regra oficial aplicável.",
    section: "operational",
  },
  requires_executed_product_snapshot: {
    key: "real_product_snapshot",
    message: "Exige produto real registrado na execução.",
    section: "operational",
  },
  requires_product_catalog_validation: {
    key: "product_catalog_validation",
    message: "Exige validação do produto no catálogo técnico.",
    section: "operational",
  },
  source_gap_age_product: {
    key: "age_product_source_gap",
    message: "Há lacuna de fonte para idade/produto.",
    section: "operational",
  },
  source_gap_bubalino: {
    key: "bubalino_source_gap",
    message: "Bubalinos exigem fonte/bula específica quando aplicável.",
    section: "operational",
  },
  product_specific_label_required: {
    key: "product_label_required",
    message: "Dose, via e carência dependem da bula do produto executado.",
    section: "operational",
  },
  do_not_generalize_class: {
    key: "do_not_generalize_class",
    message: "Classe técnica não autoriza generalizar dose, via ou carência.",
    section: "operational",
  },
  withdrawal_by_executed_product: {
    key: "withdrawal_by_executed_product",
    message: "Carência deve seguir o produto executado.",
    section: "operational",
  },
  execution_requires_enabled_veterinarian: {
    key: "enabled_veterinarian",
    message: "Exige médico-veterinário habilitado.",
    section: "operational",
  },
  execution_requires_official_record: {
    key: "official_record",
    message: "Exige fluxo oficial de registro quando aplicável.",
    section: "operational",
  },
  execution_requires_real_product_snapshot: {
    key: "real_product_snapshot",
    message: "Exige produto real registrado na execução.",
    section: "operational",
  },
  "dose: by_executed_product_label": {
    key: "dose_by_executed_product_label",
    message: "Dose deve seguir a bula do produto executado.",
    section: "operational",
  },
  "withdrawal: by_executed_product_snapshot": {
    key: "withdrawal_by_executed_product",
    message: "Carência deve seguir o produto executado.",
    section: "operational",
  },
  by_executed_product_snapshot: {
    key: "withdrawal_by_executed_product",
    message: "Carência deve seguir o produto executado.",
    section: "operational",
  },
  by_executed_product_label: {
    key: "dose_by_executed_product_label",
    message: "Dose deve seguir a bula do produto executado.",
    section: "operational",
  },
  by_executed_product_and_weight: {
    key: "weight_for_dose",
    message: "Pode exigir peso para dose quando aplicável.",
    section: "operational",
  },
  requires_real_product: {
    key: "real_product_snapshot",
    message: "Exige produto real registrado na execução.",
    section: "operational",
  },
  produto_real_obrigatorio_na_execucao: {
    key: "real_product_snapshot",
    message: "Exige produto real registrado na execução.",
    section: "operational",
  },
  source_gap_executed_product_label: {
    key: "product_label_required",
    message: "Dose, via e carência dependem da bula do produto executado.",
    section: "operational",
  },
  source_gap_product_withdrawal_snapshot: {
    key: "withdrawal_by_executed_product",
    message: "Carência deve seguir o produto executado.",
    section: "operational",
  },
  source_gap_label_or_mv: {
    key: "label_or_vet_source_gap",
    message: "Exige bula do produto ou orientação técnica responsável.",
    section: "operational",
  },
  source_gap_mv_decision: {
    key: "vet_decision_source_gap",
    message: "Exige avaliação técnica responsável quando aplicável.",
    section: "operational",
  },
  requires_weight: {
    key: "weight_for_dose",
    message: "Pode exigir peso para dose quando aplicável.",
    section: "operational",
  },
  requires_weight_or_label: {
    key: "weight_for_dose",
    message: "Pode exigir peso para dose quando aplicável.",
    section: "operational",
  },
  requires_rotation_context: {
    key: "rotation_context",
    message: "Pode exigir avaliação de rotação de classes/produtos.",
    section: "operational",
  },
  chemical_class_rotation_required: {
    key: "rotation_context",
    message: "Pode exigir avaliação de rotação de classes/produtos.",
    section: "operational",
  },
  class_group_does_not_validate_execution: {
    key: "group_no_dose_withdrawal",
    message: "Grupo técnico não valida dose nem carência.",
    section: "operational",
  },
  members_sem_class_id_bloqueados: {
    key: "group_members_blocked",
    message: "Grupo técnico sem membros ativos.",
    section: "technical",
  },
  gestation_lactation_requires_label_or_mv: {
    key: "gestation_lactation_label_or_vet",
    message: "Gestação e lactação exigem bula do produto ou orientação técnica.",
    section: "operational",
  },
  milk_requires_label: {
    key: "milk_label_required",
    message: "Uso em leite exige bula do produto executado.",
    section: "operational",
  },
  requires_slaughter_withdrawal_review: {
    key: "slaughter_withdrawal_review",
    message: "Exige revisão de carência para abate pelo produto executado.",
    section: "operational",
  },
  slaughter_withdrawal_requires_executed_product: {
    key: "slaughter_withdrawal_review",
    message: "Exige revisão de carência para abate pelo produto executado.",
    section: "operational",
  },
  withdrawal_requires_executed_product: {
    key: "withdrawal_by_executed_product",
    message: "Carência deve seguir o produto executado.",
    section: "operational",
  },
  requires_risk_area_overlay: {
    key: "risk_overlay",
    message: "Depende de avaliação regional/de risco.",
    section: "operational",
  },
  requires_focus_or_perifocus_context: {
    key: "risk_overlay",
    message: "Depende de avaliação regional/de risco.",
    section: "operational",
  },
  requires_regional_overlay: {
    key: "risk_overlay",
    message: "Depende de avaliação regional/de risco.",
    section: "operational",
  },
  regional_risk_context_required: {
    key: "risk_overlay",
    message: "Depende de avaliação regional/de risco.",
    section: "operational",
  },
  vaccination_routine_blocked: {
    key: "blocked_protocol",
    message: "Protocolo bloqueado/retired.",
    section: "operational",
  },
  blocked_archived: {
    key: "blocked_protocol",
    message: "Protocolo bloqueado/retired.",
    section: "operational",
  },
  routine_vaccination_blocked: {
    key: "blocked_protocol",
    message: "Protocolo bloqueado/retired.",
    section: "operational",
  },
  productRequirementKind_none: {
    key: "no_executable_product",
    message: "Item sem produto executável.",
    section: "operational",
  },
};

const DERIVED_LIMITATIONS: Record<
  "product_class" | "product_class_group" | "none" | "specific_product",
  LimitationMessageEntry[]
> = {
  product_class: [
    {
      key: "real_product_snapshot",
      message: "Exige produto real registrado na execução.",
      section: "operational",
    },
    {
      key: "product_label_required",
      message: "Dose, via e carência dependem do produto executado.",
      section: "operational",
    },
  ],
  product_class_group: [
    {
      key: "group_no_dose_withdrawal",
      message: "Grupo técnico não valida dose nem carência.",
      section: "operational",
    },
    {
      key: "real_product_snapshot",
      message: "Produto real continua obrigatório na execução.",
      section: "operational",
    },
    {
      key: "technical_choice_required",
      message:
        "Pode exigir escolha técnica entre classes/produtos no momento da execução.",
      section: "operational",
    },
  ],
  none: [
    {
      key: "no_executable_product",
      message: "Item sem produto executável.",
      section: "operational",
    },
    {
      key: "no_operational_action",
      message: "Não gera ação sanitária operacional.",
      section: "operational",
    },
  ],
  specific_product: [
    {
      key: "specific_product",
      message: "Item depende do produto específico indicado.",
      section: "operational",
    },
  ],
};

const addPresentationMessage = (
  presentation: SanitaryItemLimitationPresentationV2,
  seen: Set<string>,
  entry: LimitationMessageEntry,
) => {
  if (seen.has(entry.key)) return;
  const message = sanitizeHumanLimitation(entry.message);
  if (!message) return;
  seen.add(entry.key);
  presentation[entry.section].push(message);
};

export function formatSanitaryLimitationCodeV2(
  rawCode: string,
  fallbackSection: "operational" | "technical" = "technical",
): LimitationMessageEntry {
  const normalizedCode = normalizeLimitationCode(rawCode);
  const mapped = LIMITATION_MESSAGE_BY_CODE[normalizedCode];
  if (mapped) return mapped;

  const message = normalizedCode.startsWith("source_gap_")
    ? `Lacuna técnica: ${humanizeUnknownLimitation(normalizedCode.replace(/^source_gap_/, ""))}.`
    : normalizedCode.includes(":")
      ? `Política técnica: ${humanizeUnknownLimitation(normalizedCode)}.`
      : `Limitação técnica: ${humanizeUnknownLimitation(normalizedCode)}.`;

  return {
    key: `unknown:${normalizedCode.toLowerCase()}`,
    message,
    section: fallbackSection,
  };
}

export function dedupeSanitaryLimitationMessagesV2(
  values: string[],
): string[] {
  const normalized = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const message = sanitizeHumanLimitation(value);
    const key = message
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
      .trim();
    if (!key || normalized.has(key)) continue;
    normalized.add(key);
    result.push(message);
  }

  return result;
}

export function buildSanitaryItemProductClassGroupDisplayV2(
  item: SanitaryProtocolItemV2ReadModel,
  groups: SanitaryProductClassGroupV2ReadModel[],
): string {
  if (item.productRequirementKind === "product_class_group") {
    const group = groups.find((entry) => entry.id === item.productClassGroupId);
    return group?.name ?? "Grupo técnico não encontrado";
  }

  if (item.productRequirementKind === "product_class") {
    return "Não se aplica — item usa classe técnica";
  }

  if (item.productRequirementKind === "specific_product") {
    return "Não se aplica — item usa produto específico";
  }

  if (item.productRequirementKind === "none") {
    return "Não se aplica — item bloqueado/sem produto";
  }

  return "Não se aplica — requisito de produto não reconhecido";
}

export function formatSanitaryProtocolItemLabelV2(
  itemOrKey: SanitaryProtocolItemV2ReadModel | string,
): string {
  const key = typeof itemOrKey === "string" ? itemOrKey : itemOrKey.logicalItemKey;
  return ITEM_LABELS_PT_BR[key] ?? humanizeUnknownLimitation(key);
}

export function formatSanitaryRequirementKindV2(kind: string): string {
  return REQUIREMENT_KIND_LABELS_PT_BR[kind] ?? humanizeUnknownLimitation(kind);
}

export function formatSanitaryProductClassLabelV2(
  productClass: string | null,
): string {
  if (!productClass) return "Não se aplica";
  return PRODUCT_CLASS_LABELS_PT_BR[productClass] ?? humanizeUnknownLimitation(productClass);
}

export function formatSanitaryActionTypeV2(actionType: string): string {
  return ACTION_TYPE_LABELS_PT_BR[actionType] ?? humanizeUnknownLimitation(actionType);
}

export function formatSanitaryItemStatusV2(status: string): string {
  return STATUS_LABELS_PT_BR[status] ?? humanizeUnknownLimitation(status);
}

export function formatSanitaryBooleanPtBrV2(value: boolean): string {
  return value ? "Sim" : "Não";
}

export function buildSanitaryProductRequirementDisplayV2(
  item: SanitaryProtocolItemV2ReadModel,
  groups: SanitaryProductClassGroupV2ReadModel[],
): ProductRequirementDisplayV2 {
  if (item.productRequirementKind === "product_class") {
    return {
      title: "Produto exigido",
      value: formatSanitaryProductClassLabelV2(item.productClass),
      qualifier: "Classe técnica",
    };
  }

  if (item.productRequirementKind === "product_class_group") {
    return {
      title: "Produto exigido",
      value: buildSanitaryItemProductClassGroupDisplayV2(item, groups),
      qualifier: "Grupo técnico",
    };
  }

  if (item.productRequirementKind === "specific_product") {
    return {
      title: "Produto exigido",
      value: item.productId ?? "Produto específico",
      qualifier: "Produto específico",
    };
  }

  if (item.productRequirementKind === "none") {
    return {
      title: "Produto exigido",
      value: "Não se aplica — item bloqueado/sem produto",
      qualifier: "Sem produto executável",
    };
  }

  return {
    title: "Produto exigido",
    value: "Requisito de produto não reconhecido",
  };
}

export function buildSanitaryItemLimitationPresentationV2(
  item: SanitaryProtocolItemV2ReadModel,
  protocol?: SanitaryProtocolV2ReadModel | null,
): SanitaryItemLimitationPresentationV2 {
  const snapshotMetadata = readRecord(item.snapshotTemplate.metadata);
  const protocolMetadata = readRecord(protocol?.metadata);
  const rawValues = [
    ...collectStringValues(item.limitations),
    ...collectStringValues(item.snapshotTemplate.sourceGaps),
    ...collectPolicyEntries(item.snapshotTemplate.sourcePolicy),
    ...collectStringValues(item.snapshotTemplate.restrictions),
    ...collectStringValues(snapshotMetadata.sourceGaps),
    ...collectStringValues(snapshotMetadata.restrictions),
    ...collectStringValues(protocolMetadata.sourceGaps),
    ...collectStringValues(protocolMetadata.restrictions),
  ];
  const presentation: SanitaryItemLimitationPresentationV2 = {
    operational: [],
    technical: [],
    auditCodes: uniqueStrings(rawValues.map(normalizeLimitationCode)),
  };
  const seen = new Set<string>();

  const productRequirementKind = item.productRequirementKind as keyof typeof DERIVED_LIMITATIONS;
  const addDerivedMessages = () => {
    for (const entry of DERIVED_LIMITATIONS[productRequirementKind] ?? []) {
      addPresentationMessage(presentation, seen, entry);
    }
  };
  const addRawMessages = () => {
    for (const rawValue of rawValues) {
      addPresentationMessage(
        presentation,
        seen,
        formatSanitaryLimitationCodeV2(rawValue),
      );
    }
  };

  if (item.productRequirementKind === "product_class_group") {
    addDerivedMessages();
    addRawMessages();
  } else {
    addRawMessages();
    addDerivedMessages();
  }

  presentation.operational = dedupeSanitaryLimitationMessagesV2(
    presentation.operational,
  );
  presentation.technical = dedupeSanitaryLimitationMessagesV2(
    presentation.technical,
  ).filter((entry) => !presentation.operational.includes(entry));

  if (presentation.operational.length === 0 && presentation.technical.length === 0) {
    presentation.operational.push("Sem limitações registradas.");
  }

  return presentation;
}

export function buildSanitaryItemLimitationsDisplayV2(
  item: SanitaryProtocolItemV2ReadModel,
  protocol?: SanitaryProtocolV2ReadModel | null,
): string[] {
  return buildSanitaryItemLimitationPresentationV2(item, protocol).operational;
}

function throwQueryError(table: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`Falha ao ler ${table}: ${error.message}`);
  }
}

export function adaptSanitaryProtocolV2Row(
  row: JsonRecord,
): SanitaryProtocolV2ReadModel {
  return {
    id: readString(row, "id") ?? "",
    familyCode: readString(row, "family_code") ?? "",
    name: readString(row, "name") ?? "",
    scope: readString(row, "scope") ?? "",
    fazendaId: readString(row, "fazenda_id"),
    speciesScope: readSpeciesScope(row.species_scope),
    jurisdictionScope: readRecord(row.jurisdiction_scope),
    legalStatus: readString(row, "legal_status") ?? "",
    version: readNumber(row, "version"),
    status: readString(row, "status") ?? "",
    approvalStatus: readString(row, "approval_status") ?? "",
    sourceRefsSnapshot: readUnknownArray(row.source_refs_snapshot),
    metadata: readRecord(row.metadata),
  };
}

export function adaptSanitaryProtocolItemV2Row(
  row: JsonRecord,
): SanitaryProtocolItemV2ReadModel {
  return {
    id: readString(row, "id") ?? "",
    protocolId: readString(row, "protocol_id") ?? "",
    logicalItemKey: readString(row, "logical_item_key") ?? "",
    version: readNumber(row, "version"),
    itemStatus: readString(row, "item_status") ?? "",
    actionType: readString(row, "action_type") ?? "",
    productRequirementKind: readString(row, "product_requirement_kind") ?? "",
    productId: readString(row, "product_id"),
    productClass: readString(row, "product_class"),
    productClassGroupId: readString(row, "product_class_group_id"),
    eligibilityRule: readRecord(row.eligibility_rule),
    operationalWindowRule: readRecord(row.operational_window_rule),
    doseRule: readRecord(row.dose_rule),
    routeRule: readRecord(row.route_rule),
    boosterRule: readRecord(row.booster_rule),
    speciesAuthorization: readRecord(row.species_authorization),
    sourceRefsByField: readRecord(row.source_refs_by_field),
    limitations: Array.isArray(row.limitations)
      ? readStringArray(row.limitations)
      : readRecord(row.limitations),
    snapshotTemplate: readRecord(row.snapshot_template),
    allowsAgendaAuto: row.allows_agenda_auto === true,
    requiresMvResponsavel: row.requires_mv_responsavel === true,
    status: readString(row, "status") ?? "",
  };
}

export function adaptSanitaryProductClassGroupV2Row(
  row: JsonRecord,
): SanitaryProductClassGroupV2ReadModel {
  return {
    id: readString(row, "id") ?? "",
    fazendaId: readString(row, "fazenda_id"),
    scope: readString(row, "scope") ?? "",
    groupKey: readString(row, "group_key") ?? "",
    name: readString(row, "name") ?? "",
    requiresMvForOtherClass: row.requires_mv_for_other_class === true,
    curationStatus: readString(row, "curation_status") ?? "",
    automationStatus: readString(row, "automation_status") ?? "",
    limitations: readStringArray(row.limitations),
    metadata: readRecord(row.metadata),
  };
}

export async function listSanitaryProtocolsV2(
  client: SanitaryProtocolCatalogQueryClient,
): Promise<SanitaryProtocolV2ReadModel[]> {
  const { data, error } = await client
    .from("sanitario_protocolos_v2")
    .select(PROTOCOL_COLUMNS)
    .is("deleted_at", null)
    .order("family_code", { ascending: true });

  throwQueryError("sanitario_protocolos_v2", error);
  return (data ?? []).map(adaptSanitaryProtocolV2Row);
}

export async function listSanitaryProtocolItemsV2(
  client: SanitaryProtocolCatalogQueryClient,
  protocolId?: string,
): Promise<SanitaryProtocolItemV2ReadModel[]> {
  let query = client
    .from("sanitario_protocolo_itens_versions_v2")
    .select(ITEM_COLUMNS)
    .is("deleted_at", null);

  if (protocolId) {
    query = query.eq("protocol_id", protocolId);
  }

  const { data, error } = await query
    .order("protocol_id", { ascending: true })
    .order("logical_item_key", { ascending: true })
    .order("version", { ascending: true });

  throwQueryError("sanitario_protocolo_itens_versions_v2", error);
  return filterActiveSanitaryProtocolItemsV2(
    (data ?? []).map(adaptSanitaryProtocolItemV2Row),
  );
}

export async function listSanitaryProductClassGroupsV2(
  client: SanitaryProtocolCatalogQueryClient,
): Promise<SanitaryProductClassGroupV2ReadModel[]> {
  const { data, error } = await client
    .from("sanitario_product_class_groups_v2")
    .select(GROUP_COLUMNS)
    .is("deleted_at", null)
    .order("scope", { ascending: true })
    .order("group_key", { ascending: true });

  throwQueryError("sanitario_product_class_groups_v2", error);
  return (data ?? []).map(adaptSanitaryProductClassGroupV2Row);
}

export async function getSanitaryProtocolV2WithItems(
  client: SanitaryProtocolCatalogQueryClient,
  input: { protocolId?: string; familyCode?: string },
): Promise<SanitaryProtocolV2WithItems | null> {
  const protocols = await listSanitaryProtocolsV2(client);
  const protocol =
    protocols.find((entry) => entry.id === input.protocolId) ??
    protocols.find((entry) => entry.familyCode === input.familyCode) ??
    null;

  if (!protocol) return null;

  const items = await listSanitaryProtocolItemsV2(client, protocol.id);

  return {
    protocol,
    items: filterActiveSanitaryProtocolItemsV2(items, [protocol]),
  };
}

export async function readSanitaryProtocolCatalogV2(
  client: SanitaryProtocolCatalogQueryClient,
): Promise<SanitaryProtocolCatalogReadModelV2> {
  const [protocols, items, productClassGroups] = await Promise.all([
    listSanitaryProtocolsV2(client),
    listSanitaryProtocolItemsV2(client),
    listSanitaryProductClassGroupsV2(client),
  ]);

  return {
    protocols,
    items: filterActiveSanitaryProtocolItemsV2(items, protocols),
    productClassGroups,
  };
}

async function getDefaultLocalDb(): Promise<SanitaryProtocolCatalogLocalDb> {
  const { db } = await import("@/lib/offline/db");
  return db as unknown as SanitaryProtocolCatalogLocalDb;
}

const isNotDeleted = (row: JsonRecord): boolean => row.deleted_at == null;

function isActiveSanitaryProtocolItemV2(
  item: SanitaryProtocolItemV2ReadModel,
  protocols?: SanitaryProtocolV2ReadModel[],
): boolean {
  const itemStatus = item.itemStatus.trim().toLowerCase();
  const rowStatus = item.status.trim().toLowerCase();

  if (INACTIVE_ITEM_STATUSES.has(itemStatus)) return false;
  if (INACTIVE_ITEM_STATUSES.has(rowStatus)) return false;
  if (DEPRECATED_ITEM_KEYS.has(item.logicalItemKey)) return false;

  const protocol = protocols?.find((entry) => entry.id === item.protocolId);
  if (protocol?.familyCode === "raiva_herbivoros") {
    return RAIVA_ITEM_KEYS.has(item.logicalItemKey);
  }
  if (protocol?.familyCode === "matrizes_pre_parto") {
    return MATRIX_PREPARTUM_ALLOWED_ITEM_KEYS.has(item.logicalItemKey);
  }

  return true;
}

function filterActiveSanitaryProtocolItemsV2(
  items: SanitaryProtocolItemV2ReadModel[],
  protocols?: SanitaryProtocolV2ReadModel[],
): SanitaryProtocolItemV2ReadModel[] {
  return items.filter((item) => isActiveSanitaryProtocolItemV2(item, protocols));
}

export async function listLocalSanitaryProtocolsV2(
  localDb?: SanitaryProtocolCatalogLocalDb,
): Promise<SanitaryProtocolV2ReadModel[]> {
  const offlineDb = localDb ?? (await getDefaultLocalDb());
  const rows = await offlineDb.catalog_sanitario_protocolos_v2.toArray();

  return rows
    .filter(isNotDeleted)
    .map(adaptSanitaryProtocolV2Row)
    .sort((left, right) => left.familyCode.localeCompare(right.familyCode));
}

export async function listLocalSanitaryProtocolItemsV2(
  protocolId?: string,
  localDb?: SanitaryProtocolCatalogLocalDb,
): Promise<SanitaryProtocolItemV2ReadModel[]> {
  const offlineDb = localDb ?? (await getDefaultLocalDb());
  const rows = await offlineDb.catalog_sanitario_protocolo_itens_versions_v2.toArray();

  return rows
    .filter(isNotDeleted)
    .filter((row) => !protocolId || row.protocol_id === protocolId)
    .map(adaptSanitaryProtocolItemV2Row)
    .filter((item) => isActiveSanitaryProtocolItemV2(item))
    .sort((left, right) => {
      const protocolDiff = left.protocolId.localeCompare(right.protocolId);
      if (protocolDiff !== 0) return protocolDiff;
      const keyDiff = left.logicalItemKey.localeCompare(right.logicalItemKey);
      if (keyDiff !== 0) return keyDiff;
      return left.version - right.version;
    });
}

export async function listLocalSanitaryProductClassGroupsV2(
  localDb?: SanitaryProtocolCatalogLocalDb,
): Promise<SanitaryProductClassGroupV2ReadModel[]> {
  const offlineDb = localDb ?? (await getDefaultLocalDb());
  const rows = await offlineDb.catalog_sanitario_product_class_groups_v2.toArray();

  return rows
    .filter(isNotDeleted)
    .map(adaptSanitaryProductClassGroupV2Row)
    .sort((left, right) => left.groupKey.localeCompare(right.groupKey));
}

export async function getLocalSanitaryProtocolV2WithItems(
  input: { protocolId?: string; familyCode?: string },
  localDb?: SanitaryProtocolCatalogLocalDb,
): Promise<SanitaryProtocolV2WithItems | null> {
  const protocols = await listLocalSanitaryProtocolsV2(localDb);
  const protocol =
    protocols.find((entry) => entry.id === input.protocolId) ??
    protocols.find((entry) => entry.familyCode === input.familyCode) ??
    null;

  if (!protocol) return null;

  const items = await listLocalSanitaryProtocolItemsV2(protocol.id, localDb);

  return {
    protocol,
    items: filterActiveSanitaryProtocolItemsV2(items, [protocol]),
  };
}

export async function readLocalSanitaryProtocolCatalogV2(
  localDb?: SanitaryProtocolCatalogLocalDb,
): Promise<SanitaryProtocolCatalogReadModelV2> {
  const [protocols, items, productClassGroups] = await Promise.all([
    listLocalSanitaryProtocolsV2(localDb),
    listLocalSanitaryProtocolItemsV2(undefined, localDb),
    listLocalSanitaryProductClassGroupsV2(localDb),
  ]);

  return {
    protocols,
    items: filterActiveSanitaryProtocolItemsV2(items, protocols),
    productClassGroups,
  };
}

function isB19NationalRule(
  protocol: SanitaryProtocolV2ReadModel,
  items: SanitaryProtocolItemV2ReadModel[],
): boolean {
  if (protocol.familyCode !== "brucelose_b19") return false;
  if (protocol.status !== "draft") return false;

  const item = items.find(
    (entry) =>
      entry.protocolId === protocol.id &&
      entry.logicalItemKey === "b19_femeas_3_8_meses",
  );
  if (!item) return false;

  const species = readAlias(protocol.speciesScope, "especies", "species");
  const sex = readAlias(item.eligibilityRule, "sexo", "sex");
  const minAge = readAlias(
    item.eligibilityRule,
    "idade_min_meses",
    "age_min_months",
  );
  const maxAge = readAlias(
    item.eligibilityRule,
    "idade_max_meses",
    "age_max_months",
  );
  const country = readAlias(protocol.jurisdictionScope, "pais", "country");
  const legalScope = readAlias(
    protocol.jurisdictionScope,
    "escopo",
    "legal_scope",
  );

  return (
    hasStringEntry(species, "bovino") &&
    hasStringEntry(species, "bubalino") &&
    hasStringEntry(sex, "femea") &&
    minAge === 3 &&
    maxAge === 8 &&
    country === "BR" &&
    legalScope === "nacional"
  );
}

function isAftosaBlockedRule(
  protocol: SanitaryProtocolV2ReadModel,
  items: SanitaryProtocolItemV2ReadModel[],
): boolean {
  if (protocol.familyCode !== "febre_aftosa") return false;
  if (protocol.status !== "retired") return false;
  if (protocol.legalStatus !== "bloqueado") return false;

  const aftosaItems = items.filter((entry) => entry.protocolId === protocol.id);
  return (
    aftosaItems.length > 0 &&
    aftosaItems.every(
      (entry) =>
        entry.productRequirementKind === "none" &&
        !entry.productId &&
        !entry.productClass &&
        !entry.productClassGroupId,
    )
  );
}

export function buildSanitaryProtocolCatalogSummaryV2(
  readModel: SanitaryProtocolCatalogReadModelV2,
  options?: { memberImportBlockedCount?: number },
): SanitaryProtocolCatalogSummaryV2 {
  const b19Protocol = readModel.protocols.find(
    (entry) => entry.familyCode === "brucelose_b19",
  );
  const aftosaProtocol = readModel.protocols.find(
    (entry) => entry.familyCode === "febre_aftosa",
  );
  const antiparasiticItems = readModel.items.filter((entry) =>
    ANTIPARASITIC_ITEM_KEYS.has(entry.logicalItemKey),
  );

  return {
    protocolCount: readModel.protocols.length,
    itemCount: readModel.items.length,
    productClassGroupCount: readModel.productClassGroups.length,
    memberImportBlockedCount: options?.memberImportBlockedCount ?? 16,
    hasB19NationalRule: b19Protocol
      ? isB19NationalRule(b19Protocol, readModel.items)
      : false,
    hasAftosaBlockedRule: aftosaProtocol
      ? isAftosaBlockedRule(aftosaProtocol, readModel.items)
      : false,
    antiparasiticItemsUseProductClassGroup:
      antiparasiticItems.length === 6 &&
      antiparasiticItems.every(
        (entry) =>
          entry.productRequirementKind === "product_class_group" &&
          Boolean(entry.productClassGroupId),
      ),
    hasAgendaAutoEnabled: readModel.items.some((entry) => entry.allowsAgendaAuto),
    hasApprovedCatalogProtocol: readModel.protocols.some(
      (entry) =>
        entry.approvalStatus === "approved" ||
        metadataFlag(entry, "approved_for_catalog"),
    ),
    createsAgenda: false,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    allowsOperationalRelease: false,
    productClassGroupAuthorizesExecution: false,
    productClassGroupAuthorizesDose: false,
    productClassGroupAuthorizesWithdrawal: false,
    requiresRealProductForExecution: true,
  };
}

export function validateSanitaryProtocolCatalogReadOnlyInvariantsV2(
  readModel: SanitaryProtocolCatalogReadModelV2,
): string[] {
  const issues: string[] = [];
  const summary = buildSanitaryProtocolCatalogSummaryV2(readModel);

  if (summary.protocolCount !== 10) issues.push("protocol_count_mismatch");
  if (summary.itemCount !== 20) issues.push("item_count_mismatch");
  if (summary.productClassGroupCount !== 4) {
    issues.push("product_class_group_count_mismatch");
  }
  if (!summary.hasB19NationalRule) issues.push("b19_national_rule_missing");
  if (!summary.hasAftosaBlockedRule) issues.push("aftosa_blocked_rule_missing");
  if (!summary.antiparasiticItemsUseProductClassGroup) {
    issues.push("antiparasitic_group_lookup_missing");
  }
  const raivaProtocol = readModel.protocols.find(
    (entry) => entry.familyCode === "raiva_herbivoros",
  );
  const raivaItems = readModel.items.filter(
    (entry) => entry.protocolId === raivaProtocol?.id,
  );
  const raivaKeys = new Set(raivaItems.map((entry) => entry.logicalItemKey));
  if (raivaKeys.has("raiva_area_risco_anual")) {
    issues.push("raiva_deprecated_item_active");
  }
  for (const key of RAIVA_ITEM_KEYS) {
    if (!raivaKeys.has(key)) issues.push(`raiva_item_missing:${key}`);
  }
  for (const item of raivaItems) {
    if (item.productRequirementKind !== "product_class") {
      issues.push(`raiva_product_requirement_invalid:${item.logicalItemKey}`);
    }
    if (item.productClass !== "vacina_raiva_herbivoros") {
      issues.push(`raiva_product_class_invalid:${item.logicalItemKey}`);
    }
    if (item.productClassGroupId) {
      issues.push(`raiva_product_class_group_forbidden:${item.logicalItemKey}`);
    }
    if (item.allowsAgendaAuto) {
      issues.push(`raiva_agenda_auto_enabled:${item.logicalItemKey}`);
    }
    if (item.status !== "draft") {
      issues.push(`raiva_item_not_draft:${item.logicalItemKey}`);
    }
    const snapshotMetadata = readRecord(item.snapshotTemplate.metadata);
    if (snapshotMetadata.automationStatus !== "manual_only") {
      issues.push(`raiva_not_manual_only:${item.logicalItemKey}`);
    }
  }
  if (raivaItems.length !== RAIVA_ITEM_KEYS.size) {
    issues.push("raiva_item_count_mismatch");
  }

  const matrizesProtocol = readModel.protocols.find(
    (entry) => entry.familyCode === "matrizes_pre_parto",
  );
  const matrizesFallbackProtocolId = readModel.items.find((entry) =>
    MATRIX_PREPARTUM_ALLOWED_ITEM_KEYS.has(entry.logicalItemKey),
  )?.protocolId;
  const matrizesItems = readModel.items.filter(
    (entry) => entry.protocolId === (matrizesProtocol?.id ?? matrizesFallbackProtocolId),
  );
  const matrizesKeys = new Set(
    matrizesItems.map((entry) => entry.logicalItemKey),
  );
  if (matrizesKeys.has("matrizes_pre_parto_lepto_reforco_situacional")) {
    issues.push("matrizes_pre_parto_lepto_duplicate_active");
  }
  for (const key of MATRIX_PREPARTUM_ALLOWED_ITEM_KEYS) {
    if (!matrizesKeys.has(key)) issues.push(`matrizes_pre_parto_item_missing:${key}`);
  }
  if (
    matrizesItems.some(
      (entry) =>
        entry.productRequirementKind === "product_class" &&
        entry.productClass === "vacina_leptospirose",
    )
  ) {
    issues.push("matrizes_pre_parto_leptospirose_product_class_active");
  }
  if (summary.hasAgendaAutoEnabled) issues.push("agenda_auto_enabled");
  if (summary.hasApprovedCatalogProtocol) issues.push("approved_catalog_protocol");

  for (const protocol of readModel.protocols) {
    if (protocol.approvalStatus !== "draft") {
      issues.push(`protocol_not_draft:${protocol.familyCode}`);
    }
    if (metadataFlag(protocol, "agenda_allowed")) {
      issues.push(`protocol_agenda_allowed:${protocol.familyCode}`);
    }
  }

  for (const group of readModel.productClassGroups) {
    if (group.scope !== "global") issues.push(`group_not_global:${group.groupKey}`);
    if (group.curationStatus !== "needs_review") {
      issues.push(`group_not_needs_review:${group.groupKey}`);
    }
    if (metadataFlag(group, "agenda_allowed")) {
      issues.push(`group_agenda_allowed:${group.groupKey}`);
    }
    if (metadataFlag(group, "approved_for_catalog")) {
      issues.push(`group_approved_for_catalog:${group.groupKey}`);
    }
  }

  return issues;
}
