import { describe, expect, it } from "vitest";
import { buildProdutoInsumoSnapshot } from "../snapshotBuilder";
import type { Insumo, InsumoLote } from "@/lib/offline/types";

describe("snapshotBuilder", () => {
  const mockInsumo: Insumo = {
    id: "insumo-1",
    fazenda_id: "farm-1",
    nome: "Ivermectina 1%",
    tipo: "sanitario",
    categoria: "Vermifugo",
    produto_veterinario_id: "prod-vet-1",
    unidade_base: "ml",
    ativo: true,
    carencia_carne_dias: 28,
    carencia_leite_dias: 15,
    principio_ativo: "Ivermectina",
    concentracao: "1%",
    payload: { fabricante: "Merial" },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "",
    server_received_at: "",
    created_at: "",
    updated_at: "",
    deleted_at: null,
  };

  const mockLote: InsumoLote = {
    id: "lote-1",
    fazenda_id: "farm-1",
    insumo_id: "insumo-1",
    apresentacao_id: "apres-1",
    identificacao_lote: "L-1234",
    validade: "2027-12-31",
    fabricante: "Boehringer",
    local_armazenamento: "Geladeira",
    quantidade_inicial_base: 500,
    saldo_atual_base: 200,
    unidade_base: "ml",
    status: "ativo",
    custo_total: 150, // Custo unitario derivado = 150/500 = 0.30
    custo_unitario: 0.30,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-2",
    client_tx_id: null,
    client_recorded_at: "",
    server_received_at: "",
    created_at: "",
    updated_at: "",
    deleted_at: null,
  };

  it("gera snapshot manual quando nao ha insumo estruturado", () => {
    const result = buildProdutoInsumoSnapshot({
      produtoNome: "Medicamento Livre",
      dose: 5,
      doseUnidade: "ml",
    });

    expect(result).toMatchObject({
      produto_nome_snapshot: "Medicamento Livre",
      produto_tipo_snapshot: null,
      dose_aplicada: 5,
      dose_unidade: "ml",
      rastreabilidade: "manual",
    });
    expect(result.limitacoes).toContain("Sem insumo estruturado associado no cadastro");
  });

  it("gera snapshot completo com insumo, lote e custos", () => {
    const result = buildProdutoInsumoSnapshot({
      produtoNome: "Ivermectina 1%",
      insumo: mockInsumo,
      lote: mockLote,
      dose: 10,
      doseUnidade: "ml",
      quantidadeConsumida: 100,
      quantidadeUnidade: "ml",
      viaAplicacao: "subcutanea",
    });

    expect(result).toMatchObject({
      insumo_id: "insumo-1",
      insumo_lote_id: "lote-1",
      produto_nome_snapshot: "Ivermectina 1%",
      produto_tipo_snapshot: "sanitario",
      principio_ativo_snapshot: "Ivermectina",
      concentracao_snapshot: "1%",
      fabricante_snapshot: "Boehringer", // Fabricante do lote tem prioridade
      dose_aplicada: 10,
      dose_unidade: "ml",
      quantidade_consumida: 100,
      quantidade_unidade: "ml",
      via_aplicacao: "subcutanea",
      custo_unitario_snapshot: 0.30,
      custo_total_snapshot: 30, // 0.30 * 100
      carencia_carne_dias_snapshot: 28,
      carencia_leite_dias_snapshot: 15,
      rastreabilidade: "completo",
    });
    expect(result.limitacoes).toBeUndefined();
  });

  it("gera snapshot parcial quando falta custo unitario no lote", () => {
    const loteSemCusto = { ...mockLote, custo_unitario: null, custo_total: null };
    const result = buildProdutoInsumoSnapshot({
      produtoNome: "Ivermectina 1%",
      insumo: mockInsumo,
      lote: loteSemCusto,
      quantidadeConsumida: 50,
    });

    expect(result.rastreabilidade).toBe("parcial");
    expect(result.custo_unitario_snapshot).toBeNull();
    expect(result.custo_total_snapshot).toBeNull();
    expect(result.limitacoes).toContain("Sem custo unitario cadastrado no lote");
  });

  it("deriva custo unitario a partir do custo total se custo unitario estiver em branco", () => {
    const loteComCustoTotal = { ...mockLote, custo_unitario: null, custo_total: 200, quantidade_inicial_base: 500 };
    const result = buildProdutoInsumoSnapshot({
      produtoNome: "Ivermectina 1%",
      insumo: mockInsumo,
      lote: loteComCustoTotal,
      quantidadeConsumida: 100,
    });

    expect(result.custo_unitario_snapshot).toBe(0.40); // 200 / 500
    expect(result.custo_total_snapshot).toBe(40.00); // 0.40 * 100
    expect(result.rastreabilidade).toBe("completo");
  });
});
