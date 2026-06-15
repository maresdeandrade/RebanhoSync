import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

const root = process.cwd();

const files = {
  plan12f4: "docs/review/PLANO_FASE_12F4_ADAPTER_PAYLOADS_SCHEMA_REAL.md",
  protocols: "docs/review/evidence/ADAPTER_PROTOCOLOS_V2_12F4.md",
  items: "docs/review/evidence/ADAPTER_ITENS_PROTOCOLOS_V2_12F4.md",
  groups: "docs/review/evidence/ADAPTER_PRODUCT_CLASS_GROUPS_12F4.md",
  sourceRefs: "docs/review/evidence/ADAPTER_SOURCE_REFS_ROTATION_RULES_12F4.md",
  rejections: "docs/review/evidence/REJEICOES_PAYLOADS_12F4.md",
  bundle: "docs/review/evidence/PAYLOADS_ADAPTADOS_SCHEMA_REAL_12F4.md",
};

const allowedProtocolLegalStatus = new Set([
  "obrigatorio_norma",
  "recomendado_tecnico",
  "condicional",
  "estrategico",
  "experimental_alerta",
  "bloqueado",
]);
const allowedProtocolStatus = new Set(["draft", "active", "retired"]);
const allowedApprovalStatus = new Set(["draft", "pending_review", "approved", "rejected"]);
const allowedScope = new Set(["global", "pack", "fazenda"]);
const allowedItemStatus = new Set(["obrigatorio", "recomendado", "condicional", "estrategico", "somente_alerta", "bloqueado"]);
const allowedActionType = new Set(["vacinacao", "vermifugacao", "tratamento", "exame", "manejo_sanitario", "alerta"]);
const allowedProductRequirementKind = new Set(["specific_product", "product_class", "none"]);
const expectedRejectedItems = [
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

function warn(condition, message) {
  if (!condition) add("warning", message);
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
    const raw = match[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch (error) {
      add("fail", `JSON invalido em ${rel}: ${error.message}`);
    }
  }
  return blocks;
}

function hasSpecies(list, species) {
  return Array.isArray(list) && species.every((s) => list.includes(s));
}

function getSourceRef(snapshot, field) {
  if (!Array.isArray(snapshot)) return undefined;
  return snapshot.find((entry) => entry?.field === field)?.source_ref;
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
    if (value === null) ok = false;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "n/a" || lower.startsWith("source_gap_") || lower.includes("policy") || lower.includes("mv decision")) {
        ok = false;
        add("fail", `${label} contem valor invalido em sourceRefs: ${parts.join(".")}=${value}`);
      }
    }
  });
  assert(ok, `${label} nao mistura null/n/a/source_gap/policy em sourceRefs`);
}

function parseAdaptedItemsTable(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\|\s*`/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, "")))
    .filter((cells) => cells.length === 4)
    .map(([item, item_status, action_type, product_requirement_kind]) => ({
      item,
      item_status: item_status.replace(/`/g, ""),
      action_type: action_type.replace(/`/g, ""),
      product_requirement_kind: product_requirement_kind.replace(/`/g, ""),
    }));
}

const markdown = Object.fromEntries(Object.entries(files).map(([key, rel]) => [key, read(rel)]));
const allText = Object.values(markdown).join("\n");

validateNoForbiddenFlags(allText);

const bundle = jsonBlocks(markdown.bundle, files.bundle)[0];
assert(bundle?.execute_import === false, "Bundle nao executa import");
assert(bundle?.creates_migration === false, "Bundle nao cria migration");
assert(bundle?.protocols?.adapted === 10 && bundle?.protocols?.rejected === 0, "Contagem protocolos 10 adaptados / 0 rejeitados");
assert(bundle?.items?.adapted === 13 && bundle?.items?.rejected === 6, "Contagem itens 13 adaptados / 6 rejeitados");
assert(bundle?.productClassGroups?.adapted === 4 && bundle?.productClassGroups?.rejected === 0, "Contagem ProductClassGroups 4 adaptados / 0 rejeitados");
assert(bundle?.productClassGroupMembers?.adapted === 0 && bundle?.productClassGroupMembers?.rejected === 16, "Contagem members 0 adaptados / 16 rejeitados");

const protocolsArtifact = jsonBlocks(markdown.protocols, files.protocols)[0];
const protocols = protocolsArtifact?.rows ?? [];
assert(protocols.length === 10, "10 protocolos adaptados presentes");

for (const row of protocols) {
  assert(allowedProtocolLegalStatus.has(row.legal_status), `Protocolo ${row.family_code} legal_status valido`);
  assert(allowedProtocolStatus.has(row.status), `Protocolo ${row.family_code} status valido`);
  assert(allowedApprovalStatus.has(row.approval_status), `Protocolo ${row.family_code} approval_status valido`);
  assert(allowedScope.has(row.scope), `Protocolo ${row.family_code} scope valido`);
  assert(row.approval_status === "draft", `Protocolo ${row.family_code} permanece draft`);
  assert(row.scope === "fazenda" ? Boolean(row.fazenda_id) : row.fazenda_id === null, `Protocolo ${row.family_code} respeita scope/fazenda_id`);
  assert(row.metadata?.agenda_allowed === false, `Protocolo ${row.family_code} metadata.agenda_allowed=false`);
  assert(row.metadata?.approved_for_catalog === false, `Protocolo ${row.family_code} metadata.approved_for_catalog=false`);
  validateSourceRefsObject(row.source_refs_snapshot, `Protocolo ${row.family_code}`);
}

const b19 = protocols.find((row) => row.family_code === "brucelose_b19");
assert(Boolean(b19), "B19 presente em protocolos");
if (b19) {
  assert(hasSpecies(b19.species_scope, ["bovino", "bubalino"]), "B19 species_scope contem bovino e bubalino");
  assert(b19.legal_status === "obrigatorio_norma", "B19 legal_status=obrigatorio_norma");
  assert(b19.jurisdiction_scope?.legal_scope === "nacional", "B19 legal_scope nacional");
  assert(b19.status === "draft", "B19 status draft");
  assert(b19.approval_status === "draft", "B19 approval_status draft");
  assert(b19.metadata?.target_sex === "femea", "B19 target_sex femea");
  const expectedRefs = {
    eligibility: "SRC_PNCEBT_BRUCELOSE",
    species: "SRC_PNCEBT_BRUCELOSE",
    sex: "SRC_PNCEBT_BRUCELOSE",
    age: "SRC_PNCEBT_BRUCELOSE",
    dose: "SRC_BULA_ABORVAC_B19",
    route: "SRC_BULA_ABORVAC_B19",
    recurrence: "SRC_BULA_ABORVAC_B19",
    restrictions: "SRC_PNCEBT_BRUCELOSE",
  };
  for (const [field, source] of Object.entries(expectedRefs)) {
    assert(getSourceRef(b19.source_refs_snapshot, field) === source, `B19 source ref ${field}=${source}`);
  }
}

const aftosa = protocols.find((row) => row.family_code === "febre_aftosa");
assert(Boolean(aftosa), "Aftosa presente em protocolos");
if (aftosa) {
  assert(aftosa.legal_status === "bloqueado", "Aftosa legal_status=bloqueado");
  assert(aftosa.status === "retired", "Aftosa status=retired");
  assert(aftosa.metadata?.archived === true, "Aftosa metadata.archived=true");
  assert(aftosa.metadata?.automationStatus === "blocked", "Aftosa automationStatus=blocked");
  assert(!JSON.stringify(aftosa).toLowerCase().includes("product_id"), "Aftosa sem produto sugerido em protocolo");
}

const adaptedItems = parseAdaptedItemsTable(markdown.items);
assert(adaptedItems.length === 13, "Tabela documental contem 13 itens adaptaveis");
for (const item of adaptedItems) {
  assert(allowedItemStatus.has(item.item_status), `Item ${item.item} item_status valido`);
  assert(allowedActionType.has(item.action_type), `Item ${item.item} action_type valido`);
  assert(allowedProductRequirementKind.has(item.product_requirement_kind), `Item ${item.item} product_requirement_kind valido`);
  assert(item.product_requirement_kind !== "product_class_group", `Item ${item.item} nao usa product_class_group`);
}

const itemBlocks = jsonBlocks(markdown.items, files.items);
const b19Item = itemBlocks.find((block) => block?.logical_item_key === "b19_femeas_3_8_meses");
const aftosaItem = itemBlocks.find((block) => block?.logical_item_key === "fmd_bloqueio_vacinacao_rotina");
assert(Boolean(b19Item), "Exemplo JSON B19 adaptado presente");
assert(Boolean(aftosaItem), "Exemplo JSON aftosa adaptado presente");

for (const item of [b19Item, aftosaItem].filter(Boolean)) {
  assert(allowedItemStatus.has(item.item_status), `Exemplo ${item.logical_item_key} item_status valido`);
  assert(allowedActionType.has(item.action_type), `Exemplo ${item.logical_item_key} action_type valido`);
  assert(allowedProductRequirementKind.has(item.product_requirement_kind), `Exemplo ${item.logical_item_key} product_requirement_kind valido`);
  assert(item.allows_agenda_auto === false, `Exemplo ${item.logical_item_key} allows_agenda_auto=false`);
  assert(item.status === "draft", `Exemplo ${item.logical_item_key} status=draft`);
  assert(item.eligibility_rule && typeof item.eligibility_rule === "object" && !Array.isArray(item.eligibility_rule), `Exemplo ${item.logical_item_key} eligibility_rule object`);
  assert(item.operational_window_rule && typeof item.operational_window_rule === "object" && !Array.isArray(item.operational_window_rule), `Exemplo ${item.logical_item_key} operational_window_rule object`);
  assert(item.snapshot_template && typeof item.snapshot_template === "object" && !Array.isArray(item.snapshot_template), `Exemplo ${item.logical_item_key} snapshot_template object`);
  assert(Array.isArray(item.species_authorization), `Exemplo ${item.logical_item_key} species_authorization array`);
  assert(Array.isArray(item.limitations), `Exemplo ${item.logical_item_key} limitations array`);
  validateSourceRefsObject(item.source_refs_by_field, `Item ${item.logical_item_key}`);
  if (item.product_requirement_kind === "product_class") {
    assert(Boolean(item.product_class), `Item ${item.logical_item_key} product_class preenchido`);
  }
  if (item.product_requirement_kind === "none") {
    assert(item.product_id === null && item.product_class === null, `Item ${item.logical_item_key} none sem product_id/product_class`);
  }
}

if (b19Item) {
  assert(b19Item.item_status === "obrigatorio", "Item B19 obrigatorio");
  assert(b19Item.action_type === "vacinacao", "Item B19 vacinacao");
  assert(b19Item.product_requirement_kind === "product_class", "Item B19 product_class");
  assert(b19Item.product_class === "vacina_brucelose_b19", "Item B19 product_class vacina_brucelose_b19");
  assert(hasSpecies(b19Item.eligibility_rule?.species, ["bovino", "bubalino"]), "Item B19 eligibility species bovino/bubalino");
  assert(b19Item.eligibility_rule?.sex === "femea", "Item B19 sex femea");
  assert(b19Item.eligibility_rule?.age_min_months === 3, "Item B19 age_min_months=3");
  assert(b19Item.eligibility_rule?.age_max_months === 8, "Item B19 age_max_months=8");
  assert(b19Item.eligibility_rule?.legal_scope === "nacional", "Item B19 legal_scope=nacional");
  assert(b19Item.operational_window_rule?.type === "age", "Item B19 window type age");
  assert(b19Item.operational_window_rule?.anchor === "birth", "Item B19 anchor birth");
  assert(b19Item.operational_window_rule?.hard_window === true, "Item B19 hard_window=true");
  assert(b19Item.requires_mv_responsavel === true, "Item B19 requires_mv_responsavel=true");
}

if (aftosaItem) {
  assert(aftosaItem.item_status === "bloqueado", "Item aftosa bloqueado");
  assert(aftosaItem.action_type === "alerta", "Item aftosa alerta");
  assert(aftosaItem.product_requirement_kind === "none", "Item aftosa none");
  assert(aftosaItem.product_id === null, "Item aftosa product_id null");
  assert(aftosaItem.product_class === null, "Item aftosa product_class null");
  assert(aftosaItem.snapshot_template?.metadata?.archived === true, "Item aftosa snapshot archived=true");
}

const rejectionBlocks = jsonBlocks(markdown.rejections, files.rejections);
const rejectedItems = rejectionBlocks.find(Array.isArray) ?? [];
const memberRejection = rejectionBlocks.find((block) => block?.reason === "PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER");
assert(rejectedItems.length === 6, "6 itens rejeitados presentes");
for (const itemKey of expectedRejectedItems) {
  const rejected = rejectedItems.find((entry) => entry.item_key === itemKey);
  assert(rejected?.reason === "PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM", `Rejeicao item ${itemKey} com reason correto`);
  assert(!adaptedItems.some((item) => item.item === itemKey), `Item rejeitado ${itemKey} nao aparece como adaptado`);
}
assert(memberRejection?.blocked_member_count === 16, "16 ProductClassGroup members bloqueados");

const groupsArtifact = jsonBlocks(markdown.groups, files.groups)[0];
const groups = groupsArtifact?.rows ?? [];
assert(groups.length === 4, "4 ProductClassGroups adaptados presentes");
for (const groupKey of expectedGroups) {
  const group = groups.find((entry) => entry.group_key === groupKey);
  assert(Boolean(group), `Grupo obrigatorio ${groupKey} presente`);
  if (group) {
    assert(group.scope === "global", `Grupo ${groupKey} scope=global`);
    assert(group.fazenda_id === null, `Grupo ${groupKey} fazenda_id=null`);
    assert(group.requires_mv_for_other_class === true, `Grupo ${groupKey} requires_mv_for_other_class=true`);
    assert(Array.isArray(group.limitations), `Grupo ${groupKey} limitations array`);
    assert(Boolean(group.curation_status), `Grupo ${groupKey} curation_status preenchido`);
    assert(Boolean(group.automation_status), `Grupo ${groupKey} automation_status preenchido`);
    assert(group.metadata?.agenda_allowed === false, `Grupo ${groupKey} agenda_allowed=false`);
    assert(group.metadata?.approved_for_catalog === false, `Grupo ${groupKey} approved_for_catalog=false`);
  }
}

assert(!/"class_id"\s*:\s*"/.test(markdown.groups), "Nenhum class_id inventado em ProductClassGroup members");
assert(!/"group_id"\s*:\s*"/.test(markdown.groups), "Nenhum group_id inventado em ProductClassGroup members");
assert(
  ["ivermectina", "albendazol", "levamisol", "reserved_candidate"].every((token) => markdown.groups.includes(token)),
  "Principios ativos permanecem como metadata/documentacao candidata",
);

assert(markdown.sourceRefs.includes("source_refs_snapshot"), "SourceRefs destinados a source_refs_snapshot");
assert(markdown.sourceRefs.includes("source_refs_by_field"), "SourceRefs destinados a source_refs_by_field");
assert(markdown.sourceRefs.includes("snapshot_template.sourceGaps"), "SourceGaps destinados a snapshot_template/limitations/metadata");
assert(markdown.sourceRefs.includes("snapshot_template.sourcePolicy"), "SourcePolicy destinada a snapshot_template/metadata");
assert(markdown.sourceRefs.includes("metadata.rotationRule") || markdown.sourceRefs.includes("snapshot_template.rotationRule"), "RotationRule destinado a JSONB");
assert(!markdown.sourceRefs.includes("CREATE TABLE sanitario_rotation_rules_v2"), "Nenhuma tabela rotation rules criada");
assert(!markdown.sourceRefs.includes("CREATE TABLE sanitario_source_refs_field_level_v2"), "Nenhuma tabela source refs criada");

const sanitaryDoc = read("docs/domain/SANITARIO.md");
for (const invariant of [
  "Agenda é intenção/tarefa futura",
  "Evento é fato executado",
  "Protocolo é regra/configuração",
  "Carência ativa nasce somente de evento executado",
  "ProductClassGroup não valida execução sozinho",
  "Bubalino não herda autorização de bovino",
]) {
  assert(sanitaryDoc.includes(invariant), `Invariante sanitario documentado: ${invariant}`);
}

const changedFiles = process.env.SKIP_GIT_CHECKS === "1"
  ? []
  : (() => {
      try {
        return execSync("git diff --name-only --cached && git diff --name-only", { encoding: "utf8" })
          .split(/\r?\n/)
          .filter(Boolean);
      } catch {
        add("warning", "Nao foi possivel consultar git diff para checar migrations.");
        return [];
      }
    })();

for (const file of changedFiles) {
  assert(!/^supabase\/migrations\//.test(file.replaceAll("\\", "/")), `Nenhuma migration alterada: ${file}`);
}

warn(itemBlocks.filter((block) => block?.logical_item_key).length >= 13, "12F4 documenta exemplos JSON completos para todos os 13 itens adaptaveis");

console.log("12F5 sanitario adapter validation");
console.log(`PASS: ${result.pass.length}`);
for (const message of result.pass) console.log(`PASS ${message}`);
console.log(`WARNING: ${result.warning.length}`);
for (const message of result.warning) console.log(`WARNING ${message}`);
console.log(`FAIL: ${result.fail.length}`);
for (const message of result.fail) console.log(`FAIL ${message}`);

if (result.fail.length > 0) {
  process.exitCode = 1;
}
