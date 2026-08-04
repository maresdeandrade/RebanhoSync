import { describe, expect, it } from "vitest";

import type {
  SanitarioFonteCoberturaCampoLocalV2,
  SanitarioFonteTecnicaLocalV2,
  SanitarioProdutoDoseRuleLocalV2,
  SanitarioProdutoEspecieAutorizacaoLocalV2,
  SanitarioProdutoFonteLocalV2,
  SanitarioProdutoLocalV2,
} from "@/lib/offline/types";
import { buildExecutedProductTechnicalSnapshotV2 } from "../executedProductTechnicalSnapshotV2";

const now = "2026-08-04T10:00:00.000Z";

const product = (overrides: Partial<SanitarioProdutoLocalV2> = {}): SanitarioProdutoLocalV2 => ({
  id: "product-1",
  nome_comercial: "Vacina factual",
  fabricante: "Lab",
  registro_orgao: "MAPA",
  registro_numero: "123",
  classe: "vacina",
  principio_ativo: "antigeno",
  tipo_produto: "imunobiologico",
  apresentacao: "frasco 50 mL",
  status_curatorial: "ativo",
  metadata: {},
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const source = (overrides: Partial<SanitarioFonteTecnicaLocalV2> = {}): SanitarioFonteTecnicaLocalV2 => ({
  id: "source-1",
  kind: "bula",
  scope: "global",
  fazenda_id: null,
  title: "Bula",
  issuer: "Lab",
  version: "v1",
  published_at: now,
  accessed_at: now,
  url: null,
  jurisdiction_country: "BR",
  jurisdiction_uf: null,
  jurisdiction_zone: null,
  strength: "forte",
  evidence_status: "SIM_BULA",
  limitations: [],
  metadata: {},
  created_by: null,
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const coverage = (
  fieldKey: string,
  overrides: Partial<SanitarioFonteCoberturaCampoLocalV2> = {},
): SanitarioFonteCoberturaCampoLocalV2 => ({
  id: `coverage-${fieldKey}`,
  source_id: "source-1",
  field_key: fieldKey,
  coverage_status: "covers",
  notes: null,
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const link = (fieldKey: string, sourceId = "source-1"): SanitarioProdutoFonteLocalV2 => ({
  product_id: "product-1",
  source_id: sourceId,
  field_key: fieldKey,
  created_at: now,
});

const doseRule = (
  overrides: Partial<SanitarioProdutoDoseRuleLocalV2> = {},
): SanitarioProdutoDoseRuleLocalV2 => ({
  id: "dose-rule-1",
  product_id: "product-1",
  species_code: "bovino",
  aptitude: "all",
  route: "subcutanea",
  dose_quantity: 2,
  dose_unit: "mL",
  dose_basis: "animal",
  min_weight_kg: null,
  max_weight_kg: null,
  limitations: [],
  status_curatorial: "ativo",
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const authorization = (
  overrides: Partial<SanitarioProdutoEspecieAutorizacaoLocalV2> = {},
): SanitarioProdutoEspecieAutorizacaoLocalV2 => ({
  id: "authorization-1",
  product_id: "product-1",
  species_code: "bovino",
  authorization_status: "SIM_BULA",
  aptitude: "all",
  sexo: null,
  idade_min_dias: null,
  idade_max_dias: null,
  lactacao_permitida: null,
  gestacao_permitida: null,
  requires_mv_responsavel: false,
  limitations: [],
  metadata: {},
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

function build(overrides: Record<string, unknown> = {}) {
  return buildExecutedProductTechnicalSnapshotV2({
    eventId: "event-1",
    fazendaId: "farm-1",
    executedProductId: "product-1",
    executedProductName: "Vacina factual",
    executedProductClass: "vacina",
    executedDose: { quantity: 2, unit: "mL", basis: "animal" },
    executedRoute: "subcutanea",
    animals: [{ animalId: "animal-1", speciesCode: "bovino" }],
    product: product(),
    productSources: [link("dose"), link("route"), link("species_authorization"), link("presentation")],
    sources: [source()],
    coverages: [coverage("dose"), coverage("route"), coverage("species_authorization"), coverage("presentation")],
    doseRules: [doseRule()],
    speciesAuthorizations: [authorization()],
    ...overrides,
  });
}

const evidence = (snapshot: ReturnType<typeof build>, fieldKey: string) =>
  snapshot.fieldEvidence.find((entry) => entry.fieldKey === fieldKey)!;

describe("buildExecutedProductTechnicalSnapshotV2", () => {
  it("preserva produto executado, versão técnica e evidência apenas do campo coberto", () => {
    const snapshot = build({
      productSources: [link("dose")],
      coverages: [coverage("dose")],
    });

    expect(snapshot.executedProductSnapshot).toMatchObject({
      productId: "product-1",
      catalogUpdatedAt: now,
      registroNumero: "123",
    });
    expect(evidence(snapshot, "dose").coverageStatus).toBe("covers");
    expect(evidence(snapshot, "route").coverageStatus).toBe("does_not_cover");
    expect(snapshot).not.toHaveProperty("withdrawalSnapshot");
  });

  it("preserva dose e via factuais divergentes sem declará-las cobertas", () => {
    const snapshot = build({
      executedDose: { quantity: 3, unit: "mL", basis: "animal" },
      executedRoute: "intramuscular",
    });

    expect(snapshot.executedDose.quantity).toBe(3);
    expect(snapshot.executedRoute).toBe("intramuscular");
    expect(evidence(snapshot, "dose")).toMatchObject({ coverageStatus: "does_not_cover", technicalValue: null });
    expect(evidence(snapshot, "route")).toMatchObject({ coverageStatus: "does_not_cover", technicalValue: null });
  });

  it("não aplica regra de espécie incompatível nem aptidão específica não informada", () => {
    const snapshot = build({
      doseRules: [doseRule({ species_code: "bubalino" })],
      speciesAuthorizations: [authorization({ aptitude: "leite" })],
    });

    expect(evidence(snapshot, "dose").coverageStatus).toBe("does_not_cover");
    expect(evidence(snapshot, "species_authorization").coverageStatus).toBe("does_not_cover");
  });

  it("trata múltiplas coberturas candidatas como ambíguas", () => {
    const snapshot = build({
      productSources: [link("dose"), link("dose", "source-2")],
      sources: [source(), source({ id: "source-2", version: "v2" })],
      coverages: [coverage("dose"), coverage("dose", { id: "coverage-dose-2", source_id: "source-2" })],
    });

    expect(evidence(snapshot, "dose")).toMatchObject({
      coverageStatus: "partially_covers",
      reason: "ambiguous_coverage",
      sourceRef: null,
    });
  });

  it("não fabrica evidência sem produto ou fonte no cache", () => {
    const snapshot = build({ product: null, sources: [], coverages: [] });

    expect(snapshot.executedProductSnapshot).toBeNull();
    expect(snapshot.sourceRefs).toEqual([]);
    expect(snapshot.limitations).toContain("technical_product_unavailable");
    expect(snapshot.fieldEvidence.every((entry) => entry.coverageStatus !== "covers")).toBe(true);
  });

  it("não aplica fonte de outra fazenda", () => {
    const snapshot = build({ sources: [source({ scope: "fazenda", fazenda_id: "farm-2" })] });

    expect(snapshot.fieldEvidence.every((entry) => entry.coverageStatus !== "covers")).toBe(true);
  });

  it("preserva evidências distintas por espécie e animal", () => {
    const snapshot = build({
      animals: [
        { animalId: "animal-1", speciesCode: "bovino" },
        { animalId: "animal-2", speciesCode: "bubalino" },
      ],
      doseRules: [doseRule(), doseRule({ id: "dose-rule-2", species_code: "bubalino" })],
      speciesAuthorizations: [authorization(), authorization({ id: "authorization-2", species_code: "bubalino" })],
    });

    expect(snapshot.fieldEvidence.filter((entry) => entry.fieldKey === "dose")).toHaveLength(2);
    expect(snapshot.fieldEvidence.filter((entry) => entry.fieldKey === "dose").map((entry) => entry.qualifiers.animalIds)).toEqual([
      ["animal-1"],
      ["animal-2"],
    ]);
  });

  it("snapshot histórico não muda após atualização posterior do catálogo", () => {
    const original = build();
    const updated = build({ product: product({ updated_at: "2026-09-01T00:00:00.000Z", apresentacao: "frasco 100 mL" }) });

    expect(original.executedProductSnapshot?.catalogUpdatedAt).toBe(now);
    expect(original.executedProductSnapshot?.apresentacao).toBe("frasco 50 mL");
    expect(updated.executedProductSnapshot?.catalogUpdatedAt).not.toBe(original.executedProductSnapshot?.catalogUpdatedAt);
  });
});
