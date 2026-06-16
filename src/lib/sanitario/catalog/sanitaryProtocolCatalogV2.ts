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
  limitations: JsonRecord;
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

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

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

const metadataFlag = (record: { metadata: JsonRecord }, key: string): boolean =>
  record.metadata[key] === true;

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
    speciesScope: readRecord(row.species_scope),
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
    limitations: readRecord(row.limitations),
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
  return (data ?? []).map(adaptSanitaryProtocolItemV2Row);
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

  return {
    protocol,
    items: await listSanitaryProtocolItemsV2(client, protocol.id),
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

  return { protocols, items, productClassGroups };
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

  return (
    hasStringEntry(protocol.speciesScope.especies, "bovino") &&
    hasStringEntry(protocol.speciesScope.especies, "bubalino") &&
    hasStringEntry(item.eligibilityRule.sexo, "femea") &&
    item.eligibilityRule.idade_min_meses === 3 &&
    item.eligibilityRule.idade_max_meses === 8 &&
    protocol.jurisdictionScope.pais === "BR" &&
    protocol.jurisdictionScope.escopo === "nacional"
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
  if (summary.itemCount !== 19) issues.push("item_count_mismatch");
  if (summary.productClassGroupCount !== 4) {
    issues.push("product_class_group_count_mismatch");
  }
  if (!summary.hasB19NationalRule) issues.push("b19_national_rule_missing");
  if (!summary.hasAftosaBlockedRule) issues.push("aftosa_blocked_rule_missing");
  if (!summary.antiparasiticItemsUseProductClassGroup) {
    issues.push("antiparasitic_group_lookup_missing");
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
