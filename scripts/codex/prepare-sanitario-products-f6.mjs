import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { CANONICAL_ARTIFACT_VERSION, validateCanonicalTechnicalContract } from "./sanitario-v2-contract.mjs";
const stableStringify = (value) => Array.isArray(value) ? `[${value.map(stableStringify).join(",")}]` :
  value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}` : JSON.stringify(value);
const reviewDigest = (packet) => {
  const { content_sha256, ...content } = packet;
  return sha256(stableStringify(content));
};

const [candidatePath, decisionPath, outputPath = "docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json",
  matrixPath = "docs/review/evidence/SANITARIO_V2_F6_DECISION_MATRIX.csv"] = process.argv.slice(2);
assert(candidatePath && decisionPath, "Usage: node scripts/codex/prepare-sanitario-products-f6.mjs <candidate-json> <decision-csv> [payload-json] [matrix-csv]");

const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const candidateBytes = readFileSync(candidatePath);
const decisionBytes = readFileSync(decisionPath);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const csvText = decisionBytes.toString("utf8").replace(/^\uFEFF/, "");

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ";") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("DECISION_CSV_UNCLOSED_QUOTE");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...records] = rows;
  assert(headers?.length > 1, "DECISION_CSV_HEADER_REQUIRED");
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

assert(candidate.artifact === "rebanhosync_commercial_products_research_candidate_f5", "F5_CANDIDATE_ARTIFACT_REQUIRED");
assert(candidate.execute_import === false && candidate.import_gate?.remote_write_authorized === false,
  "F5_REVIEW_ONLY_GATE_REQUIRED");
assert(candidate.product_rows.length === 39 && candidate.held.length === 3, "F5_EXPECTED_39_SELECTED_AND_3_HELD");

const decisions = parseSemicolonCsv(csvText);
assert(decisions.length === 42, "F5_DECISION_CSV_EXPECTED_42_ROWS");
const decisionByCode = new Map(decisions.map((row) => [row.codigo_lote, row]));
assert(decisionByCode.size === 42 && !decisionByCode.has(undefined), "F5_DECISION_CODES_MUST_BE_UNIQUE");
const selectedCodes = new Set(candidate.product_rows.map((row) => row.metadata.research_lot_code));
const heldCodes = new Set(candidate.held.map((row) => row.codigo_lote));
assert(selectedCodes.size === 39 && heldCodes.size === 3, "F5_PRODUCT_CODES_MUST_BE_UNIQUE");
assert([...selectedCodes].every((code) => decisionByCode.get(code)?.estado_lote === "REVISAO_COMERCIAL"),
  "F5_SELECTED_CSV_STATUS_MISMATCH");
assert([...heldCodes].every((code) => decisionByCode.get(code)?.estado_lote === "RETIDO"), "F5_HELD_CSV_STATUS_MISMATCH");
assert([...selectedCodes].every((code) => !heldCodes.has(code)), "F5_HELD_PRODUCT_SELECTED");
assert(decisions.every((row) => selectedCodes.has(row.codigo_lote) || heldCodes.has(row.codigo_lote)),
  "F5_DECISION_CSV_UNMATCHED_ROW");

const csvHeader = new Set(Object.keys(decisions[0] ?? {}));
for (const field of ["codigo_lote", "product_key", "id_proposto", "nome_comercial", "fabricante_proposto",
  "tipo_produto", "classe_armazenamento_proposta", "estado_lote", "registro_mapa", "fonte_url"]) {
  assert(csvHeader.has(field), `F5_DECISION_CSV_FIELD_REQUIRED:${field}`);
}
for (const product of candidate.product_rows) {
  const row = decisionByCode.get(product.metadata.research_lot_code);
  assert(row.product_key === product.product_key && row.id_proposto === product.id && row.nome_comercial === product.nome_comercial &&
    row.fabricante_proposto === product.fabricante && row.tipo_produto === product.tipo_produto &&
    row.classe_armazenamento_proposta === product.classe && row.fonte_url === product.metadata.source_url &&
    row.registro_mapa === "NAO_VERIFICADO",
  `F5_SOURCE_MISMATCH:${product.metadata.research_lot_code}`);
}
for (const held of candidate.held) {
  const row = decisionByCode.get(held.codigo_lote);
  assert(row.nome_comercial === held.nome_comercial && row.estado_lote === "RETIDO", `F5_HELD_SOURCE_MISMATCH:${held.codigo_lote}`);
}

const collections = [
  "source_rows", "coverage_rows", "product_rows", "product_authorization_rows", "product_source_rows",
  "dose_rule_rows", "withdrawal_rule_rows", "withdrawal_source_rows", "product_class_rows",
  "product_class_group_rows", "product_class_group_member_rows", "product_class_default_rule_rows",
  "protocol_rows", "protocol_item_rows",
];
const payload = {
  artifact: "sanitario_commercial_products_v2_review_candidates",
  artifact_version: CANONICAL_ARTIFACT_VERSION,
  identity_model: "VERSIONED_EXPLICIT_UUID",
  source_artifacts: {
    candidate_json: { filename: "rebanhosync_f5_produtos_candidatos_review_only_2026-10-23.json", sha256: sha256(candidateBytes) },
    decision_csv: { filename: "rebanhosync_f5_decisao_pre_importacao_2026-10-23.csv", sha256: sha256(decisionBytes) },
  },
  execute_import: false,
  approved: false,
  review_only: true,
  import_gate: {
    import_real_authorized: false,
    authorization_reference: null,
    regulatory_confirmed: false,
    remote_write_authorized: false,
  },
  counts: { products: candidate.product_rows.length, held: candidate.held.length, decisions: decisions.length },
  held: candidate.held,
  payload: Object.fromEntries(collections.map((collection) => [
    collection,
    collection === "product_rows" ? candidate.product_rows : [],
  ])),
};
payload.content_sha256 = reviewDigest(payload);
validateCanonicalTechnicalContract(payload);

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[;\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const matrixHeaders = ["codigo_lote", "id", "product_key", "nome_comercial", "fabricante", "estado_f5", "decisao_f6", "status_registro", "url_evidencia", "motivo_retencao"];
const matrixRows = decisions.map((row) => {
  const selected = selectedCodes.has(row.codigo_lote);
  const held = candidate.held.find((entry) => entry.codigo_lote === row.codigo_lote);
  return [row.codigo_lote, row.id_proposto, row.product_key, row.nome_comercial, row.fabricante_proposto,
    row.estado_lote, selected ? "INCLUIR_REVIEW_ONLY" : "MANTER_RETIDO", row.registro_mapa,
    row.fonte_url, held?.motivo ?? ""];
});
const matrix = [matrixHeaders, ...matrixRows].map((row) => row.map(csvEscape).join(";")).join("\n") + "\n";
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(matrixPath, matrix);
console.log(JSON.stringify({
  payload: outputPath,
  matrix: matrixPath,
  artifact: payload.artifact,
  artifact_version: payload.artifact_version,
  content_sha256: payload.content_sha256,
  products: candidate.product_rows.length,
  held: candidate.held.length,
  decisions: decisions.length,
  execute_import: payload.execute_import,
  import_real_authorized: payload.import_gate.import_real_authorized,
}));
