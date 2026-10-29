import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { validateCanonicalTechnicalContract } from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildPlan, assertPublishablePlan } from "../../scripts/codex/import-sanitario-protocols-v2.mjs";
import { buildOperationalWithdrawalSnapshotV2 } from "../../src/lib/sanitario/execution/operationalWithdrawalSnapshotV2";

const packet = JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_C02_P33_CORTE_SC_REVIEW_CANDIDATE_20261029.json", "utf8"));
const payload = packet.payload;
const baseline = packet.review_evidence.snapshot.rows;
const source = payload.source_rows[0];
const rule = payload.withdrawal_rule_rows[0];
const product = payload.product_rows[0];

// Read-only transport for the canonical planner; no SQL writes or constraints simulated.
class SnapshotReader {
  constructor(rows) { this.rows = structuredClone(rows); }
  async query(sql, values) {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (!text.startsWith("select * from public.")) throw new Error("Unexpected SQL");
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

function evaluate({ status = "precisa_validar", route = "SC", aptitude = "corte", links = true } = {}) {
  return buildOperationalWithdrawalSnapshotV2({
    eventId: "synthetic-p33-only", fazendaId: "synthetic-p33-only", productId: product.id,
    productCatalogUpdatedAt: baseline.sanitario_produtos_v2[0].updated_at,
    factualReferenceAt: "2026-10-29T12:00:00Z", route, doseBasis: "kg_peso_vivo",
    animals: [{ animalId: "synthetic-p33-only", speciesCode: "bovino", aptitude }],
    rules: [...baseline.sanitario_produto_carencia_rules_v2, { ...rule, product_id: product.id, status_curatorial: status }],
    sources: [...baseline.sanitario_fontes_tecnicas_v2, source],
    coverages: [{ ...payload.coverage_rows[0], source_id: source.id }],
    productSources: [{ product_id: product.id, source_id: source.id, field_key: "withdrawal" }],
    withdrawalSources: links ? [{ withdrawal_rule_id: rule.id, source_id: source.id, field_key: "withdrawal" }] : [],
  });
}

describe("P33: candidata local de abate bovino SC, sem promoção", () => {
  it("valida contrato e preserva cadastro, gates e campos fora do recorte", () => {
    expect(validateCanonicalTechnicalContract(packet).data.withdrawal_rule_rows).toHaveLength(1);
    const { product_key: _key, ...actual } = product;
    const { created_at: _c, updated_at: _u, deleted_at: _d, ...existing } = baseline.sanitario_produtos_v2[0];
    expect(actual).toEqual(existing);
    expect(packet.execute_import).toBe(false);
    expect(Object.values(packet.import_gate)).toEqual([false, false]);
    expect(rule).toMatchObject({ route: "SC", aptitude: "corte", meat_days: 7, milk_days: null, milk_hours: null, status_curatorial: "precisa_validar" });
    expect(payload.dose_rule_rows).toEqual([]);
    expect(payload.product_authorization_rows).toEqual([]);
  });
  it("planner real propõe 5 create/1 skip e replay em memória 6 skip, sem mudar regra anterior", async () => {
    const data = validateCanonicalTechnicalContract(packet).data;
    const client = new SnapshotReader(baseline);
    const plan = await buildPlan(client, data);
    assertPublishablePlan(plan);
    expect(plan.map(op => op.action).sort()).toEqual(["create", "create", "create", "create", "create", "skip"]);
    expect(client.rows).toEqual(baseline);
    for (const op of plan.filter(op => op.action === "create")) (client.rows[op.table] ??= []).push(structuredClone(op.row));
    expect((await buildPlan(client, data)).map(op => op.action)).toEqual(Array(6).fill("skip"));
    expect(client.rows.sanitario_produtos_v2).toEqual(baseline.sanitario_produtos_v2);
    expect(client.rows.sanitario_produto_carencia_rules_v2[0]).toEqual(baseline.sanitario_produto_carencia_rules_v2[0]);
  });
  it("candidata pendente não gera carência operacional", () => {
    expect(evaluate().results.every(r => r.state === "unknown")).toBe(true);
  });
  it("cópia sintética ativa calcula carne 7 dias e mantém leite desconhecido", () => {
    const results = evaluate({ status: "ativo" }).results;
    expect(results.find(r => r.purpose === "meat")).toMatchObject({ state: "calculated", period: { value: 7, unit: "days" }, sourceRef: { id: source.id } });
    expect(results.find(r => r.purpose === "milk")).toMatchObject({ state: "unknown", period: null });
  });
  it.each([{ links: false }, { route: "IM" }, { aptitude: "leite" }])("não herda prova/contexto: %j", changes => {
    expect(evaluate({ status: "ativo", ...changes }).results.every(r => r.state === "unknown")).toBe(true);
  });
});
