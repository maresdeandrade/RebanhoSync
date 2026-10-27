import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const candidatePath = "docs/review/evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json";
const raw = readFileSync(candidatePath, "utf8");
const temporary = mkdtempSync(path.join(tmpdir(), "rebanhosync-c02-p11-"));
let sequence = 0;
const validate = text => {
  const file = path.join(temporary, `${sequence++}.json`);
  writeFileSync(file, text);
  return spawnSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--validate", "--c02-p11", file], { encoding: "utf8" });
};
const changed = change => {
  const packet = JSON.parse(raw);
  change(packet);
  return JSON.stringify(packet, null, 2) + "\n";
};

describe("local technical C02 P11 entry", () => {
  it("rejects malformed input before any database connection", () => {
    const result = validate("{broken");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("C02_P11_CANDIDATE_CHANGED");
  });

  it.each([
    ["another product", p => { p.payload.product_rows[0].id = "00000000-0000-4000-8000-000000000001"; }],
    ["operational flag", p => { p.payload.product_rows[0].metadata.operational_authorization = true; }],
    ["active dose", p => { p.payload.dose_rule_rows[0].status_curatorial = "ativo"; }],
    ["changed quantity", p => { p.payload.dose_rule_rows[0].dose_quantity = 1; }],
    ["duplicate rule", p => { p.payload.dose_rule_rows.push(p.payload.dose_rule_rows[0]); }],
    ["MAPA identity change", p => { p.payload.product_rows[0].registro_numero = "6709"; }],
  ])("rejects %s before opening a transaction", (_, change) => {
    const result = validate(changed(change));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("C02_P11_CANDIDATE_CHANGED");
  });

  it("validates through the CLI without reading a DB URL or opening a database", () => {
    const result = spawnSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--validate", "--c02-p11", candidatePath], {
      encoding: "utf8", env: { ...process.env, DB_URL: "invalid-and-must-not-be-read" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("C02 P11 validate OK");
  });

  it("refuses remote or generic apply arguments on the C02 path", () => {
    for (const extra of [["--apply"], ["--apply-local", "--host", "remote.invalid"], ["--apply-local", "--local-port", "0"]]) {
      const result = spawnSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--c02-p11", candidatePath, ...extra], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("summary");
    }
  });
});
