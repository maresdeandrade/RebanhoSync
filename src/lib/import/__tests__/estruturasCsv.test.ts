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

  it("parses new agronomic fields", () => {
    const csv = [
      "nome;area_ha;genero;capim;variedade;entrada_cm;saida_cm;capacidade_alvo",
      "Piquete 1;10;Panicum;Mombaca;Piatã;35;15;20",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      forrageiraGenero: "Panicum",
      forrageiraNome: "Mombaca",
      forrageiraCultivar: "Piatã",
      alturaEntrada: 35,
      alturaSaida: 15,
      capacidadeUaAlvo: 20,
    });
  });

  it("parses canonical pasture management headers", () => {
    const csv = [
      "nome;area_ha;tipo_pasto;tipo_area;forrageira_genero;forrageira_cultivar;altura_entrada_alvo_cm;altura_saida_alvo_cm;capacidade_ua_alvo",
      "Piquete 1;10;cultivado;cultivado;Panicum;Massai;35;15;20",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      forrageiraCultivar: "Massai",
      alturaEntrada: 35,
      alturaSaida: 15,
      capacidadeUaAlvo: 20,
    });
  });

  it("validates height targets: entrada > saida", () => {
    const csv = [
      "nome;area_ha;entrada_cm;saida_cm",
      "Erro Altura;10;15;35",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((i) => i.message.includes("menor que a altura de entrada"))).toBe(true);
  });

  it("keeps old pasture CSV format working", () => {
    const csv = [
      "nome;area_ha;capacidade_ua;tipo_pasto;observacoes",
      "Reserva;8;;nativo;Uso estrategico",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      nome: "Reserva",
      areaHa: 8,
      capacidadeUa: null,
      tipoPasto: "nativo",
      tipoArea: null,
      forrageiraGenero: null,
      forrageiraNome: null,
      forrageiraCultivar: null,
      alturaEntrada: null,
      alturaSaida: null,
      capacidadeUaAlvo: null,
    });
  });

  it("rejects zero or negative height targets when filled", () => {
    const csv = [
      "nome;area_ha;entrada_cm;saida_cm",
      "Altura zero;10;0;5",
      "Altura negativa;10;20;-1",
    ].join("\n");

    const result = parsePastoImportCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "altura_entrada",
          message: "Altura de entrada deve ser maior que zero.",
        }),
        expect.objectContaining({
          field: "altura_saida",
          message: "Altura de saida deve ser maior que zero.",
        }),
      ]),
    );
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
