import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { parseAnimalImportCsv } from "@/lib/import/animaisCsv";
import { parsePastoImportCsv, parseLoteImportCsv } from "@/lib/import/estruturasCsv";
import { previewAnimalsImportV2 } from "@/lib/import/importV2";
import fs from "fs";

function parseCsv(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function checkReferentialIntegrity(highVolume = false) {
  const pastosFile = highVolume ? "tests/fixtures/pastos_high_volume.csv" : "tests/fixtures/pastos_medium_volume.csv";
  const lotesFile = highVolume ? "tests/fixtures/lotes_high_volume.csv" : "tests/fixtures/lotes_medium_volume.csv";
  const animaisFile = highVolume ? "tests/fixtures/animais_high_volume.csv" : "tests/fixtures/animais_medium_volume.csv";

  const pastos = parseCsv(fs.readFileSync(pastosFile, "utf8")).map((r) => r.nome);
  const lotes = parseCsv(fs.readFileSync(lotesFile, "utf8")).map((r) => ({
    nome: r.nome,
    pasto: r.pasto,
  }));
  const animais = parseCsv(fs.readFileSync(animaisFile, "utf8")).map((r) => r.lote);

  const lotesSet = new Set(lotes.map((l) => l.nome));
  const pastosSet = new Set(pastos);

  const lotesInvalidos = lotes.filter((l) => l.pasto && !pastosSet.has(l.pasto));
  const animaisInvalidos = animais.filter((a) => a && !lotesSet.has(a));

  return {
    lotesReferencingValidPastos: lotesInvalidos.length === 0,
    animaisReferencingValidLotes: animaisInvalidos.length === 0,
  };
}

describe("fixtures - low volume", () => {
  it("parses low volume animals CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/animais_low_volume.csv", "utf8");
    const result = parseAnimalImportCsv(csv);
    expect(result.issues).toEqual([]);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toHaveProperty("paiTag");
    expect(result.rows[0]).toHaveProperty("maeTag");

    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-fixture",
      rawText: csv,
      fileName: "animais_low_volume.csv",
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      existing: {
        animais: [],
        lotes: [
          {
            id: "lote-02",
            fazenda_id: "farm-fixture",
            nome: "L_02",
            deleted_at: null,
          } as never,
        ],
      },
    });

    expect(preview.sourceTemplateVersion).toBe("import-v2");
    expect(preview.summary).toMatchObject({
      total: 2,
      valid: 2,
      rejected: 0,
    });
  });

  it("parses low volume pastos CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/pastos_low_volume.csv", "utf8");
    const result = parsePastoImportCsv(csv);
    expect(result.issues).toEqual([]);
    expect(result.rows.length).toBe(4);
  });

  it("parses low volume lotes CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/lotes_low_volume.csv", "utf8");
    const result = parseLoteImportCsv(csv);
    expect(result.rows.length).toBe(4);
    expect(result.rows[0]).toHaveProperty("touroTag");
  });
});

describe("fixtures - medium volume", () => {
  it("parses medium volume animals CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/animais_medium_volume.csv", "utf8");
    const result = parseAnimalImportCsv(csv);
    expect(result.rows.length).toBe(100);
    expect(result.rows[0]).toHaveProperty("paiTag");
    expect(result.rows[0]).toHaveProperty("maeTag");
  });

  it("parses medium volume pastos CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/pastos_medium_volume.csv", "utf8");
    const result = parsePastoImportCsv(csv);
    expect(result.rows.length).toBe(10);
  });

  it("parses medium volume lotes CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/lotes_medium_volume.csv", "utf8");
    const result = parseLoteImportCsv(csv);
    expect(result.rows.length).toBe(10);
    expect(result.rows[0]).toHaveProperty("touroTag");
  });

  it("maintains referential integrity for medium volume data", () => {
    const integrity = checkReferentialIntegrity(false);
    expect(integrity.lotesReferencingValidPastos).toBe(true);
    expect(integrity.animaisReferencingValidLotes).toBe(true);
  });
});

describe("fixtures - high volume", () => {
  it("parses high volume animals CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/animais_high_volume.csv", "utf8");
    const result = parseAnimalImportCsv(csv);
    expect(result.rows.length).toBe(5000);
    expect(result.rows[0]).toHaveProperty("paiTag");
    expect(result.rows[0]).toHaveProperty("maeTag");
  });

  it("parses high volume pastos CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/pastos_high_volume.csv", "utf8");
    const result = parsePastoImportCsv(csv);
    expect(result.rows.length).toBe(50);
  });

  it("parses high volume lotes CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/lotes_high_volume.csv", "utf8");
    const result = parseLoteImportCsv(csv);
    expect(result.rows.length).toBe(100);
    expect(result.rows[0]).toHaveProperty("touroTag");
  });

  it("maintains referential integrity for high volume data", () => {
    const integrity = checkReferentialIntegrity(true);
    expect(integrity.lotesReferencingValidPastos).toBe(true);
    expect(integrity.animaisReferencingValidLotes).toBe(true);
  });
});
