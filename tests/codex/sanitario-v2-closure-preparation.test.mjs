import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { prepareClosureCandidates, prepareClosureDelta, prepareClosureBootstrap, BASELINE_PATH, CANDIDATE_PATH, ELIGIBLE_DELTA_PATH, BOOTSTRAP_PATH, BOOTSTRAP_VERSION } from "../../scripts/codex/prepare-sanitario-closure-v2.mjs";
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).catalog;
const prepared = JSON.parse(readFileSync(CANDIDATE_PATH, "utf8"));
test("candidate replay preserves prospective identities, approved scopes and blocked Leptoferm D2", () => {
  const before = structuredClone(baseline);
  const packet = prepareClosureCandidates(baseline, prepared.identities);
  assert.deepEqual(packet, prepared);
  assert.deepEqual(baseline, before);
  assert(packet.payload.protocol_item_rows.every(i => i.status === "draft" && !i.allows_agenda_auto));
  const oldApproved = baseline.items.filter(i => i.status === "active");
  assert.equal(oldApproved.length, 7);
  assert(!packet.payload.protocol_item_rows.some(i => oldApproved.some(old => old.id === i.id || old.logical_item_key === i.logical_item_key)));
  assert(!packet.payload.protocol_item_rows.some(i => i.logical_item_key === "lepto_primovac_dose2"));
  assert(!packet.payload.protocol_rows.some(p => p.family_code === "febre_aftosa"));
});
test("variants retain specific intervals and unknown withdrawal without inventing product identity", () => {
  assert.equal(prepared.payload.protocol_rows.length, 3);
  assert.equal(prepared.payload.product_rows.length, 0);
  assert.equal(prepared.label_facts_for_review_only.lepto8.dose_ml, 3);
  assert(prepared.payload.protocol_item_rows.filter(i => i.logical_item_key.startsWith("raiva_")).every(i =>
    i.limitations.includes("no_agenda_auto") && i.booster_rule.tolerance.days === 0 && i.snapshot_template.metadata.catalog_review_scope === "manual_planning"));
  const d2 = prepared.payload.protocol_item_rows.find(i => i.logical_item_key === "ibr_bvd_cattlemaster_gold_primovac_dose2");
  assert.deepEqual([d2.operational_window_rule.min_offset_days, d2.operational_window_rule.max_offset_days], [21, 21]);
  assert.equal(d2.item_status, "bloqueado");
  assert(prepared.payload.protocol_item_rows.filter(i => i.logical_item_key.startsWith("lepto_bovigen8")).every(i => i.item_status === "bloqueado"));
});
test("canonical public review path accepts this exact packet and categorically refuses apply", () => {
  const command = ["scripts/codex/import-sanitario-protocols-v2.mjs", "--review-candidate", CANDIDATE_PATH];
  assert.match(execFileSync(process.execPath, [...command, "--validate"], { encoding: "utf8", windowsHide: true }), /12G validate OK/);
  const apply = spawnSync(process.execPath, [...command, "--apply"], { encoding: "utf8", windowsHide: true });
  assert.notEqual(apply.status, 0);
  assert.match(apply.stderr, /REVIEW_CANDIDATE_CANNOT_APPLY/);
});
test("eligible delta uses the same incremental route, isolates incomplete variants and refuses unauthorized apply", () => {
  const delta = JSON.parse(readFileSync(ELIGIBLE_DELTA_PATH, "utf8"));
  const preservation = JSON.parse(readFileSync(delta.inputs.preservation.path, "utf8"));
  assert.deepEqual(delta, prepareClosureDelta(baseline, prepared, preservation, delta.inputs));
  assert.equal(delta.payload.protocol_item_rows.length, 7);
  assert.equal(delta.payload.coverage_rows.length, 12);
  assert.equal(delta.payload.product_rows.length, 0);
  assert(delta.payload.protocol_item_rows.every(i => !/cattlemaster|lepto_bovigen8/.test(i.logical_item_key)));
  assert.deepEqual(delta.payload.product_class_rows.map(c => [c.class_key, c.curation_status]).sort(),
    [["vacina_ibr_bvd", "approved_for_catalog"], ["vacina_raiva_herbivoros", "needs_review"]]);
  const changed = structuredClone(prepared); changed.payload.protocol_item_rows[0].allows_agenda_auto = true;
  assert.throws(() => prepareClosureDelta(baseline, changed, preservation, delta.inputs), /CLOSURE_CANDIDATE_CHANGED/);
  const command = ["scripts/codex/import-sanitario-protocols-v2.mjs", "--incremental", ELIGIBLE_DELTA_PATH];
  assert.match(execFileSync(process.execPath, [...command, "--validate"], { encoding: "utf8", windowsHide: true }), /"protocol_items":7/);
  const apply = spawnSync(process.execPath, [...command, "--apply"], { encoding: "utf8", windowsHide: true });
  assert.notEqual(apply.status, 0); assert.match(apply.stderr, /IMPORT_REAL_NOT_AUTHORIZED/);
});
test("versioned initial bootstrap binds exactly four groups without claiming interactive review", () => {
  const delta = JSON.parse(readFileSync(ELIGIBLE_DELTA_PATH, "utf8"));
  const plan = JSON.parse(readFileSync(BOOTSTRAP_PATH, "utf8"));
  assert.equal(plan.version, BOOTSTRAP_VERSION, "Persisted bootstrap manifest must match the declared deployment version");
  assert.deepEqual(plan, prepareClosureBootstrap(delta, baseline, plan.request_id));
  assert.equal(plan.groups.length, 4); assert.equal(plan.groups.flatMap(g => g.item_versions).length, 12);
  assert.equal(plan.interactive_review, false);
  assert(!plan.groups.flatMap(g => g.item_versions).some(i => /cattlemaster|lepto_bovigen8|lepto_primovac_dose2/.test(i.logical_item_key)));
  const command = ["scripts/codex/import-sanitario-protocols-v2.mjs", "--incremental", ELIGIBLE_DELTA_PATH, "--bootstrap-initial", BOOTSTRAP_PATH];
  assert.match(execFileSync(process.execPath, [...command, "--validate"], { encoding: "utf8", windowsHide: true }), /"bootstrap":"sanitario-initial-20261022-v1"/);
  const apply = spawnSync(process.execPath, [...command, "--apply"], { encoding: "utf8", windowsHide: true });
  assert.notEqual(apply.status, 0); assert.match(apply.stderr, /IMPORT_REAL_NOT_AUTHORIZED/);
});
