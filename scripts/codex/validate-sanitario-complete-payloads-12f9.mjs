import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = (p) => path.join(root, p);
const read = (p) => readFileSync(rel(p), "utf8");
const json = (p) => JSON.parse(read(p));

const protocols = json("docs/review/evidence/PAYLOAD_JSON_PROTOCOLOS_V2_12F9.json");
const items = json("docs/review/evidence/PAYLOAD_JSON_ITENS_PROTOCOLOS_V2_12F9.json");
const groups = json("docs/review/evidence/PAYLOAD_JSON_PRODUCT_CLASS_GROUPS_12F9.json");
const rejections = json("docs/review/evidence/REJEICOES_PAYLOAD_JSON_12F9.json");

let pass = 0;
let fail = 0;
let warning = 0;

function ok(condition, message) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${message}`);
    return;
  }
  fail += 1;
  console.error(`FAIL ${message}`);
}

function warn(condition, message) {
  if (condition) return;
  warning += 1;
  console.warn(`WARNING ${message}`);
}

function by(rows, key, value) {
  return rows.find((row) => row[key] === value);
}

function walk(value, visit) {
  visit(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => walk(entry, visit));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => walk(entry, visit));
  }
}

const forbiddenTrueFlags = [
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
];

const artifacts = [protocols, items, groups, rejections];
const allRows = [
  ...protocols.rows,
  ...items.rows,
  ...groups.rows,
  ...rejections.rejections,
];
const normalizeText = (value) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

ok(protocols.artifact_version === "12F9.0-candidate", "protocolos usam artifact_version 12F9");
ok(items.artifact_version === "12F9.0-candidate", "itens usam artifact_version 12F9");
ok(groups.artifact_version === "12F9.0-candidate", "groups usam artifact_version 12F9");
ok(rejections.artifact_version === "12F9.0-candidate", "rejeicoes usam artifact_version 12F9");
artifacts.forEach((artifact) => ok(artifact.execute_import === false, `${artifact.artifact} mantem execute_import=false`));

ok(protocols.target_table === "sanitario_protocolos_v2", "target_table de protocolos correto");
ok(items.target_table === "sanitario_protocolo_itens_versions_v2", "target_table de itens correto");
ok(groups.target_table === "sanitario_product_class_groups_v2", "target_table de groups correto");
ok(protocols.rows.length === 10, "10 protocolos candidatos");
ok(items.rows.length === 19, "19 itens candidatos");
ok(groups.rows.length === 4, "4 ProductClassGroups candidatos");
ok(rejections.rejections.length === 16, "16 members rejeitados");

artifacts.forEach((artifact) => {
  walk(artifact, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const flag of forbiddenTrueFlags) {
      if (Object.hasOwn(value, flag)) {
        ok(value[flag] === false, `${artifact.artifact}: ${flag} nao esta true`);
      }
    }
  });
});

protocols.rows.forEach((row) => {
  ok(row.scope === "global", `${row.family_code}: protocolo global`);
  ok(row.fazenda_id === null, `${row.family_code}: sem fazenda_id`);
  ok(row.version === 1, `${row.family_code}: version=1`);
  ok(row.approval_status === "draft", `${row.family_code}: approval_status=draft`);
  ok(Array.isArray(row.source_refs_snapshot), `${row.family_code}: source_refs_snapshot array`);
  for (const ref of row.source_refs_snapshot) {
    ok(/^SRC_/.test(ref.source_ref), `${row.family_code}: source_ref tecnico em ${ref.field}`);
  }
});

items.rows.forEach((row) => {
  ok(row.version === 1, `${row.logical_item_key}: version=1`);
  ok(row.status === "draft", `${row.logical_item_key}: status=draft`);
  ok(row.allows_agenda_auto === false, `${row.logical_item_key}: allows_agenda_auto=false`);
  ok(row.protocol_id.startsWith("{{lookup sanitario_protocolos_v2.id by family_code="), `${row.logical_item_key}: protocol_id por lookup logico`);
  ok(["specific_product", "product_class", "product_class_group", "none"].includes(row.product_requirement_kind), `${row.logical_item_key}: modalidade de produto valida`);
  ok(row.product_id === null, `${row.logical_item_key}: product_id nulo no candidato`);
  if (row.product_requirement_kind === "product_class") {
    ok(typeof row.product_class === "string" && row.product_class.length > 0, `${row.logical_item_key}: product_class informado`);
    ok(row.product_class_group_id === null, `${row.logical_item_key}: product_class_group_id nulo para product_class`);
  }
  if (row.product_requirement_kind === "product_class_group") {
    ok(row.product_class === null, `${row.logical_item_key}: product_class nulo para ProductClassGroup`);
    ok(row.product_class_group_id.startsWith("{{lookup sanitario_product_class_groups_v2.id by group_key="), `${row.logical_item_key}: product_class_group_id por lookup`);
    ok(row.limitations.includes("class_group_does_not_validate_execution"), `${row.logical_item_key}: grupo nao valida execucao`);
    ok(row.limitations.includes("requires_real_product"), `${row.logical_item_key}: produto real exigido na execucao`);
    ok(Boolean(row.snapshot_template.rotationRuleKey || row.snapshot_template.rotationRule), `${row.logical_item_key}: rotationRule preservada no snapshot`);
  }
  if (row.product_requirement_kind === "none") {
    ok(row.product_class === null && row.product_class_group_id === null, `${row.logical_item_key}: none sem classe/grupo`);
    ok(row.snapshot_template.executionProductPolicy === "not_required", `${row.logical_item_key}: none sem produto de execucao`);
  }
  for (const refs of Object.values(row.source_refs_by_field)) {
    refs.forEach((ref) => ok(/^SRC_/.test(ref.source_ref), `${row.logical_item_key}: source_refs_by_field somente fonte tecnica`));
  }
});

const b19Protocol = by(protocols.rows, "family_code", "brucelose_b19");
const b19Item = by(items.rows, "logical_item_key", "b19_femeas_3_8_meses");
ok(b19Protocol.legal_status === "obrigatorio_norma", "B19 legal_status obrigatorio_norma");
ok(b19Protocol.jurisdiction_scope.legal_scope === "nacional", "B19 escopo nacional");
ok(b19Protocol.metadata.automationStatus === "manual_only", "B19 manual_only");
ok(b19Protocol.metadata.agenda_allowed === false, "B19 sem agenda_allowed");
ok(b19Item.eligibility_rule.sex === "femea", "B19 femeas");
ok(b19Item.eligibility_rule.age_min_months === 3 && b19Item.eligibility_rule.age_max_months === 8, "B19 faixa 3-8 meses");
ok(b19Item.eligibility_rule.species.includes("bovino") && b19Item.eligibility_rule.species.includes("bubalino"), "B19 bovino e bubalino");
ok(!JSON.stringify(b19Item).includes("requires_regional_overlay"), "B19 sem dependencia estadual/regional");

const aftosaProtocol = by(protocols.rows, "family_code", "febre_aftosa");
const aftosaItems = items.rows.filter((row) => row.protocol_id.includes("febre_aftosa"));
ok(aftosaProtocol.legal_status === "bloqueado", "aftosa legal_status bloqueado");
ok(aftosaProtocol.status === "retired", "aftosa status retired");
ok(aftosaProtocol.metadata.automationStatus === "blocked", "aftosa blocked");
aftosaItems.forEach((row) => {
  ok(row.product_requirement_kind === "none", `${row.logical_item_key}: aftosa sem requisito de produto`);
  ok(row.product_id === null && row.product_class === null && row.product_class_group_id === null, `${row.logical_item_key}: aftosa sem produto sugerido`);
  ok(row.allows_agenda_auto === false, `${row.logical_item_key}: aftosa sem agenda`);
});

const expectedPcgItems = new Map([
  ["recria_maio", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_julho", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_setembro", "pcg_antiparasitarios_recria_estrategicos"],
  ["pre_desmama_situacional", "pcg_antiparasitarios_bezerros_pre_desmama"],
  ["pre_confinamento_dose_unica", "pcg_antiparasitarios_pre_confinamento"],
  ["matrizes_pre_parto_antiparasitario", "pcg_antiparasitarios_matrizes_pre_parto"],
]);
expectedPcgItems.forEach((groupKey, itemKey) => {
  const row = by(items.rows, "logical_item_key", itemKey);
  ok(row.product_requirement_kind === "product_class_group", `${itemKey}: continua ProductClassGroup`);
  ok(row.product_class_group_id.includes(`group_key=${groupKey}`), `${itemKey}: lookup usa group_key esperado`);
});

groups.rows.forEach((row) => {
  ok(row.scope === "global", `${row.group_key}: group global`);
  ok(row.fazenda_id === null, `${row.group_key}: group sem fazenda_id`);
  ok(row.curation_status === "needs_review", `${row.group_key}: needs_review`);
  ok(row.metadata.agenda_allowed === false, `${row.group_key}: group sem agenda_allowed`);
  ok(row.metadata.approved_for_catalog === false, `${row.group_key}: group sem approved_for_catalog`);
  ok(row.metadata.rotationRule.kind === "chemical_class_rotation", `${row.group_key}: rotationRule em metadata`);
  ok(Array.isArray(row.metadata.principios_ativos_candidatos), `${row.group_key}: principios ativos apenas como metadata`);
});

const uuidLike = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
rejections.rejections.forEach((row) => {
  ok(row.reason === "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER", `${row.member_key}: motivo de rejeicao preservado`);
  ok(!Object.hasOwn(row, "class_id"), `${row.member_key}: sem class_id artificial`);
  ok(!uuidLike.test(JSON.stringify(row)), `${row.member_key}: sem UUID artificial`);
});

const migrationPath = "supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql";
ok(existsSync(rel(migrationPath)), "migration 12F7 existe");
const migration = read(migrationPath);
ok(migration.includes("product_class_group"), "migration contem product_class_group");
ok(migration.includes("product_class_group_id"), "migration contem product_class_group_id");
ok(migration.includes("sanitario_product_class_groups_v2(id)"), "migration contem FK para sanitario_product_class_groups_v2(id)");
ok(migration.includes("trg_validate_protocol_item_product_class_group_v2"), "migration contem trigger de validacao de ProductClassGroup");

const sanitario = normalizeText(read("docs/domain/SANITARIO.md"));
ok(sanitario.includes("agenda e intencao") || sanitario.includes("agenda = intencao"), "SANITARIO preserva agenda como intencao");
ok(sanitario.includes("evento e fato") || sanitario.includes("evento = fato"), "SANITARIO preserva evento como fato");
ok(sanitario.includes("productclassgroup nao valida execucao sozinho"), "SANITARIO preserva ProductClassGroup sem validar execucao sozinho");
ok(sanitario.includes("carencia ativa nasce somente de evento executado"), "SANITARIO preserva carencia por evento/produto/snapshot");
warn(sanitario.includes("bubalino nao herda autorizacao de bovino"), "SANITARIO deveria manter frase explicita sobre bubalino");

const allJson = artifacts.map((artifact) => JSON.stringify(artifact)).join("\n");
const hasTrueFlagString = (flag) => allJson.includes(`"${flag}": true`);
ok(!allJson.includes('"PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM"'), "rejeicao antiga de ProductClassGroup zerada");
ok(!hasTrueFlagString("creates_agenda"), "nenhuma agenda criada");
ok(!hasTrueFlagString("creates_event"), "nenhum evento criado");
ok(!hasTrueFlagString("creates_stock_movement"), "nenhum estoque criado");
ok(!hasTrueFlagString("creates_active_withdrawal"), "nenhuma carencia ativa criada");
ok(!hasTrueFlagString("allows_operational_release"), "nenhuma liberacao operacional criada");

console.log(`\nResultado 12F9: ${pass} PASS, ${warning} WARNING, ${fail} FAIL`);
if (fail > 0) process.exit(1);
