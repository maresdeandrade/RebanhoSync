import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInventoryPresentationName,
  calculateInventoryCostSummary,
  isVeterinaryProductRequired,
} from "@/lib/inventory/inventoryFormPresets";
import type { EntryForm } from "../types";
import { validateEntryForm } from "../helpers/validateEntryForm";
import { prepareEntryCosts } from "../helpers/prepareEntryCosts";
import { buildEntryOperations } from "../helpers/buildEntryOperations";
import {
  planBaselineEntry,
  validateBaselineFields,
  prepareBaselineCosts,
  buildBaselineOperations,
} from "./fixtures/createEntry.baseline";

type Input = Parameters<typeof planBaselineEntry>[0];
type Overrides = Partial<Omit<Input, "entryForm">> & {
  entryForm?: Partial<EntryForm>;
};

function makeInput({ entryForm: overrides, ...other }: Overrides = {}): Input {
  const entryForm: EntryForm = {
    tipo: "nutricional",
    nome: " Ração ",
    categoria: " Suplemento ",
    produtoVeterinarioId: "__none__",
    unidadeBase: "kg",
    unidadeCompra: "saco",
    apresentacaoNome: " Saco especial ",
    quantidadePorApresentacao: "25",
    quantidadeEntrada: "10",
    identificacaoLote: " Lote A ",
    validade: "2027-10-19",
    fabricante: " Fabricante ",
    localArmazenamento: " Depósito ",
    costMode: "custo_total",
    custoTotal: " 1000,00 ",
    custoUnitario: "100",
    origemCusto: "manual",
    financeTransactionId: null,
    ...overrides,
  };
  return {
    entryForm,
    entryCostSummary: calculateInventoryCostSummary(
      entryForm,
      entryForm.costMode,
    ),
    entryRequiresVeterinaryProduct: isVeterinaryProductRequired(
      entryForm.tipo,
      entryForm.categoria,
      entryForm.nome,
    ),
    resolvedEntryPresentationName:
      entryForm.apresentacaoNome.trim() ||
      buildInventoryPresentationName(entryForm),
    noneValue: "__none__",
    generated: {
      now: "2026-10-19T12:34:56.789Z",
      insumoId: "insumo-1",
      apresentacaoId: "apresentacao-1",
      loteId: "lot-1",
      movimentoId: "movement-1",
    },
    ...other,
  };
}

function planEntry(input: Input) {
  const quantities = validateEntryForm(input);
  if ("error" in quantities) return quantities;
  const costs = prepareEntryCosts(input);
  if ("error" in costs) return costs;
  return buildEntryOperations({ ...input, quantities, costs });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function compare(overrides?: Overrides) {
  const input = deepFreeze(makeInput(overrides));
  const before = structuredClone(input);
  const quantities = validateEntryForm(input);
  expect(quantities).toStrictEqual(validateBaselineFields(input));
  if (!("error" in quantities)) {
    const costs = prepareEntryCosts(input);
    expect(costs).toStrictEqual(prepareBaselineCosts(input));
    if (!("error" in costs)) {
      expect(
        buildEntryOperations({ ...input, quantities, costs }),
      ).toStrictEqual(buildBaselineOperations({ ...input, quantities, costs }));
    }
  }
  const result = planEntry(input);
  expect(result).toStrictEqual(planBaselineEntry(input));
  expect(planEntry(input)).toStrictEqual(result);
  expect(input).toStrictEqual(before);
  if (Array.isArray(result)) {
    expect(
      result.map(({ table, action, record }) => [table, action, record.id]),
    ).toStrictEqual([
      ["insumos", "INSERT", input.generated.insumoId],
      ["insumo_apresentacoes", "INSERT", input.generated.apresentacaoId],
      ["insumo_lotes", "INSERT", input.generated.loteId],
      ["insumo_movimentacoes", "INSERT", input.generated.movimentoId],
    ]);
  }
  return result;
}

const scenarios: Array<{ name: string; input?: Overrides }> = [
  { name: "entrada nutricional com custo total" },
  {
    name: "modo sem custos ignora campos inválidos",
    input: {
      entryForm: {
        costMode: "ausente",
        custoTotal: "invalid",
        custoUnitario: "invalid",
      },
    },
  },
  {
    name: "custo por entrada usa resumo canônico",
    input: {
      entryForm: {
        costMode: "custo_unitario",
        custoTotal: "invalid",
        custoUnitario: " 12,34567 ",
      },
    },
  },
  {
    name: "custo total ignora custo unitário inválido",
    input: { entryForm: { custoUnitario: "invalid" } },
  },
  {
    name: "arredondamento por custo total",
    input: {
      entryForm: {
        quantidadePorApresentacao: "3",
        quantidadeEntrada: "7",
        custoTotal: "1",
      },
    },
  },
  {
    name: "arredondamento por custo de entrada",
    input: {
      entryForm: {
        quantidadePorApresentacao: "3",
        quantidadeEntrada: "7",
        costMode: "custo_unitario",
        custoUnitario: "0,333333",
      },
    },
  },
  {
    name: "quantidades decimais e espaços",
    input: {
      entryForm: {
        quantidadePorApresentacao: " 1,25 ",
        quantidadeEntrada: " 2,5 ",
      },
    },
  },
  {
    name: "quantidades exponenciais",
    input: {
      entryForm: {
        quantidadePorApresentacao: "1e2",
        quantidadeEntrada: "0x10",
      },
    },
  },
  {
    name: "produto de quantidades grande e finito",
    input: {
      entryForm: {
        quantidadePorApresentacao: "1e308",
        quantidadeEntrada: "1",
      },
    },
  },
  {
    name: "produto veterinário clínico vinculado",
    input: {
      entryForm: {
        tipo: "sanitario",
        categoria: "Vacina",
        produtoVeterinarioId: "product-1",
        unidadeBase: "ml",
        unidadeCompra: "frasco",
      },
    },
  },
  {
    name: "sanitário sem exigência clínica",
    input: {
      entryForm: { tipo: "sanitario", categoria: "Material sanitário" },
    },
  },
  {
    name: "sentinela de seleção recebida explicitamente",
    input: {
      noneValue: "custom-none",
      entryForm: {
        tipo: "sanitario",
        categoria: "Material sanitário",
        produtoVeterinarioId: "custom-none",
      },
    },
  },
  {
    name: "id veterinário vazio mantém permissividade",
    input: {
      entryForm: {
        tipo: "sanitario",
        categoria: "Vacina",
        produtoVeterinarioId: "",
      },
    },
  },
  {
    name: "produto escolhido para outro tipo é ignorado",
    input: { entryForm: { tipo: "outro", produtoVeterinarioId: "product-1" } },
  },
  {
    name: "categoria sanitária preserva espaços",
    input: {
      entryForm: {
        tipo: "sanitario",
        categoria: " Material sanitário ",
        produtoVeterinarioId: "product-2",
      },
    },
  },
  {
    name: "nome de apresentação derivado",
    input: { entryForm: { apresentacaoNome: "  " } },
  },
  {
    name: "fallback de apresentação formatado",
    input: {
      resolvedEntryPresentationName: "",
      entryForm: { quantidadePorApresentacao: "1234,56789" },
    },
  },
  {
    name: "nome de apresentação resolvido não recebe novo trim",
    input: { resolvedEntryPresentationName: "  Nome já resolvido  " },
  },
  {
    name: "campos opcionais vazios",
    input: {
      entryForm: {
        categoria: "",
        identificacaoLote: "",
        validade: "",
        fabricante: "",
        localArmazenamento: "",
      },
    },
  },
  {
    name: "campos opcionais em branco",
    input: {
      entryForm: {
        categoria: " ",
        identificacaoLote: " ",
        validade: " ",
        fabricante: " ",
        localArmazenamento: " ",
      },
    },
  },
  {
    name: "resumo previamente calculado preservado",
    input: {
      entryCostSummary: {
        custoTotal: 123.45,
        custoPorEntrada: 12.345,
        custoUnitarioBase: 0.4938,
        status: "informado",
      },
    },
  },
  {
    name: "resumo ausente previamente calculado preservado",
    input: {
      entryCostSummary: {
        custoTotal: null,
        custoPorEntrada: null,
        custoUnitarioBase: null,
        status: "ausente",
      },
    },
  },
  {
    name: "dados gerados explícitos alternativos",
    input: {
      generated: {
        now: "2020-01-02T03:04:05.006Z",
        insumoId: "input-id",
        apresentacaoId: "presentation-id",
        loteId: "lot-id",
        movimentoId: "movement-id",
      },
    },
  },
];

afterEach(() => vi.restoreAllMocks());

describe("cadastro de entrada: equivalência com main@52a6ddb", () => {
  it.each(scenarios)("preserva operações completas: $name", ({ input }) => {
    compare(input);
  });

  it.each(["", " ", " \t\n "])(
    "prioriza nome inválido %j sobre demais erros",
    (nome) => {
      expect(
        compare({
          entryRequiresVeterinaryProduct: true,
          entryForm: {
            nome,
            quantidadeEntrada: "invalid",
            custoTotal: "invalid",
          },
        }),
      ).toStrictEqual({ error: "Nome do insumo e obrigatorio." });
    },
  );

  it("prioriza exigência veterinária sobre quantidade e custo", () => {
    expect(
      compare({
        entryForm: {
          tipo: "sanitario",
          categoria: "Vacina",
          quantidadeEntrada: "invalid",
          custoTotal: "invalid",
        },
      }),
    ).toStrictEqual({
      error:
        "Categoria sanitaria clinica exige produto veterinario catalogado.",
    });
  });

  it.each([
    "",
    " ",
    "0",
    "-0",
    "-1",
    "invalid",
    "1suffix",
    "1,2,3",
    "Infinity",
    "1e309",
    "1e-999",
  ])(
    "preserva rejeição de quantidade %j e precedência sobre custo",
    (value) => {
      for (const field of [
        "quantidadeEntrada",
        "quantidadePorApresentacao",
      ] as const) {
        expect(
          compare({ entryForm: { [field]: value, custoTotal: "invalid" } }),
        ).toStrictEqual({
          error:
            "Quantidade de entrada e apresentacao devem ser maiores que zero.",
        });
      }
    },
  );

  it.each([
    "invalid",
    "-1",
    "Infinity",
    "-Infinity",
    "1e309",
    "1suffix",
    "1,2,3",
  ])("rejeita somente custo ativo inválido %j", (value) => {
    expect(
      compare({
        entryForm: {
          costMode: "custo_total",
          custoTotal: value,
          custoUnitario: "invalid",
        },
      }),
    ).toStrictEqual({ error: "Custo total informado e invalido." });
    expect(
      compare({
        entryForm: {
          costMode: "custo_unitario",
          custoUnitario: value,
          custoTotal: "invalid",
        },
      }),
    ).toStrictEqual({ error: "Custo por entrada informado e invalido." });
  });

  it.each(["", " \t ", "0", "-0", " 1,25 ", "1e2", "0x10"])(
    "preserva custo opcional/numérico %j",
    (value) => {
      compare({ entryForm: { costMode: "custo_total", custoTotal: value } });
      compare({
        entryForm: { costMode: "custo_unitario", custoUnitario: value },
      });
    },
  );

  it.each(["manual", "ausente", "financeiro_vinculado"] as const)(
    "preserva origem %s e metadados financeiros",
    (origemCusto) => {
      compare({
        entryForm: { origemCusto, financeTransactionId: "finance-1" },
      });
      compare({
        entryForm: {
          origemCusto,
          financeTransactionId: "finance-1",
          costMode: "ausente",
        },
      });
    },
  );

  it("preserva null financeiro herdado e snapshots do resumo", () => {
    const result = compare({
      entryForm: {
        origemCusto: "financeiro_vinculado",
        financeTransactionId: "finance-1",
      },
    });
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) throw new Error("Expected operations");
    expect(result[2].record).toMatchObject({
      custo_total: 1000,
      custo_unitario: 4,
      saldo_atual_base: 0,
      payload: {
        finance_transaction_id: null,
        origem_custo: "financeiro_vinculado",
        origem: "inventario_ui_mvp",
      },
    });
    expect(result[3].record).toMatchObject({
      insumo_id: "insumo-1",
      insumo_lote_id: "lot-1",
      occurred_at: "2026-10-19T12:34:56.789Z",
      custo_total_snapshot: 1000,
      custo_unitario_snapshot: 4,
      quantidade_base: 250,
    });
  });

  it("helpers não geram novos IDs ou timestamps", () => {
    const uuid = vi.spyOn(globalThis.crypto, "randomUUID");
    const timestamp = vi.spyOn(Date.prototype, "toISOString");
    compare();
    expect(uuid).not.toHaveBeenCalled();
    expect(timestamp).not.toHaveBeenCalled();
  });
});

describe("cadastro de entrada: rejeição de quantidade calculada não finita", () => {
  it.each([
    { quantidadeEntrada: "1e308", quantidadePorApresentacao: "1e308" },
    {
      quantidadeEntrada: String(Number.MAX_VALUE),
      quantidadePorApresentacao: "2",
    },
    {
      quantidadeEntrada: "2",
      quantidadePorApresentacao: String(Number.MAX_VALUE),
    },
  ])("retorna erro de validação sem construir operações: %j", (entryForm) => {
    const input = makeInput({ entryForm });
    expect(validateEntryForm(input)).toStrictEqual({
      error: "Quantidade base calculada deve ser finita.",
    });
    expect(planEntry(input)).toStrictEqual({
      error: "Quantidade base calculada deve ser finita.",
    });
  });
});
