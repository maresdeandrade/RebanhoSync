import { describe, expect, it } from "vitest";
import {
  TAXONOMY_FACTS_SCHEMA_VERSION,
  TaxonomyFactsValidationError,
  assertValidAnimalTaxonomyFactsContract,
  buildAnimalTaxonomyFactsContract,
  validateAnimalTaxonomyFactsContract,
} from "../taxonomyFactsContract";

describe("taxonomyFactsContract", () => {
  it("builds a versioned payload for manual writes", () => {
    const facts = buildAnimalTaxonomyFactsContract(
      null,
      {
        castrado: true,
        puberdade_confirmada: true,
      },
      "manual",
    );

    expect(facts).toEqual({
      schema_version: TAXONOMY_FACTS_SCHEMA_VERSION,
      castrado: true,
      puberdade_confirmada: true,
    });
  });

  it("rejects writer drift on event-owned fields", () => {
    expect(() =>
      buildAnimalTaxonomyFactsContract(
        null,
        {
          prenhez_confirmada: true,
        },
        "manual",
      ),
    ).toThrow(TaxonomyFactsValidationError);
  });

  it("validates schema_version and date fields", () => {
    const result = validateAnimalTaxonomyFactsContract({
      schema_version: 2,
      data_prevista_parto: "10/11/2026",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected validation failure");
    }
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["INVALID_SCHEMA_VERSION", "INVALID_DATE"]),
    );
  });

  it("accepts canonical payloads from the validator", () => {
    expect(
      assertValidAnimalTaxonomyFactsContract({
        schema_version: 1,
        prenhez_confirmada: true,
        data_prevista_parto: "2026-11-10",
      }),
    ).toMatchObject({
      schema_version: 1,
      prenhez_confirmada: true,
      data_prevista_parto: "2026-11-10",
    });
  });
});
