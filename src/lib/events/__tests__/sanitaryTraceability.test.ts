import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import type { Insumo, InsumoLote } from "@/lib/offline/types";

const insumo = {
  id: "insumo-1",
  nome: "Vacina A",
  tipo: "sanitario",
  categoria: "vacina",
  produto_veterinario_id: "prod-1",
  unidade_base: "ml",
  ativo: true,
  principio_ativo: "virus inativado",
  concentracao: null,
  carencia_carne_dias: 30,
  carencia_leite_dias: null,
  payload: {},
} as Insumo;

const lote = {
  id: "lote-estoque-1",
  fazenda_id: "farm-1",
  insumo_id: "insumo-1",
  identificacao_lote: "L-2026",
  validade: "2027-05-31",
  fabricante: "BioVet",
  saldo_atual_base: 100,
  unidade_base: "ml",
  status: "ativo",
  custo_unitario: 4.5,
  payload: {},
} as InsumoLote;

describe("sanitary operational traceability", () => {
  it("requires dose, unit and route when a structured sanitary product is selected", () => {
    expect(() =>
      buildEventGesture({
        dominio: "sanitario",
        fazendaId: "farm-1",
        animalId: "animal-1",
        tipo: "vacinacao",
        produto: "Vacina A",
        insumoId: "insumo-1",
        insumoRef: insumo,
      }),
    ).toThrow(EventValidationError);
  });

  it("writes structured product, stock lot, dose, withdrawal and cost snapshots", () => {
    const result = buildEventGesture({
      dominio: "sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-pecuario-1",
      occurredAt: "2026-05-10T12:00:00.000Z",
      tipo: "vacinacao",
      produto: "Vacina A",
      produtoRef: { id: "prod-1", nome: "Vacina A", categoria: "vacina" },
      insumoId: "insumo-1",
      insumoLoteId: "lote-estoque-1",
      insumoRef: insumo,
      loteRef: lote,
      dose: 2,
      doseUnidade: "ml",
      quantidadeConsumida: 2,
      quantidadeUnidade: "ml",
      viaAplicacao: "subcutanea",
      gerarBaixaEstoque: true,
      protocoloItem: {
        id: "item-version-1",
        logicalItemKey: "logical-1",
        version: 3,
        itemCode: "aftosa-d1",
        intervalDays: 365,
        geraAgenda: true,
        snapshot: { item_code: "aftosa-d1", version: 3 },
      },
    });

    const detail = result.ops.find((op) => op.table === "eventos_sanitario")!.record;
    expect(detail).toMatchObject({
      produto_veterinario_id: "prod-1",
      produto_nome_snapshot: "Vacina A",
      estoque_lote_id: "lote-estoque-1",
      estoque_lote_codigo_snapshot: "L-2026",
      lote_fabricante: "BioVet",
      validade_produto: "2027-05-31",
      dose_quantidade: 2,
      dose_unidade: "ml",
      via_aplicacao: "subcutanea",
      carencia_carne_dias: 30,
      carencia_leite_dias: null,
      carencia_carne_ate: "2026-06-09",
      carencia_leite_ate: null,
      custo_unitario_snapshot: 4.5,
      custo_total_snapshot: 9,
      protocol_item_version_id: "item-version-1",
      protocol_item_snapshot: { item_code: "aftosa-d1", version: 3 },
    });

    const movement = result.ops.find((op) => op.table === "insumo_movimentacoes")!.record;
    expect(movement).toMatchObject({
      id: result.eventId,
      tipo: "consumo_sanitario",
      source_evento_id: result.eventId,
      source_evento_dominio: "sanitario",
      quantidade_base: 2,
      custo_total_snapshot: 9,
    });
  });

  it("records explicit null withdrawal when product has no configured withdrawal", () => {
    const result = buildEventGesture({
      dominio: "sanitario",
      fazendaId: "farm-1",
      animalId: "animal-1",
      tipo: "medicamento",
      produto: "Produto sem carencia",
      insumoId: "insumo-1",
      insumoRef: { ...insumo, carencia_carne_dias: null, carencia_leite_dias: null },
      dose: 1,
      doseUnidade: "ml",
      viaAplicacao: "oral",
    });

    const detail = result.ops.find((op) => op.table === "eventos_sanitario")!.record;
    expect(detail.carencia_carne_dias).toBeNull();
    expect(detail.carencia_leite_dias).toBeNull();
    expect(detail.carencia_carne_ate).toBeNull();
    expect(detail.carencia_leite_ate).toBeNull();
  });

  it("blocks silent negative stock consumption before creating ops", () => {
    expect(() =>
      buildEventGesture({
        dominio: "sanitario",
        fazendaId: "farm-1",
        animalId: "animal-1",
        tipo: "vacinacao",
        produto: "Vacina A",
        insumoId: "insumo-1",
        insumoLoteId: "lote-estoque-1",
        insumoRef: insumo,
        loteRef: { ...lote, saldo_atual_base: 1 },
        dose: 2,
        doseUnidade: "ml",
        quantidadeConsumida: 2,
        quantidadeUnidade: "ml",
        viaAplicacao: "subcutanea",
        gerarBaixaEstoque: true,
      }),
    ).toThrow(EventValidationError);
  });
});
