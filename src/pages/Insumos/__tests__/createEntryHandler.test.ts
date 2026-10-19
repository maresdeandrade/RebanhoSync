import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { convertPresentationQuantityToBase } from "@/lib/inventory/inventoryContracts";
import {
  buildInventoryPresentationName,
  calculateInventoryCostSummary,
  isVeterinaryProductRequired,
} from "@/lib/inventory/inventoryFormPresets";
import type { OperationInput } from "@/lib/offline/types";
import type { EntryForm } from "../types";
import { formatNumber } from "../helpers/formatting";
import { validateEntryForm } from "../helpers/validateEntryForm";
import { prepareEntryCosts } from "../helpers/prepareEntryCosts";
import { buildEntryOperations } from "../helpers/buildEntryOperations";

const baseline = readFileSync(
  new URL("./fixtures/createEntry.handler.baseline.txt", import.meta.url),
  "utf8",
);
const page = ts.createSourceFile(
  "Insumos.tsx",
  readFileSync(new URL("../../Insumos.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function currentHandler(): string {
  let result: string | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "handleCreateEntry"
    )
      result = node.getText(page);
    ts.forEachChild(node, visit);
  }
  visit(page);
  if (!result) throw new Error("handleCreateEntry not found");
  return result;
}

// Execute only the actual handler from the trusted repo source, binding its
// lexical dependencies explicitly. No React rendering, persistence or sync.
async function executeHandler(source: string, context: object) {
  const names = Object.keys(context).join(", ");
  const execute = new Function(
    "context",
    "const { " + names + " } = context; return (" + source + ")();",
  );
  const result: unknown = execute(context);
  if (!(result instanceof Promise)) throw new Error("Expected async handler");
  await result;
}

type Options = {
  savingEntry?: boolean;
  activeFarmId?: string | null;
  canManage?: boolean;
  form?: Partial<EntryForm>;
  gestureFails?: boolean;
  uuidFailsAt?: number;
};

async function traceHandler(source: string, options: Options = {}) {
  const trace: unknown[][] = [];
  const entryForm: EntryForm = {
    tipo: "nutricional",
    nome: " Ração ",
    categoria: "Suplemento",
    produtoVeterinarioId: "__none__",
    unidadeBase: "kg",
    unidadeCompra: "saco",
    apresentacaoNome: " Saco ",
    quantidadePorApresentacao: "25",
    quantidadeEntrada: "10",
    identificacaoLote: " Lote ",
    validade: "",
    fabricante: "",
    localArmazenamento: "",
    costMode: "custo_total",
    custoTotal: "1000",
    custoUnitario: "",
    origemCusto: "manual",
    financeTransactionId: null,
    ...options.form,
  };
  let idCount = 0;
  const context = {
    savingEntry: options.savingEntry ?? false,
    activeFarmId:
      options.activeFarmId === undefined ? "farm-1" : options.activeFarmId,
    canManage: options.canManage ?? true,
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
    NONE_VALUE: "__none__",
    EMPTY_ENTRY_FORM: { reset: true },
    Date: class FixedDate extends Date {
      constructor() {
        super("2026-10-19T12:34:56.789Z");
        trace.push(["timestamp"]);
      }
    },
    crypto: {
      randomUUID: () => {
        idCount += 1;
        trace.push(["uuid", idCount]);
        if (options.uuidFailsAt === idCount) throw new Error("uuid failure");
        return "generated-" + idCount;
      },
    },
    parsePositiveNumber: (value: string) => {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    },
    convertPresentationQuantityToBase,
    formatNumber,
    validateEntryForm,
    prepareEntryCosts,
    buildEntryOperations,
    setSavingEntry: (value: boolean) => {
      trace.push(["saving", value]);
    },
    createGesture: async (farm: string, ops: OperationInput[]) => {
      trace.push(["gesture", farm, structuredClone(ops)]);
      if (options.gestureFails) throw new Error("gesture failure");
    },
    setEntryForm: (value: unknown) => {
      trace.push(["form", value]);
    },
    setEntryEditedFields: (value: Set<string>) => {
      trace.push(["edited", value]);
    },
    setIsCustomCategory: (value: boolean) => {
      trace.push(["custom", value]);
    },
    showError: (message: string) => {
      trace.push(["error", message]);
    },
    showSuccess: (message: string) => {
      trace.push(["success", message]);
    },
  };
  try {
    await executeHandler(source, context);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    trace.push(["uncaught", error.message]);
  }
  return trace;
}

describe("handleCreateEntry: trace equivalente ao handler original", () => {
  it.each([
    { name: "sucesso", options: {} },
    {
      name: "sucesso com quantidades decimais",
      options: {
        form: { quantidadeEntrada: "2,5", quantidadePorApresentacao: "1,25" },
      },
    },
    { name: "gesto rejeitado", options: { gestureFails: true } },
    { name: "salvamento em andamento", options: { savingEntry: true } },
    { name: "sem fazenda", options: { activeFarmId: null } },
    { name: "sem permissão", options: { canManage: false } },
    {
      name: "nome obrigatório precede outros erros",
      options: {
        form: {
          nome: " ",
          quantidadeEntrada: "invalid",
          custoTotal: "invalid",
        },
      },
    },
    {
      name: "produto veterinário obrigatório",
      options: {
        form: {
          tipo: "sanitario",
          categoria: "Vacina",
          quantidadeEntrada: "invalid",
        },
      },
    },
    {
      name: "quantidade inválida",
      options: { form: { quantidadeEntrada: "0", custoTotal: "invalid" } },
    },
    { name: "custo inválido", options: { form: { custoTotal: "invalid" } } },
    {
      name: "custo unitário inválido",
      options: { form: { costMode: "custo_unitario", custoUnitario: "-1" } },
    },
    {
      name: "falha de UUID antes do saving e try",
      options: { uuidFailsAt: 3 },
    },
  ] satisfies Array<{ name: string; options: Options }>)(
    "$name",
    async ({ options }) => {
      expect(await traceHandler(currentHandler(), options)).toStrictEqual(
        await traceHandler(baseline, options),
      );
    },
  );

  it("gera um timestamp e quatro IDs, então inicia saving e executa gesto/reset", async () => {
    const trace = await traceHandler(currentHandler());
    expect(trace.slice(0, 6)).toStrictEqual([
      ["timestamp"],
      ["uuid", 1],
      ["uuid", 2],
      ["uuid", 3],
      ["uuid", 4],
      ["saving", true],
    ]);
    expect(trace.map((item) => item[0])).toStrictEqual([
      "timestamp",
      "uuid",
      "uuid",
      "uuid",
      "uuid",
      "saving",
      "gesture",
      "form",
      "edited",
      "custom",
      "success",
      "saving",
    ]);
    expect(trace[trace.length - 1]).toStrictEqual(["saving", false]);
  });

  it("falha de gesto preserva formulário, reporta erro e libera saving", async () => {
    const trace = await traceHandler(currentHandler(), { gestureFails: true });
    expect(trace.slice(-2)).toStrictEqual([
      ["error", "Falha ao criar entrada de insumo."],
      ["saving", false],
    ]);
    expect(
      trace.filter((item) =>
        ["form", "edited", "custom", "success"].includes(String(item[0])),
      ),
    ).toStrictEqual([]);
  });
});

describe("handleCreateEntry: bloqueio de overflow", () => {
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
  ])(
    "rejeita %j antes de timestamp, UUIDs, operações e gravação",
    async (form) => {
      expect(await traceHandler(currentHandler(), { form })).toStrictEqual([
        ["error", "Quantidade base calculada deve ser finita."],
      ]);
    },
  );
});
