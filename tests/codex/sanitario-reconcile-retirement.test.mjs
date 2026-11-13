import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("aposentadoria da Edge Function de recomputação sanitária", () => {
  it("impede a publicação da função aposentada pelo código e pacote locais", () => {
    expect(existsSync("supabase/functions/sanitario-reconcile/index.ts")).toBe(false);
    expect(readFileSync("supabase/config.toml", "utf8")).not.toContain("[functions.sanitario-reconcile]");
    expect(readFileSync("scripts/codex/prepare-sanitario-homologation.mjs", "utf8"))
      .not.toContain('"sanitario-reconcile"');
  });

  it("monta manifesto e pacote sem a função aposentada usando insumos sintéticos", () => {
    const root = mkdtempSync(path.join(tmpdir(), "sanitario-package-fixture-"));
    const copy = (name) => {
      const destination = path.join(root, name);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(name, destination);
    };
    const visit = (name, visited = new Set()) => {
      if (visited.has(name)) return;
      visited.add(name);
      copy(name);
      const source = readFileSync(name, "utf8");
      for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
        visit(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])), visited);
      }
      const deno = path.posix.join(path.posix.dirname(name), "deno.json");
      if (existsSync(deno)) copy(deno);
    };
    for (const name of ["sync-batch", "telemetry-ingest"]) visit(`supabase/functions/${name}/index.ts`);
    for (const name of readdirSync("supabase/migrations").filter((entry) => entry.endsWith(".sql"))) copy(`supabase/migrations/${name}`);
    for (const name of ["supabase/config.toml", "supabase/functions/deno.json", "config/backend-targets.json", "scripts/codex/import-sanitario-protocols-v2.mjs",
      "scripts/codex/sanitario-v2-contract.mjs", "scripts/codex/prepare-sanitario-class-delta-v2.mjs",
      "scripts/codex/prepare-sanitario-closure-v2.mjs", "scripts/codex/prepare-sanitario-approval-v2.mjs",
      "scripts/codex/prepare-sanitario-homologation.mjs", "scripts/codex/verify-sanitario-homologation-target.mjs",
      "scripts/codex/backend-environment.mjs"]) copy(name);

    const decisionPath = "docs/review/evidence/SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json";
    const canonicalPath = "docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json";
    const formPath = "docs/review/evidence/SANITARIO_V2_APROVACAO_PENDENTE_20261017.json";
    const put = (name, value) => { const p = path.join(root, name); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, value); };
    const keys = Array.from({ length: 7 }, (_, i) => `fixture_${i}`);
    put(canonicalPath, "{}\n");
    put(decisionPath, JSON.stringify({ schema_version: 4, decision_sets: [{ submission_status: "READY_FOR_GLOBAL_REVIEW", item_keys: keys }] }));
    put(formPath, JSON.stringify({ schema_version: 1, decisions: [] }));
    put("fixture-approval.mjs", `export const CANONICAL_PATH=${JSON.stringify(canonicalPath)}, DECISION_PATH=${JSON.stringify(decisionPath)};\n` +
      `export const buildApprovalCandidate=()=>({payload:{protocol_item_rows:${JSON.stringify(keys.map((key) => ({ id: key, protocol_id: "fixture", logical_item_key: key, version: 1, status: "draft" })))}}});\n` +
      "export const buildApprovalForm=()=>({schema_version:1,decisions:[]});\n");
    const source = readFileSync("scripts/codex/prepare-sanitario-homologation.mjs", "utf8");
    const runner = source.replace('from "./prepare-sanitario-approval-v2.mjs"', 'from "./fixture-approval.mjs"')
      .replace("const root = process.cwd();", `const root = ${JSON.stringify(root)};`);
    expect(runner).not.toBe(source);
    put("fixture-runner.mjs", runner);
    const output = path.join(root, "output");
    execFileSync(process.execPath, [path.join(root, "fixture-runner.mjs"), "--output", output], { encoding: "utf8" });
    const manifest = JSON.parse(readFileSync(path.join(output, "release-manifest.json"), "utf8"));
    expect(manifest.functions.map((entry) => entry.name)).toEqual(["sync-batch", "telemetry-ingest"]);
    expect(manifest.functions.every((entry) => entry.verify_jwt && existsSync(path.join(output, entry.entrypoint)))).toBe(true);
    expect(manifest.files.some((entry) => entry.path.includes("sanitario-reconcile"))).toBe(false);
    expect(existsSync(path.join(output, "supabase/functions/sanitario-reconcile/index.ts"))).toBe(false);
    expect(readFileSync(path.join(output, "supabase/config.toml"), "utf8")).not.toContain("[functions.sanitario-reconcile]");
    for (const entry of manifest.files) {
      expect(createHash("sha256").update(readFileSync(path.join(output, entry.path))).digest("hex")).toBe(entry.sha256);
    }
  });
});
