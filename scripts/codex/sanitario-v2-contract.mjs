const CANONICAL_ENTITY_KEYS = {
  sources: "source_rows",
  coverage: "coverage_rows",
  products: "product_rows",
  authorizations: "product_authorization_rows",
  productSources: "product_source_rows",
  doseRules: "dose_rule_rows",
  withdrawalRules: "withdrawal_rule_rows",
  withdrawalSources: "withdrawal_source_rows",
  classes: "product_class_rows",
  groups: "product_class_group_rows",
  groupMembers: "product_class_group_member_rows",
  classDefaultRules: "product_class_default_rule_rows",
  protocols: "protocol_rows",
  protocolItems: "protocol_item_rows",
};

export const CANONICAL_ARTIFACT_VERSION = "13.0.0-canonical-contract";

const ENTITY_KEYS = Object.values(CANONICAL_ENTITY_KEYS);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_REF_PATTERN = /^SRC_[A-Z0-9_]+$/;
const LEGACY_UUID_EMBEDDED_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const LEGACY_PROTOCOL_LOOKUP_PATTERN = /\{\{lookup sanitario_protocolos_v2\.id by family_code=([^}]+)\}\}/;
const LEGACY_GROUP_LOOKUP_PATTERN = /\{\{lookup sanitario_product_class_groups_v2\.id by group_key=([^}]+)\}\}/;
const CANONICAL_FORMAT_KEYS = ["source_rows", "product_rows", "protocol_rows", "protocol_item_rows"];
const ALIASES = {
  source_rows: ["source_rows", "sanitario_fontes_tecnicas_v2"],
  coverage_rows: ["coverage_rows", "sanitario_fonte_cobertura_campos_v2"],
  product_rows: ["product_rows", "sanitario_produtos_v2"],
  product_authorization_rows: ["product_authorization_rows", "sanitario_produto_especie_autorizacao_v2"],
  product_source_rows: ["product_source_rows", "sanitario_produto_fontes_v2"],
  dose_rule_rows: ["dose_rule_rows", "sanitario_produto_dose_rules_v2"],
  withdrawal_rule_rows: ["withdrawal_rule_rows", "sanitario_produto_carencia_rules_v2"],
  withdrawal_source_rows: ["withdrawal_source_rows", "sanitario_produto_carencia_fontes_v2"],
  product_class_rows: ["product_class_rows", "sanitario_product_classes_v2"],
  product_class_group_rows: ["product_class_group_rows", "sanitario_product_class_groups_v2"],
  product_class_group_member_rows: ["product_class_group_member_rows", "sanitario_product_class_group_members_v2"],
  product_class_default_rule_rows: ["product_class_default_rule_rows", "sanitario_product_class_default_rules_v2"],
  protocol_rows: ["protocol_rows", "sanitario_protocolos_v2"],
  protocol_item_rows: ["protocol_item_rows", "sanitario_protocolo_itens_versions_v2"],
  protocols: ["sanitario_protocolos_v2"],
  protocolItems: ["sanitario_protocolo_itens_versions_v2"],
  groups: ["sanitario_product_class_groups_v2"],
};

const REPRESENTATION_PAIRS = Object.values(ALIASES).filter((aliases) => aliases.length === 2);

const ENUMS = {
  sourceKind: ["norma_oficial", "bula", "registro_produto", "bibliografia", "guideline_apoio", "mv_responsavel"],
  sourceScope: ["global", "fazenda"],
  sourceStrength: ["forte", "apoio", "fraca"],
  evidenceStatus: ["SIM_BULA", "SIM_NORMA", "PRECISA_VALIDAR", "NAO_AUTORIZADO", "EXTRAPOLADO"],
  coverageStatus: ["covers", "partially_covers", "does_not_cover"],
  species: ["bovino", "bubalino", "outro"],
  aptitude: ["corte", "leite", "mista", "all"],
  doseBasis: ["animal", "kg_peso_vivo", "dose"],
  withdrawalApplicability: ["period", "zero", "not_applicable", "unknown", "not_permitted"],
  protocolScope: ["global", "pack", "fazenda"],
  legalStatus: ["obrigatorio_norma", "recomendado_tecnico", "condicional", "estrategico", "experimental_alerta", "bloqueado"],
  protocolStatus: ["draft", "active", "retired"],
  approvalStatus: ["draft", "pending_review", "approved", "rejected"],
  itemStatus: ["obrigatorio", "recomendado", "condicional", "estrategico", "somente_alerta", "bloqueado"],
  actionType: ["vacinacao", "vermifugacao", "tratamento", "exame", "manejo_sanitario", "alerta"],
  requirementKind: ["specific_product", "product_class", "product_class_group", "none"],
};

function fail(issues, path, message) {
  issues.push(`${path}: ${message}`);
}

function rowsFrom(payload, key) {
  const container = payload?.payload ?? payload ?? {};
  for (const alias of ALIASES[key]) {
    const value = container[alias];
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.rows)) return value.rows;
  }
  return [];
}

function rawCollectionExists(container, key) {
  const value = container[key];
  return Array.isArray(value) || (value && Array.isArray(value.rows));
}

function assertSingleEditableRepresentation(payload) {
  const container = payload?.payload ?? payload ?? {};
  const conflicts = REPRESENTATION_PAIRS
    .filter(([modern, legacy]) => rawCollectionExists(container, modern) && rawCollectionExists(container, legacy))
    .map(([modern, legacy]) => `${modern} + ${legacy}`);
  if (conflicts.length) throw new Error(`Representacao dupla detectada dentro do payload: ${conflicts.join("; ")}`);
}

export function normalizeCanonicalData(payload) {
  assertSingleEditableRepresentation(payload);
  const container = payload?.payload ?? payload ?? {};
  // Format detection must inspect the original raw properties; the alias-processed
  // result cannot be used because it resolves sanitario_* aliases automatically.
  const hasCanonicalCollections = CANONICAL_FORMAT_KEYS.some((key) => rawCollectionExists(container, key));
  const data = extractCanonicalRows(payload);
  data.memberRejections = payload.rejections?.sanitario_product_class_group_members_v2 ?? [];
  if (hasCanonicalCollections) return data;

  data.protocol_rows = rowsFrom(payload, "protocols").map((row) => ({
    ...row,
    protocol_key: row.protocol_key ?? row.family_code,
  }));
  data.protocol_item_rows = rowsFrom(payload, "protocolItems").map((row, index) => {
    const rawProtocolId = String(row.protocol_id ?? "");
    const rawGroupId = String(row.product_class_group_id ?? "");
    if (LEGACY_UUID_EMBEDDED_PATTERN.test(rawProtocolId) || LEGACY_UUID_EMBEDDED_PATTERN.test(rawGroupId)) {
      throw new Error(`sanitario_protocolo_itens_versions_v2.rows[${index}]: lookup nao pode conter UUID artificial`);
    }
    const { protocol_id, product_class, product_class_group_id, product_id, ...rest } = row;
    return {
      ...rest,
      protocol_key: rest.protocol_key ?? LEGACY_PROTOCOL_LOOKUP_PATTERN.exec(rawProtocolId)?.[1],
      product_key: rest.product_key ?? product_id,
      class_key: rest.class_key ?? product_class,
      group_key: rest.group_key ?? LEGACY_GROUP_LOOKUP_PATTERN.exec(rawGroupId)?.[1],
    };
  });
  return data;
}

function extractCanonicalRows(payload) {
  return Object.fromEntries(ENTITY_KEYS.map((key) => [key, rowsFrom(payload, key)]));
}

export function assertStableIdentity(existing, canonical, naturalKey) {
  if (existing && existing.id !== canonical.id) {
    throw new Error(`IDENTITY_CONFLICT ${naturalKey}: existing=${existing.id} canonical=${canonical.id}`);
  }
}

function addIndex(index, rows, key, path, issues) {
  for (const [position, row] of rows.entries()) {
    const id = row.id;
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
      fail(issues, `${path}[${position}].id`, "UUID estavel explicito obrigatorio");
    } else if (index.ids.has(id)) {
      fail(issues, `${path}[${position}].id`, `UUID duplicado com ${index.ids.get(id)}`);
    } else {
      index.ids.set(id, `${path}[${position}]`);
    }

    const symbolicKey = row[key];
    if (symbolicKey !== undefined) {
      if (typeof symbolicKey !== "string" || !symbolicKey.trim()) {
        fail(issues, `${path}[${position}].${key}`, "chave simbolica deve ser texto nao vazio");
      } else if (index.keys.has(symbolicKey)) {
        fail(issues, `${path}[${position}].${key}`, `chave simbolica duplicada com ${index.keys.get(symbolicKey)}`);
      } else {
        index.keys.set(symbolicKey, `${path}[${position}]`);
      }
    }
  }
}

function enumValue(issues, row, field, values, path) {
  if (row[field] !== undefined && !values.includes(row[field])) {
    fail(issues, `${path}.${field}`, `enum invalido: ${row[field]}`);
  }
}

function requireField(issues, row, field, path) {
  if (row[field] === undefined || row[field] === null || row[field] === "") {
    fail(issues, `${path}.${field}`, "campo obrigatorio ausente");
  }
}

function objectField(issues, row, field, path, required = false) {
  if (row[field] === undefined || row[field] === null) {
    if (required) fail(issues, `${path}.${field}`, "objeto JSON obrigatorio ausente");
    return;
  }
  if (!row[field] || typeof row[field] !== "object" || Array.isArray(row[field])) {
    fail(issues, `${path}.${field}`, "deve ser objeto JSON");
  }
}

function reference(value, index, issues, path, label, required = true) {
  if (value === undefined || value === null || value === "") {
    if (required) fail(issues, path, `${label} obrigatoria ausente`);
    return;
  }
  if (typeof value !== "string" || !value.trim()) {
    fail(issues, path, `${label} invalida`);
    return;
  }
  if (!index.has(value)) fail(issues, path, `${label} inexistente: ${value}`);
}

function collectSourceRefs(value, path, refs) {
  if (Array.isArray(value)) return value.forEach((entry, index) => collectSourceRefs(entry, `${path}[${index}]`, refs));
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "source_ref") refs.push({ value: entry, path: `${path}.${key}` });
    else collectSourceRefs(entry, `${path}.${key}`, refs);
  }
}

function validateSourceRows(rows, issues) {
  rows.forEach((row, index) => {
    const path = `source_rows[${index}]`;
    requireField(issues, row, "source_key", path);
    requireField(issues, row, "kind", path);
    requireField(issues, row, "scope", path);
    requireField(issues, row, "title", path);
    requireField(issues, row, "strength", path);
    requireField(issues, row, "evidence_status", path);
    enumValue(issues, row, "kind", ENUMS.sourceKind, path);
    enumValue(issues, row, "scope", ENUMS.sourceScope, path);
    enumValue(issues, row, "strength", ENUMS.sourceStrength, path);
    enumValue(issues, row, "evidence_status", ENUMS.evidenceStatus, path);
    if (row.scope === "global" && row.fazenda_id != null) fail(issues, `${path}.fazenda_id`, "global nao pode possuir fazenda_id");
    if (row.scope === "fazenda") {
      if (!row.fazenda_id) fail(issues, `${path}.fazenda_id`, "scope fazenda exige fazenda_id");
      else if (!UUID_PATTERN.test(String(row.fazenda_id))) fail(issues, `${path}.fazenda_id`, "fazenda_id exige UUID valido");
    }
    if (row.kind === "mv_responsavel" && row.scope !== "fazenda") fail(issues, `${path}.scope`, "mv_responsavel exige scope fazenda");
    if (row.kind === "guideline_apoio" && row.strength === "forte") fail(issues, `${path}.strength`, "guideline nao pode ser fonte forte");
    if (row.strength === "forte" && !["SIM_BULA", "SIM_NORMA"].includes(row.evidence_status)) fail(issues, `${path}.evidence_status`, "fonte forte exige SIM_BULA ou SIM_NORMA");
  });
}

function validateProductRows(rows, indexes, issues) {
  rows.forEach((row, index) => {
    const path = `product_rows[${index}]`;
    for (const field of ["product_key", "nome_comercial", "classe", "tipo_produto", "status_curatorial"]) requireField(issues, row, field, path);
    enumValue(issues, row, "status_curatorial", ["ativo", "precisa_validar", "bloqueado", "arquivado"], path);
    if (row.source_keys) row.source_keys.forEach((key, sourceIndex) => reference(key, indexes.sources.keys, issues, `${path}.source_keys[${sourceIndex}]`, "source_key"));
  });
}

function validateTechnicalRows(data, indexes, issues) {
  validateSourceRows(data.source_rows, issues);
  validateProductRows(data.product_rows, indexes, issues);

  data.coverage_rows.forEach((row, index) => {
    const path = `coverage_rows[${index}]`;
    requireField(issues, row, "source_key", path);
    requireField(issues, row, "field_key", path);
    requireField(issues, row, "coverage_status", path);
    enumValue(issues, row, "coverage_status", ENUMS.coverageStatus, path);
    reference(row.source_key, indexes.sources.keys, issues, `${path}.source_key`, "source_key");
  });

  data.product_authorization_rows.forEach((row, index) => {
    const path = `product_authorization_rows[${index}]`;
    requireField(issues, row, "id", path);
    requireField(issues, row, "product_key", path);
    requireField(issues, row, "species_code", path);
    requireField(issues, row, "authorization_status", path);
    requireField(issues, row, "aptitude", path);
    reference(row.product_key, indexes.products.keys, issues, `${path}.product_key`, "product_key");
    enumValue(issues, row, "species_code", ENUMS.species, path);
    enumValue(issues, row, "aptitude", ENUMS.aptitude, path);
    enumValue(issues, row, "authorization_status", ENUMS.evidenceStatus, path);
    if (row.idade_min_dias != null && row.idade_min_dias < 0) fail(issues, `${path}.idade_min_dias`, "intervalo invalido");
    if (row.idade_max_dias != null && row.idade_max_dias < 0) fail(issues, `${path}.idade_max_dias`, "intervalo invalido");
    if (row.idade_min_dias != null && row.idade_max_dias != null && row.idade_min_dias > row.idade_max_dias) fail(issues, path, "idade_min_dias maior que idade_max_dias");
  });

  data.product_source_rows.forEach((row, index) => {
    const path = `product_source_rows[${index}]`;
    requireField(issues, row, "product_key", path);
    requireField(issues, row, "source_key", path);
    reference(row.product_key, indexes.products.keys, issues, `${path}.product_key`, "product_key");
    reference(row.source_key, indexes.sources.keys, issues, `${path}.source_key`, "source_key");
    requireField(issues, row, "field_key", path);
  });

  data.dose_rule_rows.forEach((row, index) => {
    const path = `dose_rule_rows[${index}]`;
    requireField(issues, row, "id", path);
    requireField(issues, row, "product_key", path);
    reference(row.product_key, indexes.products.keys, issues, `${path}.product_key`, "product_key");
    requireField(issues, row, "route", path);
    requireField(issues, row, "dose_quantity", path);
    requireField(issues, row, "dose_unit", path);
    requireField(issues, row, "dose_basis", path);
    enumValue(issues, row, "dose_basis", ENUMS.doseBasis, path);
    if (!(Number(row.dose_quantity) > 0)) fail(issues, `${path}.dose_quantity`, "quantidade deve ser positiva");
    if (row.min_weight_kg != null && row.min_weight_kg < 0) fail(issues, `${path}.min_weight_kg`, "peso invalido");
    if (row.max_weight_kg != null && row.max_weight_kg < 0) fail(issues, `${path}.max_weight_kg`, "peso invalido");
    if (row.min_weight_kg != null && row.max_weight_kg != null && row.min_weight_kg > row.max_weight_kg) fail(issues, path, "min_weight_kg maior que max_weight_kg");
  });

  data.withdrawal_rule_rows.forEach((row, index) => {
    const path = `withdrawal_rule_rows[${index}]`;
    requireField(issues, row, "id", path);
    requireField(issues, row, "withdrawal_rule_key", path);
    requireField(issues, row, "product_key", path);
    reference(row.product_key, indexes.products.keys, issues, `${path}.product_key`, "product_key");
    for (const field of ["species_code", "aptitude", "applicability"]) requireField(issues, row, field, path);
    enumValue(issues, row, "species_code", ENUMS.species, path);
    enumValue(issues, row, "aptitude", ENUMS.aptitude.filter((value) => value !== "all"), path);
    enumValue(issues, row, "applicability", ENUMS.withdrawalApplicability, path);
    if (row.applicability === "period" && row.meat_days == null && row.milk_days == null && row.milk_hours == null) fail(issues, path, "carencia period exige periodo explicito");
    if (row.applicability === "zero") {
      const sources = (row.source_keys ?? []).map((key) => data.source_rows.find((source) => source.source_key === key));
      if (!sources.length || sources.some((source) => !source || source.strength !== "forte" || !["SIM_BULA", "SIM_NORMA"].includes(source.evidence_status))) {
        fail(issues, path, "carencia zero exige fonte forte com evidencia autorizada");
      }
    }
    if (row.valid_from && row.valid_until && row.valid_from > row.valid_until) fail(issues, path, "valid_from maior que valid_until");
  });

  data.withdrawal_source_rows.forEach((row, index) => {
    const path = `withdrawal_source_rows[${index}]`;
    requireField(issues, row, "withdrawal_rule_key", path);
    requireField(issues, row, "source_key", path);
    reference(row.withdrawal_rule_key, indexes.withdrawalRules.keys, issues, `${path}.withdrawal_rule_key`, "withdrawal_rule_key");
    reference(row.source_key, indexes.sources.keys, issues, `${path}.source_key`, "source_key");
    requireField(issues, row, "field_key", path);
  });

  const PRODUCT_CLASS_TYPES = ["vacina", "antiparasitario", "antibiotico", "anti_inflamatorio", "hormonio", "diagnostico", "outro"];
  const CURATION_STATUSES = ["candidate", "needs_review", "approved_for_catalog", "blocked", "archived"];
  const AUTOMATION_STATUSES = ["manual_only", "preview_allowed", "agenda_allowed", "blocked"];

  data.product_class_rows.forEach((row, index) => {
    const path = `product_class_rows[${index}]`;
    requireField(issues, row, "id", path);
    for (const field of ["class_key", "scope", "name", "product_type", "curation_status", "automation_status"]) {
      requireField(issues, row, field, path);
    }
    if (!Array.isArray(row.species_scope) || row.species_scope.length === 0) {
      fail(issues, `${path}.species_scope`, "species_scope exige array nao vazio");
    } else if (row.species_scope.some((code) => !["bovino", "bubalino"].includes(code))) {
      fail(issues, `${path}.species_scope`, "species invalida para classe");
    }
    enumValue(issues, row, "product_type", PRODUCT_CLASS_TYPES, path);
    enumValue(issues, row, "curation_status", CURATION_STATUSES, path);
    enumValue(issues, row, "automation_status", AUTOMATION_STATUSES, path);
    if (!(["global", "tenant"].includes(row.scope))) fail(issues, `${path}.scope`, "scope invalido");
    if (row.scope === "global" && row.fazenda_id != null) fail(issues, `${path}.fazenda_id`, "global nao pode possuir fazenda_id");
    if (row.scope === "tenant") {
      if (!row.fazenda_id) fail(issues, `${path}.fazenda_id`, "tenant exige fazenda_id");
      else if (!UUID_PATTERN.test(String(row.fazenda_id))) fail(issues, `${path}.fazenda_id`, "fazenda_id exige UUID valido");
    }
  });

  data.product_class_group_rows.forEach((row, index) => {
    const path = `product_class_group_rows[${index}]`;
    requireField(issues, row, "id", path);
    for (const field of ["group_key", "scope", "name", "curation_status", "automation_status"]) {
      requireField(issues, row, field, path);
    }
    enumValue(issues, row, "curation_status", CURATION_STATUSES, path);
    enumValue(issues, row, "automation_status", AUTOMATION_STATUSES, path);
    if (!(["global", "tenant"].includes(row.scope))) fail(issues, `${path}.scope`, "scope invalido");
    if (row.scope === "global" && row.fazenda_id != null) fail(issues, `${path}.fazenda_id`, "global nao pode possuir fazenda_id");
    if (row.scope === "tenant") {
      if (!row.fazenda_id) fail(issues, `${path}.fazenda_id`, "tenant exige fazenda_id");
      else if (!UUID_PATTERN.test(String(row.fazenda_id))) fail(issues, `${path}.fazenda_id`, "fazenda_id exige UUID valido");
    }
  });

  data.product_class_group_member_rows.forEach((row, index) => {
    const path = `product_class_group_member_rows[${index}]`;
    requireField(issues, row, "id", path);
    requireField(issues, row, "group_key", path);
    requireField(issues, row, "class_key", path);
    reference(row.group_key, indexes.groups.keys, issues, `${path}.group_key`, "group_key");
    reference(row.class_key, indexes.classes.keys, issues, `${path}.class_key`, "class_key");
  });

  data.product_class_default_rule_rows.forEach((row, index) => {
    const path = `product_class_default_rule_rows[${index}]`;
    requireField(issues, row, "id", path);
    requireField(issues, row, "class_key", path);
    requireField(issues, row, "species_code", path);
    reference(row.class_key, indexes.classes.keys, issues, `${path}.class_key`, "class_key");
    enumValue(issues, row, "species_code", ENUMS.species.filter((value) => value !== "outro"), path);
    enumValue(issues, row, "aptitude", ENUMS.aptitude, path);
    if (row.can_validate_execution === true) fail(issues, `${path}.can_validate_execution`, "classe nao pode validar execucao");
    if (row.requires_executed_product_for_withdrawal === false) fail(issues, `${path}.requires_executed_product_for_withdrawal`, "carencia de classe exige produto executado");
    for (const field of ["dose_rule", "route_rule", "withdrawal_rule"]) objectField(issues, row, field, path);
    if ((row.dose_rule ?? row.route_rule ?? row.withdrawal_rule) != null) {
      if (!Array.isArray(row.source_refs) || row.source_refs.length === 0) {
        fail(issues, `${path}.source_refs`, "rules de classe exigem source_refs autorizadas");
      }
    }
    if (row.source_keys) row.source_keys.forEach((key, sourceIndex) => reference(key, indexes.sources.keys, issues, `${path}.source_keys[${sourceIndex}]`, "source_key"));
  });
}

function validateProtocolRows(data, indexes, issues) {
  data.protocol_rows.forEach((row, index) => {
    const path = `protocol_rows[${index}]`;
    requireField(issues, row, "id", path);
    for (const field of ["protocol_key", "family_code", "name", "scope", "legal_status", "version", "status", "approval_status"]) requireField(issues, row, field, path);
    enumValue(issues, row, "scope", ENUMS.protocolScope, path);
    enumValue(issues, row, "legal_status", ENUMS.legalStatus, path);
    enumValue(issues, row, "status", ENUMS.protocolStatus, path);
    enumValue(issues, row, "approval_status", ENUMS.approvalStatus, path);
    if (!(Number.isInteger(row.version) && row.version > 0)) fail(issues, `${path}.version`, "versao deve ser inteiro positivo");
    if (row.scope === "fazenda") {
      if (!row.fazenda_id) fail(issues, `${path}.fazenda_id`, "scope fazenda exige fazenda_id");
      else if (!UUID_PATTERN.test(String(row.fazenda_id))) fail(issues, `${path}.fazenda_id`, "fazenda_id exige UUID valido");
    }
    if (row.scope !== "fazenda" && row.fazenda_id != null) fail(issues, `${path}.fazenda_id`, "scope global/pack nao pode possuir fazenda_id");
  });

  data.protocol_item_rows.forEach((row, index) => {
    const path = `protocol_item_rows[${index}]`;
    requireField(issues, row, "id", path);
    for (const field of ["protocol_key", "logical_item_key", "version", "item_status", "action_type", "product_requirement_kind"]) requireField(issues, row, field, path);
    reference(row.protocol_key, indexes.protocols.keys, issues, `${path}.protocol_key`, "protocol_key");
    enumValue(issues, row, "item_status", ENUMS.itemStatus, path);
    enumValue(issues, row, "action_type", ENUMS.actionType, path);
    enumValue(issues, row, "product_requirement_kind", ENUMS.requirementKind, path);
    if (!(Number.isInteger(row.version) && row.version > 0)) fail(issues, `${path}.version`, "versao deve ser inteiro positivo");
    objectField(issues, row, "eligibility_rule", path, true);
    objectField(issues, row, "operational_window_rule", path, true);
    objectField(issues, row, "source_refs_by_field", path, true);
    if (!Array.isArray(row.species_authorization)) fail(issues, `${path}.species_authorization`, "array obrigatorio ausente");
    if (["somente_alerta", "bloqueado"].includes(row.item_status) && row.allows_agenda_auto === true) fail(issues, path, "item de alerta/bloqueado nao pode permitir agenda");
    if (row.product_requirement_kind === "specific_product") reference(row.product_key, indexes.products.keys, issues, `${path}.product_key`, "product_key");
    if (row.product_requirement_kind === "product_class") reference(row.class_key, indexes.classes.keys, issues, `${path}.class_key`, "class_key");
    if (row.product_requirement_kind === "product_class_group") reference(row.group_key, indexes.groups.keys, issues, `${path}.group_key`, "group_key");
    if (row.product_requirement_kind === "none" && (row.product_key || row.class_key || row.group_key)) fail(issues, path, "requirement none nao pode referenciar entidade");
  });
}

export function validateCanonicalTechnicalContract(payload) {
  const issues = [];
  const data = normalizeCanonicalData(payload);
  if (payload.artifact_version !== CANONICAL_ARTIFACT_VERSION) {
    fail(issues, "artifact_version", `versao esperada ${CANONICAL_ARTIFACT_VERSION}`);
  }
  const indexes = {
    sources: { ids: new Map(), keys: new Map() },
    products: { ids: new Map(), keys: new Map() },
    classes: { ids: new Map(), keys: new Map() },
    groups: { ids: new Map(), keys: new Map() },
    withdrawalRules: { ids: new Map(), keys: new Map() },
    protocols: { ids: new Map(), keys: new Map() },
  };

  addIndex(indexes.sources, data.source_rows, "source_key", "source_rows", issues);
  addIndex(indexes.products, data.product_rows, "product_key", "product_rows", issues);
  addIndex(indexes.classes, data.product_class_rows, "class_key", "product_class_rows", issues);
  addIndex(indexes.groups, data.product_class_group_rows, "group_key", "product_class_group_rows", issues);
  addIndex(indexes.withdrawalRules, data.withdrawal_rule_rows, "withdrawal_rule_key", "withdrawal_rule_rows", issues);
  addIndex(indexes.protocols, data.protocol_rows, "protocol_key", "protocol_rows", issues);

  const uuidCollections = [
    "source_rows", "coverage_rows", "product_rows", "product_authorization_rows",
    "dose_rule_rows", "withdrawal_rule_rows", "product_class_rows",
    "product_class_group_rows", "product_class_group_member_rows",
    "product_class_default_rule_rows", "protocol_rows", "protocol_item_rows",
  ];
  for (const collection of uuidCollections) {
    data[collection].forEach((row, position) => {
      if (typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) {
        fail(issues, `${collection}[${position}].id`, "UUID estavel explicito obrigatorio");
      }
    });
  }
  for (const [collection, fields] of Object.entries({
    product_source_rows: ["product_key", "source_key", "field_key"],
    withdrawal_source_rows: ["withdrawal_rule_key", "source_key", "field_key"],
  })) {
    data[collection].forEach((row, position) => fields.forEach((field) => requireField(issues, row, field, `${collection}[${position}]`)));
  }

  const allIds = new Map();
  for (const [collection, rows] of Object.entries(data)) {
    rows.forEach((row, position) => {
      if (!row.id || !UUID_PATTERN.test(String(row.id))) return;
      const path = `${collection}[${position}].id`;
      if (allIds.has(row.id)) fail(issues, path, `UUID duplicado com ${allIds.get(row.id)}`);
      else allIds.set(row.id, path);
    });
  }

  validateTechnicalRows(data, indexes, issues);
  validateProtocolRows(data, indexes, issues);

  const classByKey = new Map(data.product_class_rows.map((row) => [row.class_key, row]));
  const groupByKey = new Map(data.product_class_group_rows.map((row) => [row.group_key, row]));
  const protocolByKey = new Map(data.protocol_rows.map((row) => [row.protocol_key, row]));
  for (const [index, row] of data.product_class_group_member_rows.entries()) {
    const group = groupByKey.get(row.group_key);
    const cls = classByKey.get(row.class_key);
    if (group && cls && (group.scope === "global" ? cls.scope !== "global" : cls.scope === "tenant" && cls.fazenda_id !== group.fazenda_id)) {
      fail(issues, `product_class_group_member_rows[${index}]`, "referencia cross-scope invalida");
    }
  }
  for (const [index, row] of data.protocol_item_rows.entries()) {
    const protocol = protocolByKey.get(row.protocol_key);
    const group = row.group_key ? groupByKey.get(row.group_key) : null;
    if (protocol && group && (protocol.scope !== "fazenda" ? group.scope !== "global" : group.scope === "tenant" && group.fazenda_id !== protocol.fazenda_id)) {
      fail(issues, `protocol_item_rows[${index}]`, "referencia de grupo cross-scope invalida");
    }
  }

  const sourceRefs = [];
  collectSourceRefs(payload, "payload", sourceRefs);
  for (const ref of sourceRefs) {
    if (typeof ref.value !== "string" || !SOURCE_REF_PATTERN.test(ref.value)) fail(issues, ref.path, "source_ref deve usar chave SRC_* valida");
    else if (!indexes.sources.keys.has(ref.value)) fail(issues, ref.path, `source_key inexistente: ${ref.value}`);
  }

  if (issues.length) {
    throw new Error(`Contrato canonico v2 invalido:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  return { data, indexes };
}
