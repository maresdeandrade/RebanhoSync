import { describe, expect, it } from "vitest";
import {
  validateSourceCoverageForCriticalField,
  validateTechnicalSourceV2,
  type SanitarySourceRefV2,
} from "../sanitarySourceV2";

const guidelineSource: SanitarySourceRefV2 = {
  kind: "guideline_apoio",
  title: "Guideline curatorial",
  strength: "apoio",
  evidenceStatus: "PRECISA_VALIDAR",
  fieldKeys: ["withdrawal", "dose", "route"],
};

const labelSource: SanitarySourceRefV2 = {
  kind: "bula",
  title: "Bula registrada",
  issuer: "Fabricante",
  strength: "forte",
  evidenceStatus: "SIM_BULA",
  fieldKeys: ["withdrawal", "dose"],
};

describe("sanitarySourceV2", () => {
  it("guideline isolado nao valida carencia", () => {
    const result = validateSourceCoverageForCriticalField([guidelineSource], "withdrawal");

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_strong_coverage" }),
      ]),
    );
  });

  it("guideline isolado nao valida dose/via critica", () => {
    const doseResult = validateSourceCoverageForCriticalField([guidelineSource], "dose");
    const routeResult = validateSourceCoverageForCriticalField([guidelineSource], "route");

    expect(doseResult.ok).toBe(false);
    expect(routeResult.ok).toBe(false);
  });

  it("produto sem fonte forte nao libera campo critico", () => {
    const weakSource: SanitarySourceRefV2 = {
      ...labelSource,
      strength: "fraca",
      evidenceStatus: "PRECISA_VALIDAR",
    };

    const result = validateSourceCoverageForCriticalField([weakSource], "withdrawal");

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_strong_coverage" }),
      ]),
    );
  });

  it("fonte forte precisa cobrir field_key especifico", () => {
    const result = validateSourceCoverageForCriticalField([labelSource], "route");

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_strong_coverage" }),
      ]),
    );
  });

  it("source_refs_by_field nao pode estar vazio em campo critico", () => {
    const result = validateSourceCoverageForCriticalField([], "eligibility_rule");

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "critical_field_missing_source" }),
      ]),
    );
  });

  it("guideline nao pode ser fonte forte", () => {
    const result = validateTechnicalSourceV2({ ...guidelineSource, strength: "forte" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "guideline_cannot_be_strong_source" }),
      ]),
    );
  });

  it("fonte MV responsavel exige escopo da fazenda", () => {
    const result = validateTechnicalSourceV2({
      kind: "mv_responsavel",
      scope: "global",
      title: "Decisao veterinaria responsavel",
      strength: "forte",
      evidenceStatus: "SIM_NORMA",
      fieldKeys: ["species_authorization"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mv_source_requires_farm_scope" }),
      ]),
    );
  });
});
