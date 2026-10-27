import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const file = "docs/review/evidence/SANITARIO_V2_C02_F6_REVIEW_CANDIDATE_20261026.json";
const packet = JSON.parse(readFileSync(file, "utf8"));
const data = packet.payload;
const temporary = mkdtempSync(path.join(tmpdir(), "rebanhosync-c02-f6-"));
const cli = (...args) => spawnSync(process.execPath,
  ["scripts/codex/import-sanitario-protocols-v2.mjs", ...args],
  { encoding: "utf8", env: { ...process.env, DB_URL: "must-not-be-read", ALLOW_SANITARIO_REMOTE_IMPORT: "1" } });
const key = code => data.product_rows.find(p => p.metadata.research_lot_code === code).product_key;

describe("local C02 F6 reviewed packet", () => {
  it("records SQL replay separately from first-apply partial skips", () => {
    const result = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_F6_INTEGRATION_SQL_RESULT_20261026.json"));
    expect(result.first_apply).toEqual({ create: 592, update: 38, skip: 22, reject: 0 });
    expect(result.replay).toEqual({ create: 0, update: 0, skip: 652, reject: 0 });
  });
  it("validates the closed 39-product packet without a database", () => {
    const result = cli("--validate", "--c02-f6", file);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("C02 F6 validate OK");
  });
  it("preserves all commercial UUIDs and excludes the three held candidates", () => {
    expect(data.product_rows.map(p => p.id).sort()).toEqual(packet.baseline.product_rows.map(p => p.id).sort());
    expect(data.product_rows).toHaveLength(39);
    expect(data.product_rows.some(p => ["P04", "P10", "P35"].includes(p.metadata.research_lot_code))).toBe(false);
    expect(new Set(data.source_rows.map(s => s.url)).size).toBe(data.source_rows.length);
  });
  it("retains uncertain fields without suppressing independent evidence", () => {
    for (const code of ["P06", "P40", "P41"]) expect(data.dose_rule_rows.filter(r => r.product_key === key(code))).toEqual([]);
    for (const code of ["P40", "P41"]) expect(data.withdrawal_rule_rows.filter(r => r.product_key === key(code))).toEqual([]);
    expect(data.withdrawal_rule_rows.some(r => r.product_key === key("P33") && r.aptitude === "leite")).toBe(false);
    expect(data.withdrawal_rule_rows.some(r => r.product_key === key("P38") && r.aptitude === "leite")).toBe(false);
    expect(data.dose_rule_rows.filter(r => r.product_key === key("P05"))).toHaveLength(1);
    expect(data.dose_rule_rows.some(r => r.product_key === key("P33"))).toBe(true);
  });
  it("preserves the complete P11 technical packet", () => {
    const original = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json")).payload;
    for (const [collection, rows] of Object.entries(original)) for (const row of rows)
      expect(data[collection]).toContainEqual(row);
  });
  it("carries the documented reproductive restrictions with vaccine evidence", () => {
    for (const [code, restriction] of [["P09", "12 meses"], ["P24", "30 dias"], ["P26", "não estabelecida em prenhes"]]) {
      for (const collection of ["product_authorization_rows", "dose_rule_rows", "withdrawal_rule_rows"])
        for (const row of data[collection].filter(r => r.product_key === key(code)))
          expect(row.limitations.join(" ")).toContain(restriction);
    }
  });
  it.each(["quantity", "activation", "identity", "baseline"])("rejects a changed %s before any connection", change => {
    const altered = structuredClone(packet);
    if (change === "quantity") altered.payload.dose_rule_rows[0].dose_quantity = 99;
    if (change === "activation") altered.payload.product_rows[0].metadata.operational_authorization = true;
    if (change === "identity") altered.payload.product_rows[0].id = "00000000-0000-4000-8000-000000000001";
    if (change === "baseline") altered.baseline.product_rows.pop();
    const target = path.join(temporary, `${change}.json`);
    writeFileSync(target, JSON.stringify(altered));
    const result = cli("--validate", "--c02-f6", target);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("C02_F6_CANDIDATE_CHANGED");
  });
  it("refuses generic apply, remote options and a missing local port", () => {
    for (const args of [["--apply"], ["--apply-local", "--host", "remote.invalid"], ["--apply-local"]]) {
      const result = cli("--c02-f6", file, ...args);
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("summary");
    }
  });
});
