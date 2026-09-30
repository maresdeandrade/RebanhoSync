import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { runInNewContext } from "node:vm";
import * as contract from "../../scripts/codex/sanitario-v2-contract.mjs";
import * as publicPublisher from "../../scripts/codex/import-sanitario-protocols-v2.mjs";
import {
  validateCanonicalTechnicalContract,
} from "../../scripts/codex/sanitario-v2-contract.mjs";
import {
  assertConvergedPlan,
  assertPublishablePlan,
  buildPlan,
  classInsertRow,
  coverageInsertRow,
  memberInsertRow,
  sourceInsertRow,
} from "../../scripts/codex/import-sanitario-protocols-v2.mjs";

const payloadUrl = new URL(
  "../../docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json", import.meta.url,
);
const publisherSource = readFileSync(new URL(
  "../../scripts/codex/import-sanitario-protocols-v2.mjs", import.meta.url,
), "utf8");
// Evaluate the unchanged private engine only inside this test sandbox. No runtime
// export, gate override, database driver or connection is introduced for testing.
const privateSource = publisherSource.slice(
  publisherSource.indexOf("const ROOT ="), publisherSource.indexOf("async function main()"),
).replace(/\bexport (?=(?:async )?function)/g, "");
const applyTransactionForTest = runInNewContext(`${privateSource}\napplyTransaction;`, {
  ...contract, process, path, existsSync, readFileSync, Date,
});
const applyImportForTest = runInNewContext(`${privateSource}\napplyImport;`, {
  ...contract, process, path, existsSync, readFileSync, Date,
});
const otherId = "00000000-0000-4000-8000-000000000001";
const farmA = "00000000-0000-4000-8000-000000000002";
const farmB = "00000000-0000-4000-8000-000000000003";
const tables = {
  source_rows: "sanitario_fontes_tecnicas_v2",
  coverage_rows: "sanitario_fonte_cobertura_campos_v2",
  product_class_rows: "sanitario_product_classes_v2",
  product_class_group_rows: "sanitario_product_class_groups_v2",
  product_class_group_member_rows: "sanitario_product_class_group_members_v2",
  protocol_rows: "sanitario_protocolos_v2",
  protocol_item_rows: "sanitario_protocolo_itens_versions_v2",
};
const expectedCounts = {
  source_rows: 14, coverage_rows: 66, product_class_rows: 8,
  product_class_group_rows: 4, product_class_group_member_rows: 12,
  protocol_rows: 10, protocol_item_rows: 20,
};

function fixture() {
  return validateCanonicalTechnicalContract(JSON.parse(readFileSync(payloadUrl, "utf8"))).data;
}

// A SQL transport double, not a PostgreSQL integration test. It exercises the real
// planner/writer and records SQL order, bindings and transaction outcomes without a connection.
class MemoryClient {
  constructor(rows = {}) {
    this.rows = structuredClone(rows);
    this.queries = [];
    this.beforeQuery = null;
    this.failInsert = null;
    this.zeroUpdate = false;
  }

  async query(sql, values = []) {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase();
    this.queries.push({ text, values: structuredClone(values) });
    this.beforeQuery?.(text, values, this);
    if (text === "begin") this.snapshot = structuredClone(this.rows);
    if (text === "rollback") this.rows = this.snapshot;
    if (text === "commit") this.committed = true;
    if (!/^(select \*|select id,|insert into|update public)/.test(text)) return { rows: [], rowCount: 0 };
    const table = /public\.(\w+)/.exec(text)[1];
    const rows = this.rows[table] ?? [];
    if (text.startsWith("select")) {
      let selected;
      if (text.includes(" is not distinct from ")) {
        const fields = [...text.matchAll(/(\w+) is not distinct from \$(\d+)/g)];
        selected = rows.filter((row) => row.id === values.at(-1) ||
          fields.every(([, field, position]) => (row[field] ?? null) === values[Number(position) - 1]));
      } else {
        selected = rows.filter((row) => !row.deleted_at && row.protocol_id === values[0] && row.logical_item_key === values[1]);
      }
      return { rows: structuredClone(selected), rowCount: selected.length };
    }
    if (text.startsWith("insert")) {
      if (this.failInsert === table) throw new Error("simulated insert failure");
      const fields = /\(([^)]+)\) values/.exec(text)[1].split(",").map((f) => f.trim());
      const row = Object.fromEntries(fields.map((field, index) => [field, decodeJson(values[index])]));
      if (rows.some((r) => r.id === row.id)) throw new Error("duplicate UUID");
      this.rows[table] = [...rows, row];
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
    if (this.zeroUpdate) return { rows: [], rowCount: 0 };
    const tombstone = text.includes("deleted_at = now()");
    const row = rows.find((r) => r.id === (tombstone ? values[0] : values.at(-1)) && !r.deleted_at);
    if (!row || (tombstone && row.status !== "draft")) return { rows: [], rowCount: 0 };
    if (tombstone) Object.assign(row, { deleted_at: "2026-09-30", status: "retired", allows_agenda_auto: false });
    else for (const [, field, position] of text.matchAll(/(\w+) = \$(\d+)/g)) {
      row[field] = decodeJson(values[Number(position) - 1]);
    }
    return { rows: [{ id: row.id }], rowCount: 1 };
  }
}

function decodeJson(value) {
  return typeof value === "string" && /^[\[{]/.test(value) ? JSON.parse(value) : value;
}

function findOperation(plan, collection, row) {
  return plan.find((op) => op.collection === collection && op.canonical_id === row.id);
}

async function seeded(data = fixture()) {
  const plan = await buildPlan(new MemoryClient(), data);
  const rows = {};
  for (const op of plan.filter((p) => p.collection)) (rows[op.table] ??= []).push(op.row);
  return new MemoryClient(rows);
}

describe("sanitario v2 publisher P1", () => {
  it("retains the canonical gate inside the private writer before any client effect", async () => {
    const client = new MemoryClient();
    await expect(applyImportForTest(client)).rejects.toThrow("PUBLISHER_INCOMPLETE");
    expect(client.queries).toEqual([]);
    expect(client.rows).toEqual({});
    expect(client.snapshot).toBeUndefined();
    expect(client.committed).toBeUndefined();
  });

  it("keeps the closed artifact gate authoritative despite caller authorization claims", async () => {
    const canonicalPayload = JSON.parse(readFileSync(payloadUrl, "utf8"));
    expect(canonicalPayload.import_gate.import_real_authorized).toBe(false);
    expect(publicPublisher.applyGateError(canonicalPayload, true)).toContain("IMPORT_REAL_NOT_AUTHORIZED");
    const client = new MemoryClient();
    await expect(applyImportForTest(client, {
      ...canonicalPayload, import_gate: { import_real_authorized: true },
      publisherComplete: true, authorized: true, skipGate: true, forceApply: true,
    })).rejects.toThrow("PUBLISHER_INCOMPLETE");
    expect(client.queries).toEqual([]);
    expect(client.rows).toEqual({});
    expect(client.snapshot).toBeUndefined();
    expect(client.committed).toBeUndefined();
  });

  it("exposes no alternative transaction writer or caller-controlled gate switch", () => {
    expect(Object.keys(publicPublisher).sort()).toEqual([
      "applyGateError", "assertApplyGate", "assertConvergedPlan", "assertPublishablePlan",
      "buildPlan", "classInsertRow", "coverageInsertRow", "itemInsertRow", "memberInsertRow", "sourceInsertRow",
    ].sort());
    const entrypoint = publisherSource.slice(
      publisherSource.indexOf("async function applyImport("),
      publisherSource.indexOf("async function applyTransaction("),
    );
    expect(entrypoint).toContain("applyImport(client)");
    expect(entrypoint.indexOf("readJsonPayload()")).toBeLessThan(entrypoint.indexOf("assertApplyGate(payload)"));
    expect(entrypoint.indexOf("assertApplyGate(payload)")).toBeLessThan(entrypoint.indexOf("applyTransaction(client, data)"));
    expect(publicPublisher).not.toHaveProperty("applyImport");
    expect(publicPublisher).not.toHaveProperty("applyTransaction");
    expect(publisherSource).not.toMatch(/export\s+(?:async\s+)?function\s+(?:applyImport|applyTransaction|writeOperation)\b/);
  });

  it.each([
    { gate: "ALLOW_SANITARIO_IMPORT", env: {}, dbUrl: "postgres://localhost/test" },
    { gate: "SANITARIO_IMPORT_CONFIRM", env: { ALLOW_SANITARIO_IMPORT: "1", SANITARIO_IMPORT_CONFIRM: "wrong" },
      dbUrl: "postgres://localhost/test" },
    { gate: "ALLOW_SANITARIO_REMOTE_IMPORT", env: {
      ALLOW_SANITARIO_IMPORT: "1", SANITARIO_IMPORT_CONFIRM: contract.CANONICAL_ARTIFACT_VERSION,
    }, dbUrl: "postgres://remote.invalid/test" },
  ])("requires operational gate $gate before creating a database client", async ({ gate, env, dbUrl }) => {
    let clientCreations = 0;
    const connectForTest = runInNewContext(
      `${privateSource}\nreadSupabaseStatusEnv = () => ({ DB_URL: testDbUrl }); connectDb;`,
      { ...contract, process: { cwd: () => process.cwd(), env }, path, existsSync, readFileSync, Date,
        URL, testDbUrl: dbUrl, Client: class {
          constructor() {
            clientCreations += 1;
            throw new Error("database client must not be created");
          }
        } },
    );
    await expect(connectForTest("apply")).rejects.toThrow(gate);
    expect(clientCreations).toBe(0);
  });

  it("blocks the CLI orchestration before requesting a database connection", async () => {
    let connectionAttempts = 0;
    const client = new MemoryClient();
    const mainSource = publisherSource.slice(
      publisherSource.indexOf("async function main()"), publisherSource.indexOf("const INVOKED_AS_SCRIPT"),
    );
    // Exercise main's apply branch in a sandbox, without launching CLI --apply.
    const blockedMain = runInNewContext(
      `${privateSource}\n${mainSource}\nparseMode = () => 'apply'; connectDb = onConnectDb; main;`,
      { ...contract, process, path, existsSync, readFileSync, Date, onConnectDb: () => {
        connectionAttempts += 1;
        throw new Error("database connection must not be attempted");
      } },
    );
    await expect(blockedMain()).rejects.toThrow("PUBLISHER_INCOMPLETE");
    expect(connectionAttempts).toBe(0);
    expect(client.queries).toEqual([]);
  });

  it("plans exactly all 134 canonical rows and four separate deliberate rejections", async () => {
    const data = fixture();
    const plan = await buildPlan(new MemoryClient(), data);
    const canonical = plan.filter((op) => op.collection);
    expect(canonical).toHaveLength(134);
    for (const [collection, count] of Object.entries(expectedCounts)) {
      const ops = canonical.filter((op) => op.collection === collection);
      expect(ops).toHaveLength(count);
      expect(ops.every((op) => op.action === "create")).toBe(true);
      expect(new Set(ops.map((op) => op.row.id))).toEqual(new Set(data[collection].map((r) => r.id)));
    }
    const expected = plan.filter((op) => op.classification === "EXPECTED_REJECTION");
    expect(expected).toHaveLength(4);
    expect(expected.every((op) => !op.row && !op.collection && op.reason === "NOT_A_CLASS_CONFIRMED")).toBe(true);
    for (const member of data.product_class_group_member_rows) {
      expect(findOperation(plan, "product_class_group_member_rows", member).row).toMatchObject({
        group_id: data.product_class_group_rows.find((g) => g.group_key === member.group_key).id,
        class_id: data.product_class_rows.find((c) => c.class_key === member.class_key).id,
      });
    }
    for (const coverage of data.coverage_rows) {
      expect(findOperation(plan, "coverage_rows", coverage).row.source_id)
        .toBe(data.source_rows.find((s) => s.source_key === coverage.source_key).id);
    }
    expect(() => assertPublishablePlan(plan)).not.toThrow();
  });

  it("refuses any nonempty collection deferred to P2 instead of silently ignoring it", async () => {
    for (const collection of ["product_rows", "product_authorization_rows", "product_source_rows", "dose_rule_rows",
      "withdrawal_rule_rows", "withdrawal_source_rows", "product_class_default_rule_rows"]) {
      const data = fixture();
      data[collection] = [{ id: otherId }];
      await expect(buildPlan(new MemoryClient(), data)).rejects.toThrow(`P1_UNSUPPORTED_NONEMPTY_COLLECTION:${collection}`);
    }
  });

  it("projects source columns explicitly without regenerating identity or losing curatorial evidence", () => {
    const source = fixture().source_rows[0];
    expect(sourceInsertRow(source)).toEqual(source);
    expect(sourceInsertRow(source).id).toBe(source.id);
  });

  it("resolves source symbols to UUID FKs and keeps coverage identity", () => {
    const data = fixture();
    const row = data.coverage_rows[0];
    const source = data.source_rows.find((s) => s.source_key === row.source_key);
    expect(coverageInsertRow(row, source)).toEqual({
      id: row.id, source_id: source.id, field_key: row.field_key, coverage_status: row.coverage_status, notes: row.notes,
    });
    expect(() => coverageInsertRow(row, null)).toThrow("source_lookup_missing");
    expect(() => coverageInsertRow(row, { ...source, deleted_at: "2026-09-30" })).toThrow("tombstoned");
  });

  it("preserves restricted IBR/BVD classification without manufacturing operational defaults", () => {
    const cls = fixture().product_class_rows.find((c) => c.class_key === "vacina_ibr_bvd");
    const row = classInsertRow(cls);
    expect(row.id).toBe(cls.id);
    expect(row.metadata.taxonomy_kind).toBe("restricted_functional_class");
    expect(row.metadata.can_validate_execution).toBe(false);
    expect(row.limitations).toContain("product_specific_reproductive_restrictions");
    for (const field of ["product_id", "dose_rule", "route_rule", "withdrawal_rule"]) expect(row).not.toHaveProperty(field);
  });

  it.each(Object.keys(tables))("skips identical physical rows for %s", async (collection) => {
    const data = fixture();
    const plan = await buildPlan(await seeded(data), data);
    expect(plan.filter((op) => op.collection === collection).every((op) => op.action === "skip")).toBe(true);
    expect(() => assertConvergedPlan(plan)).not.toThrow();
  });

  it.each(Object.keys(tables))("rejects incompatible existing UUID for %s", async (collection) => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables[collection]][0].id = otherId;
    const plan = await buildPlan(client, data);
    expect(plan.some((op) => op.collection === collection && op.reason === "IDENTITY_CONFLICT")).toBe(true);
    expect(() => assertPublishablePlan(plan)).toThrow("UNEXPECTED_CONFLICT");
  });

  it.each(Object.keys(tables))("rejects a reserved tombstoned identity for %s", async (collection) => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables[collection]][0].deleted_at = "2026-09-30";
    const plan = await buildPlan(client, data);
    expect(plan.some((op) => op.collection === collection && op.reason === "TOMBSTONE_IDENTITY_RESERVED")).toBe(true);
    expect(() => assertConvergedPlan(plan)).toThrow("UNEXPECTED_CONFLICT");
  });

  it.each([
    ["source_rows", "source_key"], ["coverage_rows", "field_key"],
    ["product_class_rows", "class_key"], ["product_class_group_rows", "group_key"],
    ["product_class_group_member_rows", "class_id"], ["protocol_rows", "family_code"],
    ["protocol_item_rows", "logical_item_key"],
  ])("rejects a canonical UUID already assigned to another %s identity", async (collection, field) => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables[collection]][0][field] = field === "class_id" ? otherId : "another_key";
    const plan = await buildPlan(client, data);
    expect(plan.some((op) => op.collection === collection && op.reason === "CANONICAL_UUID_OTHER_IDENTITY")).toBe(true);
  });

  it.each(["source_rows", "coverage_rows", "product_class_rows", "product_class_group_member_rows"])(
    "rejects ambiguous database identity for %s", async (collection) => {
      const data = fixture();
      const client = await seeded(data);
      const row = client.rows[tables[collection]][0];
      client.rows[tables[collection]].push({ ...row, id: otherId, deleted_at: "2026-09-30" });
      const plan = await buildPlan(client, data);
      expect(plan.some((op) => op.collection === collection && op.reason === "IDENTITY_AMBIGUOUS")).toBe(true);
    },
  );

  it.each(["source_rows", "coverage_rows", "product_class_rows", "product_class_group_member_rows"])(
    "rejects both occurrences of duplicate canonical physical identity for %s", async (collection) => {
      const data = fixture();
      const original = data[collection][0];
      data[collection].push({ ...original, id: otherId });
      const plan = await buildPlan(new MemoryClient(), data);
      const duplicates = plan.filter((op) => op.collection === collection &&
        [original.id, otherId].includes(op.row?.id));
      expect(duplicates).toHaveLength(2);
      expect(duplicates.every((op) => op.reason === "DUPLICATE_CANONICAL_NATURAL_KEY")).toBe(true);
    },
  );

  it("rejects missing UUIDs and duplicate UUIDs without creating replacements", async () => {
    const data = fixture();
    delete data.source_rows[0].id;
    data.product_class_rows[0].id = data.product_class_rows[1].id;
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.some((op) => op.reason === "EXPLICIT_UUID_REQUIRED")).toBe(true);
    expect(plan.filter((op) => op.reason === "DUPLICATE_CANONICAL_UUID")).toHaveLength(2);
    expect(() => assertPublishablePlan(plan)).toThrow();
  });

  it("rejects coverage with a missing or tombstoned source before any write", async () => {
    const data = fixture();
    const coverage = data.coverage_rows[0];
    data.source_rows = data.source_rows.filter((s) => s.source_key !== coverage.source_key);
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.find((op) => op.collection === "coverage_rows" && op.key === `${coverage.source_key}:${coverage.field_key}`))
      .toMatchObject({ action: "reject", classification: "UNEXPECTED_CONFLICT" });
    const complete = fixture();
    const client = await seeded(complete);
    client.rows[tables.source_rows].find((s) => s.source_key === coverage.source_key).deleted_at = "2026-09-30";
    const tombstonedPlan = await buildPlan(client, complete);
    expect(tombstonedPlan.find((op) => op.collection === "coverage_rows" && op.key === `${coverage.source_key}:${coverage.field_key}`).action)
      .toBe("reject");
  });

  it("preserves source scope rules including MV responsibility", async () => {
    const data = fixture();
    data.source_rows[0].fazenda_id = farmA;
    data.source_rows[1].kind = "mv_responsavel";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(findOperation(plan, "source_rows", data.source_rows[0]).reason).toContain("invalid_scope_fazenda");
    expect(findOperation(plan, "source_rows", data.source_rows[1]).reason).toBe("mv_responsavel_requires_fazenda");
    data.source_rows[0].scope = "fazenda";
    expect(findOperation(await buildPlan(new MemoryClient(), data), "source_rows", data.source_rows[0]).action).toBe("create");
  });

  it("rejects invalid class scope and antiparasitic associations", async () => {
    const data = fixture();
    data.product_class_rows[0].scope = "tenant";
    data.product_class_rows[0].fazenda_id = null;
    data.product_class_rows[1].class_key = "associacoes_antiparasitarias";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(findOperation(plan, "product_class_rows", data.product_class_rows[0]).reason).toContain("invalid_scope_fazenda");
    expect(findOperation(plan, "product_class_rows", data.product_class_rows[1]).reason).toBe("NOT_A_CLASS_CONFIRMED");
  });

  it.each(["approved_for_catalog", "blocked", "archived"])("protects class curatorial state %s", async (status) => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables.product_class_rows][0].curation_status = status;
    const plan = await buildPlan(client, data);
    expect(plan.some((op) => op.collection === "product_class_rows" && op.reason === "class_already_curated_or_operational")).toBe(true);
  });

  it("protects operational classes and existing approved groups/protocols/items", async () => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables.product_class_rows][0].automation_status = "agenda_allowed";
    client.rows[tables.product_class_group_rows][0].curation_status = "approved_for_catalog";
    client.rows[tables.protocol_rows][0].approval_status = "approved";
    client.rows[tables.protocol_item_rows][0].status = "active";
    const plan = await buildPlan(client, data);
    for (const collection of ["product_class_rows", "product_class_group_rows", "protocol_rows", "protocol_item_rows"]) {
      expect(plan.some((op) => op.collection === collection && op.action === "reject")).toBe(true);
    }
  });

  it("resolves member parents, derives physical scope, and does not add execution semantics", async () => {
    const data = fixture();
    const member = data.product_class_group_member_rows[0];
    const group = data.product_class_group_rows.find((g) => g.group_key === member.group_key);
    const cls = data.product_class_rows.find((c) => c.class_key === member.class_key);
    expect(memberInsertRow(member, group, cls)).toEqual({
      id: member.id, group_id: group.id, class_id: cls.id, scope: "global", fazenda_id: null,
      is_allowed: true, requires_mv_override: null, limitations: [], metadata: {},
    });
    expect(() => memberInsertRow(member, null, cls)).toThrow("group_lookup_missing");
    expect(() => memberInsertRow(member, group, null)).toThrow("class_lookup_missing");
    expect(() => memberInsertRow(member, { ...group, deleted_at: "2026-09-30" }, cls)).toThrow("tombstoned");
    expect(() => memberInsertRow(member, group, { ...cls, deleted_at: "2026-09-30" })).toThrow("tombstoned");
  });

  it.each(["product_class_rows", "product_class_group_rows"])("rejects members whose %s parent is missing/tombstoned", async (collection) => {
    const data = fixture();
    const member = data.product_class_group_member_rows[0];
    const symbol = collection === "product_class_rows" ? "class_key" : "group_key";
    const parent = data[collection].find((r) => r[symbol] === member[symbol]);
    const client = await seeded(data);
    client.rows[tables[collection]].find((r) => r.id === parent.id).deleted_at = "2026-09-30";
    expect(findOperation(await buildPlan(client, data), "product_class_group_member_rows", member).action).toBe("reject");
    data[collection] = data[collection].filter((r) => r.id !== parent.id);
    expect(findOperation(await buildPlan(new MemoryClient(), data), "product_class_group_member_rows", member).action).toBe("reject");
  });

  it("rejects cross-scope/cross-farm memberships and allows tenant-to-global references", () => {
    const data = fixture();
    const group = data.product_class_group_rows[0];
    const cls = data.product_class_rows[0];
    const member = data.product_class_group_member_rows[0];
    expect(() => memberInsertRow(member, group, { ...cls, scope: "tenant", fazenda_id: farmA })).toThrow("cross_scope");
    expect(() => memberInsertRow(member, { ...group, scope: "tenant", fazenda_id: farmA },
      { ...cls, scope: "tenant", fazenda_id: farmB })).toThrow("cross_scope");
    expect(memberInsertRow(member, { ...group, scope: "tenant", fazenda_id: farmA }, cls))
      .toMatchObject({ scope: "tenant", fazenda_id: farmA });
  });

  it("resolves ProtocolItems by protocol_key when it differs from family_code", async () => {
    const data = fixture();
    const protocol = data.protocol_rows[0];
    for (const item of data.protocol_item_rows.filter((i) => i.protocol_key === protocol.protocol_key)) item.protocol_key = "canonical_symbol";
    protocol.protocol_key = "canonical_symbol";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.find((op) => op.collection === "protocol_rows" && op.row.id === protocol.id).row.family_code).toBe(protocol.family_code);
    const items = plan.filter((op) => op.collection === "protocol_item_rows" && op.key.startsWith("canonical_symbol:"));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((op) => op.action === "create" && op.row.protocol_id === protocol.id)).toBe(true);
  });

  it("blocks unsupported specific_product rather than projecting a null product", async () => {
    const data = fixture();
    data.protocol_item_rows[0].product_requirement_kind = "specific_product";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(findOperation(plan, "protocol_item_rows", data.protocol_item_rows[0]).reason).toBe("P2_REQUIRED:specific_product");
  });

  it("allows only the four deliberate rejections, not arbitrary member conflicts", async () => {
    const data = fixture();
    data.memberRejections[0].reason = "IDENTITY_CONFLICT";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.filter((op) => op.classification === "EXPECTED_REJECTION")).toHaveLength(3);
    expect(() => assertPublishablePlan(plan)).toThrow("UNEXPECTED_CONFLICT");
    expect(() => assertConvergedPlan(plan)).toThrow("UNEXPECTED_CONFLICT");
  });

  it("does not trust an expected classification forged for another reason/key or repeated rejection", async () => {
    const expected = (await buildPlan(new MemoryClient(), fixture())).filter((op) => op.classification === "EXPECTED_REJECTION");
    for (const conflicting of [{ ...expected[0], reason: "IDENTITY_CONFLICT" }, { ...expected[0], key: "arbitrary_key" }]) {
      expect(() => assertConvergedPlan([conflicting])).toThrow("UNEXPECTED_CONFLICT");
    }
    expect(() => assertPublishablePlan([expected[0], expected[0]])).toThrow("UNEXPECTED_CONFLICT");
  });

  it("does not downgrade blocked automation or update a non-draft protocol", async () => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables.product_class_rows][0].automation_status = "blocked";
    client.rows[tables.product_class_group_rows][0].automation_status = "blocked";
    client.rows[tables.protocol_rows][0].status = "active";
    const plan = await buildPlan(client, data);
    for (const collection of ["product_class_rows", "product_class_group_rows", "protocol_rows"]) {
      expect(plan.some((op) => op.collection === collection && op.action === "reject")).toBe(true);
    }
  });

  it("rebuilds under the transaction lock, writes 134 explicit UUIDs in FK order and replays as skips", async () => {
    const data = fixture();
    const client = new MemoryClient();
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 134, update: 0, skip: 0, reject: 4 });
    const inserts = client.queries.filter((q) => q.text.startsWith("insert"));
    expect(inserts).toHaveLength(134);
    expect(inserts.every((q) => /\(id,/.test(q.text))).toBe(true);
    expect(new Set(inserts.map((q) => q.values[0]))).toEqual(new Set(Object.keys(tables).flatMap((k) => data[k].map((r) => r.id))));
    const writtenTables = inserts.map((q) => /public\.(\w+)/.exec(q.text)[1]);
    for (const [parent, child] of [["source_rows", "coverage_rows"], ["product_class_rows", "product_class_group_member_rows"],
      ["product_class_group_rows", "product_class_group_member_rows"], ["protocol_rows", "protocol_item_rows"]]) {
      expect(writtenTables.lastIndexOf(tables[parent])).toBeLessThan(writtenTables.indexOf(tables[child]));
    }
    expect(client.queries[0].text).toBe("begin");
    expect(client.queries[3].text).toContain("pg_advisory_xact_lock");
    expect(client.queries.filter((q) => q.text.startsWith("select *")).every((q) => q.text.endsWith("for update"))).toBe(true);
    expect(client.queries.at(-1).text).toBe("commit");
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 0, update: 0, skip: 134, reject: 4 });
    expect(client.queries.filter((q) => q.text.startsWith("insert"))).toHaveLength(134);
    expect(client.committed).toBe(true);
  });

  it.each(Object.keys(tables))(
    "updates changed draft/unprotected %s rows and converges", async (collection) => {
      const data = fixture();
      const client = await seeded(data);
      const physical = client.rows[tables[collection]][0];
      const field = collection === "source_rows" ? "title" : collection === "coverage_rows" ? "notes" :
        collection === "product_class_group_member_rows" ? "is_allowed" :
        collection === "protocol_item_rows" ? "eligibility_rule" : "name";
      physical[field] = field === "is_allowed" ? false : field === "eligibility_rule"
        ? { ...physical[field], stale_marker: true } : "stale content";
      const counts = await applyTransactionForTest(client, data);
      expect(counts).toEqual({ create: 0, update: 1, skip: 133, reject: 4 });
      expect(client.queries.some((q) => q.text.startsWith(`update public.${tables[collection]}`))).toBe(true);
      expect((await buildPlan(client, data)).filter((op) => op.collection).every((op) => op.action === "skip")).toBe(true);
    },
  );

  it("compares PostgreSQL date values without producing a perpetual update", async () => {
    const data = fixture();
    const client = await seeded(data);
    for (const source of client.rows[tables.source_rows]) {
      for (const field of ["published_at", "accessed_at"]) if (source[field]) source[field] = new Date(`${source[field]}T00:00:00`);
    }
    expect((await buildPlan(client, data)).filter((op) => op.collection === "source_rows").every((op) => op.action === "skip")).toBe(true);
  });

  it("does not trust a pre-lock plan when a protocol is approved before the lock", async () => {
    const data = fixture();
    const client = await seeded(data);
    const preflight = await buildPlan(client, data);
    expect(() => assertConvergedPlan(preflight)).not.toThrow();
    client.beforeQuery = (text, _, db) => {
      if (text.includes("pg_advisory_xact_lock")) db.rows[tables.protocol_rows][0].approval_status = "approved";
    };
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("UNEXPECTED_CONFLICT");
    expect(client.queries.at(-1).text).toBe("rollback");
    expect(client.queries.some((q) => q.text.startsWith("update") || q.text.startsWith("insert"))).toBe(false);
  });

  it("rolls back a partial write failure and permits retry with unchanged canonical UUIDs", async () => {
    const data = fixture();
    const client = new MemoryClient();
    client.failInsert = tables.product_class_group_member_rows;
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("simulated insert failure");
    expect(client.rows).toEqual({});
    expect(client.queries.at(-1).text).toBe("rollback");
    client.failInsert = null;
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 134, update: 0, skip: 0, reject: 4 });
  });

  it("blocks commit when the post-write verification finds an unexpected member conflict", async () => {
    const data = fixture();
    const client = new MemoryClient();
    let inserts = 0;
    client.beforeQuery = (text, _, db) => {
      if (text.startsWith("insert")) inserts += 1;
      if (text.startsWith("select *") && inserts === 134) {
        db.rows[tables.product_class_group_member_rows][0].id = otherId;
        inserts += 1;
      }
    };
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("UNEXPECTED_CONFLICT");
    expect(client.rows).toEqual({});
    expect(client.committed).not.toBe(true);
    expect(client.queries.at(-1).text).toBe("rollback");
  });

  it("rejects an UPDATE affecting zero rows", async () => {
    const data = fixture();
    const client = await seeded(data);
    client.rows[tables.source_rows][0].title = "stale";
    client.zeroUpdate = true;
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("WRITE_ROW_COUNT_CONFLICT");
    expect(client.queries.at(-1).text).toBe("rollback");
  });

  it("tombstones only the explicitly deprecated draft items, then converges", async () => {
    const data = fixture();
    const client = await seeded(data);
    const protocol = data.protocol_rows.find((p) => p.family_code === "raiva_herbivoros");
    client.rows[tables.protocol_item_rows].push({
      id: otherId, protocol_id: protocol.id, logical_item_key: "raiva_area_risco_anual", version: 1, status: "draft",
    });
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 0, update: 1, skip: 134, reject: 4 });
    expect(client.rows[tables.protocol_item_rows].find((r) => r.id === otherId)).toMatchObject({ status: "retired", allows_agenda_auto: false });
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 0, update: 0, skip: 134, reject: 4 });
  });

  it("does not tombstone deprecated non-draft items", async () => {
    const data = fixture();
    const client = await seeded(data);
    const protocol = data.protocol_rows.find((p) => p.family_code === "raiva_herbivoros");
    client.rows[tables.protocol_item_rows].push({
      id: otherId, protocol_id: protocol.id, logical_item_key: "raiva_area_risco_anual", status: "active",
    });
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("deprecated_item_not_draft");
    expect(client.queries.at(-1).text).toBe("rollback");
  });
});
