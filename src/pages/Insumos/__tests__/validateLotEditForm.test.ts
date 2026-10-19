import { describe, expect, it } from "vitest";

import { validateLotEditForm } from "../helpers/validateLotEditForm";
import { resolveLotEditCosts } from "../helpers/resolveLotEditCosts";
import { buildLotEditOperations } from "../helpers/buildLotEditOperations";
import type { LotEditForm } from "../types";
import { validateBaselineLotEditForm } from "./fixtures/lotEditValidation.baseline";
import { buildBaselineLotEditOperations } from "./fixtures/lotEditOperations.baseline";

type Fields = Parameters<typeof validateBaselineLotEditForm>[0];

function expectBaseline(input: Fields) {
  const frozen = Object.freeze({ ...input });
  const actual = validateLotEditForm(frozen);
  expect(actual).toStrictEqual(validateBaselineLotEditForm(frozen));
  expect(validateLotEditForm(frozen)).toStrictEqual(actual);
  expect(frozen).toStrictEqual(input);
  return actual;
}

const minimumError = { error: "Estoque minimo deve ser maior que zero." };
const reorderError = {
  error: "Ponto de ressuprimento deve ser maior que zero.",
};

const validNumbers: Array<[string, number | null]> = [
  ["", null],
  [" \t\n ", null],
  ["1", 1],
  [" 2,5 ", 2.5],
  ["1.25", 1.25],
  [",5", 0.5],
  ["+1", 1],
  ["1e2", 100],
  ["0x10", 16],
  ["0b10", 2],
  ["0o10", 8],
  ["5.", 5],
  ["5e-324", Number.MIN_VALUE],
];

const invalidNumbers = [
  "0",
  "-0",
  "-1",
  "-0,5",
  "0e3",
  "NaN",
  "Infinity",
  "-Infinity",
  "1e309",
  "1e-999",
  "invalid",
  "5suffix",
  "1,2,3",
  "1 2",
  "1_000",
  "+",
];

describe("validateLotEditForm", () => {
  it.each(["", " ", " \t\n "])(
    "prioriza nome obrigatório: %j",
    (insumoNome) => {
      expect(
        expectBaseline({
          insumoNome,
          estoqueMinimoBase: "invalid",
          pontoRessuprimentoBase: "invalid",
        }),
      ).toStrictEqual({ error: "Nome do insumo e obrigatorio." });
    },
  );

  it.each(validNumbers)(
    "normaliza estoque mínimo %j para %s",
    (value, expected) => {
      expect(
        expectBaseline({
          insumoNome: " Insumo ",
          estoqueMinimoBase: value,
          pontoRessuprimentoBase: "",
        }),
      ).toStrictEqual({
        estoqueMinimoBase: expected,
        pontoRessuprimentoBase: null,
      });
    },
  );

  it.each(validNumbers)(
    "normaliza ponto de ressuprimento %j para %s",
    (value, expected) => {
      expect(
        expectBaseline({
          insumoNome: " Insumo ",
          estoqueMinimoBase: "",
          pontoRessuprimentoBase: value,
        }),
      ).toStrictEqual({
        estoqueMinimoBase: null,
        pontoRessuprimentoBase: expected,
      });
    },
  );

  it.each(invalidNumbers)(
    "preserva rejeição e precedência para %j",
    (value) => {
      expect(
        expectBaseline({
          insumoNome: "Insumo",
          estoqueMinimoBase: value,
          pontoRessuprimentoBase: "10",
        }),
      ).toStrictEqual(minimumError);
      expect(
        expectBaseline({
          insumoNome: "Insumo",
          estoqueMinimoBase: "5",
          pontoRessuprimentoBase: value,
        }),
      ).toStrictEqual(reorderError);
      expect(
        expectBaseline({
          insumoNome: "Insumo",
          estoqueMinimoBase: value,
          pontoRessuprimentoBase: "invalid",
        }),
      ).toStrictEqual(minimumError);
    },
  );

  it.each([
    ["5", "10", 5, 10],
    ["5", "5", 5, 5],
    [" 1,25 ", " 2,5 ", 1.25, 2.5],
  ] as const)(
    "aceita mínimo=%s e ponto=%s",
    (minimum, reorder, expectedMinimum, expectedReorder) => {
      expect(
        expectBaseline({
          insumoNome: "Insumo",
          estoqueMinimoBase: minimum,
          pontoRessuprimentoBase: reorder,
        }),
      ).toStrictEqual({
        estoqueMinimoBase: expectedMinimum,
        pontoRessuprimentoBase: expectedReorder,
      });
    },
  );

  it("rejeita ponto inferior ao mínimo após validar ambos os números", () => {
    expect(
      expectBaseline({
        insumoNome: "Insumo",
        estoqueMinimoBase: "10",
        pontoRessuprimentoBase: "5",
      }),
    ).toStrictEqual({
      error:
        "Ponto de ressuprimento deve ser maior ou igual ao estoque minimo.",
    });
  });
});

function planLotEdit(
  editForm: LotEditForm,
  validate: typeof validateBaselineLotEditForm,
  build: typeof buildBaselineLotEditOperations,
) {
  const validation = validate(editForm);
  if ("error" in validation) return validation;
  const costResolution = resolveLotEditCosts({
    quantidadeBase: 10,
    custoTotal: editForm.custoTotal,
    custoUnitario: editForm.custoUnitario,
    origemCusto: editForm.origemCusto,
  });
  if ("error" in costResolution) return costResolution;
  return build({
    insumo: { id: "insumo-1", payload: { extra: "preservado" } },
    lot: { id: "lot-1", payload: { finance_transaction_id: "finance-1" } },
    apresentacao: { id: "apresentacao-1", payload: { extra: "preservado" } },
    editForm,
    ...validation,
    costResolution,
  });
}

describe("integração C2C → C2A → C2B", () => {
  it.each([
    ["", "", "", ""],
    ["5", "10", "100", ""],
    ["5", "", "", "10"],
    ["", "10", "100", "10"],
    ["1,5", "2,5", "invalid", ""],
    ["invalid", "invalid", "invalid", "invalid"],
  ])(
    "preserva a saída para mínimo=%j, ponto=%j, total=%j, unitário=%j",
    (minimum, reorder, total, unit) => {
      const form: LotEditForm = {
        lotId: "lot-1",
        insumoNome: " Insumo ",
        categoria: " Categoria ",
        ativo: true,
        estoqueMinimoBase: minimum,
        pontoRessuprimentoBase: reorder,
        apresentacaoNome: " Apresentação ",
        apresentacaoFabricante: " Fabricante ",
        identificacaoLote: " Lote ",
        validade: "",
        fabricante: "",
        localArmazenamento: "",
        status: "ativo",
        custoTotal: total,
        custoUnitario: unit,
        origemCusto: "financeiro_vinculado",
      };
      expect(
        planLotEdit(form, validateLotEditForm, buildLotEditOperations),
      ).toStrictEqual(
        planLotEdit(
          form,
          validateBaselineLotEditForm,
          buildBaselineLotEditOperations,
        ),
      );
    },
  );
});
