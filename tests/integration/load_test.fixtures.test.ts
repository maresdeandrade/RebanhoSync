import { describe, expect, it } from "vitest";
import { parseAnimalImportCsv } from "@/lib/import/animaisCsv";
import { parsePastoImportCsv, parseLoteImportCsv } from "@/lib/import/estruturasCsv";
import fs from "fs";

function checkReferentialIntegrity(highVolume = false) {
  const pastosFile = highVolume ? "tests/fixtures/pastos_high_volume.csv" : "tests/fixtures/pastos_medium_volume.csv";
  const lotesFile = highVolume ? "tests/fixtures/lotes_high_volume.csv" : "tests/fixtures/lotes_medium_volume.csv";
  const animaisFile = highVolume ? "tests/fixtures/animais_high_volume.csv" : "tests/fixtures/animais_medium_volume.csv";

  const pastos = fs.readFileSync(pastosFile, "utf8")
    .split("\n").slice(1).filter(l => l.trim()).map(l => l.split(";")[0]);
  const lotesRaw = fs.readFileSync(lotesFile, "utf8")
    .split("\n").slice(1).filter(l => l.trim());
  const lotes = lotesRaw.map(l => ({
    nome: l.split(";")[0],
    pasto: l.split(";")[2]
  }));
  const animaisRaw = fs.readFileSync(animaisFile, "utf8")
    .split("\n").slice(1).filter(l => l.trim());
  const animais = animaisRaw.map(l => l.split(";")[2]); // lote_nome (semicolon delimiter)

  const lotesSet = new Set(lotes.map(l => l.nome));
  const pastosSet = new Set(pastos);

  const lotesInvalidos = lotes.filter(l => !pastosSet.has(l.pasto));
  const animaisInvalidos = animais.filter(a => !lotesSet.has(a));

  return {
    lotesReferencingValidPastos: lotesInvalidos.length === 0,
    animaisReferencingValidLotes: animaisInvalidos.length === 0,
  };
}

describe("fixtures - low volume", () => {
  it("parses low volume animals CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/animais_low_volume.csv", "utf8");
    const result = parseAnimalImportCsv(csv);
    expect(result.rows.length).toBe(10);
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
  });
});

describe("fixtures - medium volume", () => {
  it("parses medium volume animals CSV correctly", () => {
    const csv = fs.readFileSync("tests/fixtures/animais_medium_volume.csv", "utf8");
    const result = parseAnimalImportCsv(csv);
    expect(result.rows.length).toBe(100);
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
  });

  it("maintains referential integrity for high volume data", () => {
    const integrity = checkReferentialIntegrity(true);
    expect(integrity.lotesReferencingValidPastos).toBe(true);
    expect(integrity.animaisReferencingValidLotes).toBe(true);
  });
});