// Local evidence harness. Uses the canonical validator/planner, never its writer.
// SQL transport is simulated; this does not certify PostgreSQL, RLS or remote state.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { validateCanonicalTechnicalContract } from "../../../scripts/codex/sanitario-v2-contract.mjs";
import { buildPlan, assertPublishablePlan, assertConvergedPlan } from "../../../scripts/codex/import-sanitario-protocols-v2.mjs";

const packetUrl = new URL("SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json", import.meta.url);
const packet = JSON.parse(readFileSync(packetUrl, "utf8"));
const { data } = validateCanonicalTechnicalContract(packet);
assert.equal(packet.execute_import, false);
assert.equal(packet.review_only, true);
assert.equal(packet.import_gate.remote_write_authorized, false);
assert.equal(packet.import_gate.import_real_authorized, false);
const pilot = data.product_rows[0];
assert.equal(pilot.id, "7fc44e31-3373-50de-97fd-58e874938938");
assert.equal(pilot.status_curatorial, "precisa_validar");
for (const key of ["approved_for_catalog", "operational_authorization", "allows_agenda_auto", "automatic_product_selection_authorized"]) {
  assert.equal(pilot.metadata[key], false);
}
assert.equal(data.protocol_rows.length + data.protocol_item_rows.length, 0);
assert.ok(data.dose_rule_rows.every(r => r.status_curatorial === "precisa_validar"));
assert.ok(data.withdrawal_rule_rows.every(r => r.status_curatorial === "precisa_validar"));
assert.ok(data.product_authorization_rows.every(r => r.authorization_status === "PRECISA_VALIDAR"));

// Baseline is an explicit historical fixture, not a current database snapshot.
const historical = JSON.parse(execFileSync("git", ["show", "6f1b8dcec93254d60be73757a6515193240e208c:docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json"], { encoding: "utf8" }));
const original = historical.payload.product_rows.find(r => r.id === pilot.id);
assert.ok(original);
const { product_key: ignored, ...physicalOriginal } = original;
const baseline = { sanitario_produtos_v2: [physicalOriginal] };
const compositeKeys = {
  sanitario_produto_fontes_v2: ["product_id", "source_id", "field_key"],
  sanitario_produto_carencia_fontes_v2: ["withdrawal_rule_id", "source_id", "field_key"],
};

class ReadOnlyMemoryClient {
  constructor(rows) { this.rows = structuredClone(rows); this.selects = 0; }
  async query(sql, values) {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase();
    assert.match(text, /^select \* from public\./);
    assert.ok(!text.includes(" for update"));
    this.selects++;
    const table = /public\.(\w+)/.exec(text)[1];
    const predicates = [...text.matchAll(/(lower\(\w+\)|coalesce\(\w+, '[^']*'\)|\w+) is not distinct from \$(\d+)/g)];
    assert.ok(predicates.length > 0);
    const rows = (this.rows[table] ?? []).filter(row =>
      (text.includes(" or id = ") && row.id === values.at(-1)) || predicates.every(([, expression, position]) => {
        const field = expression.match(/\w+/g)[expression.includes("(") ? 1 : 0];
        let value = row[field] ?? null;
        if (expression.startsWith("lower(")) value = value?.toLowerCase();
        if (expression.startsWith("coalesce(")) value ??= /'([^']*)'/.exec(expression)[1];
        return value === values[Number(position) - 1];
      }));
    return { rows: structuredClone(rows) };
  }
}

const summarize = plan => plan.reduce((out, op) => ({ ...out, [op.action]: (out[op.action] ?? 0) + 1 }), {});
const firstClient = new ReadOnlyMemoryClient(baseline);
const first = await buildPlan(firstClient, data);
assertPublishablePlan(first);
assert.deepEqual(summarize(first), { create: 19, update: 1 });
assert.deepEqual(firstClient.rows, baseline); // planner did not write even to fixture

// Projection only: copy planned rows into a second fixture to check convergence.
const projected = structuredClone(baseline);
for (const op of first) {
  assert.ok(["create", "update"].includes(op.action));
  const keys = compositeKeys[op.table] ?? ["id"];
  const rows = projected[op.table] ??= [];
  const index = rows.findIndex(row => keys.every(key => row[key] === op.row[key]));
  if (index < 0) rows.push(structuredClone(op.row));
  else rows[index] = { ...rows[index], ...structuredClone(op.row) };
}
const replayClient = new ReadOnlyMemoryClient(projected);
const replay = await buildPlan(replayClient, data);
assertConvergedPlan(replay);
assert.deepEqual(summarize(replay), { skip: 20 });

const curated = structuredClone(baseline);
curated.sanitario_produtos_v2[0].status_curatorial = "ativo";
const protectedPlan = await buildPlan(new ReadOnlyMemoryClient(curated), data);
assert.ok(protectedPlan.some(op => op.reason === "technical_row_already_curated"));
assert.throws(() => assertPublishablePlan(protectedPlan));

const otherIdentity = structuredClone(data);
otherIdentity.product_rows[0].registro_orgao = "MAPA";
otherIdentity.product_rows[0].registro_numero = "6709";
const identityPlan = await buildPlan(new ReadOnlyMemoryClient(baseline), otherIdentity);
assert.ok(identityPlan.some(op => op.reason === "CANONICAL_UUID_OTHER_IDENTITY"));
assert.throws(() => assertPublishablePlan(identityPlan));

const unsafeZero = structuredClone(packet);
unsafeZero.payload.withdrawal_rule_rows[0].applicability = "zero";
unsafeZero.payload.withdrawal_rule_rows[0].source_keys = [];
assert.throws(() => validateCanonicalTechnicalContract(unsafeZero), /carencia zero exige fonte forte/);

const result = {
  mode: "LOCAL_CANONICAL_PLANNER_SIMULATION",
  baseline: "historical F6 P11 fixture; other technical rows assumed absent only in simulation",
  limitations: ["No SQL engine, transaction, RLS, current remote snapshot, CAS or concurrency certified", "Not the publisher CLI --dry-run", "Pilot only; remaining 38 products mapped in inventory, not simulated"],
  candidate_sha256: createHash("sha256").update(readFileSync(packetUrl)).digest("hex"),
  canonical_validation: "passed",
  first_plan: summarize(first), replay_plan: summarize(replay),
  controls: { curated_product_rejected: true, registration_identity_change_rejected: true, unsourced_zero_rejected: true, pending_statuses_preserved: true },
  sql_selects_simulated: firstClient.selects + replayClient.selects,
  sql_writes: 0, remote_connections: 0,
  operations: first.map(({ table, key, action, reason }) => ({ table, key, action, reason })),
};
const resultUrl = new URL("SANITARIO_V2_C02_DRY_RUN_RESULT_20261026.json", import.meta.url);
writeFileSync(resultUrl, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result, operations: undefined, result_file: fileURLToPath(resultUrl) }, null, 2));
