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
const p2Tables = {
  product_rows: "sanitario_produtos_v2",
  product_authorization_rows: "sanitario_produto_especie_autorizacao_v2",
  product_source_rows: "sanitario_produto_fontes_v2",
  dose_rule_rows: "sanitario_produto_dose_rules_v2",
  withdrawal_rule_rows: "sanitario_produto_carencia_rules_v2",
  withdrawal_source_rows: "sanitario_produto_carencia_fontes_v2",
  product_class_default_rule_rows: "sanitario_product_class_default_rules_v2",
};
const expectedCounts = {
  source_rows: 14, coverage_rows: 66, product_class_rows: 8,
  product_class_group_rows: 4, product_class_group_member_rows: 12,
  protocol_rows: 10, protocol_item_rows: 20,
};

function fixture() {
  return validateCanonicalTechnicalContract(JSON.parse(readFileSync(payloadUrl, "utf8"))).data;
}

// Independent synthetic rows; never written into the canonical artifact.
function p2Fixture() {
  const data = fixture();
  data.product_rows = [{ id: "10000000-0000-4000-8000-000000000001", product_key: "PRODUCT_SYNTHETIC",
    nome_comercial: "Produto sintetico", classe: "vacina", tipo_produto: "vacina", status_curatorial: "precisa_validar" }];
  data.product_authorization_rows = [{ id: "10000000-0000-4000-8000-000000000002", product_key: "PRODUCT_SYNTHETIC",
    species_code: "bovino", aptitude: "all", authorization_status: "SIM_BULA" }];
  data.product_source_rows = [{ product_key: "PRODUCT_SYNTHETIC", source_key: data.source_rows[0].source_key, field_key: "dose" }];
  data.dose_rule_rows = [{ id: "10000000-0000-4000-8000-000000000003", product_key: "PRODUCT_SYNTHETIC",
    route: "subcutanea", dose_quantity: 1, dose_unit: "mL", dose_basis: "animal" }];
  data.withdrawal_rule_rows = [{ id: "10000000-0000-4000-8000-000000000004", withdrawal_rule_key: "WITHDRAWAL_SYNTHETIC",
    product_key: "PRODUCT_SYNTHETIC", species_code: "bovino", aptitude: "corte", applicability: "unknown" }];
  data.withdrawal_source_rows = [{ withdrawal_rule_key: "WITHDRAWAL_SYNTHETIC", source_key: data.source_rows[0].source_key,
    field_key: "withdrawal" }];
  data.product_class_default_rule_rows = [{ id: "10000000-0000-4000-8000-000000000005",
    class_key: data.product_class_rows[0].class_key, species_code: "bovino", aptitude: "all" }];
  Object.assign(data.protocol_item_rows[0], { product_requirement_kind: "specific_product", product_key: "PRODUCT_SYNTHETIC" });
  return data;
}

const compositeFields = {
  sanitario_produto_fontes_v2: ["product_id", "source_id", "field_key"],
  sanitario_produto_carencia_fontes_v2: ["withdrawal_rule_id", "source_id", "field_key"],
};

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
        const fields = [...text.matchAll(/(lower\(\w+\)|coalesce\(\w+, '[^']*'\)|\w+) is not distinct from \$(\d+)/g)];
        selected = rows.filter((row) => (text.includes(" or id = ") && row.id === values.at(-1)) ||
          fields.every(([, expression, position]) => {
            const field = expression.match(/\w+/g)[expression.includes("(") ? 1 : 0];
            let value = row[field] ?? null;
            if (expression.startsWith("lower(")) value = value?.toLowerCase();
            if (expression.startsWith("coalesce(")) value ??= /'([^']*)'/.exec(expression)[1];
            return value === values[Number(position) - 1];
          }));
      } else {
        selected = rows.filter((row) => !row.deleted_at && row.protocol_id === values[0] && row.logical_item_key === values[1]);
      }
      return { rows: structuredClone(selected), rowCount: selected.length };
    }
    if (text.startsWith("insert")) {
      if (this.failInsert === table) throw new Error("simulated insert failure");
      const fields = /\(([^)]+)\) values/.exec(text)[1].split(",").map((f) => f.trim());
      const row = Object.fromEntries(fields.map((field, index) => [field, decodeJson(values[index])]));
      const keys = compositeFields[table] ?? ["id"];
      if (rows.some((r) => keys.every((key) => r[key] === row[key]))) throw new Error("duplicate primary key");
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

describe("sanitario v2 publisher P2 full contract", () => {
  it.each([
    { dose_rule: { quantity: 2, unit: "mL", qualifiers: ["canonical"] } },
    { route_rule: { route: "subcutanea", qualifiers: ["canonical"] } },
    { dose_rule: { quantity: 2, unit: "mL" }, route_rule: { route: "subcutanea" } },
    {},
  ])("preserves canonical item rules and JSON serialization through create/replay: %j", async (rules) => {
    const data = p2Fixture();
    const item = Object.assign(data.protocol_item_rows[0], rules);
    const projected = publicPublisher.itemInsertRow(item, data.protocol_rows[0].id, null, data.product_rows[0].id);
    expect(projected.dose_rule).toBe(item.dose_rule ?? null);
    expect(projected.route_rule).toBe(item.route_rule ?? null);
    const client = new MemoryClient();
    const operation = (await buildPlan(client, data)).find((op) => op.canonical_id === item.id);
    expect(operation.action).toBe("create");
    expect(operation.row).toMatchObject({ dose_rule: item.dose_rule ?? null, route_rule: item.route_rule ?? null });
    await applyTransactionForTest(client, data);
    const written = client.rows[tables.protocol_item_rows].find((row) => row.id === item.id);
    expect(written).toMatchObject({ dose_rule: item.dose_rule ?? null, route_rule: item.route_rule ?? null });
    const insert = client.queries.find((q) => q.text.startsWith(`insert into public.${tables.protocol_item_rows} `) && q.values[0] === item.id);
    const fields = /\(([^)]+)\) values/.exec(insert.text)[1].split(",").map((field) => field.trim());
    for (const field of ["dose_rule", "route_rule"]) {
      expect(insert.values[fields.indexOf(field)]).toBe(item[field] == null ? null : JSON.stringify(item[field]));
    }
    expect((await buildPlan(client, data)).find((op) => op.canonical_id === item.id).action).toBe("skip");
  });

  it("updates canonical item rules without replacing item identity and converges", async () => {
    const data = p2Fixture();
    const client = await seeded(data);
    const item = data.protocol_item_rows[0];
    Object.assign(item, { dose_rule: { quantity: 3, unit: "mL" }, route_rule: { route: "intramuscular" } });
    expect((await buildPlan(client, data)).find((op) => op.canonical_id === item.id).action).toBe("update");
    await applyTransactionForTest(client, data);
    expect(client.rows[tables.protocol_item_rows].find((row) => row.id === item.id)).toMatchObject({
      dose_rule: item.dose_rule, route_rule: item.route_rule,
    });
    const replay = await buildPlan(client, data);
    expect(() => assertConvergedPlan(replay)).not.toThrow();
  });

  it.each(["specific_product", "product_class", "product_class_group"])(
    "never infers item rules from product, class, group or technical dose rules: %s", async (kind) => {
      const data = p2Fixture();
      const inherited = { dose_rule: { quantity: 99 }, route_rule: { route: "never_infer" } };
      data.product_rows[0].metadata = inherited;
      data.product_class_rows[0].metadata = inherited;
      data.product_class_group_rows[0].metadata = inherited;
      Object.assign(data.product_class_default_rule_rows[0], inherited, {
        source_refs: [{ source_ref: data.source_rows[0].source_key }],
      });
      const item = data.protocol_item_rows[0];
      Object.assign(item, { product_requirement_kind: kind, class_key: data.product_class_rows[0].class_key,
        group_key: data.product_class_group_rows[0].group_key });
      delete item.dose_rule;
      delete item.route_rule;
      const plan = await buildPlan(new MemoryClient(), data);
      expect(() => assertPublishablePlan(plan)).not.toThrow();
      const operation = plan.find((op) => op.canonical_id === item.id);
      expect(operation.action).toBe("create");
      expect(operation.row).toMatchObject({ dose_rule: null, route_rule: null });
    },
  );

  it("reports pending P3 PostgreSQL certification while preserving the closed publisher gate", () => {
    expect(publicPublisher.applyGateError(JSON.parse(readFileSync(payloadUrl, "utf8")), false))
      .toBe("PUBLISHER_INCOMPLETE: --apply bloqueado; certificacao PostgreSQL da P3 ainda pendente.");
  });

  it("validates and normalizes synthetic 14/14 data through the canonical contract", async () => {
    const data = validateCanonicalTechnicalContract({ artifact_version: contract.CANONICAL_ARTIFACT_VERSION, payload: p2Fixture() }).data;
    expect(Object.values({ ...tables, ...p2Tables })).toHaveLength(14);
    expect(Object.keys({ ...tables, ...p2Tables }).every((collection) => data[collection].length > 0)).toBe(true);
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.filter((op) => op.action === "create")).toHaveLength(141);
    expect(() => assertPublishablePlan(plan)).not.toThrow();
  });

  it("plans and publishes nonempty fixtures for all 14 collections, then converges", async () => {
    const data = p2Fixture();
    const client = new MemoryClient();
    const plan = await buildPlan(client, data);
    const allTables = { ...tables, ...p2Tables };
    expect(new Set(plan.filter((op) => op.collection).map((op) => op.collection)))
      .toEqual(new Set(Object.keys(allTables)));
    expect(plan.filter((op) => op.action === "create")).toHaveLength(141);
    expect(() => assertPublishablePlan(plan)).not.toThrow();
    expect(await applyTransactionForTest(client, data)).toEqual({ create: 141, update: 0, skip: 0, reject: 4 });
    const replay = await buildPlan(client, data);
    expect(replay.filter((op) => op.action === "skip")).toHaveLength(141);
    expect(() => assertConvergedPlan(replay)).not.toThrow();
    const inserts = client.queries.filter((q) => q.text.startsWith("insert into"));
    for (const [collection, table] of Object.entries(allTables)) {
      expect(inserts.filter((q) => q.text.startsWith(`insert into public.${table} `)))
        .toHaveLength(data[collection].length);
    }
    const order = inserts.map((q) => /public\.(\w+)/.exec(q.text)[1]);
    for (const [parent, child] of [
      ["product_rows", "product_authorization_rows"], ["product_rows", "product_source_rows"],
      ["source_rows", "product_source_rows"], ["product_rows", "dose_rule_rows"],
      ["product_rows", "withdrawal_rule_rows"], ["product_class_rows", "product_class_default_rule_rows"],
      ["withdrawal_rule_rows", "withdrawal_source_rows"], ["source_rows", "withdrawal_source_rows"],
      ["product_rows", "protocol_item_rows"], ["protocol_rows", "protocol_item_rows"],
    ]) expect(order.lastIndexOf(allTables[parent])).toBeLessThan(order.indexOf(allTables[child]));
    for (const table of Object.values(p2Tables)) {
      for (const row of client.rows[table]) {
        if (compositeFields[table]) expect(row).not.toHaveProperty("id");
        else expect(row.id).toBe(data[Object.keys(p2Tables).find((k) => p2Tables[k] === table)][0].id);
        expect(row).not.toHaveProperty("product_key");
        expect(row).not.toHaveProperty("withdrawal_rule_key");
      }
    }
    for (const table of Object.keys(compositeFields)) {
      const sql = inserts.find((q) => q.text.startsWith(`insert into public.${table} `)).text;
      expect(sql).not.toMatch(/\bid\b/);
      expect(sql).toContain(`returning ${compositeFields[table].join(", ")}`);
    }
  });

  it.each(Object.keys(p2Tables))("creates and replays the independent %s fixture", async (collection) => {
    const data = p2Fixture();
    const first = (await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === collection);
    expect(first).toHaveLength(1);
    expect(first[0].action).toBe("create");
    const replay = (await buildPlan(await seeded(data), data)).filter((op) => op.collection === collection);
    expect(replay[0].action).toBe("skip");
  });

  it.each([
    ["product_rows", "fabricante", "Fabricante atualizado"],
    ["product_authorization_rows", "idade_min_dias", 30],
    ["dose_rule_rows", "dose_quantity", 2],
    ["withdrawal_rule_rows", "limitations", ["Revisao tecnica sintetica"]],
    ["product_class_default_rule_rows", "limitations", ["Default sintetico"]],
  ])("updates permitted configuration in %s and converges without replacing UUID", async (collection, field, value) => {
    const data = p2Fixture();
    const client = await seeded(data);
    data[collection][0][field] = value;
    const plan = await buildPlan(client, data);
    expect(plan.find((op) => op.collection === collection).action).toBe("update");
    await applyTransactionForTest(client, data);
    expect(client.rows[p2Tables[collection]][0].id).toBe(data[collection][0].id);
    expect(client.rows[p2Tables[collection]][0][field]).toEqual(value);
    const replay = await buildPlan(client, data);
    expect(() => assertConvergedPlan(replay)).not.toThrow();
  });

  it.each(Object.keys(p2Tables).filter((c) => !c.includes("source_rows")))(
    "rejects reserved UUID pointing to another identity in %s", async (collection) => {
      const data = p2Fixture();
      const client = await seeded(data);
      const physical = client.rows[p2Tables[collection]][0];
      if (collection === "product_rows") physical.nome_comercial = "Outro produto";
      else if (collection === "product_class_default_rule_rows") physical.class_id = otherId;
      else physical.product_id = otherId;
      const operation = (await buildPlan(client, data)).find((op) => op.collection === collection);
      expect(operation).toMatchObject({ action: "reject", reason: "CANONICAL_UUID_OTHER_IDENTITY" });
    },
  );

  it.each(["product_rows", "product_authorization_rows", "product_class_default_rule_rows"])(
    "rejects database uniqueness and ambiguous identity in %s", async (collection) => {
      const data = p2Fixture();
      const client = await seeded(data);
      client.rows[p2Tables[collection]][0].id = otherId;
      expect((await buildPlan(client, data)).find((op) => op.collection === collection))
        .toMatchObject({ action: "reject", reason: "IDENTITY_CONFLICT" });
      client.rows[p2Tables[collection]].push({ ...client.rows[p2Tables[collection]][0], id: data[collection][0].id });
      expect((await buildPlan(client, data)).find((op) => op.collection === collection))
        .toMatchObject({ action: "reject", reason: "IDENTITY_AMBIGUOUS" });
    },
  );

  it("uses the exact commercial uniqueness expression including null and empty registration", async () => {
    const data = p2Fixture();
    const client = await seeded(data);
    Object.assign(client.rows[p2Tables.product_rows][0], { nome_comercial: "PRODUTO SINTETICO", registro_orgao: "", registro_numero: "" });
    expect((await buildPlan(client, data)).find((op) => op.collection === "product_rows").action).toBe("skip");
    client.rows[p2Tables.product_rows][0].id = otherId;
    expect((await buildPlan(client, data)).find((op) => op.collection === "product_rows").reason).toBe("IDENTITY_CONFLICT");
    data.product_rows.push({ ...data.product_rows[0], id: otherId, product_key: "OTHER_PRODUCT", nome_comercial: "PRODUTO SINTETICO",
      registro_orgao: "", registro_numero: "" });
    expect((await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === "product_rows")
      .every((op) => op.action === "reject")).toBe(true);
  });

  it("uses coalesce sexo all for authorization identity", async () => {
    const data = p2Fixture();
    const client = await seeded(data);
    client.rows[p2Tables.product_authorization_rows][0].sexo = "all";
    expect((await buildPlan(client, data)).find((op) => op.collection === "product_authorization_rows").action).toBe("skip");
    data.product_authorization_rows.push({ ...data.product_authorization_rows[0], id: otherId, sexo: "all" });
    expect((await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === "product_authorization_rows")
      .every((op) => op.action === "reject" && op.reason === "DUPLICATE_CANONICAL_NATURAL_KEY")).toBe(true);
  });

  it.each(["dose_rule_rows", "withdrawal_rule_rows"])("uses only explicit UUID lookup, never a fabricated natural key for %s", async (collection) => {
    const data = p2Fixture();
    const client = await seeded(data);
    const queryClient = new MemoryClient(client.rows);
    client.rows[p2Tables[collection]][0].id = otherId;
    expect((await buildPlan(client, data)).find((op) => op.collection === collection).action).toBe("create");
    const row = { ...data[collection][0], id: otherId };
    if (collection === "withdrawal_rule_rows") row.withdrawal_rule_key = "OTHER_WITHDRAWAL";
    data[collection].push(row);
    expect((await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === collection)
      .every((op) => op.action === "create")).toBe(true);
    await buildPlan(queryClient, data);
    const lookups = queryClient.queries.filter((q) => q.text.startsWith(`select * from public.${p2Tables[collection]}`));
    expect(lookups.every((q) => q.text.includes("where (id is not distinct from $1) or id = $2"))).toBe(true);
    delete data[collection][0].id;
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === collection && op.canonical_id === undefined).reason)
      .toBe("EXPLICIT_UUID_REQUIRED");
  });

  it("compares Postgres numeric strings without generating perpetual updates", async () => {
    const data = p2Fixture();
    data.dose_rule_rows[0].min_weight_kg = 50;
    const client = await seeded(data);
    Object.assign(client.rows[p2Tables.dose_rule_rows][0], { dose_quantity: "1.0000", min_weight_kg: "50.000" });
    expect((await buildPlan(client, data)).find((op) => op.collection === "dose_rule_rows").action).toBe("skip");
  });

  it.each(["product_source_rows", "withdrawal_source_rows"])("uses only the composite PK for %s and rejects duplicates", async (collection) => {
    const data = p2Fixture();
    // Even legacy synthetic metadata must not produce an SQL UUID.
    data[collection][0].id = otherId;
    const plan = await buildPlan(new MemoryClient(), data);
    const operation = plan.find((op) => op.collection === collection);
    expect(Object.keys(operation.row)).toEqual(compositeFields[p2Tables[collection]]);
    expect(operation.row.source_id).toBe(data.source_rows[0].id);
    expect(operation.row[collection === "product_source_rows" ? "product_id" : "withdrawal_rule_id"])
      .toBe(data[collection === "product_source_rows" ? "product_rows" : "withdrawal_rule_rows"][0].id);
    data[collection].push({ ...data[collection][0] });
    expect((await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === collection)
      .every((op) => op.action === "reject")).toBe(true);
  });

  it.each([
    ["product_authorization_rows", "product_key"], ["product_source_rows", "product_key"],
    ["product_source_rows", "source_key"], ["dose_rule_rows", "product_key"],
    ["withdrawal_rule_rows", "product_key"], ["withdrawal_source_rows", "withdrawal_rule_key"],
    ["withdrawal_source_rows", "source_key"], ["product_class_default_rule_rows", "class_key"],
  ])("rejects missing parent %s.%s", async (collection, field) => {
    const data = p2Fixture();
    data[collection][0][field] = "MISSING";
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === collection))
      .toMatchObject({ action: "reject", reason: expect.stringContaining("lookup_missing_or_conflicted") });
  });

  it.each(Object.keys(p2Tables).filter((c) => !c.includes("source_rows")))("blocks tombstoned UUID in %s", async (collection) => {
    const data = p2Fixture();
    const client = await seeded(data);
    client.rows[p2Tables[collection]][0].deleted_at = "2026-09-30";
    expect((await buildPlan(client, data)).find((op) => op.collection === collection))
      .toMatchObject({ action: "reject", reason: "TOMBSTONE_IDENTITY_RESERVED" });
  });

  it.each(["product_source_rows", "withdrawal_source_rows"])("blocks links to a tombstoned source in %s", async (collection) => {
    const data = p2Fixture();
    const client = await seeded(data);
    client.rows[tables.source_rows].find((r) => r.id === data.source_rows[0].id).deleted_at = "2026-09-30";
    expect((await buildPlan(client, data)).find((op) => op.collection === collection).action).toBe("reject");
  });

  it("resolves exact product and clears class/group without inference", async () => {
    const data = p2Fixture();
    const operation = (await buildPlan(new MemoryClient(), data)).find((op) => op.canonical_id === data.protocol_item_rows[0].id);
    expect(operation.row).toMatchObject({ product_id: data.product_rows[0].id, product_class: null, product_class_group_id: null });
    delete data.protocol_item_rows[0].product_key;
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.canonical_id === data.protocol_item_rows[0].id).action).toBe("reject");
  });

  it("blocks specific_product whose product UUID conflicts or is tombstoned", async () => {
    const data = p2Fixture();
    for (const mutation of [{ deleted_at: "2026-09-30" }, { nome_comercial: "Outro produto" }]) {
      const client = await seeded(data);
      Object.assign(client.rows[p2Tables.product_rows][0], mutation);
      expect((await buildPlan(client, data)).find((op) => op.canonical_id === data.protocol_item_rows[0].id).action).toBe("reject");
    }
  });

  it("rejects conflicting physical parent UUID hints rather than trusting them", async () => {
    for (const [collection, field] of [
      ["product_authorization_rows", "product_id"], ["product_source_rows", "source_id"],
      ["withdrawal_source_rows", "withdrawal_rule_id"], ["product_class_default_rule_rows", "class_id"],
      ["protocol_item_rows", "product_id"],
    ]) {
      const data = p2Fixture();
      data[collection][0][field] = otherId;
      expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === collection && op.canonical_id === data[collection][0].id).action)
        .toBe("reject");
    }
  });

  it("derives default scope from the class and rejects supplied mismatches", async () => {
    const data = p2Fixture();
    Object.assign(data.product_class_rows[0], { scope: "tenant", fazenda_id: farmA });
    const operation = (await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_class_default_rule_rows");
    expect(operation.row).toMatchObject({ scope: "tenant", fazenda_id: farmA, class_id: data.product_class_rows[0].id,
      can_validate_execution: false, requires_executed_product_for_withdrawal: true });
    data.product_class_default_rule_rows[0].fazenda_id = farmB;
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_class_default_rule_rows").reason)
      .toBe("default_rule_fazenda_mismatch");
    delete data.product_class_default_rule_rows[0].fazenda_id;
    data.product_class_default_rule_rows[0].scope = "global";
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_class_default_rule_rows").reason)
      .toBe("default_rule_scope_mismatch");
  });

  it("rejects duplicate default identity and protected parents", async () => {
    const data = p2Fixture();
    data.product_class_default_rule_rows.push({ ...data.product_class_default_rule_rows[0], id: otherId });
    expect((await buildPlan(new MemoryClient(), data)).filter((op) => op.collection === "product_class_default_rule_rows")
      .every((op) => op.action === "reject")).toBe(true);
    data.product_class_default_rule_rows.pop();
    data.product_class_rows[0].curation_status = "approved_for_catalog";
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_class_default_rule_rows").reason)
      .toBe("default_rule_protected_class");
  });

  it("accepts permitted farm sources and blocks invalid source scope", async () => {
    const data = p2Fixture();
    Object.assign(data.source_rows[0], { scope: "fazenda", fazenda_id: farmA });
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_source_rows").action).toBe("create");
    data.source_rows[0].fazenda_id = null;
    expect((await buildPlan(new MemoryClient(), data)).find((op) => op.collection === "product_source_rows").action).toBe("reject");
  });

  it("rejects duplicate product symbols before descendants can select an arbitrary UUID", async () => {
    const data = p2Fixture();
    data.product_rows.push({ ...data.product_rows[0], id: otherId, nome_comercial: "Outro nome" });
    const plan = await buildPlan(new MemoryClient(), data);
    expect(plan.filter((op) => op.collection === "product_rows").every((op) => op.reason === "DUPLICATE_CANONICAL_SYMBOL")).toBe(true);
    expect(plan.find((op) => op.collection === "product_authorization_rows").action).toBe("reject");
  });

  it("rolls back the private transaction on a P2 write failure", async () => {
    const data = p2Fixture();
    const client = new MemoryClient();
    client.failInsert = p2Tables.withdrawal_source_rows;
    await expect(applyTransactionForTest(client, data)).rejects.toThrow("simulated insert failure");
    expect(client.rows).toEqual({});
    expect(client.committed).toBeUndefined();
    expect(client.queries.at(-1).text).toBe("rollback");
  });

  it.each(["product_rows", "dose_rule_rows", "withdrawal_rule_rows", "product_class_default_rule_rows"])(
    "preserves curated configuration and blocks a changed %s", async (collection) => {
      const data = p2Fixture();
      const client = await seeded(data);
      const physical = client.rows[p2Tables[collection]][0];
      if (collection === "product_class_default_rule_rows") physical.curation_status = "approved_for_catalog";
      else physical.status_curatorial = "ativo";
      expect((await buildPlan(client, data)).find((op) => op.collection === collection).action).toBe("reject");
    },
  );

  it("rejects withdrawal source when the parent rule is tombstoned or conflicted", async () => {
    const data = p2Fixture();
    for (const mutation of [{ deleted_at: "2026-09-30" }, { product_id: otherId }]) {
      const client = await seeded(data);
      Object.assign(client.rows[p2Tables.withdrawal_rule_rows][0], mutation);
      expect((await buildPlan(client, data)).find((op) => op.collection === "withdrawal_source_rows").action).toBe("reject");
    }
  });
});

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

  it("refuses unknown nonempty collections instead of silently ignoring them", async () => {
    await expect(buildPlan(new MemoryClient(), { ...fixture(), unknown_rows: [{ id: otherId }] }))
      .rejects.toThrow("UNSUPPORTED_NONEMPTY_COLLECTION:unknown_rows");
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

  it("blocks specific_product without an explicit product rather than projecting a null product", async () => {
    const data = fixture();
    data.protocol_item_rows[0].product_requirement_kind = "specific_product";
    const plan = await buildPlan(new MemoryClient(), data);
    expect(findOperation(plan, "protocol_item_rows", data.protocol_item_rows[0]).reason)
      .toContain("product_rows_lookup_missing_or_conflicted");
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
