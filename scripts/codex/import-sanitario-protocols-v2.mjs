import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const ROOT = process.cwd();
const PAYLOAD_REL =
  "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json";
const PAYLOAD_PATH = path.join(ROOT, PAYLOAD_REL);

const EXPECTED = {
  artifact: "sanitario_protocols_v2_canonical_payload",
  artifactVersion: "12F10.0-canonical-candidate",
  protocols: 10,
  items: 20,
  groups: 4,
  memberRejections: 16,
};

const DEPRECATED_ACTIVE_ITEMS = [
  {
    familyCode: "raiva_herbivoros",
    logicalItemKey: "raiva_area_risco_anual",
    replacementKeys: [
      "raiva_primovac_dose1",
      "raiva_primovac_reforco_30d",
      "raiva_reforco_anual_area_risco",
    ],
  },
  {
    familyCode: "matrizes_pre_parto",
    logicalItemKey: "matrizes_pre_parto_lepto_reforco_situacional",
    replacementKeys: ["leptospirose"],
  },
];

const FORBIDDEN_TRUE_FLAGS = [
  "agenda_allowed",
  "approved_for_catalog",
  "allows_agenda_auto",
  "allowsAgendaAuto",
  "creates_agenda",
  "creates_event",
  "creates_stock_movement",
  "creates_active_withdrawal",
  "allows_operational_release",
];

const UUID_LIKE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const SOURCE_REF_FORBIDDEN = /^(?:n\/a|null|source_gap_)/i;
const SOURCE_REF_TEXT_FORBIDDEN = /\b(?:policy|politica|política|mv|decis[aã]o)\b/i;

function usage() {
  return [
    "Uso:",
    "  node scripts/codex/import-sanitario-protocols-v2.mjs --validate",
    "  node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run",
    "  ALLOW_SANITARIO_IMPORT=1 node scripts/codex/import-sanitario-protocols-v2.mjs --apply",
  ].join("\n");
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseMode(argv) {
  const modes = argv.filter((arg) => ["--validate", "--dry-run", "--apply"].includes(arg));
  assert(modes.length === 1, usage());
  assert(argv.every((arg) => modes.includes(arg)), `Argumento invalido.\n${usage()}`);
  return modes[0].slice(2);
}

function readJsonPayload() {
  assert(existsSync(PAYLOAD_PATH), `Payload canonico 12F10 ausente: ${PAYLOAD_REL}`);
  try {
    return JSON.parse(readFileSync(PAYLOAD_PATH, "utf8"));
  } catch (error) {
    fail(`Payload canonico 12F10 nao e JSON parseavel: ${error.message}`);
  }
}

function walk(value, visit, pathParts = []) {
  visit(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visit, pathParts.concat(String(index))));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => walk(entry, visit, pathParts.concat(key)));
  }
}

function rows(payload) {
  return {
    protocols: payload.payload?.sanitario_protocolos_v2?.rows ?? [],
    items: payload.payload?.sanitario_protocolo_itens_versions_v2?.rows ?? [],
    groups: payload.payload?.sanitario_product_class_groups_v2?.rows ?? [],
    memberRejections: payload.rejections?.sanitario_product_class_group_members_v2 ?? [],
  };
}

function lookupFamily(token) {
  const match = String(token).match(
    /^\{\{lookup sanitario_protocolos_v2\.id by family_code=([^}]+)\}\}$/,
  );
  return match?.[1] ?? null;
}

function lookupGroupKey(token) {
  if (token === null || token === undefined) return null;
  const match = String(token).match(
    /^\{\{lookup sanitario_product_class_groups_v2\.id by group_key=([^}]+)\}\}$/,
  );
  return match?.[1] ?? null;
}

function scopeForGroup(scope) {
  return scope === "fazenda" ? "tenant" : scope;
}

function sortedBy(rowsToSort, key) {
  return [...rowsToSort].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isDifferent(a, b) {
  return stableStringify(a) !== stableStringify(b);
}

function asJsonb(value) {
  return JSON.stringify(value);
}

function validateSourceRefs(value, label) {
  walk(value, (entry, pathParts) => {
    const key = pathParts.at(-1);
    if (key !== "source_ref") return;
    assert(typeof entry === "string" && entry.trim().length > 0, `${label}: source_ref vazio`);
    assert(!SOURCE_REF_FORBIDDEN.test(entry), `${label}: source_ref proibido ${entry}`);
    assert(!SOURCE_REF_TEXT_FORBIDDEN.test(entry), `${label}: source_ref textual/policy/MV ${entry}`);
    assert(entry.startsWith("SRC_"), `${label}: source_ref deve apontar para fonte tecnica SRC_* (${entry})`);
  });
}

function validateCanonicalPayload(payload) {
  const data = rows(payload);

  assert(payload.artifact === EXPECTED.artifact, "artifact canonico inesperado");
  assert(payload.artifact_version === EXPECTED.artifactVersion, "artifact_version 12F10 inesperada");
  assert(payload.execute_import === false, "execute_import deve permanecer false");
  assert(payload.counts?.protocols === EXPECTED.protocols, "counts.protocols deve ser 10");
  assert(payload.counts?.protocol_items === EXPECTED.items, `counts.protocol_items deve ser ${EXPECTED.items}`);
  assert(payload.counts?.product_class_groups === EXPECTED.groups, "counts.product_class_groups deve ser 4");
  assert(
    payload.counts?.product_class_group_member_rejections === EXPECTED.memberRejections,
    "counts.product_class_group_member_rejections deve ser 16",
  );
  assert(data.protocols.length === EXPECTED.protocols, "payload deve conter 10 protocolos");
  assert(data.items.length === EXPECTED.items, `payload deve conter ${EXPECTED.items} itens`);
  assert(data.groups.length === EXPECTED.groups, "payload deve conter 4 ProductClassGroups");
  assert(data.memberRejections.length === EXPECTED.memberRejections, "payload deve conter 16 rejeicoes de members");

  walk(payload, (entry, pathParts) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    for (const flag of FORBIDDEN_TRUE_FLAGS) {
      if (Object.hasOwn(entry, flag)) {
        assert(entry[flag] === false, `${pathParts.join(".")}: ${flag} nao pode ser true`);
      }
    }
  });

  const b19 = data.protocols.find((row) => row.family_code === "brucelose_b19");
  const b19Item = data.items.find((row) => row.logical_item_key === "b19_femeas_3_8_meses");
  assert(b19, "B19 ausente");
  assert(b19Item, "Item B19 ausente");
  assert(b19.jurisdiction_scope?.country === "BR", "B19 deve manter pais BR");
  assert(b19.jurisdiction_scope?.legal_scope === "nacional", "B19 deve manter escopo nacional");
  assert(b19.metadata?.automationStatus === "manual_only", "B19 deve permanecer manual_only");
  assert(b19.species_scope?.includes("bovino"), "B19 deve incluir bovino");
  assert(b19.species_scope?.includes("bubalino"), "B19 deve incluir bubalino");
  assert(b19Item.eligibility_rule?.sex === "femea", "B19 deve ser para femeas");
  assert(b19Item.eligibility_rule?.age_min_months === 3, "B19 deve manter idade minima 3 meses");
  assert(b19Item.eligibility_rule?.age_max_months === 8, "B19 deve manter idade maxima 8 meses");

  const aftosa = data.protocols.find((row) => row.family_code === "febre_aftosa");
  const aftosaItems = data.items.filter((row) => lookupFamily(row.protocol_id) === "febre_aftosa");
  assert(aftosa, "Aftosa ausente");
  assert(aftosa.legal_status === "bloqueado", "Aftosa deve manter legal_status bloqueado");
  assert(aftosa.status === "retired", "Aftosa deve manter status retired");
  assert(aftosa.metadata?.automationStatus === "blocked", "Aftosa deve manter automationStatus blocked");
  for (const item of aftosaItems) {
    assert(item.product_requirement_kind === "none", `${item.logical_item_key}: aftosa nao pode ter produto`);
    assert(item.product_id === null, `${item.logical_item_key}: aftosa product_id deve ser null`);
    assert(item.product_class === null, `${item.logical_item_key}: aftosa product_class deve ser null`);
    assert(item.product_class_group_id === null, `${item.logical_item_key}: aftosa product_class_group_id deve ser null`);
  }

  const groupKeys = new Set(data.groups.map((row) => row.group_key));
  for (const item of data.items) {
    assert(!UUID_LIKE.test(item.protocol_id), `${item.logical_item_key}: protocol_id nao pode conter UUID artificial`);
    assert(item.allows_agenda_auto === false, `${item.logical_item_key}: allows_agenda_auto deve ser false`);
    assert(item.status === "draft", `${item.logical_item_key}: status deve ser draft`);
    assert(["specific_product", "product_class", "product_class_group", "none"].includes(item.product_requirement_kind), `${item.logical_item_key}: product_requirement_kind invalido`);
    if (item.product_requirement_kind === "product_class_group") {
      const groupKey = lookupGroupKey(item.product_class_group_id);
      assert(groupKey, `${item.logical_item_key}: product_class_group_id deve ser lookup por group_key`);
      assert(groupKeys.has(groupKey), `${item.logical_item_key}: group_key ${groupKey} ausente do payload canonico`);
      assert(item.product_class === null, `${item.logical_item_key}: ProductClassGroup nao pode virar ProductClass`);
      assert(item.product_id === null, `${item.logical_item_key}: ProductClassGroup nao pode virar produto especifico`);
      assert(item.limitations?.includes("class_group_does_not_validate_execution"), `${item.logical_item_key}: grupo deve declarar que nao valida execucao`);
    }
    if (item.product_requirement_kind === "product_class") {
      assert(item.product_class?.trim(), `${item.logical_item_key}: product_class exige valor`);
      assert(item.product_class_group_id === null, `${item.logical_item_key}: product_class nao pode referenciar group`);
    }
    if (item.product_requirement_kind === "none") {
      assert(item.product_id === null && item.product_class === null && item.product_class_group_id === null, `${item.logical_item_key}: none deve permanecer sem produto/classe/grupo`);
    }
    validateSourceRefs(item.source_refs_by_field, item.logical_item_key);
  }

  const raivaItems = data.items.filter((row) => lookupFamily(row.protocol_id) === "raiva_herbivoros");
  const raivaKeys = new Set(raivaItems.map((row) => row.logical_item_key));
  assert(!raivaKeys.has("raiva_area_risco_anual"), "raiva_area_risco_anual deve sair do payload canonico ativo");
  for (const expectedKey of [
    "raiva_primovac_dose1",
    "raiva_primovac_reforco_30d",
    "raiva_reforco_anual_area_risco",
  ]) {
    assert(raivaKeys.has(expectedKey), `${expectedKey}: item de raiva ausente`);
  }
  for (const item of raivaItems) {
    assert(item.product_requirement_kind === "product_class", `${item.logical_item_key}: raiva deve usar product_class`);
    assert(item.product_class === "vacina_raiva_herbivoros", `${item.logical_item_key}: product_class de raiva invalida`);
    assert(item.product_class_group_id === null, `${item.logical_item_key}: raiva nao deve usar ProductClassGroup`);
    assert(item.allows_agenda_auto === false, `${item.logical_item_key}: raiva nao pode agenda_auto`);
    assert(item.status === "draft", `${item.logical_item_key}: raiva deve permanecer draft`);
    assert(
      item.snapshot_template?.metadata?.automationStatus === "manual_only",
      `${item.logical_item_key}: raiva deve permanecer manual_only`,
    );
    assert(
      item.snapshot_template?.sourcePolicy?.withdrawal === "by_executed_product_snapshot",
      `${item.logical_item_key}: raiva exige carencia por produto executado`,
    );
  }

  const matrizesItems = data.items.filter((row) => lookupFamily(row.protocol_id) === "matrizes_pre_parto");
  const matrizesKeys = new Set(matrizesItems.map((row) => row.logical_item_key));
  assert(
    !matrizesKeys.has("matrizes_pre_parto_lepto_reforco_situacional"),
    "matrizes_pre_parto_lepto_reforco_situacional deve sair do payload canonico ativo",
  );
  assert(
    matrizesKeys.has("matrizes_pre_parto_antiparasitario"),
    "matrizes_pre_parto_antiparasitario deve permanecer ativo",
  );
  assert(matrizesItems.length === 1, "matrizes_pre_parto deve manter apenas um item ativo");
  for (const item of matrizesItems) {
    assert(
      item.product_class !== "vacina_leptospirose",
      `${item.logical_item_key}: matrizes_pre_parto nao deve concorrer com leptospirose`,
    );
  }

  for (const protocol of data.protocols) {
    assert(protocol.approval_status === "draft", `${protocol.family_code}: approval_status deve ser draft`);
    assert(protocol.metadata?.agenda_allowed === false, `${protocol.family_code}: metadata agenda_allowed deve ser false`);
    assert(protocol.metadata?.approved_for_catalog === false, `${protocol.family_code}: metadata approved_for_catalog deve ser false`);
    validateSourceRefs(protocol.source_refs_snapshot, protocol.family_code);
  }

  for (const group of data.groups) {
    assert(group.scope === "global", `${group.group_key}: grupo deve ser global`);
    assert(group.fazenda_id === null, `${group.group_key}: grupo global deve ter fazenda_id null`);
    assert(group.curation_status === "needs_review", `${group.group_key}: curation_status deve ser needs_review`);
    assert(group.automation_status !== "agenda_allowed", `${group.group_key}: automation_status nao pode liberar agenda`);
    assert(group.metadata?.agenda_allowed === false, `${group.group_key}: metadata agenda_allowed deve ser false`);
    assert(group.metadata?.approved_for_catalog === false, `${group.group_key}: metadata approved_for_catalog deve ser false`);
    assert(Array.isArray(group.metadata?.principios_ativos_candidatos), `${group.group_key}: principios ativos devem ficar em metadata`);
  }

  for (const rejection of data.memberRejections) {
    assert(
      rejection.reason === "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER",
      `${rejection.member_key}: motivo de rejeicao deve ser PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`,
    );
    assert(!Object.hasOwn(rejection, "class_id"), `${rejection.member_key}: member nao pode importar sem class_id`);
    assert(!UUID_LIKE.test(stableStringify(rejection)), `${rejection.member_key}: rejeicao nao pode conter UUID artificial`);
  }

  return data;
}

function readSupabaseStatusEnv() {
  if (process.env.DB_URL) return { DB_URL: process.env.DB_URL };
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  assert(env.DB_URL, "supabase status -o env nao retornou DB_URL");
  return env;
}

async function connectDb() {
  const env = readSupabaseStatusEnv();
  const client = new Client({ connectionString: env.DB_URL });
  await client.connect();
  return client;
}

async function selectProtocols(client, protocols) {
  const result = new Map();
  for (const protocol of sortedBy(protocols, "family_code")) {
    const existing = await client.query(
      `
        select *
        from public.sanitario_protocolos_v2
        where deleted_at is null
          and family_code = $1
          and scope = $2
          and fazenda_id is not distinct from $3::uuid
          and version = $4
        order by id
      `,
      [protocol.family_code, protocol.scope, protocol.fazenda_id, protocol.version],
    );
    assert(existing.rowCount <= 1, `${protocol.family_code}: lookup ambiguo em sanitario_protocolos_v2`);
    result.set(protocol.family_code, existing.rows[0] ?? null);
  }
  return result;
}

async function selectGroups(client, groups) {
  const result = new Map();
  for (const group of sortedBy(groups, "group_key")) {
    const scope = scopeForGroup(group.scope);
    const existing = await client.query(
      `
        select *
        from public.sanitario_product_class_groups_v2
        where deleted_at is null
          and scope = $1
          and fazenda_id is not distinct from $2::uuid
          and group_key = $3
        order by id
      `,
      [scope, group.fazenda_id, group.group_key],
    );
    assert(existing.rowCount <= 1, `${group.group_key}: lookup ambiguo em sanitario_product_class_groups_v2`);
    result.set(group.group_key, existing.rows[0] ?? null);
  }
  return result;
}

async function selectItems(client, items, protocolIdsByFamily) {
  const result = new Map();
  for (const item of sortedBy(items, "logical_item_key")) {
    const familyCode = lookupFamily(item.protocol_id);
    const protocolId = protocolIdsByFamily.get(familyCode);
    if (!protocolId || !UUID_LIKE.test(protocolId)) {
      result.set(item.logical_item_key, null);
      continue;
    }
    const existing = await client.query(
      `
        select *
        from public.sanitario_protocolo_itens_versions_v2
        where deleted_at is null
          and protocol_id = $1
          and logical_item_key = $2
          and version = $3
        order by id
      `,
      [protocolId, item.logical_item_key, item.version],
    );
    assert(existing.rowCount <= 1, `${item.logical_item_key}: lookup ambiguo em sanitario_protocolo_itens_versions_v2`);
    result.set(item.logical_item_key, existing.rows[0] ?? null);
  }
  return result;
}

async function selectDeprecatedActiveItems(client, protocolIdsByFamily) {
  const result = [];
  for (const deprecatedItem of DEPRECATED_ACTIVE_ITEMS) {
    const protocolId = protocolIdsByFamily.get(deprecatedItem.familyCode);
    if (!protocolId || !UUID_LIKE.test(protocolId)) continue;
    const existing = await client.query(
      `
        select id, protocol_id, logical_item_key, deleted_at
        from public.sanitario_protocolo_itens_versions_v2
        where deleted_at is null
          and protocol_id = $1
          and logical_item_key = $2
        order by id
      `,
      [protocolId, deprecatedItem.logicalItemKey],
    );
    for (const row of existing.rows) {
      result.push({ ...deprecatedItem, id: row.id });
    }
  }
  return result;
}

function protocolInsertRow(protocol) {
  return {
    family_code: protocol.family_code,
    name: protocol.name,
    scope: protocol.scope,
    fazenda_id: protocol.fazenda_id,
    species_scope: protocol.species_scope,
    jurisdiction_scope: protocol.jurisdiction_scope,
    legal_status: protocol.legal_status,
    version: protocol.version,
    status: protocol.status,
    source_refs_snapshot: protocol.source_refs_snapshot,
    approval_status: "draft",
    metadata: {
      ...protocol.metadata,
      agenda_allowed: false,
      approved_for_catalog: false,
    },
  };
}

function groupInsertRow(group) {
  return {
    fazenda_id: group.fazenda_id,
    scope: scopeForGroup(group.scope),
    group_key: group.group_key,
    name: group.name,
    requires_mv_for_other_class: group.requires_mv_for_other_class,
    curation_status: group.curation_status,
    automation_status: group.automation_status,
    limitations: group.limitations,
    metadata: {
      ...group.metadata,
      agenda_allowed: false,
      approved_for_catalog: false,
    },
  };
}

function itemInsertRow(item, protocolId, groupId) {
  return {
    protocol_id: protocolId,
    logical_item_key: item.logical_item_key,
    version: item.version,
    item_status: item.item_status,
    action_type: item.action_type,
    product_requirement_kind: item.product_requirement_kind,
    product_id: null,
    product_class: item.product_requirement_kind === "product_class" ? item.product_class : null,
    product_class_group_id: item.product_requirement_kind === "product_class_group" ? groupId : null,
    eligibility_rule: item.eligibility_rule,
    operational_window_rule: item.operational_window_rule,
    dose_rule: null,
    route_rule: null,
    booster_rule: item.booster_rule ?? null,
    species_authorization: item.species_authorization,
    source_refs_by_field: item.source_refs_by_field,
    limitations: item.limitations,
    snapshot_template: {
      ...(item.snapshot_template ?? {}),
      metadata: {
        ...(item.snapshot_template?.metadata ?? {}),
        agenda_allowed: false,
        approved_for_catalog: false,
      },
    },
    allows_agenda_auto: false,
    requires_mv_responsavel: item.requires_mv_responsavel,
    status: "draft",
  };
}

function compareProtocol(existing, row) {
  if (!existing) return true;
  return [
    ["name", row.name],
    ["species_scope", row.species_scope],
    ["jurisdiction_scope", row.jurisdiction_scope],
    ["legal_status", row.legal_status],
    ["status", row.status],
    ["source_refs_snapshot", row.source_refs_snapshot],
    ["approval_status", row.approval_status],
    ["metadata", row.metadata],
  ].some(([key, value]) => isDifferent(existing[key], value));
}

function compareGroup(existing, row) {
  if (!existing) return true;
  return [
    ["name", row.name],
    ["requires_mv_for_other_class", row.requires_mv_for_other_class],
    ["curation_status", row.curation_status],
    ["automation_status", row.automation_status],
    ["limitations", row.limitations],
    ["metadata", row.metadata],
  ].some(([key, value]) => isDifferent(existing[key], value));
}

function compareItem(existing, row) {
  if (!existing) return true;
  return [
    ["item_status", row.item_status],
    ["action_type", row.action_type],
    ["product_requirement_kind", row.product_requirement_kind],
    ["product_id", row.product_id],
    ["product_class", row.product_class],
    ["product_class_group_id", row.product_class_group_id],
    ["eligibility_rule", row.eligibility_rule],
    ["operational_window_rule", row.operational_window_rule],
    ["dose_rule", row.dose_rule],
    ["route_rule", row.route_rule],
    ["booster_rule", row.booster_rule],
    ["species_authorization", row.species_authorization],
    ["source_refs_by_field", row.source_refs_by_field],
    ["limitations", row.limitations],
    ["snapshot_template", row.snapshot_template],
    ["allows_agenda_auto", row.allows_agenda_auto],
    ["requires_mv_responsavel", row.requires_mv_responsavel],
    ["status", row.status],
  ].some(([key, value]) => isDifferent(existing[key], value));
}

async function buildPlan(client, data) {
  const existingProtocols = await selectProtocols(client, data.protocols);
  const existingGroups = await selectGroups(client, data.groups);

  const plannedProtocolIds = new Map();
  for (const protocol of data.protocols) {
    const existing = existingProtocols.get(protocol.family_code);
    plannedProtocolIds.set(protocol.family_code, existing?.id ?? `planned:${protocol.family_code}`);
  }

  const plannedGroupIds = new Map();
  for (const group of data.groups) {
    const existing = existingGroups.get(group.group_key);
    plannedGroupIds.set(group.group_key, existing?.id ?? `planned:${group.group_key}`);
  }

  const existingItems = await selectItems(client, data.items, plannedProtocolIds);
  const deprecatedActiveItems = await selectDeprecatedActiveItems(client, plannedProtocolIds);
  const operations = [];

  for (const group of sortedBy(data.groups, "group_key")) {
    const row = groupInsertRow(group);
    const existing = existingGroups.get(group.group_key);
    const action = existing ? (compareGroup(existing, row) ? "update" : "skip") : "create";
    operations.push({ table: "sanitario_product_class_groups_v2", key: group.group_key, action });
  }

  for (const protocol of sortedBy(data.protocols, "family_code")) {
    const row = protocolInsertRow(protocol);
    const existing = existingProtocols.get(protocol.family_code);
    const action = existing ? (compareProtocol(existing, row) ? "update" : "skip") : "create";
    operations.push({ table: "sanitario_protocolos_v2", key: protocol.family_code, action });
  }

  for (const item of sortedBy(data.items, "logical_item_key")) {
    const familyCode = lookupFamily(item.protocol_id);
    const protocolId = plannedProtocolIds.get(familyCode);
    let action = "reject";
    let reason = "";
    let groupId = null;

    if (!protocolId) {
      reason = `protocol_lookup_missing:${familyCode}`;
    } else if (item.product_requirement_kind === "product_class_group") {
      const groupKey = lookupGroupKey(item.product_class_group_id);
      groupId = plannedGroupIds.get(groupKey);
      if (!groupId) {
        reason = `group_lookup_missing:${groupKey}`;
      }
    }

    if (!reason) {
      const row = itemInsertRow(item, protocolId, groupId);
      const existing = existingItems.get(item.logical_item_key);
      action = existing ? (compareItem(existing, row) ? "update" : "skip") : "create";
    }

    operations.push({
      table: "sanitario_protocolo_itens_versions_v2",
      key: `${familyCode}:${item.logical_item_key}:v${item.version}`,
      action,
      reason,
    });
  }

  for (const rejection of sortedBy(data.memberRejections, "member_key")) {
    operations.push({
      table: "sanitario_product_class_group_members_v2",
      key: rejection.member_key,
      action: "reject",
      reason: rejection.reason,
    });
  }

  for (const item of deprecatedActiveItems) {
    operations.push({
      table: "sanitario_protocolo_itens_versions_v2",
      key: `${item.familyCode}:${item.logicalItemKey}:deprecated`,
      action: "update",
      reason: `replaced_by:${item.replacementKeys.join(",")}`,
    });
  }

  return operations;
}

function summarize(operations) {
  return operations.reduce(
    (acc, op) => {
      acc[op.action] += 1;
      return acc;
    },
    { create: 0, update: 0, skip: 0, reject: 0 },
  );
}

function printPlan(mode, operations) {
  console.log(`12G sanitario protocols v2 ${mode}`);
  for (const op of operations) {
    const suffix = op.reason ? ` reason=${op.reason}` : "";
    console.log(`${op.action.padEnd(6)} ${op.table} ${op.key}${suffix}`);
  }
  console.log(`summary ${JSON.stringify(summarize(operations))}`);
}

async function upsertGroup(client, group) {
  const row = groupInsertRow(group);
  const existing = await selectGroups(client, [group]).then((map) => map.get(group.group_key));
  if (!existing) {
    const inserted = await client.query(
      `
        insert into public.sanitario_product_class_groups_v2(
          fazenda_id, scope, group_key, name, requires_mv_for_other_class,
          curation_status, automation_status, limitations, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id
      `,
      [
        row.fazenda_id,
        row.scope,
        row.group_key,
        row.name,
        row.requires_mv_for_other_class,
        row.curation_status,
        row.automation_status,
        row.limitations,
        asJsonb(row.metadata),
      ],
    );
    return { id: inserted.rows[0].id, action: "create" };
  }
  if (!compareGroup(existing, row)) return { id: existing.id, action: "skip" };
  await client.query(
    `
      update public.sanitario_product_class_groups_v2
      set name = $2,
          requires_mv_for_other_class = $3,
          curation_status = $4,
          automation_status = $5,
          limitations = $6,
          metadata = $7
      where id = $1
    `,
    [
      existing.id,
      row.name,
      row.requires_mv_for_other_class,
      row.curation_status,
      row.automation_status,
      row.limitations,
      asJsonb(row.metadata),
    ],
  );
  return { id: existing.id, action: "update" };
}

async function upsertProtocol(client, protocol) {
  const row = protocolInsertRow(protocol);
  const existing = await selectProtocols(client, [protocol]).then((map) => map.get(protocol.family_code));
  if (!existing) {
    const inserted = await client.query(
      `
        insert into public.sanitario_protocolos_v2(
          family_code, name, scope, fazenda_id, species_scope, jurisdiction_scope,
          legal_status, version, status, source_refs_snapshot, approval_status, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
        returning id
      `,
      [
        row.family_code,
        row.name,
        row.scope,
        row.fazenda_id,
        asJsonb(row.species_scope),
        asJsonb(row.jurisdiction_scope),
        row.legal_status,
        row.version,
        row.status,
        asJsonb(row.source_refs_snapshot),
        asJsonb(row.metadata),
      ],
    );
    return { id: inserted.rows[0].id, action: "create" };
  }
  if (!compareProtocol(existing, row)) return { id: existing.id, action: "skip" };
  await client.query(
    `
      update public.sanitario_protocolos_v2
      set name = $2,
          species_scope = $3,
          jurisdiction_scope = $4,
          legal_status = $5,
          status = $6,
          source_refs_snapshot = $7,
          approval_status = 'draft',
          approved_by = null,
          approved_at = null,
          metadata = $8
      where id = $1
    `,
    [
      existing.id,
      row.name,
      asJsonb(row.species_scope),
      asJsonb(row.jurisdiction_scope),
      row.legal_status,
      row.status,
      asJsonb(row.source_refs_snapshot),
      asJsonb(row.metadata),
    ],
  );
  return { id: existing.id, action: "update" };
}

async function upsertItem(client, item, protocolId, groupId) {
  const row = itemInsertRow(item, protocolId, groupId);
  const existing = await client.query(
    `
      select *
      from public.sanitario_protocolo_itens_versions_v2
      where deleted_at is null
        and protocol_id = $1
        and logical_item_key = $2
        and version = $3
    `,
    [protocolId, item.logical_item_key, item.version],
  );
  assert(existing.rowCount <= 1, `${item.logical_item_key}: lookup ambiguo no apply`);
  if (existing.rowCount === 0) {
    await client.query(
      `
        insert into public.sanitario_protocolo_itens_versions_v2(
          protocol_id, logical_item_key, version, item_status, action_type,
          product_requirement_kind, product_id, product_class, product_class_group_id,
          eligibility_rule, operational_window_rule, dose_rule, route_rule, booster_rule,
          species_authorization, source_refs_by_field, limitations, snapshot_template,
          allows_agenda_auto, requires_mv_responsavel, status
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, false, $19, 'draft'
        )
      `,
      [
        row.protocol_id,
        row.logical_item_key,
        row.version,
        row.item_status,
        row.action_type,
        row.product_requirement_kind,
        row.product_id,
        row.product_class,
        row.product_class_group_id,
        asJsonb(row.eligibility_rule),
        asJsonb(row.operational_window_rule),
        row.dose_rule === null ? null : asJsonb(row.dose_rule),
        row.route_rule === null ? null : asJsonb(row.route_rule),
        row.booster_rule === null ? null : asJsonb(row.booster_rule),
        asJsonb(row.species_authorization),
        asJsonb(row.source_refs_by_field),
        asJsonb(row.limitations),
        asJsonb(row.snapshot_template),
        row.requires_mv_responsavel,
      ],
    );
    return "create";
  }
  if (!compareItem(existing.rows[0], row)) return "skip";
  await client.query(
    `
      update public.sanitario_protocolo_itens_versions_v2
      set item_status = $2,
          action_type = $3,
          product_requirement_kind = $4,
          product_id = $5,
          product_class = $6,
          product_class_group_id = $7,
          eligibility_rule = $8,
          operational_window_rule = $9,
          dose_rule = $10,
          route_rule = $11,
          booster_rule = $12,
          species_authorization = $13,
          source_refs_by_field = $14,
          limitations = $15,
          snapshot_template = $16,
          allows_agenda_auto = false,
          requires_mv_responsavel = $17,
          status = 'draft'
      where id = $1
    `,
    [
      existing.rows[0].id,
      row.item_status,
      row.action_type,
      row.product_requirement_kind,
      row.product_id,
      row.product_class,
      row.product_class_group_id,
      asJsonb(row.eligibility_rule),
      asJsonb(row.operational_window_rule),
      row.dose_rule === null ? null : asJsonb(row.dose_rule),
      row.route_rule === null ? null : asJsonb(row.route_rule),
      row.booster_rule === null ? null : asJsonb(row.booster_rule),
      asJsonb(row.species_authorization),
      asJsonb(row.source_refs_by_field),
      asJsonb(row.limitations),
      asJsonb(row.snapshot_template),
      row.requires_mv_responsavel,
    ],
  );
  return "update";
}

async function tombstoneDeprecatedActiveItems(client, protocolIds) {
  let count = 0;
  for (const deprecatedItem of DEPRECATED_ACTIVE_ITEMS) {
    const protocolId = protocolIds.get(deprecatedItem.familyCode);
    if (!protocolId) continue;
    const result = await client.query(
      `
        update public.sanitario_protocolo_itens_versions_v2
        set deleted_at = now(),
            status = 'retired',
            allows_agenda_auto = false
        where deleted_at is null
          and protocol_id = $1
          and logical_item_key = $2
      `,
      [protocolId, deprecatedItem.logicalItemKey],
    );
    count += result.rowCount ?? 0;
  }
  return count;
}

async function applyImport(client, data) {
  assert(
    process.env.ALLOW_SANITARIO_IMPORT === "1",
    "Modo --apply bloqueado: defina ALLOW_SANITARIO_IMPORT=1 para executar import controlado.",
  );

  const counts = { create: 0, update: 0, skip: 0, reject: 0 };
  await client.query("begin");
  try {
    const groupIds = new Map();
    for (const group of sortedBy(data.groups, "group_key")) {
      const result = await upsertGroup(client, group);
      groupIds.set(group.group_key, result.id);
      counts[result.action] += 1;
    }

    const protocolIds = new Map();
    for (const protocol of sortedBy(data.protocols, "family_code")) {
      const result = await upsertProtocol(client, protocol);
      protocolIds.set(protocol.family_code, result.id);
      counts[result.action] += 1;
    }

    for (const item of sortedBy(data.items, "logical_item_key")) {
      const familyCode = lookupFamily(item.protocol_id);
      const protocolId = protocolIds.get(familyCode);
      assert(protocolId, `${item.logical_item_key}: protocol_id nao resolvido para ${familyCode}`);
      const groupKey = lookupGroupKey(item.product_class_group_id);
      const groupId = groupKey ? groupIds.get(groupKey) : null;
      assert(!groupKey || groupId, `${item.logical_item_key}: ProductClassGroup nao resolvido para ${groupKey}`);
      const action = await upsertItem(client, item, protocolId, groupId);
      counts[action] += 1;
    }

    counts.update += await tombstoneDeprecatedActiveItems(client, protocolIds);
    counts.reject += data.memberRejections.length;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return counts;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const payload = readJsonPayload();
  const data = validateCanonicalPayload(payload);

  if (mode === "validate") {
    console.log("12G validate OK");
    console.log(
      JSON.stringify(
        {
          payload: PAYLOAD_REL,
          artifact_version: payload.artifact_version,
          protocols: data.protocols.length,
          items: data.items.length,
          product_class_groups: data.groups.length,
          member_rejections: data.memberRejections.length,
          execute_import: payload.execute_import,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (mode === "apply") {
    assert(
      process.env.ALLOW_SANITARIO_IMPORT === "1",
      "Modo --apply bloqueado: defina ALLOW_SANITARIO_IMPORT=1 para executar import controlado.",
    );
  }

  const client = await connectDb();
  try {
    if (mode === "dry-run") {
      const plan = await buildPlan(client, data);
      printPlan("dry-run", plan);
      return;
    }

    const counts = await applyImport(client, data);
    console.log("12G apply OK");
    console.log(`summary ${JSON.stringify(counts)}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`12G importador sanitario v2 falhou: ${error.message}`);
  process.exitCode = 1;
});
