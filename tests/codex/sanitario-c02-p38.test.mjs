import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { validateCanonicalTechnicalContract } from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildPlan, assertPublishablePlan } from "../../scripts/codex/import-sanitario-protocols-v2.mjs";
import { validateWithdrawalRuleV2 } from "../../src/lib/sanitario/rules/sanitaryProductV2";
import { buildOperationalWithdrawalSnapshotV2 } from "../../src/lib/sanitario/execution/operationalWithdrawalSnapshotV2";

const packet = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P38_REVIEW_CANDIDATE_20261028.json", "utf8"));
const payload = packet.payload;
const baseline = packet.review_evidence.snapshot.rows;
const source = payload.source_rows[0];
const rule = payload.withdrawal_rule_rows[0];
const product = payload.product_rows[0];

// Read-only SQL transport double for the real canonical planner. No database,
// SQL writer, transaction, CAS or PostgreSQL constraint is simulated/certified.
class SnapshotReader {
  constructor(rows) { this.rows = structuredClone(rows); }
  async query(sql, values) {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (!text.startsWith("select * from public.")) throw new Error("Unexpected SQL in read-only dry-run");
    const table = /public\.(\w+)/.exec(text)[1];
    const fields = [...text.matchAll(/(lower\(\w+\)|coalesce\(\w+, '[^']*'\)|\w+) is not distinct from \$(\d+)/g)];
    if (!fields.length) throw new Error("Unsupported identity predicate");
    return { rows: structuredClone((this.rows[table] ?? []).filter(row =>
      (text.includes(" or id = ") && row.id === values.at(-1)) || fields.every(([, expression, position]) => {
        const field = expression.match(/\w+/g)[expression.includes("(") ? 1 : 0];
        let value = row[field] ?? null;
        if (expression.startsWith("lower(")) value = value?.toLowerCase();
        if (expression.startsWith("coalesce(")) value ??= /'([^']*)'/.exec(expression)[1];
        return value === values[Number(position) - 1];
      }))) };
  }
}

const domainRule = fieldKeys => ({
  productId: product.id, speciesCode: rule.species_code, aptitude: rule.aptitude,
  route: rule.route, meatDays: rule.meat_days, milkDays: rule.milk_days,
  applicability: rule.applicability, zeroRequiresExplicitSource: true,
  statusCuratorial: rule.status_curatorial,
  sourceRefs: [{ kind: source.kind, title: source.title, strength: source.strength,
    evidenceStatus: source.evidence_status, fieldKeys }],
});

describe("P38: candidata documental de leite, sem promoção operacional", () => {
  it("entrada P38 não aceita apply genérico, outro projeto, candidata ou porta inválida", () => {
    const args = ["scripts/codex/import-sanitario-protocols-v2.mjs", "--c02-p38",
      "docs/review/evidence/SANITARIO_V2_C02_P38_REVIEW_CANDIDATE_20261028.json",
      "--local-port", "0", "--mcp-snapshot", "docs/review/evidence/SANITARIO_V2_C02_P38_REMOTE_BEFORE_20261029.json",
      "--emit-mcp-apply", "unused-no-output.sql", "--project-ref", "zqloazqzhwauamcejmuz",
      "--authorization-ref", "C02-P38-LOCAL-NEGATIVE-CONTROL"];
    for (const change of ["apply", "project", "candidate", "port"]) {
      const changed = [...args];
      if (change === "apply") changed.push("--apply");
      if (change === "project") changed[changed.indexOf("--project-ref") + 1] = "other";
      if (change === "candidate") changed[changed.indexOf("--c02-p38") + 1] = "docs/review/evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json";
      const result = spawnSync(process.execPath, changed, { encoding: "utf8", env: { ...process.env, DB_URL: "must-not-connect" } });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain({ apply: "C02_P38_INVALID_ARGUMENT", project: "C02_P38_AUTHORIZATION_REQUIRED",
        candidate: "C02_P38_CANDIDATE_CHANGED", port: "C02_P38_LOCAL_PORT_REQUIRED" }[change]);
    }
  });
  it("estado remoto persiste somente cinco linhas novas e replay não promove regras", () => {
    const before = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P38_REMOTE_BEFORE_20261029.json", "utf8")).rows;
    const result = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P38_REMOTE_RESULT_20261029.json", "utf8"));
    expect(result.apply).toMatchObject({ create: 5, update: 0, skip: 1, approved: 0 });
    expect(result.replay).toMatchObject({ replay: true, skip: 6 });
    let added = 0;
    for (const [table, rows] of Object.entries(before)) {
      const after = result.snapshot.rows[table];
      for (const row of rows) expect(after).toContainEqual(row);
      added += after.length - rows.length;
    }
    expect(added).toBe(5);
    expect(result.snapshot.rows.sanitario_produto_carencia_rules_v2.every(r => r.status_curatorial === "precisa_validar")).toBe(true);
  });

  it("snapshot P38 persistido: regra/fonte exatas, leite não comprova corte", () => {
    const rows = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P38_REMOTE_RESULT_20261029.json", "utf8")).snapshot.rows;
    const evaluate = (aptitude, rules = rows.sanitario_produto_carencia_rules_v2, withdrawalSources = rows.sanitario_produto_carencia_fontes_v2) =>
      buildOperationalWithdrawalSnapshotV2({ eventId: "synthetic-only", fazendaId: "synthetic-only", productId: product.id,
        productCatalogUpdatedAt: rows.sanitario_produtos_v2[0].updated_at, factualReferenceAt: "2026-10-29T12:00:00Z",
        route: "SC", doseBasis: "kg_peso_vivo", animals: [{ animalId: "synthetic-only", speciesCode: "bovino", aptitude }],
        rules, withdrawalSources, productSources: rows.sanitario_produto_fontes_v2,
        sources: rows.sanitario_fontes_tecnicas_v2, coverages: rows.sanitario_fonte_cobertura_campos_v2 });
    for (const aptitude of ["leite", "corte", "mista"]) {
      expect(evaluate(aptitude).results.every(r => r.state === "unknown")).toBe(true);
    }
    // Synthetic copies ONLY; persisted statuses and links remain untouched.
    const active = rows.sanitario_produto_carencia_rules_v2.map(r => ({ ...r, status_curatorial: "ativo" }));
    expect(evaluate("leite", active).results.map(r => [r.purpose, r.state])).toEqual([["meat", "unknown"], ["milk", "explicit_absence"]]);
    expect(evaluate("corte", active).results.every(r => r.state === "unknown")).toBe(true);
    const cut = active.find(r => r.aptitude === "corte");
    const syntheticLinks = [...rows.sanitario_produto_carencia_fontes_v2,
      { withdrawal_rule_id: cut.id, source_id: source.id, field_key: "withdrawal", created_at: "2026-10-29" }];
    expect(evaluate("corte", active, syntheticLinks).results.find(r => r.purpose === "meat"))
      .toMatchObject({ state: "calculated", period: { value: 12, unit: "days" }, sourceRef: { id: source.id } });
    expect(evaluate("mista", active).results.every(r => r.state === "unknown")).toBe(true);
  });
  it("valida o contrato canônico e mantém o produto atual integralmente", () => {
    expect(validateCanonicalTechnicalContract(packet).data.withdrawal_rule_rows).toHaveLength(1);
    const { product_key: _key, ...actual } = product;
    const { created_at: _created, updated_at: _updated, deleted_at: _deleted, ...existing } = baseline.sanitario_produtos_v2[0];
    expect(actual).toEqual(existing);
    expect(packet.execute_import).toBe(false);
    expect(Object.values(packet.import_gate)).toEqual([false, false]);
    expect(payload.product_authorization_rows).toEqual([]);
    expect(payload.dose_rule_rows).toEqual([]);
  });

  it.each(["missing", "weak", "unconfirmed"])("rejeita zero com fonte %s", change => {
    const changed = structuredClone(packet);
    if (change === "missing") changed.payload.withdrawal_rule_rows[0].source_keys = [];
    if (change === "weak") changed.payload.source_rows[0].strength = "apoio";
    if (change === "unconfirmed") changed.payload.source_rows[0].evidence_status = "PRECISA_VALIDAR";
    expect(() => validateCanonicalTechnicalContract(changed)).toThrow("carencia zero exige fonte forte");
  });

  it("exige cobertura específica withdrawal no contrato de domínio", () => {
    expect(payload.coverage_rows[0]).toMatchObject({ source_key: source.source_key, field_key: "withdrawal", coverage_status: "covers" });
    expect(payload.withdrawal_source_rows).toEqual([{ withdrawal_rule_key: rule.withdrawal_rule_key, source_key: source.source_key, field_key: "withdrawal" }]);
    expect(validateWithdrawalRuleV2(domainRule(["withdrawal"])).ok).toBe(true);
    expect(validateWithdrawalRuleV2(domainRule(["dose"])).ok).toBe(false);
  });

  it("dry-run real do planner: cinco criações, produto skip, replay seis skip", async () => {
    const data = validateCanonicalTechnicalContract(packet).data;
    const client = new SnapshotReader(baseline);
    const before = structuredClone(client.rows);
    const plan = await buildPlan(client, data);
    expect(plan.map(op => op.action).sort()).toEqual(["create", "create", "create", "create", "create", "skip"]);
    expect(plan.find(op => op.collection === "product_rows").action).toBe("skip");
    expect(client.rows).toEqual(before);
    // Project accepted creates in memory only, then ask the SAME planner again.
    for (const op of plan.filter(op => op.action === "create")) (client.rows[op.table] ??= []).push(structuredClone(op.row));
    const replay = await buildPlan(client, data);
    expect(replay.map(op => op.action)).toEqual(Array(6).fill("skip"));
    expect(client.rows.sanitario_produto_carencia_rules_v2).toHaveLength(2);
    expect(client.rows.sanitario_produto_carencia_rules_v2.find(row => row.aptitude === "corte"))
      .toEqual(before.sanitario_produto_carencia_rules_v2[0]);
    expect(client.rows.sanitario_produto_dose_rules_v2).toEqual(before.sanitario_produto_dose_rules_v2);
    expect(client.rows.sanitario_produto_especie_autorizacao_v2).toEqual(before.sanitario_produto_especie_autorizacao_v2);
  });

  it("rejeita tombstone ou UUID conflitante na fonte proposta", async () => {
    const data = validateCanonicalTechnicalContract(packet).data;
    for (const extra of [{ deleted_at: "2026-10-28" }, { source_key: "SRC_OTHER_VERSION" }]) {
      const rows = structuredClone(baseline);
      rows.sanitario_fontes_tecnicas_v2.push({ ...source, ...extra });
      const plan = await buildPlan(new SnapshotReader(rows), data);
      expect(plan.find(op => op.collection === "source_rows").action).toBe("reject");
      expect(() => assertPublishablePlan(plan)).toThrow();
    }
  });

  it.each(["leite", "corte", "mista"])("contexto %s não ganha carência ativa", aptitude => {
    expect(rule).toMatchObject({ species_code: "bovino", aptitude: "leite", route: "SC", milk_days: 0,
      meat_days: null, applicability: "zero", status_curatorial: "precisa_validar", zero_requires_explicit_source: true });
    const snapshot = buildOperationalWithdrawalSnapshotV2({
      eventId: "local-verification-only", fazendaId: "local-verification-only", productId: product.id,
      productCatalogUpdatedAt: baseline.sanitario_produtos_v2[0].updated_at,
      factualReferenceAt: "2026-10-28T12:00:00Z", route: "SC", doseBasis: "kg_peso_vivo",
      animals: [{ animalId: "local-verification-only", speciesCode: "bovino", aptitude }],
      rules: [...baseline.sanitario_produto_carencia_rules_v2, { ...rule, product_id: product.id }],
      sources: [...baseline.sanitario_fontes_tecnicas_v2, source],
      coverages: [...baseline.sanitario_fonte_cobertura_campos_v2, { ...payload.coverage_rows[0], source_id: source.id }],
      productSources: [...baseline.sanitario_produto_fontes_v2, { product_id: product.id, source_id: source.id, field_key: "withdrawal" }],
    });
    expect(snapshot.results.every(result => result.state === "unknown")).toBe(true);
    expect(snapshot.results.every(result => result.period === null)).toBe(true);
  });
});
