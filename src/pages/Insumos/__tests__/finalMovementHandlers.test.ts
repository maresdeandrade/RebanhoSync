import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  evaluateInventoryLotManualMovement,
  evaluateInventoryLotConsumption,
} from "@/lib/inventory/inventoryContracts";
import { buildInventoryCostSnapshot } from "@/lib/inventory/costing";
import type { InsumoLote, OperationInput } from "@/lib/offline/types";
import type {
  ManualMovementForm,
  ConsumptionForm,
  SourceOption,
} from "../types";
import {
  validateManualMovement,
  prepareConsumption,
} from "../helpers/prepareInventoryMovements";
import {
  buildManualMovementOperations,
  buildConsumptionOperations,
} from "../helpers/buildInventoryMovementOperations";

type Handler = "handleCreateManualMovement" | "handleCreateConsumption";
type Lot = Parameters<typeof prepareConsumption>[0]["selectedLot"] &
  Pick<InsumoLote, "insumo_id">;
type Source = Pick<
  SourceOption,
  "eventoId" | "dominio" | "animalId" | "rebanhoLoteId" | "pastoId"
>;
type Options = {
  saving?: boolean;
  farm?: string | null;
  canManage?: boolean;
  lot?: Lot | null;
  lotPatch?: Partial<Lot>;
  source?: Source | null;
  balance?: number | null;
  quantity?: string;
  tipo?: ManualMovementForm["tipo"];
  notes?: string;
  gestureFailure?: "reject" | "after_receipt";
  uuidFails?: boolean;
  timestampFails?: boolean;
  resetFails?: boolean;
  successToastFails?: boolean;
};
type Trace =
  | { step: "saving"; value: boolean }
  | { step: "uuid" | "timestamp" | "partial_receipt" }
  | { step: "gesture"; farm: string; ops: OperationInput[] }
  | { step: "reset"; value: unknown }
  | { step: "error" | "success" | "uncaught"; message: string };

const original = readFileSync(
  new URL("./fixtures/finalMovementHandlers.baseline.txt", import.meta.url),
  "utf8",
);
const current = readFileSync(
  new URL("../../Insumos.tsx", import.meta.url),
  "utf8",
);
function handlerSource(source: string, name: Handler): string {
  const file = ts.createSourceFile(
    "Insumos.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let result: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      result = node.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!result) throw new Error("Handler missing: " + name);
  return result;
}
const sources = {
  handleCreateManualMovement: {
    before: handlerSource(original, "handleCreateManualMovement"),
    after: handlerSource(current, "handleCreateManualMovement"),
  },
  handleCreateConsumption: {
    before: handlerSource(original, "handleCreateConsumption"),
    after: handlerSource(current, "handleCreateConsumption"),
  },
};

// Bind lexical dependencies of the actual trusted handler source, without
// rendering React or executing database/sync effects.
async function execute(source: string, context: object) {
  const names = Object.keys(context).join(", ");
  const run = new Function(
    "context",
    "const { " + names + " } = context; return (" + source + ")();",
  );
  const result: unknown = run(context);
  if (!(result instanceof Promise)) throw new Error("Expected async handler");
  await result;
}

function inputs(options: Options = {}) {
  const {
    lot = {
      id: "stock-lot-1",
      insumo_id: "insumo-1",
      saldo_atual_base: 100,
      unidade_base: "kg",
      status: "ativo",
      deleted_at: null,
      quantidade_inicial_base: 1000,
      custo_unitario: 2.5,
      custo_total: 2500,
      ...options.lotPatch,
    },
    source = {
      eventoId: "executed-event-1",
      dominio: "nutricao",
      animalId: "animal-1",
      rebanhoLoteId: "herd-lot-1",
      pastoId: "pasture-1",
    },
    balance = null,
    quantity = "5",
    tipo = "ajuste_negativo",
    notes,
  } = options;
  const selectedLot = lot ? Object.freeze(lot) : null;
  const selectedSource = source ? Object.freeze(source) : null;
  const manualMovementForm: ManualMovementForm = {
    insumoLoteId: "stock-lot-1",
    tipo,
    quantidadeBase: quantity,
    observacoes: notes ?? " Registro manual ",
  };
  const consumptionForm: ConsumptionForm = {
    sourceKey: "executed-event-1:nutricao",
    insumoLoteId: "stock-lot-1",
    quantidadeBase: quantity,
    observacoes: notes ?? " Consumo factual ",
  };
  return {
    selectedManualMovementLot: selectedLot,
    selectedLot,
    selectedSource,
    selectedManualMovementLotBalance: balance,
    selectedLotBalance: balance,
    manualMovementForm: Object.freeze(manualMovementForm),
    consumptionForm: Object.freeze(consumptionForm),
  };
}

async function traceHandler(source: string, options: Options = {}) {
  const trace: Trace[] = [];
  const setSaving = (value: boolean) => {
    trace.push({ step: "saving", value });
  };
  const reset = (value: unknown) => {
    trace.push({ step: "reset", value });
    if (options.resetFails) throw new Error("reset interrupted after gesture");
  };
  const context = {
    ...inputs(options),
    savingManualMovement: options.saving ?? false,
    savingConsumption: options.saving ?? false,
    activeFarmId: options.farm === undefined ? "farm-1" : options.farm,
    canManage: options.canManage ?? true,
    EMPTY_MANUAL_MOVEMENT_FORM: { reset: "manual" },
    EMPTY_CONSUMPTION_FORM: { reset: "consumption" },
    parsePositiveNumber: (value: string) => {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    },
    evaluateInventoryLotManualMovement,
    evaluateInventoryLotConsumption,
    buildInventoryCostSnapshot,
    validateManualMovement,
    prepareConsumption,
    buildManualMovementOperations,
    buildConsumptionOperations,
    crypto: {
      randomUUID: () => {
        trace.push({ step: "uuid" });
        if (options.uuidFails) throw new Error("uuid failure");
        return "generated-movement-1";
      },
    },
    Date: class FixedDate extends Date {
      constructor() {
        super("2026-10-19T12:34:56.789Z");
        trace.push({ step: "timestamp" });
        if (options.timestampFails) throw new Error("clock failure");
      }
    },
    setSavingManualMovement: setSaving,
    setSavingConsumption: setSaving,
    setManualMovementForm: reset,
    setConsumptionForm: reset,
    showError: (message: string) => {
      trace.push({ step: "error", message });
    },
    showSuccess: (message: string) => {
      trace.push({ step: "success", message });
      if (options.successToastFails)
        throw new Error("toast interrupted after gesture");
    },
    createGesture: async (farm: string, ops: OperationInput[]) => {
      trace.push({ step: "gesture", farm, ops: structuredClone(ops) });
      if (options.gestureFailure === "after_receipt")
        trace.push({ step: "partial_receipt" });
      if (options.gestureFailure) throw new Error("gesture interrupted");
    },
  };
  try {
    await execute(source, context);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    trace.push({ step: "uncaught", message: error.message });
  }
  return trace;
}

async function compare(name: Handler, options: Options = {}) {
  const actual = await traceHandler(sources[name].after, options);
  const expected = await traceHandler(sources[name].before, options);
  expect(actual).toStrictEqual(expected);
  const gesture = actual.find((item) => item.step === "gesture");
  if (gesture) {
    expect(gesture.ops).toHaveLength(1);
    expect(gesture.ops[0]).toMatchObject({
      table: "insumo_movimentacoes",
      action: "INSERT",
      record: {
        id: "generated-movement-1",
        insumo_id: "insumo-1",
        insumo_lote_id: "stock-lot-1",
        occurred_at: "2026-10-19T12:34:56.789Z",
      },
    });
  }
  return actual;
}

const common: Array<{ name: string; options: Options }> = [
  { name: "sucesso", options: {} },
  {
    name: "salvamento em andamento",
    options: {
      saving: true,
      farm: null,
      lot: null,
      source: null,
      quantity: "invalid",
    },
  },
  {
    name: "sem fazenda precede demais erros",
    options: { farm: null, lot: null, source: null, quantity: "invalid" },
  },
  { name: "sem lote", options: { lot: null, quantity: "invalid" } },
  { name: "sem evento", options: { source: null, quantity: "invalid" } },
  { name: "sem evento e sem lote", options: { source: null, lot: null } },
  { name: "sem canManage local", options: { canManage: false } },
  { name: "lote bloqueado", options: { lotPatch: { status: "bloqueado" } } },
  {
    name: "lote excluído",
    options: { lotPatch: { deleted_at: "2026-10-01T00:00:00Z" } },
  },
  { name: "id de lote vazio", options: { lotPatch: { id: "" } } },
  { name: "saldo insuficiente", options: { quantity: "101" } },
  { name: "saldo exato", options: { quantity: "100" } },
  { name: "saldo projetado zero não usa fallback", options: { balance: 0 } },
  {
    name: "saldo projetado prevalece",
    options: { balance: 10, lotPatch: { saldo_atual_base: 0 } },
  },
  {
    name: "fallback do saldo do lote",
    options: { balance: null, lotPatch: { saldo_atual_base: 4 } },
  },
  { name: "saldo negativo rejeitado", options: { balance: -1 } },
  { name: "saldo NaN herdado", options: { balance: NaN } },
  { name: "saldo infinito herdado", options: { balance: Infinity } },
  { name: "quantidade decimal", options: { quantity: " 1,25 " } },
  { name: "quantidade hexadecimal herdada", options: { quantity: "0x10" } },
  { name: "observações vazias", options: { notes: "" } },
  { name: "observações em branco", options: { notes: " \t " } },
  { name: "rejeição de gesto", options: { gestureFailure: "reject" } },
  {
    name: "interrupção após receber operação",
    options: { gestureFailure: "after_receipt" },
  },
  { name: "falha de UUID", options: { uuidFails: true } },
  { name: "falha de timestamp", options: { timestampFails: true } },
  { name: "falha de reset após gesto aceito", options: { resetFails: true } },
  {
    name: "falha de toast após gesto aceito",
    options: { successToastFails: true },
  },
];

for (const name of [
  "handleCreateManualMovement",
  "handleCreateConsumption",
] as const) {
  describe(name, () => {
    it.each(common)("equivale à baseline: $name", async ({ options }) => {
      await compare(name, options);
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
      "1e309",
      "Infinity",
      "NaN",
      "1e-999",
    ])("quantidade inválida %j", async (quantity) => {
      const trace = await compare(name, {
        quantity,
        lotPatch: { status: "bloqueado" },
      });
      expect(trace).toStrictEqual([
        {
          step: "error",
          message:
            name === "handleCreateConsumption"
              ? "Quantidade de consumo deve ser maior que zero."
              : "Quantidade da movimentacao deve ser maior que zero.",
        },
      ]);
    });
    it.each([{ resetFails: true }, { successToastFails: true }])(
      "falha parcial após gesto não o reexecuta",
      async (options) => {
        const trace = await compare(name, options);
        expect(trace.filter((item) => item.step === "gesture")).toHaveLength(1);
        expect(trace.filter((item) => item.step === "error")).toHaveLength(1);
        expect(trace[trace.length - 1]).toStrictEqual({
          step: "saving",
          value: false,
        });
      },
    );
    it("ordem dos efeitos e geração dentro do try", async () => {
      const trace = await compare(name);
      expect(trace.map((item) => item.step)).toStrictEqual([
        "saving",
        "uuid",
        "timestamp",
        "gesture",
        "reset",
        "success",
        "saving",
      ]);
      expect(trace[0]).toStrictEqual({ step: "saving", value: true });
      expect(trace[trace.length - 1]).toStrictEqual({
        step: "saving",
        value: false,
      });
    });
    it.each(["reject", "after_receipt"] as const)(
      "falha %s mantém formulário e libera saving",
      async (gestureFailure) => {
        const trace = await compare(name, { gestureFailure });
        expect(
          trace.some(
            (item) => item.step === "reset" || item.step === "success",
          ),
        ).toBe(false);
        expect(trace[trace.length - 1]).toStrictEqual({
          step: "saving",
          value: false,
        });
        expect(trace.filter((item) => item.step === "error")).toHaveLength(1);
      },
    );
  });
}

it.each(["entrada", "ajuste_positivo", "ajuste_negativo"] as const)(
  "movimento manual %s preserva registros e campos ausentes",
  async (tipo) => {
    const trace = await compare("handleCreateManualMovement", {
      tipo,
      balance: 1,
    });
    const gesture = trace.find((item) => item.step === "gesture");
    if (tipo === "ajuste_negativo") {
      expect(gesture).toBeUndefined();
      return;
    }
    if (!gesture) throw new Error("Expected gesture");
    expect(gesture.ops[0].record).toMatchObject({
      tipo,
      source_evento_id: null,
      source_evento_dominio: null,
      animal_id: null,
      rebanho_lote_id: null,
      pasto_id: null,
      payload: { origem: "inventario_ui_mvp", fluxo: "movimentacao_manual" },
    });
    expect(gesture.ops[0].record).not.toHaveProperty("custo_unitario_snapshot");
  },
);

it.each(["sanitario", "nutricao", "pastagem"] as const)(
  "consumo preserva evento factual %s e relações",
  async (dominio) => {
    const source: Source = {
      eventoId: "executed-event-2",
      dominio,
      animalId: null,
      rebanhoLoteId: "herd-lot-2",
      pastoId: null,
    };
    const trace = await compare("handleCreateConsumption", { source });
    const gesture = trace.find((item) => item.step === "gesture");
    if (!gesture) throw new Error("Expected gesture");
    expect(gesture.ops[0].record).toMatchObject({
      tipo: dominio === "sanitario" ? "consumo_sanitario" : "consumo_nutricao",
      source_evento_id: source.eventoId,
      source_evento_dominio: dominio,
      animal_id: null,
      rebanho_lote_id: source.rebanhoLoteId,
      pasto_id: null,
    });
  },
);

it.each([
  {
    name: "custo direto",
    patch: { custo_unitario: 3.333333 },
    quantity: "1,25",
  },
  {
    name: "custo derivado e arredondado",
    patch: {
      custo_unitario: null,
      custo_total: 10,
      quantidade_inicial_base: 3,
    },
    quantity: "2",
  },
  { name: "custo zero", patch: { custo_unitario: 0 }, quantity: "5" },
  {
    name: "custos ausentes com limitação",
    patch: { custo_unitario: null, custo_total: null },
    quantity: "5",
  },
  {
    name: "custo negativo sem fallback",
    patch: { custo_unitario: -1, custo_total: null },
    quantity: "5",
  },
  {
    name: "custo infinito herdado",
    patch: { custo_unitario: Infinity },
    quantity: "5",
  },
] satisfies Array<{ name: string; patch: Partial<Lot>; quantity: string }>)(
  "snapshot financeiro: $name",
  async ({ patch: lotPatch, quantity }) => {
    const trace = await compare("handleCreateConsumption", {
      lotPatch,
      quantity,
    });
    const gesture = trace.find((item) => item.step === "gesture");
    if (!gesture) throw new Error("Expected gesture");
    const data = inputs({ lotPatch, quantity });
    const snapshot = buildInventoryCostSnapshot({
      lot: data.selectedLot,
      quantidadeBase: Number(quantity.replace(",", ".")),
    });
    expect(gesture.ops[0].record).toMatchObject({
      custo_unitario_snapshot: snapshot.custo_unitario_snapshot,
      custo_total_snapshot: snapshot.custo_total_snapshot,
      payload: { custo_status: snapshot.custo_status },
    });
    if (snapshot.limitacoes.length)
      expect(gesture.ops[0].record).toMatchObject({
        payload: { limitacoes: snapshot.limitacoes },
      });
    else expect(gesture.ops[0].record.payload).not.toHaveProperty("limitacoes");
  },
);

it("consumo preserva ausência da checagem canManage local", async () => {
  expect(
    (await compare("handleCreateConsumption", { canManage: false })).some(
      (item) => item.step === "gesture",
    ),
  ).toBe(true);
  expect(
    await compare("handleCreateManualMovement", { canManage: false }),
  ).toStrictEqual([
    {
      step: "error",
      message: "Apenas owner/manager pode registrar entradas e ajustes.",
    },
  ]);
});

it("helpers puros preservam entradas e os valores gerados explícitos", () => {
  const data = inputs();
  if (
    !data.selectedLot ||
    !data.selectedManualMovementLot ||
    !data.selectedSource
  )
    throw new Error("Fixture missing");
  const before = structuredClone(data);
  const validation = validateManualMovement({
    ...data,
    selectedManualMovementLot: data.selectedManualMovementLot,
  });
  const preparation = prepareConsumption({
    ...data,
    selectedLot: data.selectedLot,
  });
  if ("error" in validation || "error" in preparation)
    throw new Error("Expected valid fixture");
  const generated = {
    id: "explicit-id",
    occurredAt: "2020-01-02T03:04:05.006Z",
  };
  const manual = buildManualMovementOperations({
    ...data,
    selectedManualMovementLot: data.selectedManualMovementLot,
    ...validation,
    ...generated,
  });
  const consumption = buildConsumptionOperations({
    ...data,
    selectedLot: data.selectedLot,
    selectedSource: data.selectedSource,
    ...preparation,
    ...generated,
  });
  expect(manual[0].record).toMatchObject({
    id: generated.id,
    occurred_at: generated.occurredAt,
  });
  expect(consumption[0].record).toMatchObject({
    id: generated.id,
    occurred_at: generated.occurredAt,
  });
  expect(data).toStrictEqual(before);
});
