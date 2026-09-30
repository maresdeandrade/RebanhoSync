import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  CANONICAL_ARTIFACT_VERSION,
  assertStableIdentity,
  validateCanonicalTechnicalContract,
} from "./sanitario-v2-contract.mjs";

const { Client } = pg;

const ROOT = process.cwd();
const PAYLOAD_REL =
  "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json";
const PAYLOAD_PATH = path.join(ROOT, PAYLOAD_REL);

const EXPECTED = {
  artifact: "sanitario_protocols_v2_canonical_payload",
  artifactVersion: CANONICAL_ARTIFACT_VERSION,
  protocols: 10,
  items: 20,
  groups: 4,
  members: 12,
  memberRejections: 4,
};

const PIPELINE_STATUS = {
  CANONICAL_VALIDATION_COMPLETE: true,
  PUBLISHER_COMPLETE: false,
};

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const IMPORT_LOCK_KEY = "rebanhosync:sanitario-protocols-v2:12F10";

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
    `  ALLOW_SANITARIO_IMPORT=1 SANITARIO_IMPORT_CONFIRM=${EXPECTED.artifactVersion} node scripts/codex/import-sanitario-protocols-v2.mjs --apply`,
    "  Em banco remoto, tambem exige ALLOW_SANITARIO_REMOTE_IMPORT=1.",
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

function rows(canonicalData) {
  return {
    protocols: canonicalData.protocol_rows,
    items: canonicalData.protocol_item_rows,
    groups: canonicalData.product_class_group_rows,
    members: canonicalData.product_class_group_member_rows,
    memberRejections: canonicalData.memberRejections ?? [],
  };
}

function itemIdentity(item) {
  return `${item.protocol_key}:${item.logical_item_key}:v${item.version}`;
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

function protocolUpdateBlockReason(existing) {
  if (!existing) return null;
  if (existing.approval_status !== "draft" || existing.approved_at || existing.status !== "draft") {
    return "protocol_not_draft";
  }
  return null;
}

function groupUpdateBlockReason(existing) {
  if (!existing) return null;
  if (
    existing.curation_status !== "needs_review" ||
    ["agenda_allowed", "blocked"].includes(existing.automation_status)
  ) {
    return "group_already_curated_or_operational";
  }
  return null;
}

function itemUpdateBlockReason(existing) {
  if (!existing) return null;
  return existing.status === "draft" ? null : "item_not_draft";
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
  const contract = validateCanonicalTechnicalContract(payload);
  const data = rows(contract.data);

  assert(payload.artifact === EXPECTED.artifact, "artifact canonico inesperado");
  assert(payload.artifact_version === EXPECTED.artifactVersion, "artifact_version 12F10 inesperada");
  assert(payload.identity_model === "VERSIONED_EXPLICIT_UUID", "identity_model deve ser VERSIONED_EXPLICIT_UUID");
  assert(payload.execute_import === false, "execute_import deve permanecer false");
  assert(payload.counts?.protocols === EXPECTED.protocols, "counts.protocols deve ser 10");
  assert(payload.counts?.protocol_items === EXPECTED.items, `counts.protocol_items deve ser ${EXPECTED.items}`);
  assert(payload.counts?.product_class_groups === EXPECTED.groups, "counts.product_class_groups deve ser 4");
  assert(payload.counts?.product_class_group_members === EXPECTED.members, "counts.product_class_group_members deve ser 12");
  assert(
    payload.counts?.product_class_group_member_rejections === EXPECTED.memberRejections,
    "counts.product_class_group_member_rejections deve ser 4",
  );
  assert(data.protocols.length === EXPECTED.protocols, "payload deve conter 10 protocolos");
  assert(data.items.length === EXPECTED.items, `payload deve conter ${EXPECTED.items} itens`);
  assert(data.groups.length === EXPECTED.groups, "payload deve conter 4 ProductClassGroups");
  assert(data.members.length === EXPECTED.members, "payload deve conter 12 ProductClassGroupMembers");
  assert(data.memberRejections.length === EXPECTED.memberRejections, "payload deve conter 4 rejeicoes de members");

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
  const aftosaItems = data.items.filter((row) => row.protocol_key === "febre_aftosa");
  assert(aftosa, "Aftosa ausente");
  assert(aftosa.legal_status === "bloqueado", "Aftosa deve manter legal_status bloqueado");
  assert(aftosa.status === "retired", "Aftosa deve manter status retired");
  assert(aftosa.metadata?.automationStatus === "blocked", "Aftosa deve manter automationStatus blocked");
  for (const item of aftosaItems) {
    assert(item.product_requirement_kind === "none", `${item.logical_item_key}: aftosa nao pode ter produto`);
    assert(!item.product_key, `${item.logical_item_key}: aftosa product_id deve ser null`);
    assert(!item.class_key, `${item.logical_item_key}: aftosa product_class deve ser null`);
    assert(!item.group_key, `${item.logical_item_key}: aftosa product_class_group_id deve ser null`);
  }

  const groupKeys = new Set(data.groups.map((row) => row.group_key));
  for (const item of data.items) {
    assert(item.allows_agenda_auto === false, `${item.logical_item_key}: allows_agenda_auto deve ser false`);
    assert(item.status === "draft", `${item.logical_item_key}: status deve ser draft`);
    assert(["specific_product", "product_class", "product_class_group", "none"].includes(item.product_requirement_kind), `${item.logical_item_key}: product_requirement_kind invalido`);
    if (item.product_requirement_kind === "product_class_group") {
      assert(item.group_key, `${item.logical_item_key}: product_class_group_id deve ser lookup por group_key`);
      assert(groupKeys.has(item.group_key), `${item.logical_item_key}: group_key ${item.group_key} ausente do payload canonico`);
      assert(!item.class_key, `${item.logical_item_key}: ProductClassGroup nao pode virar ProductClass`);
      assert(!item.product_key, `${item.logical_item_key}: ProductClassGroup nao pode virar produto especifico`);
      assert(item.limitations?.includes("class_group_does_not_validate_execution"), `${item.logical_item_key}: grupo deve declarar que nao valida execucao`);
    }
    if (item.product_requirement_kind === "product_class") {
      assert(item.class_key?.trim(), `${item.logical_item_key}: product_class exige valor`);
      assert(!item.group_key, `${item.logical_item_key}: product_class nao pode referenciar group`);
    }
    if (item.product_requirement_kind === "none") {
      assert(!item.product_key && !item.class_key && !item.group_key, `${item.logical_item_key}: none deve permanecer sem produto/classe/grupo`);
    }
    validateSourceRefs(item.source_refs_by_field, item.logical_item_key);
  }

  const raivaItems = data.items.filter((row) => row.protocol_key === "raiva_herbivoros");
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
    assert(item.class_key === "vacina_raiva_herbivoros", `${item.logical_item_key}: product_class de raiva invalida`);
    assert(!item.group_key, `${item.logical_item_key}: raiva nao deve usar ProductClassGroup`);
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

  const matrizesItems = data.items.filter((row) => row.protocol_key === "matrizes_pre_parto");
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
      item.class_key !== "vacina_leptospirose",
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

  const validClassKeys = new Set(["lactonas_macrociclicas", "benzimidazois", "imidazotiazoleis"]);
  const classKeys = new Set(contract.data.product_class_rows.map((row) => row.class_key));
  const memberPairs = new Set();
  for (const member of data.members) {
    const pair = `${member.group_key}:${member.class_key}`;
    assert(groupKeys.has(member.group_key), `${pair}: grupo de member inexistente`);
    assert(validClassKeys.has(member.class_key) && classKeys.has(member.class_key), `${pair}: classe de member invalida`);
    assert(!memberPairs.has(pair), `${pair}: member duplicado`);
    memberPairs.add(pair);
  }
  for (const groupKey of groupKeys) {
    for (const classKey of validClassKeys) {
      assert(memberPairs.has(`${groupKey}:${classKey}`), `${groupKey}:${classKey}: member ausente`);
    }
  }
  const rejectedGroups = new Set();
  for (const rejection of data.memberRejections) {
    assert(
      rejection.reason === "NOT_A_CLASS_CONFIRMED" && rejection.class_key === "associacoes_antiparasitarias",
      `${rejection.member_key}: motivo de rejeicao deve ser NOT_A_CLASS_CONFIRMED para associacoes_antiparasitarias`,
    );
    assert(groupKeys.has(rejection.group_key), `${rejection.member_key}: grupo de rejection inexistente`);
    assert(!rejectedGroups.has(rejection.group_key), `${rejection.member_key}: rejection duplicada para grupo`);
    rejectedGroups.add(rejection.group_key);
    assert(!Object.hasOwn(rejection, "class_id"), `${rejection.member_key}: member nao pode importar sem class_id`);
    assert(!UUID_LIKE.test(stableStringify(rejection)), `${rejection.member_key}: rejeicao nao pode conter UUID artificial`);
  }
  assert(rejectedGroups.size === groupKeys.size, "cada grupo deve ter uma rejection de associacoes_antiparasitarias");

  return contract.data;
}

function readSupabaseStatusEnv() {
  if (process.env.DB_URL?.trim()) return { DB_URL: process.env.DB_URL.trim() };
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  assert(env.DB_URL, "supabase status -o env nao retornou DB_URL");
  return env;
}

function describeDatabase(dbUrl) {
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    fail("DB_URL invalida; use uma connection string postgresql:// valida.");
  }
  assert(
    ["postgres:", "postgresql:"].includes(parsed.protocol),
    `DB_URL deve usar postgres/postgresql, recebido ${parsed.protocol}`,
  );
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    local: LOCAL_DATABASE_HOSTS.has(parsed.hostname),
  };
}

export function applyGateError(payload, publisherComplete) {
  if (publisherComplete !== true) {
    return "PUBLISHER_INCOMPLETE: --apply bloqueado; cobertura P1 nao conclui as colecoes e requisitos da P2.";
  }
  const gate = payload?.import_gate;
  if (gate?.import_real_authorized !== true) {
    return "IMPORT_REAL_NOT_AUTHORIZED: --apply bloqueado enquanto import_gate.import_real_authorized !== true.";
  }
  return null;
}

export function assertApplyGate(payload) {
  const error = applyGateError(payload, PIPELINE_STATUS.PUBLISHER_COMPLETE);
  assert(!error, error);
}

function assertApplyAuthorized(dbUrl) {
  assert(
    process.env.ALLOW_SANITARIO_IMPORT === "1",
    "Modo --apply bloqueado: defina ALLOW_SANITARIO_IMPORT=1.",
  );
  assert(
    process.env.SANITARIO_IMPORT_CONFIRM === EXPECTED.artifactVersion,
    `Modo --apply bloqueado: defina SANITARIO_IMPORT_CONFIRM=${EXPECTED.artifactVersion}.`,
  );
  const target = describeDatabase(dbUrl);
  if (!target.local) {
    assert(
      process.env.ALLOW_SANITARIO_REMOTE_IMPORT === "1",
      `Import remoto bloqueado para ${target.host}. Defina ALLOW_SANITARIO_REMOTE_IMPORT=1 somente apos dry-run e autorizacao explicita.`,
    );
  }
  return target;
}

async function connectDb(mode) {
  const env = readSupabaseStatusEnv();
  const target = describeDatabase(env.DB_URL);
  if (mode === "apply") assertApplyAuthorized(env.DB_URL);
  const client = new Client({ connectionString: env.DB_URL });
  await client.connect();
  return { client, target };
}

export function sourceInsertRow(source) {
  return {
    id: source.id, source_key: source.source_key, kind: source.kind, scope: source.scope,
    fazenda_id: source.fazenda_id ?? null, title: source.title,
    issuer: source.issuer ?? null, version: source.version ?? null,
    published_at: source.published_at ?? null, accessed_at: source.accessed_at ?? null,
    url: source.url ?? null, jurisdiction_country: source.jurisdiction_country ?? "BR",
    jurisdiction_uf: source.jurisdiction_uf ?? null, jurisdiction_zone: source.jurisdiction_zone ?? null,
    strength: source.strength, evidence_status: source.evidence_status,
    limitations: source.limitations ?? [], metadata: source.metadata ?? {},
  };
}

export function coverageInsertRow(coverage, source) {
  assert(source && !source.deleted_at, `source_lookup_missing_or_tombstoned:${coverage.source_key}`);
  return {
    id: coverage.id, source_id: source.id, field_key: coverage.field_key,
    coverage_status: coverage.coverage_status, notes: coverage.notes ?? null,
  };
}

export function classInsertRow(cls) {
  return {
    id: cls.id, scope: cls.scope, fazenda_id: cls.fazenda_id ?? null,
    class_key: cls.class_key, name: cls.name, product_type: cls.product_type,
    product_subtype: cls.product_subtype ?? null, target_condition: cls.target_condition ?? null,
    species_scope: cls.species_scope, curation_status: cls.curation_status,
    automation_status: cls.automation_status, limitations: cls.limitations ?? [], metadata: cls.metadata ?? {},
  };
}

export function memberInsertRow(member, group, cls) {
  assert(group && !group.deleted_at, `group_lookup_missing_or_tombstoned:${member.group_key}`);
  assert(cls && !cls.deleted_at, `class_lookup_missing_or_tombstoned:${member.class_key}`);
  assertCompatibleScope(group, cls, "member");
  return {
    id: member.id, group_id: group.id, class_id: cls.id,
    scope: group.scope, fazenda_id: group.fazenda_id ?? null,
    is_allowed: member.is_allowed ?? true, requires_mv_override: member.requires_mv_override ?? null,
    limitations: member.limitations ?? [], metadata: member.metadata ?? {},
  };
}

function assertCompatibleScope(parent, reference, label) {
  const tenant = parent.scope === "tenant" || parent.scope === "fazenda";
  assert(tenant
    ? reference.scope === "global" ||
      ((reference.scope === "tenant" || reference.scope === "fazenda") && reference.fazenda_id === parent.fazenda_id)
    : reference.scope === "global", `${label}:cross_scope_reference`);
}

function classUpdateBlockReason(existing) {
  return !["candidate", "needs_review"].includes(existing.curation_status) ||
    ["agenda_allowed", "blocked"].includes(existing.automation_status) ? "class_already_curated_or_operational" : null;
}

function protocolInsertRow(protocol) {
  return {
    id: protocol.id, family_code: protocol.family_code, name: protocol.name,
    scope: protocol.scope, fazenda_id: protocol.fazenda_id ?? null,
    species_scope: protocol.species_scope ?? [], jurisdiction_scope: protocol.jurisdiction_scope ?? {},
    legal_status: protocol.legal_status, version: protocol.version, status: protocol.status,
    source_refs_snapshot: protocol.source_refs_snapshot ?? [], approval_status: "draft",
    metadata: { ...protocol.metadata, agenda_allowed: false, approved_for_catalog: false },
  };
}

function groupInsertRow(group) {
  return {
    id: group.id, fazenda_id: group.fazenda_id ?? null, scope: scopeForGroup(group.scope),
    group_key: group.group_key, name: group.name, requires_mv_for_other_class: group.requires_mv_for_other_class ?? true,
    curation_status: group.curation_status, automation_status: group.automation_status,
    limitations: group.limitations ?? [],
    metadata: { ...group.metadata, agenda_allowed: false, approved_for_catalog: false },
  };
}

export function itemInsertRow(item, protocolId, groupId) {
  return {
    id: item.id, protocol_id: protocolId, logical_item_key: item.logical_item_key, version: item.version,
    item_status: item.item_status, action_type: item.action_type, product_requirement_kind: item.product_requirement_kind,
    product_id: null,
    product_class: item.product_requirement_kind === "product_class" ? item.class_key : null,
    product_class_group_id: item.product_requirement_kind === "product_class_group" ? groupId : null,
    eligibility_rule: item.eligibility_rule, operational_window_rule: item.operational_window_rule,
    dose_rule: null, route_rule: null, booster_rule: item.booster_rule ?? null,
    species_authorization: item.species_authorization, source_refs_by_field: item.source_refs_by_field,
    limitations: item.limitations ?? [],
    snapshot_template: {
      ...(item.snapshot_template ?? {}),
      metadata: { ...(item.snapshot_template?.metadata ?? {}), agenda_allowed: false, approved_for_catalog: false },
    },
    allows_agenda_auto: false, requires_mv_responsavel: item.requires_mv_responsavel ?? false, status: "draft",
  };
}

// Only P1 tables/columns are eligible for SQL. Symbols remain in CanonicalData.
const P1_PUBLISHERS = [
  {
    collection: "source_rows", table: "sanitario_fontes_tecnicas_v2",
    key: (r) => r.source_key, natural: ["scope", "fazenda_id", "source_key"],
    project: sourceInsertRow, json: ["limitations", "metadata"], dates: ["published_at", "accessed_at"],
  },
  {
    collection: "coverage_rows", table: "sanitario_fonte_cobertura_campos_v2",
    key: (r) => `${r.source_key}:${r.field_key}`, natural: ["source_id", "field_key"],
    project: (r, parents) => coverageInsertRow(r, resolveParent(parents, "source_rows", r.source_key)),
  },
  {
    collection: "product_class_rows", table: "sanitario_product_classes_v2",
    key: (r) => r.class_key, natural: ["scope", "fazenda_id", "class_key"],
    project: classInsertRow, json: ["metadata"], block: classUpdateBlockReason,
  },
  {
    collection: "product_class_group_rows", table: "sanitario_product_class_groups_v2",
    key: (r) => r.group_key, natural: ["scope", "fazenda_id", "group_key"],
    project: groupInsertRow, json: ["metadata"], block: groupUpdateBlockReason,
  },
  {
    collection: "product_class_group_member_rows", table: "sanitario_product_class_group_members_v2",
    key: (r) => `${r.group_key}:${r.class_key}`, natural: ["group_id", "class_id"],
    project: (r, parents) => memberInsertRow(r,
      resolveParent(parents, "product_class_group_rows", r.group_key),
      resolveParent(parents, "product_class_rows", r.class_key)),
    json: ["metadata"],
  },
  {
    collection: "protocol_rows", table: "sanitario_protocolos_v2",
    key: (r) => r.protocol_key, natural: ["family_code", "scope", "fazenda_id", "version"],
    project: protocolInsertRow,
    json: ["species_scope", "jurisdiction_scope", "source_refs_snapshot", "metadata"],
    block: protocolUpdateBlockReason,
  },
  {
    collection: "protocol_item_rows", table: "sanitario_protocolo_itens_versions_v2",
    key: itemIdentity, natural: ["protocol_id", "logical_item_key", "version"],
    project: (r, parents) => {
      assert(r.product_requirement_kind !== "specific_product", "P2_REQUIRED:specific_product");
      assert(r.dose_rule == null && r.route_rule == null, "P2_REQUIRED:item_dose_or_route");
      const protocol = resolveParent(parents, "protocol_rows", r.protocol_key);
      const group = r.product_requirement_kind === "product_class_group"
        ? resolveParent(parents, "product_class_group_rows", r.group_key) : null;
      if (group) assertCompatibleScope(protocol, group, "item_group");
      if (r.product_requirement_kind === "product_class") {
        assertCompatibleScope(protocol, resolveParent(parents, "product_class_rows", r.class_key), "item_class");
      }
      return itemInsertRow(r, protocol.id, group?.id ?? null);
    },
    json: ["eligibility_rule", "operational_window_rule", "dose_rule", "route_rule",
      "booster_rule", "species_authorization", "source_refs_by_field", "limitations", "snapshot_template"],
    block: itemUpdateBlockReason,
  },
];

const EXPECTED_MEMBER_REJECTIONS = new Map([
  ["spcgmem_recria_associacoes", "pcg_antiparasitarios_recria_estrategicos"],
  ["spcgmem_pre_desmama_associacoes", "pcg_antiparasitarios_bezerros_pre_desmama"],
  ["spcgmem_pre_confinamento_associacoes", "pcg_antiparasitarios_pre_confinamento"],
  ["spcgmem_matrizes_associacoes", "pcg_antiparasitarios_matrizes_pre_parto"],
]);

function resolveParent(parents, collection, key) {
  const parent = parents.get(collection)?.get(key);
  assert(parent && parent.action !== "reject", `${collection}_lookup_missing_or_conflicted:${key}`);
  assert(!parent.row.deleted_at, `${collection}_parent_tombstoned:${key}`);
  return parent.row;
}

function assertScope(row, collection) {
  if (["source_rows", "product_class_rows", "product_class_group_rows", "protocol_rows"].includes(collection)) {
    const tenantScope = collection === "source_rows" || collection === "protocol_rows" ? "fazenda" : "tenant";
    assert((row.scope === "global" || (collection === "protocol_rows" && row.scope === "pack"))
      ? row.fazenda_id === null : row.scope === tenantScope && Boolean(row.fazenda_id),
    `${collection}:invalid_scope_fazenda`);
  }
  if (collection === "source_rows" && row.kind === "mv_responsavel") {
    assert(row.scope === "fazenda", "mv_responsavel_requires_fazenda");
  }
  if (collection === "product_class_rows") {
    assert(row.class_key !== "associacoes_antiparasitarias", "NOT_A_CLASS_CONFIRMED");
  }
}

async function selectIdentity(client, publisher, row, lockRows) {
  const values = publisher.natural.map((column) => row[column]);
  const predicates = publisher.natural.map((column, index) => `${column} is not distinct from $${index + 1}`);
  values.push(row.id);
  // Include tombstones and the UUID even when it belongs to a different natural key.
  return (await client.query(
    `select * from public.${publisher.table}
     where (${predicates.join(" and ")}) or id = $${values.length}
     order by id${lockRows ? " for update" : ""}`, values,
  )).rows;
}

function identityReason(publisher, row, existingRows) {
  if (existingRows.length > 1) return "IDENTITY_AMBIGUOUS";
  const existing = existingRows[0];
  if (!existing) return null;
  if (existing.id !== row.id) return "IDENTITY_CONFLICT";
  if (publisher.natural.some((field) => isDifferent(existing[field] ?? null, row[field] ?? null))) {
    return "CANONICAL_UUID_OTHER_IDENTITY";
  }
  if (existing.deleted_at) return "TOMBSTONE_IDENTITY_RESERVED";
  assertStableIdentity(existing, row, publisher.key(row));
  return null;
}

function compareRow(publisher, existing, row) {
  return Object.entries(row).some(([field, value]) => {
    let actual = existing[field] ?? null;
    if (publisher.dates?.includes(field) && actual instanceof Date) {
      actual = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, "0")}-${String(actual.getDate()).padStart(2, "0")}`;
    }
    return isDifferent(actual, value);
  });
}

async function selectDeprecatedActiveItems(client, data, lockRows = false) {
  const result = [];
  for (const deprecated of DEPRECATED_ACTIVE_ITEMS) {
    const protocols = data.protocol_rows.filter((p) => p.family_code === deprecated.familyCode);
    for (const protocol of protocols) {
      const existing = await client.query(
        `select id, protocol_id, logical_item_key, status, deleted_at
         from public.sanitario_protocolo_itens_versions_v2
         where deleted_at is null and protocol_id = $1 and logical_item_key = $2
         order by id${lockRows ? " for update" : ""}`,
        [protocol.id, deprecated.logicalItemKey],
      );
      for (const row of existing.rows) result.push({ ...deprecated, ...row });
    }
  }
  return result;
}

export async function buildPlan(client, data, { lockRows = false } = {}) {
  const supported = new Set(P1_PUBLISHERS.map((p) => p.collection));
  for (const [collection, entries] of Object.entries(data)) {
    assert(collection === "memberRejections" || supported.has(collection) || entries.length === 0,
      `P1_UNSUPPORTED_NONEMPTY_COLLECTION:${collection}`);
  }
  const operations = [];
  const parents = new Map();
  const allIds = new Map();
  for (const publisher of P1_PUBLISHERS) {
    for (const canonical of data[publisher.collection] ?? []) {
      allIds.set(canonical.id, (allIds.get(canonical.id) ?? 0) + 1);
    }
  }
  for (const publisher of P1_PUBLISHERS) {
    const entries = data[publisher.collection] ?? [];
    const projectedKeys = new Map();
    const resolved = new Map();
    parents.set(publisher.collection, resolved);
    for (const canonical of sortedBy(entries, "id")) {
      const key = publisher.key(canonical);
      let row = null;
      let reason = "";
      let existing = null;
      let action = "reject";
      try {
        assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonical.id), "EXPLICIT_UUID_REQUIRED");
        assert(allIds.get(canonical.id) === 1, "DUPLICATE_CANONICAL_UUID");
        assert(!canonical.deleted_at, "CANONICAL_TOMBSTONE_NOT_PUBLISHABLE");
        row = publisher.project(canonical, parents);
        assertScope(row, publisher.collection);
        const naturalKey = stableStringify(publisher.natural.map((field) => row[field]));
        if (!projectedKeys.has(naturalKey)) projectedKeys.set(naturalKey, []);
        projectedKeys.get(naturalKey).push(operations.length);
        const found = await selectIdentity(client, publisher, row, lockRows);
        existing = found[0] ?? null;
        reason = identityReason(publisher, row, found) ?? "";
        if (!reason) {
          const changed = existing && compareRow(publisher, existing, row);
          reason = changed ? (publisher.block?.(existing) ?? "") : "";
          action = reason ? "reject" : existing ? (changed ? "update" : "skip") : "create";
        }
      } catch (error) {
        reason = error.message;
      }
      const operation = {
        collection: publisher.collection, table: publisher.table, key, canonical_id: canonical.id,
        action, reason, classification: action === "reject" ? "UNEXPECTED_CONFLICT" : "CANONICAL_ROW",
        row, existing,
      };
      operations.push(operation);
      resolved.set(key, operation);
    }
    // Mark every duplicate, including its first occurrence; descendants cannot resolve it.
    for (const positions of projectedKeys.values()) {
      if (positions.length <= 1) continue;
      for (const position of positions) {
        Object.assign(operations[position], {
          action: "reject", reason: "DUPLICATE_CANONICAL_NATURAL_KEY", classification: "UNEXPECTED_CONFLICT",
        });
      }
    }
  }
  const rejectionKeys = new Set();
  for (const rejection of data.memberRejections ?? []) {
    const expected = !rejectionKeys.has(rejection.member_key) &&
      EXPECTED_MEMBER_REJECTIONS.get(rejection.member_key) === rejection.group_key &&
      rejection.class_key === "associacoes_antiparasitarias" && rejection.reason === "NOT_A_CLASS_CONFIRMED" &&
      rejection.target_table === "sanitario_product_class_group_members_v2" &&
      !rejection.id && !rejection.class_id && parents.get("product_class_group_rows")?.has(rejection.group_key);
    rejectionKeys.add(rejection.member_key);
    operations.push({
      table: "sanitario_product_class_group_members_v2", key: rejection.member_key,
      action: "reject", reason: rejection.reason,
      classification: expected ? "EXPECTED_REJECTION" : "UNEXPECTED_CONFLICT",
    });
  }
  for (const item of await selectDeprecatedActiveItems(client, data, lockRows)) {
    operations.push({
      table: "sanitario_protocolo_itens_versions_v2", key: `${item.protocol_id}:${item.logical_item_key}:deprecated`,
      action: item.status === "draft" ? "update" : "reject",
      reason: item.status === "draft" ? `replaced_by:${item.replacementKeys.join(",")}` : "deprecated_item_not_draft",
      classification: item.status === "draft" ? "DEPRECATED_ITEM" : "UNEXPECTED_CONFLICT",
      existing: item,
    });
  }
  const expectedCount = [...supported].reduce((count, collection) => count + (data[collection]?.length ?? 0), 0);
  assert(operations.filter((op) => supported.has(op.collection)).length === expectedCount, "CANONICAL_PLAN_COVERAGE_MISMATCH");
  return operations;
}

export function assertPublishablePlan(operations) {
  const expectedKeys = new Set();
  const conflicts = operations.filter((op) => {
    if (op.action !== "reject") return false;
    const expected = op.classification === "EXPECTED_REJECTION" &&
      op.table === "sanitario_product_class_group_members_v2" &&
      EXPECTED_MEMBER_REJECTIONS.has(op.key) && op.reason === "NOT_A_CLASS_CONFIRMED" &&
      !op.collection && !op.row && !expectedKeys.has(op.key);
    if (expected) expectedKeys.add(op.key);
    return !expected;
  });
  assert(conflicts.length === 0,
    `UNEXPECTED_CONFLICT: ${stableStringify(conflicts.map(({ table, key, reason }) => ({ table, key, reason })))}`);
}

export function assertConvergedPlan(operations) {
  assertPublishablePlan(operations);
  const unstable = operations.filter((op) => op.action !== "skip" && op.classification !== "EXPECTED_REJECTION");
  assert(unstable.length === 0,
    `Import nao ficou idempotente antes do commit: ${stableStringify(unstable.map(({ table, key, action }) => ({ table, key, action })))}`);
}

function summarize(operations) {
  return operations.reduce((acc, op) => { acc[op.action] += 1; return acc; },
    { create: 0, update: 0, skip: 0, reject: 0 });
}

function printPlan(mode, operations) {
  console.log(`12G sanitario protocols v2 ${mode}`);
  for (const op of operations) {
    const suffix = op.reason ? ` reason=${op.reason} classification=${op.classification}` : "";
    console.log(`${op.action.padEnd(6)} ${op.table} ${op.key}${suffix}`);
  }
  console.log(`summary ${JSON.stringify(summarize(operations))}`);
}

async function writeOperation(client, operation) {
  if (operation.action === "skip" || operation.classification === "EXPECTED_REJECTION") return;
  if (operation.classification === "DEPRECATED_ITEM") {
    const result = await client.query(
      `update public.sanitario_protocolo_itens_versions_v2
       set deleted_at = now(), status = 'retired', allows_agenda_auto = false
       where id = $1 and deleted_at is null and status = 'draft'`, [operation.existing.id],
    );
    assert(result.rowCount === 1, "deprecated_item_concurrent_change");
    return;
  }
  const publisher = P1_PUBLISHERS.find((p) => p.collection === operation.collection);
  assert(publisher && operation.row, "UNSUPPORTED_WRITE_OPERATION");
  const columns = Object.keys(operation.row);
  const values = columns.map((field) => publisher.json?.includes(field) && operation.row[field] !== null
    ? asJsonb(operation.row[field]) : operation.row[field]);
  let result;
  if (operation.action === "create") {
    result = await client.query(
      `insert into public.${publisher.table} (${columns.join(", ")})
       values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, values,
    );
  } else {
    assert(operation.action === "update", "UNEXPECTED_WRITE_ACTION");
    // Read FOR UPDATE after the advisory lock. Natural identity columns are immutable.
    const mutable = columns.filter((field) => field !== "id" && !publisher.natural.includes(field));
    const updateValues = mutable.map((field) => values[columns.indexOf(field)]);
    updateValues.push(operation.row.id);
    result = await client.query(
      `update public.${publisher.table}
       set ${mutable.map((field, i) => `${field} = $${i + 1}`).join(", ")}
       where id = $${updateValues.length} and deleted_at is null returning id`, updateValues,
    );
  }
  assert(result.rowCount === 1, `${operation.key}:WRITE_ROW_COUNT_CONFLICT`);
}

// Caller-supplied data/flags cannot authorize publication: read the canonical artifact.
async function applyImport(client) {
  const payload = readJsonPayload();
  assertApplyGate(payload);
  const data = validateCanonicalPayload(payload);
  return applyTransaction(client, data);
}

// Private engine: all production calls must pass through the authorized entrypoint.
async function applyTransaction(client, data) {
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '60s'");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [IMPORT_LOCK_KEY]);
    const plan = await buildPlan(client, data, { lockRows: true });
    assertPublishablePlan(plan);
    for (const operation of plan) await writeOperation(client, operation);
    assertConvergedPlan(await buildPlan(client, data, { lockRows: true }));
    await client.query("commit");
    return summarize(plan);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
async function main() {
  const mode = parseMode(process.argv.slice(2));
  const payload = readJsonPayload();
  if (mode === "apply") assertApplyGate(payload);
  const data = validateCanonicalPayload(payload);

  if (mode === "validate") {
    console.log("12G validate OK");
    console.log(
      JSON.stringify(
        {
          payload: PAYLOAD_REL,
          artifact_version: payload.artifact_version,
          canonical_validation_complete: PIPELINE_STATUS.CANONICAL_VALIDATION_COMPLETE,
          publisher_complete: PIPELINE_STATUS.PUBLISHER_COMPLETE,
          protocols: data.protocol_rows.length,
          items: data.protocol_item_rows.length,
          sources: data.source_rows.length,
          coverage: data.coverage_rows.length,
          product_classes: data.product_class_rows.length,
          product_class_groups: data.product_class_group_rows.length,
          product_class_group_members: data.product_class_group_member_rows.length,
          member_rejections: data.memberRejections.length,
          execute_import: payload.execute_import,
        },
        null,
        2,
      ),
    );
    return;
  }

  const connection = await connectDb(mode);
  const { client } = connection;
  try {
    console.log(
      `database host=${connection.target.host} port=${connection.target.port} database=${connection.target.database} local=${connection.target.local}`,
    );
    if (mode === "dry-run") {
      const plan = await buildPlan(client, data);
      printPlan("dry-run", plan);
      console.log(
        `aviso: publisher_complete=false; cobertura P1 do payload atual; sete colecoes e specific_product aguardam P2`,
      );
      return;
    }

    const preflightPlan = await buildPlan(client, data);
    assertPublishablePlan(preflightPlan);
    printPlan("apply-plan", preflightPlan);
    const counts = await applyImport(client);
    console.log("12G apply OK");
    console.log(`summary ${JSON.stringify(counts)}`);
  } finally {
    await client.end();
  }
}

const INVOKED_AS_SCRIPT =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (INVOKED_AS_SCRIPT) {
  main().catch((error) => {
    console.error(`12G importador sanitario v2 falhou: ${error.message}`);
    process.exitCode = 1;
  });
}
