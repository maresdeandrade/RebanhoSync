import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCE_CATEGORIES,
  getDeterministicFinanceCategoryId,
  getLocalDefaultFinanceCategoriesOps,
} from "../categories";

describe("Finance default category authority", () => {
  it("uses deterministic identities per farm and slug", () => {
    const first = getDeterministicFinanceCategoryId("farm-1", "venda-animais");
    const retry = getDeterministicFinanceCategoryId("farm-1", "venda-animais");
    const otherFarm = getDeterministicFinanceCategoryId("farm-2", "venda-animais");
    const otherSlug = getDeterministicFinanceCategoryId("farm-1", "compra-animais");

    expect(first).toBe(retry);
    expect(first).not.toBe(otherFarm);
    expect(first).not.toBe(otherSlug);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // Vetor fixo compartilhado com o Postgres
    const fixed = getDeterministicFinanceCategoryId("00000000-0000-0000-0000-000000000000", "venda-animais");
    expect(fixed).toBe("b182fa01-e899-5328-91aa-7d57a6049ce3");
  });

  it("materializes the same default slugs and identities on retry", () => {
    const first = getLocalDefaultFinanceCategoriesOps("farm-1");
    const retry = getLocalDefaultFinanceCategoriesOps("farm-1");

    expect(first).toHaveLength(DEFAULT_FINANCE_CATEGORIES.length);
    expect(first.map((op) => op.record.slug)).toEqual(
      DEFAULT_FINANCE_CATEGORIES.map((category) => category.slug),
    );
    expect(first.map((op) => op.record.id)).toEqual(
      retry.map((op) => op.record.id),
    );
    expect(new Set(first.map((op) => op.record.slug)).size).toBe(first.length);
  });
});
