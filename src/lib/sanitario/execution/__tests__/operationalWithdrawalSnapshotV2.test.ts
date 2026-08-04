import { describe, expect, it } from "vitest";
import type {
  SanitarioFonteCoberturaCampoLocalV2,
  SanitarioFonteTecnicaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
} from "@/lib/offline/types";
import {
  buildOperationalWithdrawalSnapshotV2,
  calculateOperationalWithdrawalEndV2,
  projectOperationalWithdrawalLegacyFieldsV2,
  type BuildOperationalWithdrawalSnapshotInputV2,
} from "../operationalWithdrawalSnapshotV2";

const source: SanitarioFonteTecnicaLocalV2 = {
  id: "source-1", kind: "bula", scope: "global", fazenda_id: null,
  title: "Bula", issuer: "Fabricante", version: "v1", published_at: null,
  accessed_at: "2026-01-01T00:00:00Z", url: null, jurisdiction_country: "BR",
  jurisdiction_uf: null, jurisdiction_zone: null, strength: "forte",
  evidence_status: "SIM_BULA", limitations: [], metadata: {}, created_by: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};
const coverage: SanitarioFonteCoberturaCampoLocalV2 = {
  id: "coverage-1", source_id: source.id, field_key: "withdrawal",
  coverage_status: "covers", notes: null, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
};
const rule = (overrides: Partial<SanitarioProdutoCarenciaRuleLocalV2> = {}): SanitarioProdutoCarenciaRuleLocalV2 => ({
  id: "rule-1", product_id: "product-1", species_code: "bovino", aptitude: "corte",
  route: "subcutanea", dose_basis: "dose", meat_days: 10, milk_days: 2,
  milk_hours: null, applicability: "period", zero_requires_explicit_source: true,
  valid_from: null, valid_until: null, status_curatorial: "ativo", limitations: [],
  metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null, ...overrides,
});
const input = (overrides: Partial<BuildOperationalWithdrawalSnapshotInputV2> = {}): BuildOperationalWithdrawalSnapshotInputV2 => ({
  eventId: "event-1", fazendaId: "farm-1", productId: "product-1",
  productCatalogUpdatedAt: "2026-01-01T00:00:00Z",
  factualReferenceAt: "2026-07-02T23:30:00.000Z", route: "subcutanea", doseBasis: "dose",
  animals: [{ animalId: "animal-1", speciesCode: "bovino", aptitude: "corte" }],
  rules: [rule()],
  productSources: [{ product_id: "product-1", source_id: source.id, field_key: "withdrawal", created_at: "2026-01-01T00:00:00Z" }],
  sources: [source], coverages: [coverage], ...overrides,
});

describe("operational withdrawal snapshot v2", () => {
  it("calcula carência factual com evidência explícita", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input());
    expect(value.results.map((result) => [result.purpose, result.state])).toEqual([
      ["meat", "calculated"], ["milk", "calculated"],
    ]);
    expect(value.results[0]).toMatchObject({ ruleId: "rule-1", sourceCoverageId: "coverage-1" });
  });

  it("mantém carne e leite independentes", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ milk_days: null })] }));
    expect(value.results.find((result) => result.purpose === "meat")?.state).toBe("calculated");
    expect(value.results.find((result) => result.purpose === "milk")?.state).toBe("unknown");
  });

  it("não amplia cobertura de outro campo para withdrawal", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ coverages: [{ ...coverage, field_key: "dose" }] }));
    expect(value.results.every((result) => result.state === "unknown")).toBe(true);
  });

  it("distingue ausência explicitamente comprovada de desconhecida", () => {
    const absent = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ applicability: "zero", meat_days: null, milk_days: null })] }));
    const unknown = buildOperationalWithdrawalSnapshotV2(input({ sources: [] }));
    expect(absent.results.every((result) => result.state === "explicit_absence")).toBe(true);
    expect(unknown.results.every((result) => result.state === "unknown")).toBe(true);
  });

  it("fonte ausente não fabrica carência", () => {
    expect(buildOperationalWithdrawalSnapshotV2(input({ productSources: [] })).limitations)
      .toContain("withdrawal_evidence_missing_or_ambiguous");
  });

  it("produto técnico indisponível offline mantém estado desconhecido", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ productCatalogUpdatedAt: null }));
    expect(value.results.every((result) => result.reason === "technical_product_unavailable")).toBe(true);
  });

  it("mais de uma regra não equivalente permanece ambígua", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule(), rule({ id: "rule-2", meat_days: 5 })] }));
    expect(value.results.every((result) => result.state === "ambiguous")).toBe(true);
  });

  it("regras semanticamente equivalentes têm seleção determinística", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ id: "rule-b" }), rule({ id: "rule-a" })] }));
    expect(value.results[0]).toMatchObject({ ruleId: "rule-a", equivalentRuleIds: ["rule-a", "rule-b"] });
  });

  it("aptidão necessária ausente não é inferida", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ animals: [{ animalId: "animal-1", speciesCode: "bovino", aptitude: null }] }));
    expect(value.results.every((result) => result.reason === "aptitude_missing")).toBe(true);
  });

  it("calcula horas desde o instante factual sem arredondar", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ milk_days: null, milk_hours: 36 })] }));
    expect(value.results.find((result) => result.purpose === "milk")).toMatchObject({
      period: { value: 36, unit: "hours" }, endsAt: "2026-07-04T11:30:00.000Z",
    });
  });

  it("calcula dias nominais em America/Sao_Paulo com término inclusivo", () => {
    expect(calculateOperationalWithdrawalEndV2({ factualReferenceAt: "2026-07-03T01:30:00.000Z", value: 2, unit: "days" }))
      .toEqual({ endsOn: "2026-07-04", endsAt: "2026-07-05T02:59:59.999Z" });
  });

  it("mantém resultados próprios para animais com espécies diferentes", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({
      animals: [
        { animalId: "animal-1", speciesCode: "bovino", aptitude: "corte" },
        { animalId: "animal-2", speciesCode: "bubalino", aptitude: "corte" },
      ],
    }));
    expect(value.results.filter((result) => result.qualifiers.animalId === "animal-1").every((result) => result.state === "calculated")).toBe(true);
    expect(value.results.filter((result) => result.qualifiers.animalId === "animal-2").every((result) => result.state === "unknown")).toBe(true);
  });

  it("snapshot histórico não muda quando objetos do catálogo mudam depois", () => {
    const catalogRule = rule();
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [catalogRule] }));
    catalogRule.meat_days = 99;
    expect(value.results.find((result) => result.purpose === "meat")?.period?.value).toBe(10);
  });

  it("via divergente produz estado desconhecido", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ route: "intramuscular" }));
    expect(value.results.every((result) => result.reason === "no_applicable_rule")).toBe(true);
  });

  it("fonte de outro tenant é recusada", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ sources: [{ ...source, scope: "fazenda", fazenda_id: "farm-2" }] }));
    expect(value.results.every((result) => result.state === "unknown")).toBe(true);
  });

  it("projeção legada não arredonda horas nem mistura resultados divergentes", () => {
    const snapshot = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ milk_days: null, milk_hours: 12 })] }));
    expect(projectOperationalWithdrawalLegacyFieldsV2(snapshot)).toMatchObject({
      carneDias: 10, leiteDias: null, leiteAte: "2026-07-03T11:30:00.000Z",
    });
  });

  it("rejeita período temporal inválido", () => {
    expect(() => calculateOperationalWithdrawalEndV2({ factualReferenceAt: "2026-01-01T00:00:00Z", value: 0, unit: "hours" }))
      .toThrow("SANITARY_WITHDRAWAL_PERIOD_INVALID");
  });
});
