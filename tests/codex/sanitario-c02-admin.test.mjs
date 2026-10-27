import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const candidate = "docs/review/evidence/SANITARIO_V2_C02_F6_REVIEW_CANDIDATE_20261026.json";
const ref = "zqloazqzhwauamcejmuz";
const publisherSource = readFileSync("scripts/codex/import-sanitario-protocols-v2.mjs", "utf8");
const transportHelpers = publisherSource.slice(publisherSource.indexOf("function c02SqlLiteral("),
  publisherSource.indexOf("\nasync function prepareC02McpSql("));
const { c02SqlLiteral, compileC02McpTransaction } = new Function(
  "assert", "createHash", "C02_ADMIN_PROJECT_REF", "C02_F6_SHA256", "IMPORT_LOCK_KEY", "c02Tables",
  transportHelpers + "; return {c02SqlLiteral,compileC02McpTransaction};")(
  assert, createHash, ref, "6270981bb7c2f8e22eb547c8512f788d8191e7015e912cf62d5abd2350351367", "test-lock", () => []);
const cli = (...args) => spawnSync(process.execPath,
  ["scripts/codex/import-sanitario-protocols-v2.mjs", ...args],
  { encoding: "utf8", env: { ...process.env, DB_URL: "must-not-connect", ALLOW_SANITARIO_IMPORT: "1", ALLOW_SANITARIO_REMOTE_IMPORT: "1" } });

describe("C02 authorized post-approval baseline", () => {
  const packet = JSON.parse(readFileSync(candidate, "utf8"));
  const observed = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_POST_APPROVAL_READONLY_20261027.json", "utf8"));
  const product = packet.payload.product_rows.find(p => p.metadata.research_lot_code === "P11");
  const current = observed.rows.sanitario_produtos_v2.find(p => p.id === product.id);
  const flags = publisherSource.slice(publisherSource.indexOf("const FORBIDDEN_TRUE_FLAGS ="),
    publisherSource.indexOf("\nconst UUID_LIKE"));
  const preserve = new Function("assert", "C02_F6_SHA256", "C02_ADMIN_PROJECT_REF", flags +
    publisherSource.slice(publisherSource.indexOf("async function preserveC02Baseline("),
      publisherSource.indexOf("\n// Reuse only equivalent global evidence.")) + ";return preserveC02Baseline;")(
    assert, createHash("sha256").update(readFileSync(candidate)).digest("hex"), ref);
  const replay = async (row, admin = true) => {
    const data = { product_rows: [structuredClone(product)] };
    await preserve({ query: async () => ({ rows: [structuredClone(row)] }) }, data,
      { scope: "F6", baseline: packet.baseline.product_rows, admin }, false);
    return data.product_rows[0];
  };
  it("preserves approved metadata and historical review provenance without changing the candidate", async () => {
    const before = JSON.stringify(product);
    const result = await replay(current);
    expect(result.status_curatorial).toBe("ativo");
    expect(result.metadata).toEqual(current.metadata);
    expect(result.metadata.approved_for_catalog).toBe(true);
    expect(result.metadata.review_only).toBe(true);
    expect(JSON.stringify(product)).toBe(before);
  });
  it.each(["operational_authorization", "allows_agenda_auto", "automatic_product_selection_authorized", "agenda_allowed"])(
    "rejects operational promotion through %s even on an approved registration", async flag => {
      const row = structuredClone(current);
      row.metadata[flag] = true;
      await expect(replay(row)).rejects.toThrow(/OPERATIONAL/);
    });
  it.each(["catalog_flag", "receipt", "identity", "provenance", "legacy_mode"])(
    "rejects an unexpected post-approval change: %s", async change => {
      const row = structuredClone(current);
      if (change === "catalog_flag") row.metadata.approved_for_catalog = false;
      if (change === "receipt") row.metadata.c02_cadastral_approval.project_ref = "other";
      if (change === "identity") row.registro_numero = "other";
      if (change === "provenance") row.metadata.review_only = false;
      await expect(replay(row, change !== "legacy_mode")).rejects.toThrow();
    });
  it("rejects a catalog flag on a pending product without approving it by inference", async () => {
    const row = structuredClone(current);
    row.status_curatorial = "precisa_validar";
    delete row.metadata.c02_cadastral_approval;
    await expect(replay(row)).rejects.toThrow(/CATALOG/);
  });
});

describe("C02 MCP transaction transport", () => {
  it("rechecks the materialized snapshot under the canonical lock and rolls back a local race before planning", async () => {
    const expected = { id: "product", metadata: { note: "original" } };
    let current = structuredClone(expected);
    const queries = [];
    const snapshot = { project_ref: ref, read_only: "on", isolation: "repeatable read",
      executor: "postgres", session_executor: "postgres", rows: { sanitario_produtos_v2: [expected] },
      contracts: Array.from({ length: 8 }, () => ({ owner: "postgres", rls: true,
        force_rls: false, select: true, insert: true, update: true })) };
    const engine = publisherSource.slice(publisherSource.indexOf("async function applyTransaction("),
      publisherSource.indexOf("\n// Reviewed bytes are the allowlist"));
    const preparation = publisherSource.slice(publisherSource.indexOf("async function prepareC02McpSql("),
      publisherSource.indexOf("\nasync function c02Main("));
    const prepare = new Function("assert", "readFileSync", "C02_ADMIN_PROJECT_REF", "IMPORT_LOCK_KEY",
      "c02Tables", "stableStringify", "isDifferent", "validateCanonicalTechnicalContract", "c02StateSql",
      "assertC02AdminAccess", "preserveC02Baseline",
      engine + preparation + ";return prepareC02McpSql;")(
      assert, () => JSON.stringify(snapshot), ref, "test-lock", () => ["sanitario_produtos_v2"],
      JSON.stringify, (a,b) => JSON.stringify(a) !== JSON.stringify(b), () => ({ data: {} }),
      () => "'unused'::jsonb", async () => {}, async () => { throw new Error("PLANNING_REACHED_AFTER_LOCAL_RACE"); });
    const db = { query: async sql => {
      queries.push(sql);
      if (sql === "select pg_advisory_xact_lock(hashtext($1))") current = { ...current, metadata: { note: "concurrent" } };
      return { rows: sql.startsWith("select to_jsonb") ? [{ row: current }] : [{ state: {} }] };
    } };
    await expect(prepare(db, JSON.stringify({ baseline: { product_rows: [] } }), "fixture", "must-not-be-written",
      { admin: true })).rejects.toThrow("C02_MCP_LOCAL_SNAPSHOT_MISMATCH");
    expect(queries.indexOf("select pg_advisory_xact_lock(hashtext($1))")).toBeLessThan(
      queries.findIndex(q => q.startsWith("select to_jsonb")));
    expect(queries.at(-1)).toBe("rollback");
  });
  const approve = new Function("assert", "C02_ADMIN_PROJECT_REF", "C02_F6_SHA256",
    publisherSource.slice(publisherSource.indexOf("async function approveC02Products("),
      publisherSource.indexOf("\nconst c02Tables")) + "; return approveC02Products;")(
    assert, ref, "6270981bb7c2f8e22eb547c8512f788d8191e7015e912cf62d5abd2350351367");
  it("rejects unexpected child rule states before issuing registration approval", async () => {
    let calls = 0;
    const db = { query: async () => { calls++; return { rows: [{ id: "unexpected-active-rule" }] }; } };
    await expect(approve(db, { product_rows: [{ id: "product" }] }, { admin: true, authorizationRef: "explicit-user-request" }))
      .rejects.toThrow("C02_APPROVAL_CHILD_RULE_STATE_CONFLICT");
    expect(calls).toBe(1);
  });
  it("approves only pending roots, with an audit receipt and without promoting child rules", async () => {
    const queries = [];
    const db = { query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [], rowCount: 1 };
    } };
    await approve(db, { product_rows: [{ id: "pending", status_curatorial: "precisa_validar" },
      { id: "already-approved", status_curatorial: "ativo" }] }, { admin: true, authorizationRef: "explicit-user-request" });
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain("authorization_status<>'PRECISA_VALIDAR'");
    expect(queries[1].sql).toContain("status_curatorial='precisa_validar'");
    expect(queries[1].sql).toContain("transaction_timestamp()");
    expect(queries[1].sql).toContain("'{approved_for_catalog}','true'::jsonb");
    expect(JSON.parse(queries[1].values[1])).toMatchObject({ scope: "product_registration_only", executor: "postgres" });
    expect(queries[1].values[0]).toBe("pending");
  });
  it("rejects a stale root update instead of reporting approval", async () => {
    const db = { query: async () => ({ rows: [], rowCount: 0 }) };
    await expect(approve(db, { product_rows: [{ id: "pending" }] }, { admin: true, authorizationRef: "explicit-user-request" }))
      .rejects.toThrow("C02_APPROVAL_CONCURRENT_STATE_CONFLICT");
  });
  it("encodes SQL data without interpolation of quotes, backslashes or parameter-like data", () => {
    expect(c02SqlLiteral("bula'; rollback; -- \\ $1")).toBe("'bula''; rollback; -- \\ $1'");
    expect(c02SqlLiteral(null)).toBe("NULL");
    expect(c02SqlLiteral(false)).toBe("FALSE");
    expect(c02SqlLiteral(1.25)).toBe("1.25");
    expect(() => c02SqlLiteral(NaN)).toThrow();
    expect(() => c02SqlLiteral("bad\u0000data")).toThrow();
  });
  it("rejects other projects and unreviewed candidates before compiling writes", () => {
    expect(() => compileC02McpTransaction({ projectRef: "other" })).toThrow("C02_ADMIN_PROJECT_REQUIRED");
    expect(() => compileC02McpTransaction({ projectRef: ref, candidateDigest: "changed" })).toThrow("C02_ADMIN_CANDIDATE_CHANGED");
  });
  it("does not open generic remote apply when only a confirmation flag is supplied", () => {
    const r = cli("--apply", "--c02-admin", candidate, "--project-ref", ref, "--confirm-c02", "6270981bb7c2f8e22eb547c8512f788d8191e7015e912cf62d5abd2350351367");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("C02_ADMIN_REMOTE_WRITE_DISABLED");
  });
});

describe("C02 administrative preparation", () => {
  it.each(["anon", "authenticated", "service_role"])("rejects an administrative session as %s before planning", async role => {
    const source = readFileSync("scripts/codex/import-sanitario-protocols-v2.mjs", "utf8");
    const helper = source.slice(source.indexOf("async function assertC02AdminAccess("), source.indexOf("\n// Approval is separate"));
    const guard = new Function("assert", "PUBLISHERS", `${helper}; return assertC02AdminAccess;`)(
      (condition, message) => { if (!condition) throw new Error(message); }, []);
    let queries = 0;
    const db = { query: async () => { queries++; return { rows: [{ executor: role, session_executor: role }] }; } };
    await expect(guard(db)).rejects.toThrow("C02_ADMIN_POSTGRES_SESSION_REQUIRED");
    expect(queries).toBe(1);
  });
  it("validates the F6 packet with an explicit project without opening a connection", () => {
    const r = cli("--validate", "--c02-admin", candidate, "--project-ref", ref);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("C02 ADMIN validate OK");
  });
  it("keeps remote apply disabled even with legacy import overrides", () => {
    const r = cli("--apply", "--c02-admin", candidate, "--project-ref", ref);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("C02_ADMIN_REMOTE_WRITE_DISABLED");
  });
  it.each([undefined, "abcdefghijklmnopqrst"])("rejects an absent or different project %s", target => {
    const args = ["--validate", "--c02-admin", candidate];
    if (target) args.push("--project-ref", target);
    const r = cli(...args);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("C02_ADMIN_PROJECT_REQUIRED");
  });
  it("rejects a noncanonical candidate on the administrative path", () => {
    const r = cli("--validate", "--c02-admin", "docs/review/evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json", "--project-ref", ref);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("C02_ADMIN_CANDIDATE_CHANGED");
  });
});
