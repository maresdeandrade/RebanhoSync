import { describe, expect, it } from "vitest";
import {
  parseLoteImportCsv,
  parsePastoImportCsv,
} from "../estruturasCsv";

describe("parsePastoImportCsv", () => {
  it("parses aliases and normalizes decimal and pasture type", () => {
    const csv = [
      "pasto;hectares;capacidade;tipo",
      "Piquete 1;12,5;18;ILPF",
      "Reserva;8;0;nativo",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      nome: "Piquete 1",
      areaHa: 12.5,
      capacidadeUa: 18,
      tipoPasto: "integracao",
    });
    expect(result.rows[1]?.capacidadeUa).toBe(0);
  });

  it("reports duplicate names and invalid area", () => {
    const csv = [
      "nome;area_ha",
      "Piquete 1;10",
      "Piquete 1;abc",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((issue) => issue.message.includes("duplicado"))).toBe(true);
  });
});

describe("parseLoteImportCsv", () => {
  it("parses default status and linked pasture column", () => {
    const csv = [
      "lote;pasto;obs",
      "Matrizes;Piquete 1;Lote principal",
      "Recria;;Animais novos",
    ].join("\n");

    const result = parseLoteImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      nome: "Matrizes",
      status: "ativo",
      pastoNome: "Piquete 1",
    });
  });

  it("rejects invalid status values", () => {
    const csv = [
      "nome;status",
      "Matrizes;aberto",
    ].join("\n");

    const result = parseLoteImportCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.field).toBe("status");
  });
});
