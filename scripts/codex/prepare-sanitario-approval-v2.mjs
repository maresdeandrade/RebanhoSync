// Preparation only: no database, approval, operational flag or publication entrypoint.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { normalizeCanonicalData, validateCanonicalTechnicalContract } from "./sanitario-v2-contract.mjs";

export const CANONICAL_PATH = "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json";
export const DECISION_PATH = "docs/review/evidence/SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function buildApprovalCandidate(canonical, packet, canonicalBytes, packetBytes) {
  assert.equal(sha256(canonicalBytes), packet.source_canonical_sha256, "CANONICAL_HASH_MISMATCH");
  assert.equal(packet.schema_version, 3, "DECISION_SCHEMA_REQUIRED");
  assert.equal(packet.approvals_granted, 0, "PREPARATION_CANNOT_GRANT_APPROVAL");
  assert.equal(packet.execute_import, false, "PREPARATION_CANNOT_IMPORT");
  const data = structuredClone(normalizeCanonicalData(canonical));
  const allKeys = packet.decision_sets.flatMap((group) => group.item_keys).sort();
  assert.deepEqual(allKeys, data.protocol_item_rows.map((item) => item.logical_item_key).sort(), "EXACT_20_ITEM_COVERAGE_REQUIRED");
  assert.equal(packet.prepared_item_records.length, 14);
  assert.equal(packet.prepared_protocol_records.length, 8);
  for (const group of packet.decision_sets) {
    assert.equal(group.approval.status, "NOT_GRANTED");
    assert.equal(group.approval.actor_id, null);
    assert.equal(group.approval.approved_at, null);
    assert.equal(group.approval.decision_reference, null);
    if (group.catalog_review_request) assert.equal(group.catalog_review_request.approved_at, null);
  }
  const itemProposals = normalizeCanonicalData({ payload: {
    sanitario_protocolo_itens_versions_v2: { rows: packet.prepared_item_records.map((entry) => entry.record) },
  } }).protocol_item_rows;
  for (const entry of packet.prepared_protocol_records) {
    const index = data.protocol_rows.findIndex((row) => row.id === entry.expected_id);
    assert(index >= 0 && data.protocol_rows[index].version === entry.expected_version, "PROTOCOL_VERSION_CONFLICT");
    assert.equal(entry.record.id, entry.expected_id, "STABLE_PROTOCOL_ID_REQUIRED");
    assert.equal(entry.record.version, entry.expected_version + 1);
    assert.equal(entry.record.status, "draft");
    assert.equal(entry.record.approval_status, "draft");
    assert.equal(entry.record.metadata.agenda_allowed, false);
    assert.equal(entry.record.metadata.approved_for_catalog, false);
    data.protocol_rows[index] = structuredClone(entry.record);
    // Existing importer accepts only manual_only drafts. This is not activation.
    data.protocol_rows[index].metadata.automationStatus = "manual_only";
  }
  for (const entry of packet.prepared_item_records) {
    const index = data.protocol_item_rows.findIndex((row) => row.id === entry.expected_previous_id);
    assert(index >= 0 && data.protocol_item_rows[index].version === entry.expected_previous_version, "ITEM_VERSION_CONFLICT");
    const proposal = itemProposals.find((row) => row.id === entry.record.id);
    assert.equal(proposal.version, entry.expected_previous_version + 1);
    assert.equal(proposal.protocol_id, data.protocol_item_rows[index].protocol_id);
    assert.equal(proposal.status, "draft");
    assert.equal(proposal.allows_agenda_auto, false);
    assert.equal(proposal.snapshot_template.metadata.agenda_allowed, false);
    assert.equal(proposal.snapshot_template.metadata.approved_for_catalog, false);
    data.protocol_item_rows[index] = proposal;
  }
  for (const record of packet.retained_restricted_records) {
    const original = canonical.payload.sanitario_protocolo_itens_versions_v2.rows.find((row) => row.id === record.id);
    assert.deepEqual(record, original, "RESTRICTED_ITEM_CHANGED");
  }
  for (const dossier of packet.commercial_dossiers.filter((entry) => entry.selected_for_proposal)) {
    assert.equal(dossier.replaces_legacy_generic_product, false);
    assert.equal(dossier.automatic_product_selection_authorized, false);
    assert(!data.product_rows.some((row) => row.id === dossier.product_id_proposal), "COMMERCIAL_ID_COLLISION");
    data.product_rows.push({
      id: dossier.product_id_proposal, product_key: dossier.product_key,
      nome_comercial: dossier.nome_comercial, fabricante: dossier.fabricante,
      registro_orgao: "MAPA", registro_numero: dossier.registration.number,
      classe: "vacina", tipo_produto: "vacina", apresentacao: JSON.stringify(dossier.presentation),
      status_curatorial: "precisa_validar", metadata: {
        review_only: true, registration_current_validity: "unknown",
        source_url: dossier.source_url, pending_fields: dossier.pending_fields,
        presentation_evidence: dossier.presentation.source,
        registration_evidence: dossier.registration.source,
      },
    });
  }
  const candidate = { ...structuredClone(canonical), canonical_representation: "payload.*_rows",
    payload: data, review_only: true,
    review_provenance: { canonical_sha256: sha256(canonicalBytes), decisions_sha256: sha256(packetBytes) },
    publication_readiness: packet.publication_readiness,
    import_gate: { ...canonical.import_gate, import_real_authorized: false },
  };
  delete candidate.payload.memberRejections;
  validateCanonicalTechnicalContract(candidate);
  return candidate;
}

export function buildApprovalForm(candidate, packet) {
  return {
    artifact: "sanitario_v2_pending_catalog_review_form", schema_version: 2,
    candidate_sha256: sha256(JSON.stringify(candidate, null, 2) + "\n"),
    decisions_sha256: candidate.review_provenance.decisions_sha256,
    operational_authorization: false,
    responsibility_model: structuredClone(packet.responsibility_model),
    decisions: packet.decision_sets.filter((group) => group.catalog_review_request).map((group) => ({
      id: group.id, scope: group.scope, submission_status: group.submission_status,
      versions: packet.prepared_item_records.filter((entry) => entry.decision_set === group.id).map((entry) => ({
        protocol_id: entry.record.protocol_id, item_id: entry.record.id,
        protocol_version: packet.prepared_protocol_records.find((protocol) => protocol.record.id === entry.record.protocol_id).record.version,
        logical_item_key: entry.record.logical_item_key, version: entry.record.version,
        expected_previous_id: entry.expected_previous_id, expected_previous_version: entry.expected_previous_version,
      })),
      required_before_catalog_decision: group.unresolved_inputs,
      conditions: group.operational_conditions,
      catalog_review: structuredClone(group.catalog_review_request),
      farm_activation: structuredClone(group.farm_activation_requirements),
      execution_compliance: structuredClone(group.execution_compliance),
    })),
  };
}

function main() {
  const args = process.argv.slice(2);
  assert(args.length === 1 && args[0] === "--validate" || args.length === 2 && ["--out", "--approval-form"].includes(args[0]),
    "Uso: node scripts/codex/prepare-sanitario-approval-v2.mjs --validate | --out <novo-arquivo.json> | --approval-form <novo-formulario.json>");
  const canonicalBytes = readFileSync(CANONICAL_PATH);
  const packetBytes = readFileSync(DECISION_PATH);
  const packet = JSON.parse(packetBytes);
  const candidate = buildApprovalCandidate(JSON.parse(canonicalBytes), packet, canonicalBytes, packetBytes);
  const bytes = JSON.stringify(candidate, null, 2) + "\n";
  if (args[0] === "--out") writeFileSync(args[1], bytes, { flag: "wx" });
  if (args[0] === "--approval-form") writeFileSync(args[1], JSON.stringify(buildApprovalForm(candidate, packet), null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ result: "REVIEW_CANDIDATE_VALID", sha256: sha256(bytes),
    ...candidate.publication_readiness, protocols: 10, items: 20,
    commercial_drafts: 3, signed_approvals: 0, operational_auto_permissions: 0 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
