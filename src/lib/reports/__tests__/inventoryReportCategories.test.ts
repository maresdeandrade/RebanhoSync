import { describe, expect, it } from "vitest";
import type {
  Insumo,
  InsumoLote,
  InsumoMovimentacao,
} from "@/lib/offline/types";
import {
  buildOperationalSummary,
  buildOperationalSummaryCsv,
  type OperationalSummaryInput,
} from "../operationalSummary";

const now = new Date("2026-10-23T12:00:00Z");
const range = {
  preset: "30d" as const,
  from: "2026-10-01",
  to: "2026-10-30",
  label: "Outubro",
  filenameTag: "outubro",
};
const metadata = {
  fazenda_id: "farm-1",
  client_id: "fixture",
  client_op_id: "fixture-op",
  client_tx_id: null,
  client_recorded_at: now.toISOString(),
  server_received_at: now.toISOString(),
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  deleted_at: null,
};

function product(
  id: string,
  categoria: string | null,
  payload: Insumo["payload"] = {},
): Insumo {
  return {
    ...metadata,
    id,
    nome: id,
    tipo: "outro",
    categoria,
    produto_veterinario_id: null,
    unidade_base: "dose",
    ativo: true,
    payload,
  };
}

function lot(id: string, insumoId: string, saldo: number): InsumoLote {
  return {
    ...metadata,
    id,
    insumo_id: insumoId,
    apresentacao_id: null,
    identificacao_lote: id,
    validade: null,
    fabricante: null,
    local_armazenamento: null,
    quantidade_inicial_base: saldo,
    saldo_atual_base: saldo,
    unidade_base: "dose",
    status: "ativo",
    payload: {},
  };
}

function movement(
  tipo: InsumoMovimentacao["tipo"],
  quantidade: number,
): InsumoMovimentacao {
  return {
    ...metadata,
    id: tipo,
    insumo_id: "critical",
    insumo_lote_id: "critical-1",
    tipo,
    quantidade_base: quantidade,
    unidade_base: "dose",
    occurred_at: now.toISOString(),
    source_evento_id: null,
    source_evento_dominio: null,
    animal_id: null,
    rebanho_lote_id: null,
    pasto_id: null,
    observacoes: null,
    payload: {},
  };
}

function input(
  overrides: Partial<OperationalSummaryInput> = {},
): OperationalSummaryInput {
  return {
    fazendaId: "farm-1",
    farmTimezone: "UTC",
    animals: [],
    lotes: [],
    pastos: [],
    agenda: [],
    eventos: [],
    eventosPesagem: [],
    eventosFinanceiro: [],
    gestures: [],
    rejections: [],
    ...overrides,
  };
}

describe("inventory categories through the operational report", () => {
  it.each([
    ["absent", {}],
    ["empty", { insumos: [], insumoLotes: [] }],
  ] as const)("returns no categories for %s inventory", (_name, overrides) => {
    expect(
      buildOperationalSummary(input(overrides), range, now).inventory
        .categorias,
    ).toEqual([]);
  });

  it("groups and sorts lots without deduplicating products or mixing resupply states", () => {
    const policy = {
      inventory_policy: {
        estoque_minimo_base: 10,
        ponto_ressuprimento_base: 20,
      },
    };
    const source = input({
      insumos: [
        product("critical", " Vacina ", policy),
        product("warning", "Alimentação", policy),
        product("ok", "Vacina", policy),
        product("unconfigured", "Vacina"),
      ],
      insumoLotes: [
        lot("critical-2", "critical", 3),
        lot("ok-1", "ok", 30),
        lot("warning-1", "warning", 15),
        lot("critical-1", "critical", 2),
        lot("unconfigured-1", "unconfigured", 0),
      ],
      insumoMovimentacoes: [
        movement("entrada", 12),
        movement("consumo_sanitario", 4),
      ],
    });
    const before = structuredClone(source);
    const report = buildOperationalSummary(source, range, now);
    const expected = [
      {
        categoria: "Alimentação",
        itens: 1,
        lotes: 1,
        saldo: 15,
        entradas: 0,
        saidas: 0,
        resupplyWarningCount: 1,
        resupplyCriticalCount: 0,
      },
      {
        categoria: "Vacina",
        itens: 4,
        lotes: 4,
        saldo: 35,
        entradas: 12,
        saidas: 4,
        resupplyWarningCount: 0,
        resupplyCriticalCount: 2,
      },
    ];

    expect(report.inventory.categorias).toEqual(expected);
    expect(
      buildOperationalSummary(source, range, now).inventory.categorias,
    ).toEqual(expected);
    expect(source).toEqual(before);
    expect(buildOperationalSummaryCsv(report, "Fazenda piloto")).toContain(
      "estoque_categoria;Vacina;4 item(ns) | 4 lote(s) | saldo 35.000 | +12.000 | -4.000 | ressuprir 0 | critico 2",
    );
  });

  it("keeps missing categories and catalog entries while excluding other farms and tombstones", () => {
    const report = buildOperationalSummary(
      input({
        insumos: [product("blank", "  "), product("null", null)],
        insumoLotes: [
          lot("blank-1", "blank", 0),
          lot("null-1", "null", 3),
          lot("orphan-1", "missing-product", -2),
          { ...lot("foreign", "blank", 100), fazenda_id: "farm-2" },
          { ...lot("deleted", "blank", 100), deleted_at: now.toISOString() },
        ],
      }),
      range,
      now,
    );

    expect(report.inventory.categorias).toEqual([
      {
        categoria: "Sem categoria",
        itens: 3,
        lotes: 3,
        saldo: 1,
        entradas: 0,
        saidas: 0,
        resupplyWarningCount: 0,
        resupplyCriticalCount: 0,
      },
    ]);
  });
});
