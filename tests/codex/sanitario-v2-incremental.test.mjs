import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { classDeltaDigest, prepareClassDelta } from "../../scripts/codex/prepare-sanitario-class-delta-v2.mjs";

const publisher = "scripts/codex/import-sanitario-protocols-v2.mjs";
const historical = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_R04B2_CANONICAL_DELTA_20261021.json", "utf8"));
// Test the current publisher without rewriting the certified historical packet.
const inputs = Object.fromEntries(Object.entries(historical.inputs).map(([key, input]) => [key,
  { ...input, sha256: createHash("sha256").update(readFileSync(input.path)).digest("hex") }]));
const inputJson = key => JSON.parse(readFileSync(inputs[key].path, "utf8"));
const current = prepareClassDelta(inputJson("canonical"), inputJson("previews"), inputJson("baseline"), inputJson("technical"), inputs);
assert.deepEqual(current.payload, historical.payload, "Test fingerprints cannot change the certified publication payload");
const delta = path.join(mkdtempSync(path.join(tmpdir(), "r04b2-current-publisher-")), "delta.json");
writeFileSync(delta, JSON.stringify(current));

describe("public incremental sanitary publisher", () => {
  it("validates only the five bounded class candidates through the canonical entrypoint", () => {
    const result = spawnSync(process.execPath, [publisher, "--validate", "--incremental", delta], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"protocol_items":5');
    expect(result.stdout).toContain('"coverage":8');
    expect(result.stdout).toContain('"product_links":2');
  });

  it("refuses apply before any connection without explicit artifact authorization", () => {
    const result = spawnSync(process.execPath, [publisher, "--apply", "--incremental", delta], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("IMPORT_REAL_NOT_AUTHORIZED");
    expect(result.stdout).not.toContain("database host=");
  });

  it("rejects connection options that could override the verified target", () => {
    const result = spawnSync(process.execPath, [publisher, "--dry-run", "--incremental", delta], {
      encoding: "utf8", env: { ...process.env, DB_URL: "postgresql://127.0.0.1:1/local?host=remote.invalid" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INCREMENTAL_DATABASE_OPTIONS_FORBIDDEN");
  });

  it("does not accept tampered candidate evidence even with a recomputed packet digest", () => {
    const packet = JSON.parse(readFileSync(delta, "utf8"));
    packet.payload.protocol_item_rows[0].source_refs_by_field.operational_window[0].title = "Different evidence";
    packet.content_sha256 = classDeltaDigest(packet);
    const file = path.join(mkdtempSync(path.join(tmpdir(), "r04b2-tamper-")), "delta.json");
    writeFileSync(file, JSON.stringify(packet));
    const result = spawnSync(process.execPath, [publisher, "--validate", "--incremental", file], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INCREMENTAL_PREPARATION_MISMATCH");
  });

  it("binds explicit import authorization to the exact content digest before connection", () => {
    const packet = JSON.parse(readFileSync(delta, "utf8"));
    packet.import_gate = { import_real_authorized: true, authorization_reference: "synthetic authorization test only" };
    const file = path.join(mkdtempSync(path.join(tmpdir(), "r04b2-authorize-")), "delta.json");
    writeFileSync(file, JSON.stringify(packet));
    const result = spawnSync(process.execPath, [publisher, "--apply", "--incremental", file], {
      encoding: "utf8", env: { ...process.env, SANITARIO_DELTA_CONFIRM: "different-digest", DB_URL: "postgresql://127.0.0.1:1/local" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INCREMENTAL_EXPLICIT_AUTHORIZATION_REQUIRED");
    expect(result.stdout).not.toContain("database host=");
  });

  it("rejects a remote database belonging to another project before connecting", () => {
    const result = spawnSync(process.execPath, [publisher, "--dry-run", "--incremental", delta], {
      encoding: "utf8", env: { ...process.env, DB_URL: "postgresql://db.other-project.supabase.co/postgres" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("INCREMENTAL_PROJECT_TARGET_MISMATCH");
  });
});
