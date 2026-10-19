import { describe, expect, it } from "vitest";

import { buildLotEditOperations } from "../helpers/buildLotEditOperations";
import { resolveLotEditCosts } from "../helpers/resolveLotEditCosts";
import type { LotEditForm } from "../types";
import { buildBaselineLotEditOperations } from "./fixtures/lotEditOperations.baseline";

type Input = Parameters<typeof buildBaselineLotEditOperations>[0];
type Overrides = Partial<Omit<Input, "editForm" | "costResolution">> & {
  editForm?: Partial<LotEditForm>;
};

function makeInput({
  editForm: formOverrides,
  ...overrides
}: Overrides = {}): Input {
  const editForm: LotEditForm = {
    lotId: "lot-1",
    insumoNome: "  Ração  ",
    categoria: "  Nutrição  ",
    ativo: true,
    estoqueMinimoBase: "5",
    pontoRessuprimentoBase: "10",
    apresentacaoNome: "  Saco  ",
    apresentacaoFabricante: "  Fabricante da apresentação  ",
    identificacaoLote: "  Lote A  ",
    validade: "2027-10-20",
    fabricante: "  Fabricante do lote  ",
    localArmazenamento: "  Depósito  ",
    status: "ativo",
    custoTotal: " 100,00 ",
    custoUnitario: " 10,00 ",
    origemCusto: "manual",
    ...formOverrides,
  };
  const costResolution = resolveLotEditCosts({
    quantidadeBase: 10,
    custoTotal: editForm.custoTotal,
    custoUnitario: editForm.custoUnitario,
    origemCusto: editForm.origemCusto,
  });
  if ("error" in costResolution) throw new Error(costResolution.error);

  return {
    insumo: {
      id: "insumo-1",
      payload: {
        extra_insumo: { nested: [1, "preservado", null] },
        origem_ultima_edicao: "importacao_original",
        inventory_policy: { estoque_minimo_base: 1, outro: "anterior" },
      },
    },
    lot: {
      id: "lot-1",
      payload: {
        extra_lote: { nested: ["preservado"] },
        origem: "entrada_original",
        origem_ultima_edicao: "importacao_original",
        custo_status: "anterior",
        origem_custo: "anterior",
        custo_total_informado: "anterior",
        custo_unitario_informado: "anterior",
        finance_transaction_id: "finance-1",
      },
    },
    apresentacao: {
      id: "apresentacao-1",
      payload: {
        extra_apresentacao: { nested: true },
        origem_ultima_edicao: "importacao_original",
      },
    },
    estoqueMinimoBase: 5,
    pontoRessuprimentoBase: 10,
    ...overrides,
    editForm,
    costResolution,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const scenarios: Array<{ name: string; overrides?: Overrides }> = [
  { name: "sem apresentação", overrides: { apresentacao: undefined } },
  { name: "com apresentação e nome preenchido" },
  {
    name: "apresentação com nome vazio",
    overrides: { editForm: { apresentacaoNome: "" } },
  },
  {
    name: "apresentação com nome em branco",
    overrides: { editForm: { apresentacaoNome: " \t " } },
  },
  {
    name: "custos ausentes",
    overrides: { editForm: { custoTotal: "", custoUnitario: "" } },
  },
  {
    name: "custos em branco",
    overrides: { editForm: { custoTotal: " \t", custoUnitario: " \n" } },
  },
  {
    name: "apenas custo total",
    overrides: { editForm: { custoUnitario: "" } },
  },
  {
    name: "apenas custo unitário",
    overrides: { editForm: { custoTotal: "" } },
  },
  { name: "ambos os custos" },
  {
    name: "custos zerados",
    overrides: { editForm: { custoTotal: "0", custoUnitario: "0" } },
  },
  {
    name: "origem financeira vinculada",
    overrides: { editForm: { origemCusto: "financeiro_vinculado" } },
  },
  {
    name: "origem ausente com custo informado",
    overrides: { editForm: { origemCusto: "ausente" } },
  },
  {
    name: "origem financeira sem custos",
    overrides: {
      editForm: {
        origemCusto: "financeiro_vinculado",
        custoTotal: "",
        custoUnitario: "",
      },
    },
  },
  { name: "transação financeira existente" },
  {
    name: "transação financeira ausente",
    overrides: { lot: { id: "lot-2", payload: { origem: "manual" } } },
  },
  {
    name: "transação financeira nula",
    overrides: {
      lot: { id: "lot-2", payload: { finance_transaction_id: null } },
    },
  },
  {
    name: "transação financeira vazia preservada",
    overrides: {
      lot: { id: "lot-2", payload: { finance_transaction_id: "" } },
    },
  },
  { name: "estoque mínimo e ressuprimento preenchidos" },
  {
    name: "estoque mínimo e ressuprimento nulos",
    overrides: { estoqueMinimoBase: null, pontoRessuprimentoBase: null },
  },
  {
    name: "somente estoque mínimo",
    overrides: { pontoRessuprimentoBase: null },
  },
  {
    name: "somente ponto de ressuprimento",
    overrides: { estoqueMinimoBase: null },
  },
  {
    name: "campos opcionais vazios",
    overrides: {
      editForm: {
        categoria: "",
        identificacaoLote: "",
        validade: "",
        fabricante: "",
        localArmazenamento: "",
        apresentacaoFabricante: "",
      },
    },
  },
  {
    name: "campos opcionais em branco",
    overrides: {
      editForm: {
        categoria: " ",
        identificacaoLote: " ",
        fabricante: " ",
        localArmazenamento: " ",
        apresentacaoFabricante: " ",
      },
    },
  },
  {
    name: "inativação e bloqueio do lote",
    overrides: { editForm: { ativo: false, status: "bloqueado" } },
  },
  { name: "propriedades adicionais e proveniência dos três payloads" },
  {
    name: "payloads vazios",
    overrides: {
      insumo: { id: "insumo-2", payload: {} },
      lot: { id: "lot-2", payload: {} },
      apresentacao: { id: "apresentacao-2", payload: {} },
    },
  },
];

describe("buildLotEditOperations", () => {
  it.each(scenarios)("equivale à baseline: $name", ({ overrides }) => {
    const input = deepFreeze(makeInput(overrides));
    const before = structuredClone(input);
    const expected = buildBaselineLotEditOperations(input);
    const actual = buildLotEditOperations(input);

    // Strict equality checks order, nulls, keys, payloads and financial metadata.
    expect(actual).toStrictEqual(expected);
    const hasPresentation =
      input.apresentacao && input.editForm.apresentacaoNome.trim();
    expect(
      actual.map(({ table, action, record }) => [table, action, record.id]),
    ).toStrictEqual(
      hasPresentation
        ? [
            ["insumos", "UPDATE", input.insumo.id],
            ["insumo_apresentacoes", "UPDATE", input.apresentacao.id],
            ["insumo_lotes", "UPDATE", input.lot.id],
          ]
        : [
            ["insumos", "UPDATE", input.insumo.id],
            ["insumo_lotes", "UPDATE", input.lot.id],
          ],
    );
    expect(input).toStrictEqual(before);
    expect(buildLotEditOperations(input)).toStrictEqual(actual);
  });
});
