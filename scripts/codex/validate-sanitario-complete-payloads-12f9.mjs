import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = (value) => path.join(root, value);
const paths = {
  protocols: "docs/review/evidence/PAYLOAD_JSON_PROTOCOLOS_V2_12F9.json",
  items: "docs/review/evidence/PAYLOAD_JSON_ITENS_PROTOCOLOS_V2_12F9.json",
  groups: "docs/review/evidence/PAYLOAD_JSON_PRODUCT_CLASS_GROUPS_12F9.json",
  rejections: "docs/review/evidence/REJEICOES_PAYLOAD_JSON_12F9.json",
  migration: "supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql",
  sanitario: "docs/domain/SANITARIO.md",
};

let pass = 0;
let fail = 0;
let warning = 0;

function ok(condition, message) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function warn(condition, message) {
  if (condition) return;
  warning += 1;
  console.warn(`WARNING ${message}`);
}

function readText(file) {
  if (!existsSync(rel(file))) {
    ok(false, `arquivo obrigatorio existe: ${file}`);
    return null;
  }
  try {
    return readFileSync(rel(file), "utf8");
  } catch (error) {
    ok(false, `arquivo legivel ${file}: ${error.message}`);
    return null;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    ok(false, `JSON valido ${file}: ${error.message}`);
    return null;
  }
}

function rowsOf(artifact, label, key = "rows") {
  const rows = artifact?.[key];
  ok(Array.isArray(rows), `${label} possui array ${key}`);
  return Array.isArray(rows) ? rows : [];
}

function by(rows, key, value) {
  return rows.find((row) => row?.[key] === value);
}

function uniqueBy(rows, key, label) {
  const values = rows.map((row) => row?.[key]).filter(Boolean);
  ok(values.length === rows.length, `${label}: ${key} preenchido`);
  ok(new Set(values).size === values.length, `${label}: ${key} sem duplicidade`);
}

function walk(value, visit) {
  visit(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => walk(entry, visit));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => walk(entry, visit));
  }
}

function normalizeText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function validateSourceRefs(refs, label) {
  ok(refs && typeof refs === "object", `${label}: source refs estruturadas`);
  if (!refs || typeof refs !== "object") return;
  let containsInvalidSentinel = false;
  walk(refs, (value) => {
    if (value === null) containsInvalidSentinel = true;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "n/a" || normalized.startsWith("source_gap_") || normalized.includes("policy")) {
        containsInvalidSentinel = true;
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (Object.hasOwn(value, "source_ref")) {
      ok(typeof value.source_ref === "string" && /^SRC_/.test(value.source_ref), `${label}: source_ref tecnico`);
    }
  });
  ok(!containsInvalidSentinel, `${label}: source refs sem null/n-a/source_gap/policy`);
}

const protocolsArtifact = readJson(paths.protocols);
const itemsArtifact = readJson(paths.items);
const groupsArtifact = readJson(paths.groups);
const rejectionsArtifact = readJson(paths.rejections);
const artifacts = [protocolsArtifact, itemsArtifact, groupsArtifact, rejectionsArtifact].filter(Boolean);

const protocols = rowsOf(protocolsArtifact, "protocolos");
const items = rowsOf(itemsArtifact, "itens");
const groups = rowsOf(groupsArtifact, "groups");
const rejections = rowsOf(rejectionsArtifact, "rejeicoes", "rejections");

for (const [artifact, label] of [
  [protocolsArtifact, "protocolos"],
  [itemsArtifact, "itens"],
  [groupsArtifact, "groups"],
  [rejectionsArtifact, "rejeicoes"],
]) {
  if (!artifact) continue;
  ok(artifact.artifact_version === "12F9.0-candidate", `${label} usa artifact_version 12F9`);
  ok(artifact.execute_import === false, `${label} mantem execute_import=false`);
}

ok(protocolsArtifact?.target_table === "sanitario_protocolos_v2", "target_table de protocolos correto");
ok(itemsArtifact?.target_table === "sanitario_protocolo_itens_versions_v2", "target_table de itens correto");
ok(groupsArtifact?.target_table === "sanitario_product_class_groups_v2", "target_table de groups correto");
ok(protocols.length === 10, "10 protocolos candidatos");
ok(items.length === 19, "19 itens candidatos");
ok(groups.length === 4, "4 ProductClassGroups candidatos");
ok(rejections.length === 16, "16 members rejeitados");
uniqueBy(protocols, "family_code", "protocolos");
uniqueBy(items, "logical_item_key", "itens");
uniqueBy(groups, "group_key", "groups");
uniqueBy(rejections, "member_key", "rejeicoes");

const forbiddenTrueFlags = new Set([
  "agenda_allowed",
  "approved_for_catalog",
  "allows_agenda_auto",
  "allowsAgendaAuto",
  "execute_import",
  "creates_agenda",
  "creates_event",
  "creates_stock_movement",
  "creates_active_withdrawal",
  "allows_operational_release",
]);
for (const artifact of artifacts) {
  walk(artifact, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, flagValue] of Object.entries(value)) {
      if (forbiddenTrueFlags.has(key)) ok(flagValue === false, `${artifact.artifact}: ${key} nao esta true`);
    }
  });
}

for (const row of protocols) {
  ok(row.scope === "global", `${row.family_code}: protocolo global`);
  ok(row.fazenda_id === null, `${row.family_code}: sem fazenda_id`);
  ok(row.version === 1, `${row.family_code}: version=1`);
  ok(row.approval_status === "draft", `${row.family_code}: approval_status=draft`);
  ok(Array.isArray(row.source_refs_snapshot) && row.source_refs_snapshot.length > 0, `${row.family_code}: source_refs_snapshot preenchido`);
  validateSourceRefs(row.source_refs_snapshot, row.family_code);
}

for (const row of items) {
  ok(row.version === 1, `${row.logical_item_key}: version=1`);
  ok(row.status === "draft", `${row.logical_item_key}: status=draft`);
  ok(row.allows_agenda_auto === false, `${row.logical_item_key}: allows_agenda_auto=false`);
  ok(typeof row.protocol_id === "string" && row.protocol_id.startsWith("{{lookup sanitario_protocolos_v2.id by family_code="), `${row.logical_item_key}: protocol_id por lookup logico`);
  ok(["specific_product", "product_class", "product_class_group", "none"].includes(row.product_requirement_kind), `${row.logical_item_key}: modalidade de produto valida`);
  ok(row.product_id === null, `${row.logical_item_key}: product_id nulo no candidato`);
  validateSourceRefs(row.source_refs_by_field, row.logical_item_key);

  if (row.product_requirement_kind === "product_class") {
    ok(typeof row.product_class === "string" && row.product_class.length > 0, `${row.logical_item_key}: product_class informado`);
    ok(row.product_class_group_id === null, `${row.logical_item_key}: grupo nulo para product_class`);
  } else if (row.product_requirement_kind === "product_class_group") {
    ok(row.product_class === null, `${row.logical_item_key}: classe nula para ProductClassGroup`);
    ok(typeof row.product_class_group_id === "string" && row.product_class_group_id.startsWith("{{lookup sanitario_product_class_groups_v2.id by group_key="), `${row.logical_item_key}: group por lookup`);
    ok(Array.isArray(row.limitations) && row.limitations.includes("class_group_does_not_validate_execution"), `${row.logical_item_key}: grupo nao valida execucao`);
    ok(row.limitations?.includes("requires_real_product"), `${row.logical_item_key}: produto real exigido`);
    ok(Boolean(row.snapshot_template?.rotationRuleKey || row.snapshot_template?.rotationRule), `${row.logical_item_key}: RotationRule preservada`);
  } else if (row.product_requirement_kind === "none") {
    ok(row.product_class === null && row.product_class_group_id === null, `${row.logical_item_key}: none sem classe/grupo`);
    ok(row.snapshot_template?.executionProductPolicy === "not_required", `${row.logical_item_key}: none sem produto de execucao`);
  }
}

const b19Protocol = by(protocols, "family_code", "brucelose_b19");
const b19Item = by(items, "logical_item_key", "b19_femeas_3_8_meses");
ok(Boolean(b19Protocol), "protocolo B19 presente");
ok(Boolean(b19Item), "item B19 presente");
if (b19Protocol && b19Item) {
  ok(b19Protocol.legal_status === "obrigatorio_norma", "B19 obrigatorio_norma");
  ok(b19Protocol.jurisdiction_scope?.legal_scope === "nacional", "B19 escopo nacional");
  ok(b19Protocol.metadata?.automationStatus === "manual_only", "B19 manual_only");
  ok(b19Protocol.metadata?.agenda_allowed === false, "B19 sem agenda_allowed");
  ok(b19Item.eligibility_rule?.sex === "femea", "B19 femeas");
  ok(b19Item.eligibility_rule?.age_min_months === 3 && b19Item.eligibility_rule?.age_max_months === 8, "B19 faixa 3-8 meses");
  ok(b19Item.eligibility_rule?.species?.includes("bovino") && b19Item.eligibility_rule?.species?.includes("bubalino"), "B19 bovino e bubalino");
  ok(!JSON.stringify(b19Item).includes("requires_regional_overlay"), "B19 sem dependencia estadual artificial");
}

const aftosaProtocol = by(protocols, "family_code", "febre_aftosa");
const aftosaItems = items.filter((row) => row.protocol_id?.includes("febre_aftosa"));
ok(Boolean(aftosaProtocol), "protocolo aftosa presente");
if (aftosaProtocol) {
  ok(aftosaProtocol.legal_status === "bloqueado", "aftosa bloqueada");
  ok(aftosaProtocol.status === "retired", "aftosa retired");
  ok(aftosaProtocol.metadata?.automationStatus === "blocked", "aftosa automation blocked");
}
ok(aftosaItems.length > 0, "itens de aftosa presentes");
for (const row of aftosaItems) {
  ok(row.product_requirement_kind === "none", `${row.logical_item_key}: aftosa sem requisito de produto`);
  ok(row.product_id === null && row.product_class === null && row.product_class_group_id === null, `${row.logical_item_key}: aftosa sem produto sugerido`);
  ok(row.allows_agenda_auto === false, `${row.logical_item_key}: aftosa sem agenda`);
}

const expectedPcgItems = new Map([
  ["recria_maio", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_julho", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_setembro", "pcg_antiparasitarios_recria_estrategicos"],
  ["pre_desmama_situacional", "pcg_antiparasitarios_bezerros_pre_desmama"],
  ["pre_confinamento_dose_unica", "pcg_antiparasitarios_pre_confinamento"],
  ["matrizes_pre_parto_antiparasitario", "pcg_antiparasitarios_matrizes_pre_parto"],
]);
for (const [itemKey, groupKey] of expectedPcgItems) {
  const row = by(items, "logical_item_key", itemKey);
  ok(Boolean(row), `${itemKey}: item presente`);
  if (!row) continue;
  ok(row.product_requirement_kind === "product_class_group", `${itemKey}: continua ProductClassGroup`);
  ok(row.product_class_group_id?.includes(`group_key=${groupKey}`), `${itemKey}: lookup usa grupo esperado`);
}

for (const row of groups) {
  ok(row.scope === "global" && row.fazenda_id === null, `${row.group_key}: group global sem fazenda`);
  ok(row.curation_status === "needs_review", `${row.group_key}: needs_review`);
  ok(row.metadata?.agenda_allowed === false && row.metadata?.approved_for_catalog === false, `${row.group_key}: sem liberacao operacional`);
  ok(row.metadata?.rotationRule?.kind === "chemical_class_rotation", `${row.group_key}: RotationRule em metadata`);
  ok(Array.isArray(row.metadata?.principios_ativos_candidatos), `${row.group_key}: principios ativos apenas candidatos`);
}

const uuidLike = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
for (const row of rejections) {
  ok(row.reason === "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER", `${row.member_key}: motivo preservado`);
  ok(!Object.hasOwn(row, "class_id"), `${row.member_key}: sem class_id artificial`);
  ok(!uuidLike.test(JSON.stringify(row)), `${row.member_key}: sem UUID artificial`);
}

const migration = readText(paths.migration) ?? "";
ok(migration.includes("product_class_group"), "migration contem product_class_group");
ok(migration.includes("product_class_group_id"), "migration contem product_class_group_id");
ok(migration.includes("sanitario_product_class_groups_v2(id)"), "migration contem FK de ProductClassGroup");
ok(migration.includes("trg_validate_protocol_item_product_class_group_v2"), "migration contem trigger de validacao");

const sanitarioText = readText(paths.sanitario);
if (sanitarioText !== null) {
  const sanitario = normalizeText(sanitarioText);
  ok(sanitario.includes("agenda e intencao") || sanitario.includes("agenda = intencao"), "SANITARIO preserva Agenda como intencao");
  ok(sanitario.includes("evento e fato") || sanitario.includes("evento = fato"), "SANITARIO preserva Evento como fato");
  ok(sanitario.includes("productclassgroup nao valida execucao sozinho"), "SANITARIO preserva grupo sem validar execucao");
  ok(sanitario.includes("carencia ativa nasce somente de evento executado"), "SANITARIO preserva carencia factual");
  warn(sanitario.includes("bubalino nao herda autorizacao de bovino"), "SANITARIO deveria explicitar que bubalino nao herda autorizacao de bovino");
}

const allJson = artifacts.map((artifact) => JSON.stringify(artifact)).join("\n");
ok(!allJson.includes('"PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"'), "rejeicao antiga de ProductClassGroup zerada");

console.log(`\nResultado 12F9: ${pass} PASS, ${warning} WARNING, ${fail} FAIL`);
if (fail > 0) process.exitCode = 1;
