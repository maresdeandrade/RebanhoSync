import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import pg from "pg";
import { classDeltaDigest, prepareClassDelta } from "./prepare-sanitario-class-delta-v2.mjs";
import { BASELINE_PATH as CLOSURE_BASELINE_PATH, prepareClosureCandidates, prepareClosureDelta, prepareClosureBootstrap, CLOSURE_DELTA_KIND } from "./prepare-sanitario-closure-v2.mjs";
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
  PUBLISHER_COMPLETE: true,
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
    "  --validate/--dry-run aceitam --review-candidate <arquivo>; dry-run de candidato exige banco local descartavel.",
    "  --validate/--dry-run/--apply aceitam --incremental <delta>; apply exige autorizacao e SANITARIO_DELTA_CONFIRM=<content_sha256>.",
    "  --review-candidate <arquivo> --apply so e aceito para produtos comerciais (sanitario_commercial_products_v2_review_candidates); exige SANITARIO_PRODUCTS_CONFIRM=<content_sha256> e SANITARIO_PRODUCTS_AUTHORIZATION_REF.",
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

function commercialProductReviewDigest(payload) {
  const { content_sha256, ...content } = payload;
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

function validateCommercialProductReviewPayload(payload) {
  const { data } = validateCanonicalTechnicalContract(payload);
  assert(payload.artifact === "sanitario_commercial_products_v2_review_candidates", "COMMERCIAL_REVIEW_ARTIFACT_REQUIRED");
  assert(payload.artifact_version === CANONICAL_ARTIFACT_VERSION, "COMMERCIAL_REVIEW_ARTIFACT_VERSION_MISMATCH");
  assert(payload.execute_import === false && payload.approved === false && payload.review_only === true,
    "COMMERCIAL_REVIEW_ONLY_REQUIRED");
  assert(payload.import_gate?.import_real_authorized === false && payload.import_gate?.remote_write_authorized === false &&
    payload.import_gate?.regulatory_confirmed === false && payload.import_gate?.authorization_reference == null,
  "COMMERCIAL_REVIEW_IMPORT_GATE_MUST_REMAIN_CLOSED");
  assert(payload.content_sha256 === commercialProductReviewDigest(payload), "COMMERCIAL_REVIEW_DIGEST_MISMATCH");
  assert(payload.counts?.products === 39 && data.product_rows.length === 39, "COMMERCIAL_REVIEW_EXACT_39_PRODUCTS_REQUIRED");
  const heldNames = new Set((payload.held ?? []).map((product) => product.nome_comercial));
  assert(payload.counts?.held === 3 && heldNames.size === 3 &&
    ["Fortress 8", "Lepto-Bac 6", "Valbazen 10 Cobalto"].every((name) => heldNames.has(name)),
  "COMMERCIAL_REVIEW_HELD_SET_MISMATCH");
  assert(payload.source_artifacts?.candidate_json?.sha256 && /^[0-9a-f]{64}$/.test(payload.source_artifacts.candidate_json.sha256),
    "COMMERCIAL_REVIEW_SOURCE_JSON_DIGEST_REQUIRED");
  assert(payload.source_artifacts?.decision_csv?.sha256 && /^[0-9a-f]{64}$/.test(payload.source_artifacts.decision_csv.sha256),
    "COMMERCIAL_REVIEW_DECISION_CSV_DIGEST_REQUIRED");

  for (const [collection, entries] of Object.entries(data)) {
    if (collection !== "product_rows" && collection !== "memberRejections") {
      assert(entries.length === 0, `COMMERCIAL_REVIEW_COLLECTION_FORBIDDEN:${collection}`);
    }
  }
  assert(data.product_rows.length > 0 && data.memberRejections.length === 0,
    "COMMERCIAL_REVIEW_PRODUCTS_REQUIRED_OR_FORBIDDEN_REJECTIONS_PRESENT");

  const lotCodes = new Set();
  const naturalKeys = new Set();
  const excludedCommercialNames = new Set(["fortress 8", "lepto-bac 6", "valbazen 10 cobalto"]);
  for (const [index, product] of data.product_rows.entries()) {
    const pathLabel = `product_rows[${index}]`;
    assert(product.status_curatorial === "precisa_validar", `${pathLabel}:COMMERCIAL_REVIEW_STATUS_REQUIRED`);
    assert(product.registro_orgao == null && product.registro_numero == null, `${pathLabel}:OFFICIAL_REGISTRATION_MUST_REMAIN_NULL`);
    assert(product.principio_ativo == null && product.apresentacao == null, `${pathLabel}:UNVERIFIED_TECHNICAL_FIELDS_MUST_REMAIN_NULL`);
    const metadata = product.metadata;
    assert(metadata?.review_only === true && metadata.registration_current_validity === "unknown",
      `${pathLabel}:REGULATORY_REVIEW_METADATA_REQUIRED`);
    assert(metadata.approved_for_catalog === false && metadata.operational_authorization === false &&
      metadata.allows_agenda_auto === false && metadata.automatic_product_selection_authorized === false,
    `${pathLabel}:OPERATIONAL_FLAGS_MUST_REMAIN_DISABLED`);
    assert(typeof metadata.source_url === "string" && /^https?:\/\//.test(metadata.source_url),
      `${pathLabel}:RESEARCH_SOURCE_REQUIRED`);
    assert(typeof metadata.research_lot_code === "string" && !lotCodes.has(metadata.research_lot_code),
      `${pathLabel}:DUPLICATE_OR_MISSING_RESEARCH_LOT_CODE`);
    lotCodes.add(metadata.research_lot_code);
    const normalizedName = product.nome_comercial.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
    assert(!excludedCommercialNames.has(normalizedName), `${pathLabel}:HELD_PRODUCT_INCLUDED`);
    const naturalKey = [normalizedName, product.registro_orgao ?? "", product.registro_numero ?? ""].join("|");
    assert(!naturalKeys.has(naturalKey), `${pathLabel}:DUPLICATE_COMMERCIAL_NATURAL_KEY`);
    naturalKeys.add(naturalKey);
  }
  return data;
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
    return "PUBLISHER_INCOMPLETE: --apply bloqueado enquanto PUBLISHER_COMPLETE !== true.";
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

async function connectDb(mode, reviewOnly = false, incrementalProjectRef = null, { commercialProductsOnly = false } = {}) {
  if (commercialProductsOnly) {
    assert(mode === "apply" && process.env.DB_URL?.trim(), "COMMERCIAL_DB_URL_REQUIRED");
    assert(/^[a-z0-9]{20}$/.test(incrementalProjectRef ?? ""), "COMMERCIAL_PROJECT_REF_REQUIRED");
  }
  const env = readSupabaseStatusEnv();
  const target = describeDatabase(env.DB_URL);
  if (commercialProductsOnly) assert(!target.local, "COMMERCIAL_REMOTE_DATABASE_REQUIRED");
  if (incrementalProjectRef) {
    const url = new URL(env.DB_URL);
    assert(!url.search, "INCREMENTAL_DATABASE_OPTIONS_FORBIDDEN");
    if (!target.local) assert(url.hostname === `db.${incrementalProjectRef}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${incrementalProjectRef}`),
    "INCREMENTAL_PROJECT_TARGET_MISMATCH");
  }
  // pg connection-string query options can override the URL hostname.
  if (reviewOnly) assert(target.local && !new URL(env.DB_URL).search, "REVIEW_CANDIDATE_REQUIRES_LOCAL_DATABASE");
  if (mode === "apply") assertApplyAuthorized(env.DB_URL);
  const config = { connectionString: env.DB_URL };
  if (!target.local) {
    const url = new URL(env.DB_URL);
    // pg parses URL options after config and can replace both the host and SSL.
    assert(!url.search && !url.hash, "REMOTE_DATABASE_OPTIONS_FORBIDDEN");
    assert(url.username && url.password, "REMOTE_DATABASE_CREDENTIALS_REQUIRED");
    // Use Node's trusted CA roots (including NODE_EXTRA_CA_CERTS when configured).
    // Explicit options override PGSSLMODE; verify the direct/pooler hostname too.
    config.ssl = { rejectUnauthorized: true, servername: target.host, checkServerIdentity };
  }
  const client = new Client(config);
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => {});
    if (!target.local) fail("REMOTE_DATABASE_CONNECTION_FAILED");
    throw error;
  }
  // The client-facing socket is the TLS evidence, including with Session Pooler.
  // pg_stat_ssl behind a pooler describes a different connection.
  if (!target.local && !(client.connection?.stream?.encrypted === true && client.connection.stream.authorized === true)) {
    await client.end().catch(() => {});
    fail("REMOTE_DATABASE_TLS_NOT_VERIFIED");
  }
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

export function itemInsertRow(item, protocolId, groupId, productId = null) {
  assert(item.product_requirement_kind !== "specific_product" || productId, "specific_product_requires_explicit_product");
  return {
    id: item.id, protocol_id: protocolId, logical_item_key: item.logical_item_key, version: item.version,
    item_status: item.item_status, action_type: item.action_type, product_requirement_kind: item.product_requirement_kind,
    product_id: item.product_requirement_kind === "specific_product" ? productId : null,
    product_class: item.product_requirement_kind === "product_class" ? item.class_key : null,
    product_class_group_id: item.product_requirement_kind === "product_class_group" ? groupId : null,
    eligibility_rule: item.eligibility_rule, operational_window_rule: item.operational_window_rule,
    dose_rule: item.dose_rule ?? null, route_rule: item.route_rule ?? null, booster_rule: item.booster_rule ?? null,
    species_authorization: item.species_authorization, source_refs_by_field: item.source_refs_by_field,
    limitations: item.limitations ?? [],
    snapshot_template: {
      ...(item.snapshot_template ?? {}),
      metadata: { ...(item.snapshot_template?.metadata ?? {}), agenda_allowed: false, approved_for_catalog: false },
    },
    allows_agenda_auto: false, requires_mv_responsavel: item.requires_mv_responsavel ?? false, status: "draft",
  };
}

function productInsertRow(r) {
  return {
    id: r.id, nome_comercial: r.nome_comercial, fabricante: r.fabricante ?? null,
    registro_orgao: r.registro_orgao ?? null, registro_numero: r.registro_numero ?? null,
    classe: r.classe, principio_ativo: r.principio_ativo ?? null, tipo_produto: r.tipo_produto,
    apresentacao: r.apresentacao ?? null, status_curatorial: r.status_curatorial, metadata: r.metadata ?? {},
  };
}

function productReference(r, parents) {
  const product = resolveParent(parents, "product_rows", r.product_key);
  assert(r.product_id == null || r.product_id === product.id, "product_reference_uuid_mismatch");
  return product.id;
}

function sourceReference(r, parents) {
  const source = resolveParent(parents, "source_rows", r.source_key);
  assert(r.source_id == null || r.source_id === source.id, "source_reference_uuid_mismatch");
  // Sources may be global or farm scoped, as permitted by the link-table RLS.
  assertScope(source, "source_rows");
  return source.id;
}

function technicalUpdateBlockReason(existing) {
  return existing.status_curatorial === "precisa_validar" ? null : "technical_row_already_curated";
}

function defaultRuleInsertRow(r, parents) {
  const cls = resolveParent(parents, "product_class_rows", r.class_key);
  assert(!classUpdateBlockReason(cls), "default_rule_protected_class");
  assert(r.class_id == null || r.class_id === cls.id, "class_reference_uuid_mismatch");
  assert(r.scope == null || r.scope === cls.scope, "default_rule_scope_mismatch");
  assert(r.fazenda_id === undefined || r.fazenda_id === (cls.fazenda_id ?? null), "default_rule_fazenda_mismatch");
  assert(r.can_validate_execution !== true && r.requires_executed_product_for_withdrawal !== false,
    "default_rule_execution_invariant");
  return {
    id: r.id, class_id: cls.id, scope: cls.scope, fazenda_id: cls.fazenda_id ?? null,
    species_code: r.species_code, aptitude: r.aptitude ?? "all",
    dose_rule: r.dose_rule ?? null, route_rule: r.route_rule ?? null, withdrawal_rule: r.withdrawal_rule ?? null,
    execution_product_policy: r.execution_product_policy ?? "required_at_execution",
    can_validate_execution: false, requires_executed_product_for_withdrawal: true,
    source_refs: r.source_refs ?? [], limitations: r.limitations ?? [], metadata: r.metadata ?? {},
    curation_status: r.curation_status ?? "candidate",
  };
}

// Physical columns and identity expressions follow the active migrations. Symbols
// remain in CanonicalData. UUID-only rules deliberately have no natural lookup key.
const PUBLISHERS = [
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
    collection: "product_rows", table: "sanitario_produtos_v2",
    key: (r) => r.product_key, natural: ["nome_comercial", "registro_orgao", "registro_numero"],
    expressions: { nome_comercial: "lower(nome_comercial)", registro_orgao: "coalesce(registro_orgao, '')",
      registro_numero: "coalesce(registro_numero, '')" },
    normalize: (field, value) => field === "nome_comercial" ? value?.toLowerCase() : value ?? "",
    project: productInsertRow, json: ["metadata"], block: technicalUpdateBlockReason,
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
    collection: "product_authorization_rows", table: "sanitario_produto_especie_autorizacao_v2",
    key: (r) => r.id, natural: ["product_id", "species_code", "aptitude", "sexo"],
    expressions: { sexo: "coalesce(sexo, 'all')" },
    normalize: (field, value) => field === "sexo" ? value ?? "all" : value,
    project: (r, parents) => ({
      id: r.id, product_id: productReference(r, parents), species_code: r.species_code,
      aptitude: r.aptitude, sexo: r.sexo ?? null, authorization_status: r.authorization_status,
      idade_min_dias: r.idade_min_dias ?? null, idade_max_dias: r.idade_max_dias ?? null,
      lactacao_permitida: r.lactacao_permitida ?? null, gestacao_permitida: r.gestacao_permitida ?? null,
      requires_mv_responsavel: r.requires_mv_responsavel ?? false, limitations: r.limitations ?? [], metadata: r.metadata ?? {},
    }), json: ["limitations", "metadata"],
  },
  {
    collection: "product_source_rows", table: "sanitario_produto_fontes_v2", composite: true,
    key: (r) => `${r.product_key}:${r.source_key}:${r.field_key}`, natural: ["product_id", "source_id", "field_key"],
    project: (r, parents) => ({ product_id: productReference(r, parents), source_id: sourceReference(r, parents), field_key: r.field_key }),
  },
  {
    collection: "dose_rule_rows", table: "sanitario_produto_dose_rules_v2", key: (r) => r.id,
    natural: ["id"], immutable: ["product_id", "species_code", "aptitude", "route", "dose_basis"],
    project: (r, parents) => ({
      id: r.id, product_id: productReference(r, parents), species_code: r.species_code ?? null, aptitude: r.aptitude ?? null,
      route: r.route, dose_quantity: Number(r.dose_quantity), dose_unit: r.dose_unit, dose_basis: r.dose_basis,
      min_weight_kg: r.min_weight_kg == null ? null : Number(r.min_weight_kg),
      max_weight_kg: r.max_weight_kg == null ? null : Number(r.max_weight_kg),
      limitations: r.limitations ?? [], status_curatorial: r.status_curatorial ?? "precisa_validar",
    }), json: ["limitations"], numeric: ["dose_quantity", "min_weight_kg", "max_weight_kg"], block: technicalUpdateBlockReason,
  },
  {
    collection: "withdrawal_rule_rows", table: "sanitario_produto_carencia_rules_v2", key: (r) => r.withdrawal_rule_key,
    natural: ["id"], immutable: ["product_id", "species_code", "aptitude", "route", "dose_basis"],
    project: (r, parents) => ({
      id: r.id, product_id: productReference(r, parents), species_code: r.species_code, aptitude: r.aptitude,
      route: r.route ?? null, dose_basis: r.dose_basis ?? null, meat_days: r.meat_days ?? null,
      milk_days: r.milk_days ?? null, milk_hours: r.milk_hours ?? null, applicability: r.applicability,
      zero_requires_explicit_source: r.zero_requires_explicit_source ?? true,
      valid_from: r.valid_from ?? null, valid_until: r.valid_until ?? null,
      status_curatorial: r.status_curatorial ?? "precisa_validar", limitations: r.limitations ?? [], metadata: r.metadata ?? {},
    }), json: ["limitations", "metadata"], dates: ["valid_from", "valid_until"], block: technicalUpdateBlockReason,
  },
  {
    collection: "product_class_default_rule_rows", table: "sanitario_product_class_default_rules_v2",
    key: (r) => r.id, natural: ["scope", "fazenda_id", "class_id", "species_code", "aptitude"],
    project: defaultRuleInsertRow, json: ["dose_rule", "route_rule", "withdrawal_rule", "source_refs", "metadata"],
    block: (r) => ["candidate", "needs_review"].includes(r.curation_status) ? null : "default_rule_already_curated",
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
    collection: "withdrawal_source_rows", table: "sanitario_produto_carencia_fontes_v2", composite: true,
    key: (r) => `${r.withdrawal_rule_key}:${r.source_key}:${r.field_key}`, natural: ["withdrawal_rule_id", "source_id", "field_key"],
    project: (r, parents) => {
      const rule = resolveParent(parents, "withdrawal_rule_rows", r.withdrawal_rule_key);
      assert(r.withdrawal_rule_id == null || r.withdrawal_rule_id === rule.id, "withdrawal_reference_uuid_mismatch");
      return { withdrawal_rule_id: rule.id, source_id: sourceReference(r, parents), field_key: r.field_key };
    },
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
      const protocol = resolveParent(parents, "protocol_rows", r.protocol_key);
      const group = r.product_requirement_kind === "product_class_group"
        ? resolveParent(parents, "product_class_group_rows", r.group_key) : null;
      if (group) assertCompatibleScope(protocol, group, "item_group");
      if (r.product_requirement_kind === "product_class") {
        assertCompatibleScope(protocol, resolveParent(parents, "product_class_rows", r.class_key), "item_class");
      }
      const productId = r.product_requirement_kind === "specific_product" ? productReference(r, parents) : null;
      return itemInsertRow(r, protocol.id, group?.id ?? null, productId);
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
  const values = identityValues(publisher, row);
  const predicates = publisher.natural.map((column, index) =>
    `${publisher.expressions?.[column] ?? column} is not distinct from $${index + 1}`);
  if (!publisher.composite) values.push(row.id);
  // Include tombstones and the UUID even when it belongs to a different natural key.
  return (await client.query(
    `select * from public.${publisher.table}
     where (${predicates.join(" and ")})${publisher.composite ? "" : ` or id = $${values.length}`}
     order by ${publisher.composite ? publisher.natural.join(", ") : "id"}${lockRows ? " for update" : ""}`, values,
  )).rows;
}

function identityValues(publisher, row) {
  return publisher.natural.map((column) => publisher.normalize
    ? publisher.normalize(column, row[column] ?? null) : row[column] ?? null);
}

function identityReason(publisher, row, existingRows) {
  if (existingRows.length > 1) return "IDENTITY_AMBIGUOUS";
  const existing = existingRows[0];
  if (!existing) return null;
  if (!publisher.composite && existing.id !== row.id) return "IDENTITY_CONFLICT";
  if (isDifferent(identityValues(publisher, existing), identityValues(publisher, row)) ||
      publisher.immutable?.some((field) => isDifferent(existing[field] ?? null, row[field] ?? null))) {
    return "CANONICAL_UUID_OTHER_IDENTITY";
  }
  if (existing.deleted_at) return "TOMBSTONE_IDENTITY_RESERVED";
  if (!publisher.composite) assertStableIdentity(existing, row, publisher.key(row));
  return null;
}

function compareRow(publisher, existing, row) {
  return Object.entries(row).some(([field, value]) => {
    let actual = existing[field] ?? null;
    if (publisher.expressions?.[field]) {
      return isDifferent(publisher.normalize(field, actual), publisher.normalize(field, value));
    }
    if (publisher.numeric?.includes(field) && actual !== null) actual = Number(actual);
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
  // Explicitly superseded physical versions are retired only when still draft.
  // Never reuse their UUIDs, rewrite snapshots, or retire an approved active item.
  for (const item of data.protocol_item_rows) {
    const supersedes = item.snapshot_template?.metadata?.supersedes;
    if (!supersedes) continue;
    assert(UUID_LIKE.test(supersedes.id ?? "") && supersedes.id !== item.id,
      "invalid_superseded_item_identity");
    assert(Number.isInteger(supersedes.version) && supersedes.version < item.version,
      "invalid_superseded_item_version");
    const existing = await client.query(
      `select * from public.sanitario_protocolo_itens_versions_v2
       where id is not distinct from $1${lockRows ? " for update" : ""}`, [supersedes.id],
    );
    for (const row of existing.rows) {
      assert(row.protocol_id === item.protocol_id && row.logical_item_key === item.logical_item_key &&
        Number(row.version) === supersedes.version, "superseded_item_identity_conflict");
      if (!row.deleted_at) result.push({
        ...row, familyCode: item.protocol_key,
        replacementKeys: [`${item.logical_item_key}:v${item.version}`],
      });
    }
  }
  return result;
}

export async function buildPlan(client, data, { lockRows = false, incremental = null } = {}) {
  const supported = new Set(PUBLISHERS.map((p) => p.collection));
  for (const [collection, entries] of Object.entries(data)) {
    assert(collection === "memberRejections" || supported.has(collection) || entries.length === 0,
      `UNSUPPORTED_NONEMPTY_COLLECTION:${collection}`);
  }
  const operations = [];
  const parents = new Map();
  const allIds = new Map();
  for (const publisher of PUBLISHERS.filter((p) => !p.composite)) {
    for (const canonical of data[publisher.collection] ?? []) {
      allIds.set(canonical.id, (allIds.get(canonical.id) ?? 0) + 1);
    }
  }
  for (const publisher of PUBLISHERS) {
    const entries = data[publisher.collection] ?? [];
    const projectedKeys = new Map();
    const symbolicKeys = new Map();
    const resolved = new Map();
    parents.set(publisher.collection, resolved);
    for (const canonical of sortedBy(entries, "id")) {
      const key = publisher.key(canonical);
      let row = null;
      let reason = "";
      let existing = null;
      let action = "reject";
      try {
        if (!publisher.composite) {
          assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonical.id), "EXPLICIT_UUID_REQUIRED");
          assert(allIds.get(canonical.id) === 1, "DUPLICATE_CANONICAL_UUID");
        }
        assert(typeof key === "string" && key.length > 0, "CANONICAL_SYMBOL_REQUIRED");
        if (!symbolicKeys.has(key)) symbolicKeys.set(key, []);
        symbolicKeys.get(key).push(operations.length);
        assert(!canonical.deleted_at, "CANONICAL_TOMBSTONE_NOT_PUBLISHABLE");
        row = publisher.project(canonical, parents);
        assertScope(row, publisher.collection);
        const naturalKey = stableStringify(identityValues(publisher, row));
        if (!projectedKeys.has(naturalKey)) projectedKeys.set(naturalKey, []);
        projectedKeys.get(naturalKey).push(operations.length);
        const found = await selectIdentity(client, publisher, row, lockRows);
        existing = found[0] ?? null;
        reason = identityReason(publisher, row, found) ?? "";
        if (!reason) {
          const newClosureSource = incremental?.delta_kind === "closure_eligible_20261022" && publisher.collection === "source_rows" &&
            !incremental.baseline.source_rows.some(s => s.id === canonical.id);
          if (incremental && !newClosureSource && ["source_rows", "product_rows", "protocol_rows"].includes(publisher.collection)) {
            assert(existing, "INCREMENTAL_REFERENCE_MISSING");
            row = existing;
            action = "skip";
          } else {
          const changed = existing && compareRow(publisher, existing, row);
          reason = changed ? (publisher.block?.(existing) ?? "") : "";
          if (incremental && changed && publisher.collection !== "product_class_rows") {
            if (publisher.collection === "protocol_item_rows" && await reviewedDeltaReplay(client, publisher, existing, row)) {
              reason = "";
              action = "skip";
            } else reason = "INCREMENTAL_EXISTING_CONTENT_CONFLICT";
          }
          if (action !== "skip")
          action = reason ? "reject" : existing ? (changed ? "update" : "skip") : "create";
          }
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
    for (const positions of symbolicKeys.values()) {
      if (positions.length <= 1) continue;
      for (const position of positions) {
        if (operations[position].reason === "DUPLICATE_CANONICAL_NATURAL_KEY") continue;
        Object.assign(operations[position], {
          action: "reject", reason: "DUPLICATE_CANONICAL_SYMBOL", classification: "UNEXPECTED_CONFLICT",
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
  if (incremental) await assertIncrementalBaseline(client, incremental, operations, lockRows);
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
  const publisher = PUBLISHERS.find((p) => p.collection === operation.collection);
  assert(publisher && operation.row, "UNSUPPORTED_WRITE_OPERATION");
  const columns = Object.keys(operation.row);
  const values = columns.map((field) => publisher.json?.includes(field) && operation.row[field] !== null
    ? asJsonb(operation.row[field]) : operation.row[field]);
  let result;
  if (operation.action === "create") {
    result = await client.query(
      `insert into public.${publisher.table} (${columns.join(", ")})
       values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning ${publisher.composite ? publisher.natural.join(", ") : "id"}`, values,
    );
  } else {
    assert(operation.action === "update", "UNEXPECTED_WRITE_ACTION");
    // Read FOR UPDATE after the advisory lock. Natural identity columns are immutable.
    assert(!publisher.composite, "COMPOSITE_LINK_HAS_NO_MUTABLE_COLUMNS");
    const mutable = columns.filter((field) => field !== "id" && !publisher.natural.includes(field) && !publisher.immutable?.includes(field));
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
async function applyTransaction(client, data, { incremental = null, bootstrap = null, commercialProductsOnly = false } = {}) {
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '60s'");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [IMPORT_LOCK_KEY]);
    if (bootstrap) {
      const replay = await bootstrapReplay(client, bootstrap);
      if (replay) {
        await captureIncrementalProtectedState(client, incremental);
        await client.query("commit");
        return { bootstrap: replay, replay: true };
      }
    }
    if (incremental) {
      // Same order as curatorial decisions: protocols/items before technical evidence.
      await client.query("select id from public.sanitario_protocolos_v2 where id=any($1::uuid[]) order by id for update",
        [[...new Set([...data.protocol_rows.map(p => p.id), ...(bootstrap?.groups.map(g => g.protocol_id) ?? [])])]]);
      await client.query("select id from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[]) order by id for update",
        [[...new Set([...data.protocol_item_rows.map(i => i.id), ...incremental.baseline.predecessors.map(i => i.id),
          ...(bootstrap?.groups.flatMap(g => g.item_versions.map(i => i.id)) ?? [])])]]);
    }
    const preserved = incremental ? await captureIncrementalProtectedState(client, incremental) : null;
    const plan = await buildPlan(client, data, { lockRows: true, incremental });
    assertPublishablePlan(plan);
    if (commercialProductsOnly) {
      const updates = plan.filter((operation) => operation.collection === "product_rows" && operation.action === "update");
      assert(updates.length === 0,
        `PRODUCTS_APPLY_UPDATE_FORBIDDEN: ${stableStringify(updates.map(({ key, reason }) => ({ key, reason })))}`);
    }
    for (const operation of plan) await writeOperation(client, operation);
    assertConvergedPlan(await buildPlan(client, data, { lockRows: true, incremental }));
    const receipt = bootstrap ? await bootstrapInitialCatalog(client, bootstrap, incremental.import_gate.authorization_reference) : null;
    if (incremental) assert(!isDifferent(preserved, await captureIncrementalProtectedState(client, incremental)), "INCREMENTAL_PROTECTED_STATE_CHANGED");
    await client.query("commit");
    return { ...summarize(plan), ...(receipt ? { bootstrap: receipt } : {}) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

// Deployment bootstrap, not an interactive curatorial decision. Only the gated DB-owner
// publisher reaches this function. It has no public RPC, session spoof or new grants.
async function bootstrapCatalogState(client, plan) {
  const groups = [];
  for (const group of plan.groups) groups.push((await client.query(
    "select public.internal_sanitario_review_content_v2($1,$2) as content",
    [group.protocol_id, group.item_versions.map(i => i.id)])).rows[0].content);
  return groups;
}

async function bootstrapReplay(client, plan) {
  const audit = (await client.query("select * from public.app_admin_audit_events where id=$1", [plan.request_id])).rows[0];
  if (!audit) return null;
  assert(audit.action === "SANITARY_CATALOG_BOOTSTRAP_V2" && !isDifferent(audit.metadata.plan, plan), "BOOTSTRAP_REQUEST_CONFLICT");
  assert(!isDifferent(await bootstrapCatalogState(client, plan), audit.state_after.catalog_after), "BOOTSTRAP_REPLAY_CONTENT_CONFLICT");
  return audit.state_after;
}

async function bootstrapInitialCatalog(client, plan, authorizationReference) {
  const executor = (await client.query("select current_user as role, session_user as session_role")).rows[0];
  assert(["postgres", "supabase_admin"].includes(executor.role), "BOOTSTRAP_DATABASE_OWNER_REQUIRED");
  const admins = (await client.query("select user_id from public.app_superadmins order by user_id for share")).rows;
  assert(admins.length === 1, "BOOTSTRAP_SINGLE_ADMIN_REQUIRED");
  const principal = admins[0].user_id;
  assert(!(await client.query("select id from public.app_admin_audit_events where action='SANITARY_CATALOG_BOOTSTRAP_V2'")).rows.length,
    "INITIAL_BOOTSTRAP_ALREADY_EXISTS");
  const families = (await client.query("select family_code,status,approval_status from public.sanitario_protocolos_v2 where deleted_at is null and scope='global'")).rows;
  const preservedFamilies = ["brucelose_b19", "controle_parasitario_recria_5_7_9", "vermifugacao_pre_desmama", "vermifugacao_pre_confinamento_pasto_vedado", "matrizes_pre_parto"];
  assert(preservedFamilies.every(f => families.some(p => p.family_code === f && p.status === "active" && p.approval_status === "approved")) &&
    families.some(p => p.family_code === "febre_aftosa" && p.status === "retired"), "BOOTSTRAP_INITIAL_BASELINE_REQUIRED");
  await client.query("select id from public.sanitario_protocolos_v2 where id=any($1::uuid[]) order by id for update", [plan.groups.map(g => g.protocol_id)]);
  await client.query("select id from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[]) order by id for update", [plan.groups.flatMap(g => g.item_versions.map(i => i.id))]);
  let contents = await bootstrapCatalogState(client, plan);
  for (const [table, field] of [["sanitario_fontes_tecnicas_v2", "sources"], ["sanitario_fonte_cobertura_campos_v2", "coverage"],
    ["sanitario_produtos_v2", "products"], ["sanitario_product_classes_v2", "classes"]]) {
    await client.query(`select id from public.${table} where id=any($1::uuid[]) order by id for share`,
      [[...new Set(contents.flatMap(c => c[field].map(r => r.id)))]]);
  }
  contents = await bootstrapCatalogState(client, plan);
  const at = (await client.query("select transaction_timestamp() as at")).rows[0].at.toISOString();
  const reference = `sanitary-bootstrap-v2:${plan.request_id}`;
  const groups = [];
  for (let n = 0; n < plan.groups.length; n++) {
    const group = plan.groups[n], content = contents[n];
    assert(content.protocol.scope === "global" && !content.protocol.fazenda_id && content.protocol.family_code === group.family &&
      content.protocol.version === group.expected_version && content.protocol.status === "draft" && content.protocol.approval_status === "draft", "BOOTSTRAP_PROTOCOL_CAS_CONFLICT");
    assert(!isDifferent(content.items.map(i => ({ id: i.id, version: i.version, logical_item_key: i.logical_item_key })).sort((a,b) => a.id.localeCompare(b.id)), group.item_versions), "BOOTSTRAP_ITEM_CAS_CONFLICT");
    const digest = (await client.query("select encode(extensions.digest($1::jsonb::text,'sha256'),'hex') as digest", [JSON.stringify(content)])).rows[0].digest;
    assert(!group.expected_content_digest || group.expected_content_digest === digest, "BOOTSTRAP_CONTENT_DIGEST_CONFLICT");
    const mappings = (await client.query("select public.internal_sanitario_review_fields_v2($1,$2,$3,$4) as fields", [content, principal, at, reference])).rows[0].fields;
    for (const item of content.items) {
      const auto = item.snapshot_template.metadata.catalog_review_scope !== "manual_planning";
      const refs = mappings[item.id];
      for (const [field, entries] of Object.entries(refs)) for (const ref of entries) {
        // Do not claim that a person reviewed this field. Preserve technical coverage
        // and record the administrative deployment provenance under its own name.
        delete ref.metadata?.catalogFieldReview;
        ref.metadata = { ...ref.metadata, catalogBootstrap: { version: plan.version, reference, executedAt: at,
          administratorPrincipalId: principal, protocolId: group.protocol_id, itemId: item.id, itemVersion: item.version, field } };
      }
      const metadata = { ...item.snapshot_template.metadata, proposal_only: false, agenda_allowed: auto, approved_for_catalog: true,
        curationStatus: "approved_for_catalog", automationStatus: auto ? "agenda_allowed" : "manual_only",
        approval_basis: "administrative_initial_bootstrap", catalog_bootstrap_reference: reference,
        catalog_bootstrap_version: plan.version, bootstrap_content_digest: digest };
      const result = await client.query(`update public.sanitario_protocolo_itens_versions_v2 set status='active',allows_agenda_auto=$2,
        source_refs_by_field=$3,snapshot_template=jsonb_set(snapshot_template,'{metadata}',$4::jsonb)
        where id=$1 and version=$5 and status='draft' and deleted_at is null`, [item.id, auto, JSON.stringify(refs), JSON.stringify(metadata), item.version]);
      assert(result.rowCount === 1, "BOOTSTRAP_ITEM_CAS_CONFLICT");
    }
    const auto = content.items.some(i => i.snapshot_template.metadata.catalog_review_scope !== "manual_planning");
    await client.query(`update public.sanitario_protocolos_v2 set status='active',approval_status='approved',approved_by=null,approved_at=$2,
      metadata=metadata||$3::jsonb where id=$1`, [group.protocol_id, at, JSON.stringify({ agenda_allowed: auto, approved_for_catalog: true,
      curationStatus: "approved_for_catalog", automationStatus: auto ? "agenda_allowed" : "manual_only",
      approval_basis: "administrative_initial_bootstrap", catalog_bootstrap_reference: reference, catalog_bootstrap_version: plan.version })]);
    groups.push({ family: group.family, protocol_id: group.protocol_id, content_digest: digest, item_versions: group.item_versions });
  }
  const receipt = { bootstrap_reference: reference, bootstrap_version: plan.version, executed_at: at, interactive_review: false,
    administrator_principal_id: principal, database_executor: executor, groups, catalog_after: await bootstrapCatalogState(client, plan) };
  await client.query(`insert into public.app_admin_audit_events(id,actor_user_id,action,target_type,target_id,state_before,state_after,metadata)
    values($1,$2,'SANITARY_CATALOG_BOOTSTRAP_V2','sanitario_global_catalog',$3,$4,$5,$6)`,
  [plan.request_id, principal, plan.version, JSON.stringify({ groups: contents }), JSON.stringify(receipt),
    JSON.stringify({ plan, authorization_reference: authorizationReference, source: "versioned_initial_deployment",
      actor_semantics: "sole_administrator_onboarding_principal", interactive_review: false })]);
  return receipt;
}

function validateIncrementalPayload(payload) {
  assert(payload.artifact === "sanitario_protocols_v2_incremental_delta" && payload.execute_import === false && payload.approved === false,
    "INCREMENTAL_ARTIFACT_REQUIRED");
  assert(payload.content_sha256 === classDeltaDigest(payload), "INCREMENTAL_DIGEST_MISMATCH");
  for (const input of Object.values(payload.inputs ?? {})) {
    assert(typeof input.path === "string" && createHash("sha256").update(readFileSync(input.path)).digest("hex") === input.sha256,
      "INCREMENTAL_INPUT_CHANGED");
  }
  const inputJson = key => JSON.parse(readFileSync(payload.inputs[key].path, "utf8"));
  if (payload.delta_kind === CLOSURE_DELTA_KIND) {
    const prepared = prepareClosureDelta(inputJson("baseline").catalog, inputJson("candidates"), inputJson("preservation"), payload.inputs);
    assert(prepared.content_sha256 === payload.content_sha256 && prepared.project_ref === payload.project_ref, "INCREMENTAL_PREPARATION_MISMATCH");
    return validateCanonicalTechnicalContract(payload).data;
  }
  assert(payload.delta_kind === undefined, "INCREMENTAL_UNKNOWN_DELTA_KIND");
  const prepared = prepareClassDelta(inputJson("canonical"), inputJson("previews"), inputJson("baseline"), inputJson("technical"), payload.inputs);
  assert(prepared.content_sha256 === payload.content_sha256, "INCREMENTAL_PREPARATION_MISMATCH");
  assert(payload.project_ref === prepared.project_ref, "INCREMENTAL_PROJECT_SCOPE_MISMATCH");
  const data = validateCanonicalTechnicalContract(payload).data;
  const expected = { source_rows: 2, product_rows: 2, protocol_rows: 2, product_class_rows: 2,
    protocol_item_rows: 5, coverage_rows: 8, product_source_rows: 2 };
  for (const p of PUBLISHERS) assert(data[p.collection].length === (expected[p.collection] ?? 0), `INCREMENTAL_SCOPE:${p.collection}`);
  assert(!data.memberRejections?.length, "INCREMENTAL_REJECTIONS_FORBIDDEN");
  const keys = ["clostridial_primovac_dose1", "clostridial_primovac_dose2", "clostridial_reforco_anual",
    "lepto_primovac_dose1", "lepto_reforco_anual_semestral"];
  assert(!isDifferent(data.protocol_item_rows.map(i => i.logical_item_key).sort(), keys.sort()), "INCREMENTAL_EXACT_FIVE_REQUIRED");
  assert(!isDifferent(data.source_rows.map(s => s.source_key).sort(), ["SRC_BULA_FORTRESS7", "SRC_BULA_LEPTOFERM5"]), "INCREMENTAL_SOURCE_SCOPE");
  assert(!isDifferent(data.product_class_rows.map(c => c.class_key).sort(), ["vacina_clostridial", "vacina_leptospirose"]), "INCREMENTAL_CLASS_SCOPE");
  for (const i of data.protocol_item_rows) {
    assert(i.status === "draft" && i.allows_agenda_auto === false && i.action_type === "vacinacao" &&
      i.product_requirement_kind === "product_class" && !i.product_id && !i.product_key && !i.dose_rule && !i.route_rule &&
      i.snapshot_template?.metadata?.planning_scope === "class_scheme" && i.snapshot_template.metadata.proposal_only === true,
    "INCREMENTAL_DRAFT_CLASS_REQUIRED");
    for (const flag of ["agenda_allowed", "approved_for_catalog"]) assert(i.snapshot_template.metadata[flag] === false, "INCREMENTAL_PREAPPROVAL_FORBIDDEN");
    const prior = payload.baseline.predecessors.find(p => p.id === i.snapshot_template.metadata.supersedes?.id);
    assert(prior && prior.protocol_id === i.protocol_id && prior.logical_item_key === i.logical_item_key &&
      prior.version + 1 === i.version && prior.status === "draft" && !prior.allows_agenda_auto, "INCREMENTAL_PREDECESSOR_REQUIRED");
  }
  for (const c of data.product_class_rows) {
    const before = payload.baseline.product_class_rows.find(r => r.id === c.id);
    assert(before && before.curation_status === "needs_review" && c.curation_status === "approved_for_catalog" &&
      c.automation_status === "manual_only" && c.metadata.can_validate_execution === false &&
      !isDifferent(classInsertRow(before), classInsertRow({ ...c, curation_status: before.curation_status })), "INCREMENTAL_CLASS_REVIEW_SCOPE");
  }
  assert(payload.protected.approved_item_ids.length === 7 && payload.protected.r05_agenda_ids.length === 7, "INCREMENTAL_PRESERVATION_SCOPE");
  return data;
}

async function reviewedDeltaReplay(client, publisher, existing, row) {
  const auto = row.snapshot_template?.metadata?.catalog_review_scope !== "manual_planning";
  if (existing.status !== "active" || existing.allows_agenda_auto !== auto) return false;
  const meta = existing.snapshot_template?.metadata ?? {};
  const bootstrapId = /^sanitary-bootstrap-v2:([a-f0-9-]{36})$/.exec(meta.catalog_bootstrap_reference ?? "")?.[1];
  if (bootstrapId) {
    const audit = (await client.query("select * from public.app_admin_audit_events where id=$1 and action='SANITARY_CATALOG_BOOTSTRAP_V2'", [bootstrapId])).rows[0];
    const before = audit?.state_before?.groups?.flatMap(g => g.items).find(i => i.id === row.id);
    const after = audit?.state_after?.catalog_after?.flatMap(g => g.items).find(i => i.id === row.id);
    const expected = after && Object.fromEntries(Object.keys(row).map(k => [k, after[k]]));
    return Boolean(before && expected && !compareRow(publisher, before, row) && !compareRow(publisher, existing, expected));
  }
  const id = /^sanitary-v2:([a-f0-9-]{36})$/.exec(meta.catalog_decision_reference ?? "")?.[1];
  if (!id) return false;
  const audit = (await client.query("select * from public.app_admin_audit_events where id=$1 and action='SANITARY_RULE_DECISION_V2'", [id])).rows[0];
  const before = audit?.state_before?.items?.find(i => i.id === row.id);
  const receipt = audit?.state_after;
  if (!before || compareRow(publisher, before, row) || receipt?.result !== "approved" || receipt.actor_id !== audit.actor_user_id ||
    receipt.reviewed_content_digest !== meta.reviewed_content_digest) return false;
  const expected = structuredClone(row);
  expected.status = "active"; expected.allows_agenda_auto = auto;
  expected.snapshot_template.metadata = { ...row.snapshot_template.metadata, proposal_only: false, agenda_allowed: auto,
    approved_for_catalog: true, curationStatus: "approved_for_catalog", automationStatus: auto ? "agenda_allowed" : "manual_only",
    catalog_decision_reference: meta.catalog_decision_reference, reviewed_content_digest: meta.reviewed_content_digest };
  expected.source_refs_by_field = Object.fromEntries(Object.entries(row.source_refs_by_field).map(([field, refs]) => [field, refs.map(r => ({
    source_ref: r.source_ref, id: r.id, kind: r.kind, scope: "global", title: r.title, strength: r.strength,
    evidenceStatus: r.evidenceStatus, fieldKeys: [field], metadata: { coverage_ids: r.metadata.coverage_ids,
      catalogFieldReview: { actorId: receipt.actor_id, approvedAt: receipt.decided_at, decisionReference: meta.catalog_decision_reference,
        protocolId: row.protocol_id, itemId: row.id, itemVersion: row.version, field, scope: "class_scheme" } },
  }))]));
  return !compareRow(publisher, existing, expected);
}

async function assertIncrementalBaseline(client, packet, operations, lockRows) {
  const noWrites = operations.every(o => o.action === "skip");
  for (const collection of ["source_rows", "product_rows", "protocol_rows", "product_class_rows"]) {
    const publisher = PUBLISHERS.find(p => p.collection === collection);
    for (const before of packet.baseline[collection]) {
      const op = operations.find(o => o.collection === collection && o.canonical_id === before.id);
      assert(op?.existing && !op.existing.deleted_at, `INCREMENTAL_BASELINE_MISSING:${collection}`);
      const expected = publisher.project(before, new Map());
      if (collection === "product_class_rows" && !compareRow(publisher, op.existing, op.row)) continue;
      if (noWrites && collection === "protocol_rows" && op.existing.status === "active" &&
        op.existing.approval_status === "approved" && operations.some(o => o.collection === "protocol_item_rows" && o.existing?.protocol_id === before.id && o.existing.status === "active")) {
        const auto = operations.some(o => o.collection === "protocol_item_rows" && o.existing?.protocol_id === before.id && o.existing.allows_agenda_auto);
        expected.status = "active"; expected.approval_status = "approved";
        expected.metadata = { ...expected.metadata, agenda_allowed: auto, approved_for_catalog: true,
          curationStatus: "approved_for_catalog", automationStatus: auto ? "agenda_allowed" : "manual_only" };
        const reference = op.existing.metadata?.catalog_bootstrap_reference;
        if (reference) {
          const audit = (await client.query("select state_after from public.app_admin_audit_events where id=$1 and action='SANITARY_CATALOG_BOOTSTRAP_V2'", [reference.replace("sanitary-bootstrap-v2:", "")])).rows[0];
          const after = audit?.state_after?.catalog_after?.find(g => g.protocol.id === before.id)?.protocol;
          assert(after && !compareRow(publisher, op.existing, Object.fromEntries(Object.keys(expected).map(k => [k, after[k]]))), "BOOTSTRAP_PROTOCOL_REPLAY_CONFLICT");
          expected.metadata = after.metadata;
        }
      }
      assert(!compareRow(publisher, op.existing, expected), `INCREMENTAL_BASELINE_CONFLICT:${collection}:${before.id}`);
    }
  }
  // New logical variants must start at v1 without an independently published competing identity.
  for (const next of packet.payload.protocol_item_rows.filter(i => !i.snapshot_template.metadata.supersedes)) {
    assert(packet.delta_kind === "closure_eligible_20261022" && next.version === 1, "INCREMENTAL_PREDECESSOR_REQUIRED");
    const competing = (await client.query("select id from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and logical_item_key=$2 and id<>$3", [next.protocol_id, next.logical_item_key, next.id])).rows;
    assert(!competing.length, "INCREMENTAL_NEW_LOGICAL_KEY_CONFLICT");
  }
  for (const before of packet.baseline.predecessors) {
    const actual = (await client.query(`select to_jsonb(t) as row from public.sanitario_protocolo_itens_versions_v2 t where id=$1${lockRows ? " for update" : ""}`, [before.id])).rows[0]?.row;
    assert(actual, "INCREMENTAL_PREDECESSOR_MISSING");
    const expected = { ...before };
    if (actual.status === "retired" && actual.deleted_at && !actual.allows_agenda_auto) {
      expected.status = "retired"; expected.deleted_at = actual.deleted_at;
    }
    for (const key of ["created_at", "updated_at"]) { delete actual[key]; delete expected[key]; }
    assert(!isDifferent(actual, expected), "INCREMENTAL_PREDECESSOR_CONFLICT");
    const next = packet.payload.protocol_item_rows.find(i => i.logical_item_key === before.logical_item_key);
    const newer = (await client.query("select id from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and logical_item_key=$2 and version>$3 and deleted_at is null", [before.protocol_id, before.logical_item_key, next.version])).rows;
    assert(!newer.length, "INCREMENTAL_NEWER_VERSION_CONFLICT");
  }
}

async function captureIncrementalProtectedState(client, packet) {
  const items = (await client.query("select to_jsonb(t) as row from public.sanitario_protocolo_itens_versions_v2 t where id=any($1::uuid[]) order by id", [packet.protected.approved_item_ids])).rows;
  const agendas = (await client.query("select to_jsonb(t) as row from public.sanitario_agenda_v2 t where id=any($1::uuid[]) and fazenda_id=$2 order by id", [packet.protected.r05_agenda_ids, packet.protected.r05_farm_id])).rows;
  assert(items.length === 7 && items.every(i => i.row.status === "active" && i.row.allows_agenda_auto) && agendas.length === 7, "INCREMENTAL_PROTECTED_BASELINE_REQUIRED");
  const gates = (await client.query("select to_jsonb(t) as row from public.sanitario_sync_v2_gates t order by fazenda_id")).rows;
  assert(gates.every(g => !g.row.enabled), "INCREMENTAL_REQUIRES_GATES_OFF");
  return { items, agendas, gates };
}

async function incrementalMain(args) {
  const index = args.indexOf("--incremental"), file = args[index + 1];
  assert(file && !file.startsWith("--"), usage());
  const bootstrapIndex = args.indexOf("--bootstrap-initial"), bootstrapFile = bootstrapIndex >= 0 ? args[bootstrapIndex + 1] : null;
  assert(bootstrapIndex < 0 || bootstrapFile && !bootstrapFile.startsWith("--"), "BOOTSTRAP_PLAN_REQUIRED");
  const mode = parseMode(args.filter((_, n) => n !== index && n !== index + 1 && (bootstrapIndex < 0 || n !== bootstrapIndex && n !== bootstrapIndex + 1)));
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const data = validateIncrementalPayload(payload);
  const bootstrap = bootstrapFile ? JSON.parse(readFileSync(bootstrapFile, "utf8")) : null;
  if (bootstrap) assert(!isDifferent(bootstrap, prepareClosureBootstrap(payload,
    JSON.parse(readFileSync(payload.inputs.baseline.path, "utf8")).catalog, bootstrap.request_id)), "BOOTSTRAP_PLAN_CHANGED");
  if (mode === "validate") {
    console.log(JSON.stringify({ incremental: true, content_sha256: payload.content_sha256,
      protocol_items: data.protocol_item_rows.length, coverage: data.coverage_rows.length, classes: data.product_class_rows.length,
      product_links: data.product_source_rows.length, bootstrap: bootstrap?.version ?? null, approved: false }));
    return;
  }
  if (mode === "apply") {
    assertApplyGate(payload);
    assert(process.env.SANITARIO_DELTA_CONFIRM === payload.content_sha256 &&
      typeof payload.import_gate.authorization_reference === "string" && payload.import_gate.authorization_reference.trim().length >= 10,
    "INCREMENTAL_EXPLICIT_AUTHORIZATION_REQUIRED");
  }
  const { client, target } = await connectDb(mode, false, payload.project_ref);
  try {
    await captureIncrementalProtectedState(client, payload);
    const plan = await buildPlan(client, data, { incremental: payload });
    assertPublishablePlan(plan);
    console.log(`database host=${target.host} port=${target.port} database=${target.database} local=${target.local}`);
    console.log(JSON.stringify({ content_sha256: payload.content_sha256, authorization_reference: payload.import_gate.authorization_reference }));
    printPlan(`incremental-${mode}`, plan);
    if (mode === "apply") console.log(JSON.stringify(await applyTransaction(client, data, { incremental: payload, bootstrap })));
  } finally { await client.end(); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--incremental")) return incrementalMain(args);
  const reviewIndex = args.indexOf("--review-candidate");
  const reviewPath = reviewIndex >= 0 ? args[reviewIndex + 1] : null;
  if (reviewIndex >= 0) assert(reviewPath && !reviewPath.startsWith("--"), usage());
  const mode = parseMode(reviewIndex >= 0 ? args.filter((_, index) => index !== reviewIndex && index !== reviewIndex + 1) : args);
  const payload = reviewPath ? JSON.parse(readFileSync(reviewPath, "utf8")) : readJsonPayload();
  const commercialProductReview = Boolean(reviewPath) &&
    payload.artifact === "sanitario_commercial_products_v2_review_candidates";
  if (reviewPath) assert(payload.review_only === true && payload.import_gate?.import_real_authorized === false,
    "REVIEW_ONLY_ARTIFACT_REQUIRED");
  if (mode === "apply") {
    if (commercialProductReview) {
      assert(process.env.SANITARIO_PRODUCTS_CONFIRM === payload.content_sha256,
        `Products apply bloqueado: defina SANITARIO_PRODUCTS_CONFIRM=${payload.content_sha256}.`);
      const reference = process.env.SANITARIO_PRODUCTS_AUTHORIZATION_REF;
      assert(typeof reference === "string" && reference.trim().length >= 10,
        "Products apply bloqueado: defina SANITARIO_PRODUCTS_AUTHORIZATION_REF com referencia explicita.");
    } else {
      assert(!reviewPath, "REVIEW_CANDIDATE_CANNOT_APPLY");
      assertApplyGate(payload);
    }
  }
  const closureReview = Boolean(reviewPath) && payload.artifact === "sanitario_closure_review_candidates";
  if (closureReview) {
    const expected = prepareClosureCandidates(JSON.parse(readFileSync(CLOSURE_BASELINE_PATH, "utf8")).catalog, payload.identities);
    assert(!isDifferent(payload, expected), "CLOSURE_REVIEW_PREPARATION_MISMATCH");
  }
  const data = commercialProductReview
    ? validateCommercialProductReviewPayload(payload)
    : closureReview ? validateCanonicalTechnicalContract(payload).data : validateCanonicalPayload(payload);

  if (mode === "validate") {
    console.log(commercialProductReview ? "F6 commercial product validate OK" : "12G validate OK");
    console.log(
      JSON.stringify(
        {
          payload: reviewPath ? "review candidate (not authorized for import)" : PAYLOAD_REL,
          artifact: payload.artifact,
          artifact_version: payload.artifact_version,
          canonical_validation_complete: PIPELINE_STATUS.CANONICAL_VALIDATION_COMPLETE,
          publisher_complete: PIPELINE_STATUS.PUBLISHER_COMPLETE,
          products: data.product_rows.length,
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

  const commercialProjectRef = commercialProductReview && mode === "apply"
    ? (() => {
      const ref = readFileSync(path.join(ROOT, "supabase/.temp/project-ref"), "utf8").trim();
      assert(/^[a-z0-9]{20}$/.test(ref), "COMMERCIAL_PROJECT_REF_REQUIRED: projeto vinculado ausente em supabase/.temp/project-ref.");
      return ref;
    })()
    : null;
  const connection = await connectDb(mode, Boolean(reviewPath) && mode !== "apply", commercialProjectRef,
    { commercialProductsOnly: commercialProductReview && mode === "apply" });
  const { client } = connection;
  try {
    console.log(
      `database host=${connection.target.host} port=${connection.target.port} database=${connection.target.database} local=${connection.target.local}`,
    );
    if (mode === "dry-run") {
      const plan = await buildPlan(client, data);
      printPlan("dry-run", plan);
      console.log(
        `aviso: publisher_complete=${PIPELINE_STATUS.PUBLISHER_COMPLETE}; cobertura estrutural 14/14; dry-run nao certifica autorizacao operacional, RLS ou concorrencia`,
      );
      return;
    }

    if (commercialProductReview) {
      const plan = await buildPlan(client, data);
      assertPublishablePlan(plan);
      printPlan("apply-plan", plan);
      const updates = plan.filter((op) => op.collection === "product_rows" && op.action === "update");
      assert(updates.length === 0,
        `PRODUCTS_APPLY_UPDATE_FORBIDDEN: ${stableStringify(updates.map(({ key, reason }) => ({ key, reason })))}`);
      const counts = await applyTransaction(client, data, { commercialProductsOnly: true });
      console.log("F6 commercial products apply OK");
      console.log(JSON.stringify({ content_sha256: payload.content_sha256, project_ref: commercialProjectRef,
        authorization_reference: process.env.SANITARIO_PRODUCTS_AUTHORIZATION_REF, ...counts }));
    } else {
      const preflightPlan = await buildPlan(client, data);
      assertPublishablePlan(preflightPlan);
      printPlan("apply-plan", preflightPlan);
      const counts = await applyImport(client);
      console.log("12G apply OK");
      console.log(`summary ${JSON.stringify(counts)}`);
    }
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
