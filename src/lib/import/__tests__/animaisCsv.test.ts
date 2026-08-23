import { describe, expect, it } from "vitest";
import {
  normalizeAnimalIdentifier,
  normalizeLookupValue,
  parseAnimalImportCsv,
} from "../animaisCsv";

describe("parseAnimalImportCsv", () => {
  it("parses semicolon-delimited files with aliases", () => {
    const csv = [
      "brinco;sexo;especie;lote;data_nascimento;origem",
      "BR-001;F;bovino;Lote A;12/01/2024;nascimento",
      "BR-002;M;bubalino;Lote B;2024-02-20;compra",
    ].join("\n");

    const result = parseAnimalImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      identificacao: "BR-001",
      sexo: "F",
      especie: "bovino",
      loteNome: "Lote A",
      dataNascimento: "2024-01-12",
      origem: "nascimento",
    });
  });

  it("reports duplicate identifiers inside the file", () => {
    const csv = [
      "identificacao,sexo",
      "A-01,F",
      "A-01,M",
    ].join("\n");

    const result = parseAnimalImportCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.issues[0]?.message).toContain("duplicada");
  });

  it("rejects invalid dates and invalid sex values", () => {
    const csv = [
      "identificacao;sexo;data_nascimento",
      "A-01;X;2024-20-99",
    ].join("\n");

    const result = parseAnimalImportCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((issue) => issue.field === "sexo")).toBe(true);
  });

  it("accepts old CSV files without species", () => {
    const csv = [
      "identificacao;sexo;lote;data_nascimento;origem",
      "BR-001;F;Matrizes;2024-01-12;nascimento",
    ].join("\n");

    const result = parseAnimalImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      identificacao: "BR-001",
      especie: null,
    });
  });

  it("rejects species outside the canonical minimum", () => {
    const csv = [
      "identificacao;sexo;especie",
      "BR-001;F;caprino",
    ].join("\n");

    const result = parseAnimalImportCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({
      field: "especie",
      message: "Especie invalida. Use bovino ou bubalino.",
    });
  });

  it.each([
    "data\\_nascimento",
    "schema\\_version",
    "template\\_version",
    "**nome",
    "**rfid",
  ])(
    "rejects malformed header %s without normalizing it into a supported column",
    (header) => {
      const csv = [`identificacao;sexo;${header}`, "A-01;F;valor"].join("\n");

      const result = parseAnimalImportCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            lineNumber: 1,
            field: header,
            code: "HEADER_INVALID",
            message: expect.stringContaining(`Coluna inválida "${header}"`),
          }),
        ]),
      );
    },
  );

  it("rejects unknown columns explicitly", () => {
    const result = parseAnimalImportCsv(
      "identificacao;sexo;apelido_externo\nA-01;F;Estrela",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lineNumber: 1,
          field: "apelido_externo",
          code: "HEADER_UNKNOWN",
          message: 'Coluna desconhecida "apelido_externo".',
        }),
      ]),
    );
  });

  it("reports a required column as missing when its header is malformed", () => {
    const result = parseAnimalImportCsv(
      "identifica\\cao;sexo;nome\nA-01;F;Estrela",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "identifica\\cao",
          code: "HEADER_INVALID",
        }),
        expect.objectContaining({
          field: "identificacao",
          code: "HEADER_REQUIRED_MISSING",
          message: "Cabecalho obrigatorio ausente: identificacao.",
        }),
      ]),
    );
  });

  it("rejects deterministic malformed values before building import rows", () => {
    const result = parseAnimalImportCsv(
      "identificacao;sexo;nome;rfid\nA-01;F;**Estrela;RF-01",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toEqual([
      expect.objectContaining({
        lineNumber: 2,
        field: "nome",
        code: "VALUE_FORMAT_INVALID",
        message: expect.stringContaining('Valor inválido na coluna "nome"'),
      }),
    ]);
  });
});

describe("lookup normalizers", () => {
  it("normalizes lookup strings and identifiers", () => {
    expect(normalizeLookupValue("  Fêmea Nelore  ")).toBe("femea nelore");
    expect(normalizeAnimalIdentifier(" BR - 001 ")).toBe("br-001");
  });
});
