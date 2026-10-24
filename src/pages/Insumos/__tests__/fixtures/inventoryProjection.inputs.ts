import type {
  Insumo,
  InsumoLote,
  InsumoMovimentacao,
  InsumoApresentacao,
} from "@/lib/offline/types";
export const referenceTimeMs = Date.parse("2026-10-24T12:00:00Z");
export const all = {
  search: "",
  periodDays: null,
  selectedCategory: "__all_categories__",
  selectedType: "__all_types__",
};
export type Snapshot = {
  insumos: Insumo[];
  lotes: InsumoLote[];
  movimentacoes: InsumoMovimentacao[];
  apresentacoes: InsumoApresentacao[];
  pendingTxIds: Set<string>;
};
export type Filters = typeof all & { periodDays: number | null };
export function fixture(): Snapshot {
  const audit = {
    fazenda_id: "farm",
    client_id: "client",
    client_op_id: "op",
    client_tx_id: null,
    client_recorded_at: "",
    server_received_at: "",
    created_at: "",
    updated_at: "",
    deleted_at: null,
  };
  const insumos: Insumo[] = [
    {
      ...audit,
      id: "a",
      nome: "Sal",
      tipo: "nutricional",
      categoria: " Nutrição ",
      unidade_base: "kg",
      ativo: true,
      produto_veterinario_id: null,
      payload: {
        inventory_policy: {
          estoque_minimo_base: 10,
          ponto_ressuprimento_base: 20,
        },
      },
    },
    {
      ...audit,
      id: "b",
      nome: "Agulha",
      tipo: "sanitario",
      categoria: "Sanitário",
      unidade_base: "un",
      ativo: true,
      produto_veterinario_id: null,
      payload: { inventory_policy: { estoque_minimo_base: 5 } },
    },
  ];
  const lotes: InsumoLote[] = [
    {
      ...audit,
      id: "a1",
      insumo_id: "a",
      apresentacao_id: null,
      identificacao_lote: "primeiro",
      validade: null,
      fabricante: "Fábrica",
      local_armazenamento: "Galpão",
      quantidade_inicial_base: 10,
      saldo_atual_base: 10,
      unidade_base: "kg",
      status: "ativo",
      payload: {},
    },
    {
      ...audit,
      id: "a2",
      insumo_id: "a",
      apresentacao_id: "pack",
      identificacao_lote: "segundo",
      validade: null,
      fabricante: null,
      local_armazenamento: null,
      quantidade_inicial_base: 2,
      saldo_atual_base: 2,
      unidade_base: "kg",
      status: "ativo",
      payload: {},
    },
    {
      ...audit,
      id: "b1",
      insumo_id: "b",
      apresentacao_id: null,
      identificacao_lote: null,
      validade: null,
      fabricante: null,
      local_armazenamento: null,
      quantidade_inicial_base: 1,
      saldo_atual_base: 1,
      unidade_base: "un",
      status: "ativo",
      payload: {},
    },
  ];
  const movimentacoes: InsumoMovimentacao[] = [
    {
      ...audit,
      id: "m1",
      insumo_id: "a",
      insumo_lote_id: "a1",
      tipo: "ajuste_positivo",
      quantidade_base: 3,
      unidade_base: "kg",
      occurred_at: "2026-10-24T00:00:00Z",
      source_evento_id: null,
      source_evento_dominio: null,
      animal_id: null,
      rebanho_lote_id: null,
      pasto_id: null,
      observacoes: null,
      payload: {},
      client_tx_id: "pending",
    },
  ];
  const apresentacoes: InsumoApresentacao[] = [
    {
      ...audit,
      id: "pack",
      insumo_id: "a",
      nome: "Saco especial",
      unidade_compra: "saco",
      quantidade_base: 25,
      unidade_base: "kg",
      codigo_barras: null,
      fabricante: "Fornecedor",
      payload: {},
    },
  ];
  return {
    insumos,
    lotes,
    movimentacoes,
    apresentacoes,
    pendingTxIds: new Set(["pending"]),
  };
}
