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
  withdrawalSources: (overrides.rules ?? [rule()]).map(entry => ({ withdrawal_rule_id: entry.id, source_id: source.id, field_key: "withdrawal", created_at: "2026-01-01T00:00:00Z" })),
  productSources: [{ product_id: "product-1", source_id: source.id, field_key: "withdrawal", created_at: "2026-01-01T00:00:00Z" }],
  sources: [source], coverages: [coverage], ...overrides,
});

describe("operational withdrawal snapshot v2", () => {
  it.each([
    { name: "ausente", withdrawalSources: [] },
    { name: "outra regra", withdrawalSources: [{ withdrawal_rule_id: "other-rule", source_id: source.id, field_key: "withdrawal", created_at: "2026-01-01" }] },
    { name: "outro campo", withdrawalSources: [{ withdrawal_rule_id: "rule-1", source_id: source.id, field_key: "dose", created_at: "2026-01-01" }] },
  ])("fonte de produto não substitui vínculo da regra: $name", ({ withdrawalSources }) => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ withdrawalSources }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });
  it("vínculo da regra não autoriza fonte de outro produto nem fallback de cliente antigo", () => {
    const wrongProduct = buildOperationalWithdrawalSnapshotV2(input({
      productSources: [{ product_id: "other-product", source_id: source.id, field_key: "withdrawal", created_at: "2026-01-01" }],
    }));
    expect(wrongProduct.results.every(result => result.state === "unknown")).toBe(true);
    const legacy = buildOperationalWithdrawalSnapshotV2(input({ withdrawalSources: undefined }));
    expect(legacy.results.every(result => result.state === "unknown")).toBe(true);
  });
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
    const absent = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ applicability: "zero", meat_days: 0, milk_days: 0 })] }));
    const unknown = buildOperationalWithdrawalSnapshotV2(input({ sources: [] }));
    expect(absent.results.every((result) => result.state === "explicit_absence")).toBe(true);
    expect(unknown.results.every((result) => result.state === "unknown")).toBe(true);
  });

  it("P38 sintético ativo: leite zero não comprova carne zero", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({
      route: "SC",
      animals: [{ animalId: "animal-1", speciesCode: "bovino", aptitude: "leite" }],
      rules: [rule({ aptitude: "leite", route: "SC", applicability: "zero", meat_days: null, milk_days: 0 })],
    }));
    expect(value.results.find(result => result.purpose === "milk")).toMatchObject({ state: "explicit_absence", ruleId: "rule-1" });
    expect(value.results.find(result => result.purpose === "meat")).toMatchObject({ state: "unknown", period: null, sourceRef: null });
    expect(projectOperationalWithdrawalLegacyFieldsV2(value)).toMatchObject({
      carneDias: null, carneAte: null, leiteDias: null, leiteAte: null, createsActiveWithdrawal: false,
    });
  });

  it("zero com todos os valores nulos permanece desconhecido", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ applicability: "zero", meat_days: null, milk_days: null })] }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it("separa regras complementares de carne com prazo e leite zero", () => {
    const request = input({ rules: [
      rule({ id: "meat-period", meat_days: 12, milk_days: null }),
      rule({ id: "milk-zero", meat_days: null, milk_days: 0, applicability: "zero" }),
    ] });
    const before = structuredClone(request);
    const value = buildOperationalWithdrawalSnapshotV2(request);
    expect(value.results.find(result => result.purpose === "meat")).toMatchObject({
      state: "calculated", ruleId: "meat-period", equivalentRuleIds: ["meat-period"],
      period: { value: 12, unit: "days" }, endsOn: "2026-07-14", endsAt: "2026-07-15T02:59:59.999Z",
    });
    expect(value.results.find(result => result.purpose === "milk")).toMatchObject({
      state: "explicit_absence", ruleId: "milk-zero", equivalentRuleIds: ["milk-zero"],
    });
    expect(projectOperationalWithdrawalLegacyFieldsV2(value)).toMatchObject({
      carneDias: 12, carneAte: "2026-07-14", leiteDias: null, leiteAte: null, createsActiveWithdrawal: true,
    });
    expect(buildOperationalWithdrawalSnapshotV2({ ...request, rules: [...request.rules].reverse() })).toEqual(value);
    expect(buildOperationalWithdrawalSnapshotV2(request)).toEqual(value);
    expect(request).toEqual(before);
  });

  it("compara equivalência somente na finalidade avaliada", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [
      rule({ id: "rule-b", milk_days: 3 }), rule({ id: "rule-a", milk_days: 2 }),
    ] }));
    expect(value.results.find(result => result.purpose === "meat")).toMatchObject({
      state: "calculated", ruleId: "rule-a", equivalentRuleIds: ["rule-a", "rule-b"],
    });
    expect(value.results.find(result => result.purpose === "milk").state).toBe("ambiguous");
  });

  it("zero e prazo positivo para a mesma finalidade permanecem ambíguos", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [
      rule({ id: "zero", applicability: "zero", meat_days: null, milk_days: 0 }),
      rule({ id: "period", meat_days: null, milk_days: 2 }),
    ] }));
    expect(value.results.find(result => result.purpose === "milk").state).toBe("ambiguous");
    expect(value.results.find(result => result.purpose === "meat").state).toBe("unknown");
  });

  it.each([
    { meat_days: null, milk_days: 0, milk_hours: null },
    { meat_days: null, milk_days: null, milk_hours: 0 },
  ])("zero de leite explícito em dias ou horas não cobre carne: %j", values => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ ...values, applicability: "zero" })] }));
    expect(value.results.find(result => result.purpose === "milk").state).toBe("explicit_absence");
    expect(value.results.find(result => result.purpose === "meat").state).toBe("unknown");
  });

  it.each([
    { milk_days: 2, milk_hours: null },
    { milk_days: 0, milk_hours: 12 },
    { milk_days: 2, milk_hours: 0 },
  ])("zero inconsistente não comprova ausência: %j", values => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ ...values, meat_days: null, applicability: "zero" })] }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it.each(["precisa_validar", "bloqueado", "arquivado"] as const)("ignora regra %s", status_curatorial => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ status_curatorial, applicability: "zero", meat_days: 0, milk_days: 0 })] }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it.each([
    { name: "ausente", sources: [] },
    { name: "fraca", sources: [{ ...source, strength: "apoio" as const }] },
    { name: "outra fazenda", sources: [{ ...source, scope: "fazenda" as const, fazenda_id: "farm-2" }] },
  ])("zero não dispensa fonte forte da fazenda correta: $name", ({ sources }) => {
    const value = buildOperationalWithdrawalSnapshotV2(input({
      sources,
      rules: [rule({ applicability: "zero", meat_days: 0, milk_days: 0 })],
    }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it.each(["not_permitted", "not_applicable"] as const)("preserva %s sem períodos", applicability => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ applicability, meat_days: null, milk_days: null })] }));
    expect(value.results.every(result => result.state === (applicability === "not_permitted" ? "not_permitted" : "explicit_absence"))).toBe(true);
  });

  it("zero explícito de carne não cobre leite sem valor", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({ applicability: "zero", meat_days: 0, milk_days: null })] }));
    expect(value.results.find(result => result.purpose === "meat")?.state).toBe("explicit_absence");
    expect(value.results.find(result => result.purpose === "milk")?.state).toBe("unknown");
  });

  it.each(["leite", "corte", "mista"] as const)("regra ativa de leite respeita aptidão %s", aptitude => {
    const value = buildOperationalWithdrawalSnapshotV2(input({
      animals: [{ animalId: "animal-1", speciesCode: "bovino", aptitude }],
      rules: [rule({ aptitude: "leite", applicability: "zero", meat_days: null, milk_days: 0 })],
    }));
    expect(value.results.find(result => result.purpose === "meat")?.state).toBe("unknown");
    expect(value.results.find(result => result.purpose === "milk")?.state)
      .toBe(aptitude === "leite" ? "explicit_absence" : "unknown");
  });

  it.each([
    { name: "sem cobertura", coverages: [] },
    { name: "outro campo", coverages: [{ ...coverage, field_key: "dose" as const }] },
    { name: "cobertura tombstonada", coverages: [{ ...coverage, deleted_at: "2026-07-01" }] },
  ])("zero exige cobertura withdrawal válida: $name", ({ coverages }) => {
    const value = buildOperationalWithdrawalSnapshotV2(input({
      coverages, rules: [rule({ applicability: "zero", meat_days: 0, milk_days: 0 })],
    }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it("aceita fonte forte da própria fazenda e rejeita evidência ambígua", () => {
    const request = input({
      sources: [{ ...source, scope: "fazenda", fazenda_id: "farm-1" }],
      rules: [rule({ applicability: "zero", meat_days: 0, milk_days: 0 })],
    });
    expect(buildOperationalWithdrawalSnapshotV2(request).results.every(result => result.state === "explicit_absence")).toBe(true);
    const secondSource = { ...source, id: "source-2" };
    const ambiguous = buildOperationalWithdrawalSnapshotV2({
      ...request, sources: [...request.sources, secondSource],
      coverages: [coverage, { ...coverage, id: "coverage-2", source_id: secondSource.id }],
      productSources: [...request.productSources, { ...request.productSources[0], source_id: secondSource.id }],
      withdrawalSources: [...request.withdrawalSources!, { ...request.withdrawalSources![0], source_id: secondSource.id }],
    });
    expect(ambiguous.results.every(result => result.state === "unknown")).toBe(true);
  });

  it.each([
    { valid_from: "2026-07-03" },
    { valid_until: "2026-07-01" },
    { deleted_at: "2026-07-01" },
  ])("zero fora da vigência ou tombstonado não é usado: %j", values => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule({
      ...values, applicability: "zero", meat_days: 0, milk_days: 0,
    })] }));
    expect(value.results.every(result => result.state === "unknown")).toBe(true);
  });

  it("fonte ausente não fabrica carência", () => {
    expect(buildOperationalWithdrawalSnapshotV2(input({ productSources: [] })).limitations)
      .toContain("withdrawal_evidence_missing_or_ambiguous");
  });

  it("produto técnico indisponível offline mantém estado desconhecido", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ productCatalogUpdatedAt: null }));
    expect(value.results.every((result) => result.reason === "technical_product_unavailable")).toBe(true);
  });

  it("contradição em carne bloqueia carne e preserva leite equivalente", () => {
    const value = buildOperationalWithdrawalSnapshotV2(input({ rules: [rule(), rule({ id: "rule-2", meat_days: 5 })] }));
    expect(value.results.find(result => result.purpose === "meat")?.state).toBe("ambiguous");
    expect(value.results.find(result => result.purpose === "milk")?.state).toBe("calculated");
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
