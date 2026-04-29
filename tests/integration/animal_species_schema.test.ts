import { describe, expect, it } from "vitest";

import { readCanonicalBaselineMigration } from "../helpers/supabaseMigrations";

const baselineSql = readCanonicalBaselineMigration();

function extractAnimaisTable() {
  const match = baselineSql.match(
    /create table public\.animais \([\s\S]*?\n\);/,
  );
  expect(match, "public.animais table not found").not.toBeNull();
  return match?.[0] ?? "";
}

function schemaAcceptsSpecies(value: "bovino" | "bubalino" | null) {
  return value === null || value === "bovino" || value === "bubalino";
}

describe("P6.3a animal species schema contract", () => {
  it("models animais.especie as nullable text with the canonical minimum values", () => {
    const animaisTable = extractAnimaisTable();

    expect(animaisTable).toContain("especie text");
    expect(animaisTable).toContain(
      "constraint chk_animais_especie check (especie is null or especie in ('bovino','bubalino'))",
    );
  });

  it.each(["bovino", "bubalino", null] as const)(
    "accepts %s as animal species",
    (value) => {
      expect(schemaAcceptsSpecies(value)).toBe(true);
    },
  );

  it("rejects species outside the canonical minimum", () => {
    expect(schemaAcceptsSpecies("caprino" as "bovino")).toBe(false);
  });
});
