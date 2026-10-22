// Derived publication packet only. The canonical publisher remains the sole writer.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CANONICAL_ARTIFACT_VERSION, validateCanonicalTechnicalContract } from "./sanitario-v2-contract.mjs";

export const CLASS_DELTA_PATH = "docs/review/evidence/SANITARIO_V2_R04B2_CANONICAL_DELTA_20261021.json";
const paths = {
  canonical: "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json",
  previews: "docs/review/evidence/SANITARIO_V2_R04B_CLASS_PREVIEWS_20261021.json",
  baseline: "docs/review/evidence/SANITARIO_V2_R04B_CLASS_REMOTE_FINAL_20261020.json",
  technical: "docs/review/evidence/SANITARIO_V2_R04B_BASELINE_20261020.json",
  migration: "supabase/migrations/20261020232807_sanitario_class_scheme_planning_v2.sql",
  publisher: "scripts/codex/import-sanitario-protocols-v2.mjs",
  preparer: "scripts/codex/prepare-sanitario-class-delta-v2.mjs",
  contract: "scripts/codex/sanitario-v2-contract.mjs",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(",")}]` :
  value && typeof value === "object" ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}` : JSON.stringify(value);
export const classDeltaDigest = (packet) => sha(stable({ payload: packet.payload, baseline: packet.baseline,
  protected: packet.protected, inputs: packet.inputs }));

export function prepareClassDelta(canonical, previews, baseline, technical, inputs) {
  const original = validateCanonicalTechnicalContract(canonical).data;
  const candidates = previews.decisions.filter(d => d.proposed_item);
  assert.equal(candidates.length, 5);
  assert.equal(previews.approved, false);
  const classes = previews.class_review_proposals.map(proposal => {
    const row = original.product_class_rows.find(c => c.id === proposal.id);
    assert(row && row.curation_status === proposal.expected_curation_status);
    return { ...row, curation_status: proposal.proposed_curation_status };
  });
  const sourceIds = new Set(previews.source_rows_reused.map(s => s.id));
  const products = original.product_rows.filter(p => previews.product_source_rows_proposed.some(l => l.product_id === p.id));
  const protocols = baseline.protocols.filter(p => candidates.some(d => d.protocol_id === p.id))
    .map(p => ({ ...p, protocol_key: p.family_code }));
  const payload = Object.fromEntries(Object.keys(original).filter(k => k !== "memberRejections").map(k => [k, []]));
  Object.assign(payload, {
    source_rows: technical.technical_sources.sources.filter(s => sourceIds.has(s.id)),
    product_rows: products,
    product_class_rows: classes,
    protocol_rows: protocols,
    coverage_rows: previews.coverage_rows_proposed,
    product_source_rows: previews.product_source_rows_proposed.map(link => ({
      product_id: link.product_id, source_id: link.source_id, field_key: link.field_key,
      product_key: products.find(p => p.id === link.product_id).product_key,
      source_key: previews.source_rows_reused.find(s => s.id === link.source_id).source_key,
    })),
    protocol_item_rows: candidates.map(d => ({ ...d.proposed_item,
      protocol_key: protocols.find(p => p.id === d.protocol_id).protocol_key,
      class_key: d.proposed_item.product_class,
    })),
  });
  const packet = {
    artifact: "sanitario_protocols_v2_incremental_delta", artifact_version: CANONICAL_ARTIFACT_VERSION,
    identity_model: "VERSIONED_EXPLICIT_UUID", project_ref: previews.project_ref,
    execute_import: false, approved: false,
    import_gate: { import_real_authorized: false, authorization_reference: null },
    inputs, payload,
    baseline: {
      source_rows: payload.source_rows,
      product_rows: products,
      protocol_rows: protocols,
      product_class_rows: classes.map(c => original.product_class_rows.find(r => r.id === c.id)),
      predecessors: candidates.map(d => baseline.items.find(i => i.id === d.current_item_id)),
    },
    protected: {
      approved_item_ids: baseline.items.filter(i => i.status === "active" && i.allows_agenda_auto).map(i => i.id).sort(),
      r05_farm_id: "2d8a30d9-bd9c-41b4-a71d-93d2d293058f",
      r05_agenda_ids: baseline.agendas.map(a => a.id).sort(),
    },
  };
  assert.equal(packet.protected.approved_item_ids.length, 7);
  assert.equal(packet.protected.r05_agenda_ids.length, 7);
  validateCanonicalTechnicalContract(packet);
  packet.content_sha256 = classDeltaDigest(packet);
  return packet;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputs = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, { path: file, sha256: sha(readFileSync(file)) }]));
  const json = key => JSON.parse(readFileSync(paths[key], "utf8"));
  const packet = prepareClassDelta(json("canonical"), json("previews"), json("baseline"), json("technical"), inputs);
  writeFileSync(CLASS_DELTA_PATH, JSON.stringify(packet, null, 2) + "\n");
  console.log(JSON.stringify({ file: CLASS_DELTA_PATH, content_sha256: packet.content_sha256,
    protocol_items: packet.payload.protocol_item_rows.length, coverage: packet.payload.coverage_rows.length,
    classes: packet.payload.product_class_rows.length, product_links: packet.payload.product_source_rows.length,
    source_protocol_product_writes: 0, approved: false }));
}
