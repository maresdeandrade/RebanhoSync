import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

const root = process.cwd();

const files = {
  migration12f7: "supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql",
  seedItems12f2: "docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md",
  groups12f4: "docs/review/evidence/ADAPTER_PRODUCT_CLASS_GROUPS_12F4.md",
  payloads12f8: "docs/review/evidence/PAYLOADS_ADAPTADOS_PRODUCT_CLASS_GROUP_12F8.md",
  rejections12f8: "docs/review/evidence/REJEICOES_REMANESCENTES_12F8.md",
  revalidation12f8: "docs/review/evidence/REVALIDACAO_ADAPTER_SCHEMA_ATUALIZADO_12F8.md",
  sanitaryDoc: "docs/domain/SANITARIO.md",
};

const expectedItems = [
  "recria_maio",
  "recria_julho",
  "recria_setembro",
  "pre_desmama_situacional",
  "pre_confinamento_dose_unica",
  "matrizes_pre_parto_antiparasitario",
];

const expectedGroups = [
  "pcg_antiparasitarios_recria_estrategicos",
  "pcg_antiparasitarios_bezerros_pre_desmama",
  "pcg_antiparasitarios_pre_confinamento",
  "pcg_antiparasitarios_matrizes_pre_parto",
];

const expectedGroupByItem = new Map([
  ["recria_maio", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_julho", "pcg_antiparasitarios_recria_estrategicos"],
  ["recria_setembro", "pcg_antiparasitarios_recria_estrategicos"],
  ["pre_desmama_situacional", "pcg_antiparasitarios_bezerros_pre_desmama"],
  ["pre_confinamento_dose_unica", "pcg_antiparasitarios_pre_confinamento"],
  ["matrizes_pre_parto_antiparasitario", "pcg_antiparasitarios_matrizes_pre_parto"],
]);

const result = {
  pass: [],
  fail: [],
  warning: [],
};

function add(kind, message) {
  result[kind].push(message);
}

function assert(condition, message) {
  add(condition ? "pass" : "fail", message);
}

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    add("fail", `Arquivo ausente: ${rel}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function jsonBlocks(markdown, rel) {
  const blocks = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch (error) {
      add("fail", `JSON invalido em ${rel}: ${error.message}`);
    }
  }
  return blocks;
}

function walk(value, callback, pathParts = []) {
  callback(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, callback, pathParts.concat(String(index))));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, callback, pathParts.concat(key)));
  }
}

function validateNoForbiddenFlags(allText) {
  const forbidden = [
    /"agenda_allowed"\s*:\s*true/,
    /"approved_for_catalog"\s*:\s*true/,
    /"allows_agenda_auto"\s*:\s*true/,
    /"allowsAgendaAuto"\s*:\s*true/,
    /"execute_import"\s*:\s*true/,
    /"creates_agenda"\s*:\s*true/,
    /"creates_event"\s*:\s*true/,
    /"creates_stock_movement"\s*:\s*true/,
    /"creates_active_withdrawal"\s*:\s*true/,
    /"allows_operational_release"\s*:\s*true/,
  ];
  for (const pattern of forbidden) {
    assert(!pattern.test(allText), `Flag proibida ausente: ${pattern}`);
  }
}

function validateSourceRefsObject(sourceRefs, label) {
  let ok = true;
  walk(sourceRefs, (value, parts) => {
    if (value === null) {
      ok = false;
      add("fail", `${label} contem null em source_refs_by_field: ${parts.join(".")}`);
    }
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "n/a" || lower.startsWith("source_gap_") || lower.includes("policy") || lower.includes("mv")) {
        ok = false;
        add("fail", `${label} contem valor proibido em source_refs_by_field: ${parts.join(".")}=${value}`);
      }
    }
  });
  assert(ok, `${label} source_refs_by_field sem null/n/a/source_gap/politica/MV`);
}

function lookupToken(groupKey) {
  return `{{lookup sanitario_product_class_groups_v2.id by group_key=${groupKey}}}`;
}

const markdown = Object.fromEntries(Object.entries(files).map(([key, rel]) => [key, read(rel)]));
const allText = [
  markdown.payloads12f8,
  markdown.rejections12f8,
  markdown.revalidation12f8,
].join("\n");

validateNoForbiddenFlags(allText);

const migration = markdown.migration12f7;
assert(migration.includes("add value if not exists 'product_class_group'"), "Migration 12F7 adiciona enum product_class_group");
assert(migration.includes("add column if not exists product_class_group_id"), "Migration 12F7 adiciona product_class_group_id");
assert(migration.includes("references public.sanitario_product_class_groups_v2(id)"), "Migration 12F7 possui FK para sanitario_product_class_groups_v2(id)");
assert(migration.includes("sanitario_protocolo_itens_versions_v2_product_req_chk"), "Migration 12F7 recria CHECK de requisito");
assert(migration.includes("fn_validate_protocol_item_product_class_group_v2"), "Migration 12F7 possui funcao trigger de ProductClassGroup");
assert(migration.includes("trg_validate_protocol_item_product_class_group_v2"), "Migration 12F7 possui trigger de ProductClassGroup");
assert(migration.includes("v_group_curation_status in ('blocked', 'archived')"), "Trigger bloqueia agenda automatica para grupo blocked/archived");

const seedItemsArtifact = jsonBlocks(markdown.seedItems12f2, files.seedItems12f2)[0];
const seedRows = seedItemsArtifact?.rows ?? [];
assert(seedRows.length === 19, "12F2 contem 19 itens candidatos");

const groupsArtifact = jsonBlocks(markdown.groups12f4, files.groups12f4)[0];
const groupRows = groupsArtifact?.rows ?? [];
assert(groupRows.length === 4, "12F4 contem 4 ProductClassGroups adaptaveis");
for (const groupKey of expectedGroups) {
  const matches = groupRows.filter((group) => group.group_key === groupKey && group.scope === "global" && group.fazenda_id === null);
  assert(matches.length === 1, `Lookup documental inequivoco para ${groupKey}`);
  assert(matches[0]?.metadata?.agenda_allowed === false, `Grupo ${groupKey} agenda_allowed=false`);
  assert(matches[0]?.metadata?.approved_for_catalog === false, `Grupo ${groupKey} approved_for_catalog=false`);
}

const payloadArtifact = jsonBlocks(markdown.payloads12f8, files.payloads12f8)[0];
const adaptedRows = payloadArtifact?.rows ?? [];
assert(payloadArtifact?.execute_import === false, "Payload 12F8 nao executa import");
assert(payloadArtifact?.creates_migration === false, "Payload 12F8 nao cria migration");
assert(payloadArtifact?.counts?.items?.adapted === 19, "Contagem 12F8 itens adaptaveis = 19");
assert(payloadArtifact?.counts?.items?.rejected === 0, "Contagem 12F8 itens rejeitados por enum antigo = 0");
assert(payloadArtifact?.counts?.productClassGroupMembers?.rejected === 16, "Members continuam 16 rejeitados");
assert(adaptedRows.length === 6, "Payload 12F8 documenta os 6 itens ProductClassGroup adaptados");

for (const itemKey of expectedItems) {
  const source = seedRows.find((row) => row.item_key === itemKey);
  const adapted = adaptedRows.find((row) => row.logical_item_key === itemKey);
  const groupKey = expectedGroupByItem.get(itemKey);
  assert(source?.productRequirementKind === "product_class_group", `12F2 ${itemKey} era product_class_group`);
  assert(source?.productClassGroupKey === groupKey, `12F2 ${itemKey} aponta para ${groupKey}`);
  assert(Boolean(adapted), `12F8 adaptou ${itemKey}`);
  if (!adapted) continue;

  assert(adapted.protocol_id === `{{lookup sanitario_protocolos_v2.id by family_code=${source.protocol_key}}}`, `${itemKey} usa protocol_id por lookup logico`);
  assert(adapted.version === 1, `${itemKey} version=1`);
  assert(adapted.action_type === "vermifugacao", `${itemKey} action_type=vermifugacao`);
  assert(adapted.product_requirement_kind === "product_class_group", `${itemKey} product_requirement_kind=product_class_group`);
  assert(adapted.product_class_group_id === lookupToken(groupKey), `${itemKey} usa product_class_group_id por lookup`);
  assert(adapted.product_id === null, `${itemKey} product_id=null`);
  assert(adapted.product_class === null, `${itemKey} product_class=null`);
  assert(adapted.allows_agenda_auto === false, `${itemKey} allows_agenda_auto=false`);
  assert(adapted.status === "draft", `${itemKey} status=draft`);
  assert(["estrategico", "condicional"].includes(adapted.item_status), `${itemKey} item_status permitido`);
  assert(adapted.snapshot_template?.executionProductPolicy === "required_at_execution", `${itemKey} exige produto real na execucao`);
  assert(
    adapted.snapshot_template?.rotationRuleKey === "rr_antiparasitario_chemical_class_rotation_v1" ||
      adapted.snapshot_template?.rotationRule?.kind === "chemical_class_rotation",
    `${itemKey} preserva RotationRule em snapshot_template`,
  );
  assert(Array.isArray(adapted.snapshot_template?.sourceGaps), `${itemKey} sourceGaps em snapshot_template`);
  assert(adapted.snapshot_template?.sourcePolicy?.withdrawal === "by_executed_product_snapshot", `${itemKey} SourcePolicy de carencia por produto executado`);
  assert(Array.isArray(adapted.limitations) && adapted.limitations.length > 0, `${itemKey} limitations preenchido`);
  assert(Array.isArray(adapted.species_authorization), `${itemKey} species_authorization array`);
  validateSourceRefsObject(adapted.source_refs_by_field, `Item ${itemKey}`);
}

const rejectionArtifact = jsonBlocks(markdown.rejections12f8, files.rejections12f8)[0];
assert(rejectionArtifact?.items?.rejected === 0, "12F8 sem rejeicao remanescente dos 6 itens por ProductClassGroup");
assert(rejectionArtifact?.items?.old_reason_count?.PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM === 0, "Reason antigo zerado");
assert(rejectionArtifact?.productClassGroupMembers?.rejected === 16, "12F8 preserva members rejeitados");
assert(rejectionArtifact?.productClassGroupMembers?.reason === "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER", "Reason de members preservado");
assert(!/"class_id"\s*:\s*"[0-9a-f-]{8,}"/i.test(markdown.rejections12f8), "Nenhum class_id artificial em rejeicoes");
assert(!/"group_id"\s*:\s*"[0-9a-f-]{8,}"/i.test(markdown.rejections12f8), "Nenhum group_id artificial em rejeicoes");

for (const invariant of [
  "ProductClassGroup não valida execução sozinho",
  "Carência ativa nasce somente de evento executado",
  "B19 como regra nacional",
  "febre aftosa como archived/blocked",
]) {
  assert(markdown.sanitaryDoc.includes(invariant), `SANITARIO preserva invariante: ${invariant}`);
}

const changedFiles = (() => {
  try {
    return execSync("git diff --name-only --cached && git diff --name-only", { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/"));
  } catch {
    add("warning", "Nao foi possivel consultar git diff.");
    return [];
  }
})();

for (const file of changedFiles) {
  assert(file !== files.migration12f7, "Migration 12F7 nao foi alterada nesta fase");
  assert(!/^src\/lib\/offline\//.test(file), `Dexie/offline nao alterado: ${file}`);
  assert(!/^supabase\/functions\/sync-batch\//.test(file), `sync-batch nao alterado: ${file}`);
  assert(!/^src\/pages\//.test(file), `UI nao alterada: ${file}`);
}

console.log("12F8 sanitario adapter validation");
console.log(`PASS: ${result.pass.length}`);
for (const message of result.pass) console.log(`PASS ${message}`);
console.log(`WARNING: ${result.warning.length}`);
for (const message of result.warning) console.log(`WARNING ${message}`);
console.log(`FAIL: ${result.fail.length}`);
for (const message of result.fail) console.log(`FAIL ${message}`);

if (result.fail.length > 0) {
  process.exitCode = 1;
}
