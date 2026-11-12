import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { validateCanonicalTechnicalContract } from "../../scripts/codex/sanitario-v2-contract.mjs";
import { buildPlan, assertPublishablePlan } from "../../scripts/codex/import-sanitario-protocols-v2.mjs";
import { buildOperationalWithdrawalSnapshotV2 } from "../../src/lib/sanitario/execution/operationalWithdrawalSnapshotV2";
import { classifyDocumentedField, reconcileClosure } from "../../scripts/codex/summarize-sanitario-f6-closure.mjs";

const read = name => JSON.parse(readFileSync("docs/review/evidence/" + name, "utf8"));
const packet = read("SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_V14_20261112.json");
const matrix = read("SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json");
const v14Snapshot = read("SANITARIO_V2_C02_F6_CLOSURE_CONTRACT_SNAPSHOT_V14_20261112.json");
const historicalBefore = read("SANITARIO_V2_C02_F6_CLOSURE_ADMIN_BEFORE_20261029.json").rows;
const before = v14Snapshot.rows;
const payload = packet.payload;
const cell = (code, field) => matrix.cells.find(c => c.code === code && c.field === field);
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
const uuid = name => {
  const b = createHash("sha1").update(Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex")).update("rebanhosync:" + name).digest().subarray(0,16);
  b[6] = (b[6] & 15) | 80; b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex"); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
function evaluate(code, active = false, links = true) {
  const product = payload.product_rows.find(p => p.metadata.research_lot_code === code);
  const rules = payload.withdrawal_rule_rows.filter(r => r.product_key === product.product_key);
  const sid = key => payload.source_rows.find(s => s.source_key === key).id;
  return buildOperationalWithdrawalSnapshotV2({ eventId: "synthetic-f6-only", fazendaId: "synthetic-f6-only", productId: product.id,
    productCatalogUpdatedAt: "2026-10-29", factualReferenceAt: "2026-10-29T12:00:00Z", route: "SC", doseBasis: "kg_peso_vivo",
    animals: [{ animalId: "synthetic-f6-only", speciesCode: "bovino", aptitude: "corte" }],
    rules: [...before.sanitario_produto_carencia_rules_v2, ...rules.map(r => ({ ...r, product_id: product.id, status_curatorial: active ? "ativo" : r.status_curatorial }))],
    sources: [...before.sanitario_fontes_tecnicas_v2.filter(s => !payload.source_rows.some(n => n.id === s.id)), ...payload.source_rows],
    coverages: payload.coverage_rows.map(c => ({ ...c, source_id: sid(c.source_key) })),
    productSources: payload.product_source_rows.map(l => ({ product_id: payload.product_rows.find(p => p.product_key === l.product_key).id, source_id: sid(l.source_key), field_key: l.field_key })),
    withdrawalSources: links ? payload.withdrawal_source_rows.map(l => ({ withdrawal_rule_id: payload.withdrawal_rule_rows.find(r => r.withdrawal_rule_key === l.withdrawal_rule_key).id, source_id: sid(l.source_key), field_key: l.field_key })) : [],
  });
}

describe("Fechamento F6 consolidado, sem promoção operacional", () => {
  it("valida contrato v14 e proveniência fechada sem substituir evidência histórica", () => {
    expect(validateCanonicalTechnicalContract(packet).data.product_rows).toHaveLength(39);
    const raw = readFileSync("docs/review/evidence/SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_V14_20261112.json");
    expect(createHash("sha256").update(raw).digest("hex")).toBe("8ada29135f25cc87f9220758d0c3c76c647bb4b5538e29f8f7884f01b15b6654");
    const originalPath = "docs/review/evidence/SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_20261029.json";
    expect(packet.artifact_version).toBe("14.0.0-canonical-contract");
    expect(packet.reissue).toMatchObject({
      source_candidate_file: "SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_20261029.json",
      source_candidate_sha256: createHash("sha256").update(readFileSync(originalPath)).digest("hex"),
      source_artifact_version: "13.0.0-canonical-contract",
      contract_snapshot_projection_file: "SANITARIO_V2_C02_F6_CLOSURE_CONTRACT_SNAPSHOT_V14_20261112.json",
      remote_write_performed: false,
    });
    expect(packet.reissue.contract_snapshot_projection_sha256).toBe(createHash("sha256")
      .update(readFileSync("docs/review/evidence/SANITARIO_V2_C02_F6_CLOSURE_CONTRACT_SNAPSHOT_V14_20261112.json")).digest("hex"));
    expect(v14Snapshot).toMatchObject({ artifact_version: packet.artifact_version, projection_only: true, usable_as_importer_mcp_snapshot: false });
    expect(v14Snapshot.source_snapshot_sha256).toBe(createHash("sha256").update(readFileSync("docs/review/evidence/SANITARIO_V2_C02_F6_CLOSURE_ADMIN_BEFORE_20261029.json")).digest("hex"));
    expect(historicalBefore.sanitario_produtos_v2.some(p => Object.hasOwn(p.metadata, "allows_agenda_auto"))).toBe(true);
    expect(v14Snapshot.rows.sanitario_produtos_v2.every(p => !Object.hasOwn(p.metadata, "allows_agenda_auto"))).toBe(true);
    for (const p of payload.product_rows) {
      const { product_key: _key, ...actual } = p;
      const { created_at: _c, updated_at: _u, deleted_at: _d, ...prior } = v14Snapshot.rows.sanitario_produtos_v2.find(r => r.id === p.id);
      expect(actual).toEqual(prior);
      expect(p.metadata.operational_authorization).toBe(false);
    }
    expect(payload.product_authorization_rows).toEqual([]);
    expect(payload.dose_rule_rows).toEqual([]);
    expect(payload.withdrawal_rule_rows.every(r => r.status_curatorial === "precisa_validar" && r.milk_days === null)).toBe(true);
  });
  it("planner v14 ignora somente o campo legado e rejeita outras divergências de metadata", async () => {
    const data = validateCanonicalTechnicalContract(packet).data;
    const plan = await buildPlan(new SnapshotReader(before), data);
    assertPublishablePlan(plan);
    expect(plan.filter(op => op.action === "create")).toHaveLength(43);
    expect(plan.filter(op => op.action === "skip")).toHaveLength(42);
    expect(plan.some(op => op.action === "update" || op.action === "reject")).toBe(false);

    const changedSnapshot = structuredClone(before);
    const candidateProductId = payload.product_rows[0].id;
    changedSnapshot.sanitario_produtos_v2.find(p => p.id === candidateProductId).metadata.unrelated_v14_regression_probe = true;
    const changedPlan = await buildPlan(new SnapshotReader(changedSnapshot), data);
    expect(changedPlan.find(op => op.collection === "product_rows" && op.row.id === candidateProductId).action).toBe("reject");
    expect(() => assertPublishablePlan(changedPlan)).toThrow();
  });
  it("recusa outro projeto antes de conectar ou emitir SQL", () => {
    const result = spawnSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--c02-f6-closure", "unused.json",
      "--local-port", "1", "--mcp-snapshot", "unused.json", "--emit-mcp-apply", "unused.sql", "--project-ref", "other", "--authorization-ref", "F6-NEGATIVE-CONTROL"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("C02_F6_CLOSURE_AUTHORIZATION_REQUIRED");
  });
  it("matriz contém exatamente nove campos por identidade e exceções com motivo", () => {
    expect(matrix.cells).toHaveLength(351);
    expect(new Set(matrix.cells.map(c => c.code)).size).toBe(39);
    for (const p of payload.product_rows) expect(matrix.cells.filter(c => c.product_id === p.id)).toHaveLength(9);
    expect(matrix.counts).toEqual({ CONFIRMADO: 288, DIVERGENTE: 19, SEM_EVIDENCIA: 44 });
    expect(matrix.exceptions.every(c => c.reason && c.status !== "CONFIRMADO")).toBe(true);
  });
  it("preserva divergências técnicas, restrições de representação e identidades regulatórias", () => {
    for (const [code,field] of [["P33","milk"],["P40","composition"],["P40","meat"],["P40","milk"]]) expect(cell(code,field).status).toBe("DIVERGENTE");
    expect(cell("P41","composition").status).toBe("SEM_EVIDENCIA");
    expect(cell("P06","route").status).toBe("SEM_EVIDENCIA");
    expect(cell("P28","registration").status).toBe("SEM_EVIDENCIA");
    expect(cell("P38","registration")).toMatchObject({ status: "CONFIRMADO", value: { registration: "SP0001290-8" } });
    expect(cell("P12","registration")).toMatchObject({ status: "CONFIRMADO", value: { registration: "SP0000361-76" } });
    for (const code of ["P03","P06","P16","P25","P33","P34","P40"]) expect(cell(code,"registration").status).toBe("DIVERGENTE");
    expect(payload.product_source_rows.filter(l => l.field_key === "registration")).toHaveLength(23);
  });
  it("vínculos MAPA correspondem somente a identidades individuais confirmadas, sem provar carência", () => {
    for (const source of payload.source_rows.filter(s => /MAPA|P34/.test(s.source_key))) {
      expect(payload.coverage_rows.filter(c => c.source_key === source.source_key).some(c => c.field_key === "withdrawal")).toBe(false);
      expect(payload.withdrawal_source_rows.some(l => l.source_key === source.source_key)).toBe(false);
    }
    for (const coverage of payload.coverage_rows.filter(c => c.field_key === "registration")) {
      for (const record of JSON.parse(coverage.notes)) {
        expect(matrix.cells.find(c => c.product_id === record.product_id && c.field === "registration" && c.status === "CONFIRMADO")?.value).toEqual(Object.fromEntries(Object.entries(record).filter(([k]) => k !== "product_id")));
      }
    }
  });
  it("UUIDv5 novos são reproduzíveis e não colidem com linhas existentes, inclusive tombstones", () => {
    for (const source of payload.source_rows.filter(s => !before.sanitario_fontes_tecnicas_v2.some(old => old.id === s.id))) {
      expect(source.id).toBe(uuid(source.source_key));
      expect(before.sanitario_fontes_tecnicas_v2.some(s => s.source_key === source.source_key || s.url === source.url)).toBe(false);
    }
    for (const rule of payload.withdrawal_rule_rows) {
      expect(rule.id).toBe(uuid(rule.withdrawal_rule_key));
      expect(before.sanitario_produto_carencia_rules_v2.some(r => r.id === rule.id)).toBe(false);
    }
  });
  it("recibo remoto observa 43 inserções, 85 skips no replay e nenhuma linha anterior alterada", () => {
    const result = read("SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json");
    expect(result.apply).toMatchObject({ create: 43, update: 0, skip: 42, approved: 0, reject: 0 });
    expect(result.replay).toMatchObject({ replay: true, skip: 85 });
    expect(Object.values(result.postconditions).every(c => c.all_previous_rows_unchanged)).toBe(true);
    expect(Object.values(result.postconditions).reduce((n,c) => n+c.added,0)).toBe(43);
    expect(result.snapshot.rows.sanitario_produto_carencia_rules_v2.every(r => r.status_curatorial === "precisa_validar")).toBe(true);
  });
  it("matriz reconciliada corresponde à proveniência efetivamente persistida e é determinística", () => {
    expect(reconcileClosure()).toEqual(matrix);
    expect(reconcileClosure()).toEqual(reconcileClosure());
    expect(matrix.confirmed_persisted_after).toBe(283);
    expect(matrix.cells.filter(c => c.status === "CONFIRMADO" && !c.persisted_after)).toHaveLength(5);
  });
  it("classificador mantém conflito positivo, informação ausente e zero explícito distintos", () => {
    expect(classifyDocumentedField({ code: "P33", field: "milk", value: null })).toBe("DIVERGENTE");
    expect(classifyDocumentedField({ code: "P01", field: "milk", value: null })).toBe("SEM_EVIDENCIA");
    expect(classifyDocumentedField({ code: "P38", field: "milk", value: { days: 0 } }, { primaryEvidence: true })).toBe("CONFIRMADO");
  });
  it("valor preenchido, inclusive zero, não comprova campo sem evidência primária", () => {
    expect(classifyDocumentedField({ code: "synthetic", field: "milk", value: { days: 0 } })).toBe("SEM_EVIDENCIA");
    expect(classifyDocumentedField({ field: "registration", value: { status: "VIGENTE" } })).toBe("SEM_EVIDENCIA");
  });
  it("classificador não transforma Ativo com data passada ou cancelamento em vigência", () => {
    expect(classifyDocumentedField({ field: "registration", value: { status: "Ativo", expires: "20/05/2029" } }, { primaryEvidence: true })).toBe("CONFIRMADO");
    expect(classifyDocumentedField({ field: "registration", value: { status: "Ativo", expires: "20/05/2025" } })).toBe("DIVERGENTE");
    expect(classifyDocumentedField({ field: "registration", value: { status: "CANCELADO" } })).toBe("DIVERGENTE");
  });
  it.each(["P33","P38"])("%s pendente não gera prazo; cópia ativa calcula corte somente com vínculo exato", code => {
    expect(evaluate(code).results.every(r => r.state === "unknown")).toBe(true);
    expect(evaluate(code,true).results.find(r => r.purpose === "meat")).toMatchObject({ state: "calculated", period: { value: code === "P33" ? 7 : 12, unit: "days" } });
    expect(evaluate(code,true).results.find(r => r.purpose === "milk").state).toBe("unknown");
    expect(evaluate(code,true,false).results.every(r => r.state === "unknown")).toBe(true);
  });
});
