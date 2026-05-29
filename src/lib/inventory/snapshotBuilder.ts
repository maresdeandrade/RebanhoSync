import type { Insumo, InsumoLote } from "@/lib/offline/types";

export interface ProdutoInsumoSnapshot {
  insumo_id?: string | null;
  insumo_lote_id?: string | null;

  // Snapshot imutavel do produto
  produto_nome_snapshot: string;
  produto_tipo_snapshot: "sanitario" | "nutricional" | "outro" | null;
  principio_ativo_snapshot?: string | null;
  fabricante_snapshot?: string | null;
  concentracao_snapshot?: string | null;

  // Dose e quantidade
  dose_aplicada?: number | null;
  dose_unidade?: string | null;
  quantidade_consumida?: number | null;
  quantidade_unidade?: string | null;
  via_aplicacao?: string | null;

  // Custo
  custo_unitario_snapshot?: number | null;
  custo_total_snapshot?: number | null;

  // Carencia preparatoria
  carencia_carne_dias_snapshot?: number | null;
  carencia_leite_dias_snapshot?: number | null;

  // Qualidade do dado
  rastreabilidade: "completo" | "parcial" | "manual";
  limitacoes?: string[];
}

export interface BuildSnapshotInput {
  produtoNome: string;
  insumo?: Insumo | null;
  lote?: InsumoLote | null;
  dose?: number | null;
  doseUnidade?: string | null;
  quantidadeConsumida?: number | null;
  quantidadeUnidade?: string | null;
  viaAplicacao?: string | null;
}

/**
 * Construtor puro que gera o snapshot imutavel de produto/insumo a ser gravado no payload do evento.
 */
export function buildProdutoInsumoSnapshot(input: BuildSnapshotInput): ProdutoInsumoSnapshot {
  const {
    produtoNome,
    insumo,
    lote,
    dose,
    doseUnidade,
    quantidadeConsumida,
    quantidadeUnidade,
    viaAplicacao,
  } = input;

  const limitacoes: string[] = [];

  // 1. Caso base: Sem insumo cadastrado
  if (!insumo) {
    return {
      produto_nome_snapshot: produtoNome || "Produto Nao Identificado",
      produto_tipo_snapshot: null,
      dose_aplicada: dose ?? null,
      dose_unidade: doseUnidade ?? null,
      quantidade_consumida: quantidadeConsumida ?? null,
      quantidade_unidade: quantidadeUnidade ?? null,
      via_aplicacao: viaAplicacao ?? null,
      rastreabilidade: "manual",
      limitacoes: ["Sem insumo estruturado associado no cadastro"],
    };
  }

  // 2. Se ha insumo, extrair dados dele
  const insumo_id = insumo.id;
  const carencia_carne_dias_snapshot = insumo.carencia_carne_dias ?? null;
  const carencia_leite_dias_snapshot = insumo.carencia_leite_dias ?? null;

  // Identificar fabricante se houver no lote ou insumo
  const fabricante_snapshot = lote?.fabricante ?? insumo.payload?.fabricante as string | null ?? null;

  // Custo unitario e total
  let custo_unitario_snapshot: number | null = null;
  let custo_total_snapshot: number | null = null;

  if (lote) {
    if (typeof lote.custo_unitario === "number" && lote.custo_unitario >= 0) {
      custo_unitario_snapshot = lote.custo_unitario;
    } else if (
      typeof lote.custo_total === "number" &&
      lote.custo_total > 0 &&
      typeof lote.quantidade_inicial_base === "number" &&
      lote.quantidade_inicial_base > 0
    ) {
      // Tenta derivar caso nao haja custo_unitario direto
      custo_unitario_snapshot = parseFloat((lote.custo_total / lote.quantidade_inicial_base).toFixed(4));
    }
  }

  if (custo_unitario_snapshot !== null && typeof quantidadeConsumida === "number" && quantidadeConsumida > 0) {
    custo_total_snapshot = parseFloat((custo_unitario_snapshot * quantidadeConsumida).toFixed(2));
  }

  // Qualidade do dado e Rastreabilidade
  let rastreabilidade: "completo" | "parcial" | "manual" = "completo";

  if (!lote) {
    rastreabilidade = "parcial";
    limitacoes.push("Lote nao associado");
  } else {
    if (custo_unitario_snapshot === null) {
      rastreabilidade = "parcial";
      limitacoes.push("Sem custo unitario cadastrado no lote");
    }
    if (!lote.identificacao_lote) {
      limitacoes.push("Identificacao do lote em branco");
    }
  }

  return {
    insumo_id,
    insumo_lote_id: lote?.id ?? null,
    produto_nome_snapshot: insumo.nome || produtoNome,
    produto_tipo_snapshot: insumo.tipo === "sanitario" ? "sanitario" : insumo.tipo === "nutricional" ? "nutricional" : "outro",
    principio_ativo_snapshot: insumo.principio_ativo ?? null,
    fabricante_snapshot,
    concentracao_snapshot: insumo.concentracao ?? null,
    dose_aplicada: dose ?? null,
    dose_unidade: doseUnidade ?? null,
    quantidade_consumida: quantidadeConsumida ?? null,
    quantidade_unidade: quantidadeUnidade ?? null,
    via_aplicacao: viaAplicacao ?? null,
    custo_unitario_snapshot,
    custo_total_snapshot,
    carencia_carne_dias_snapshot,
    carencia_leite_dias_snapshot,
    rastreabilidade,
    limitacoes: limitacoes.length > 0 ? limitacoes : undefined,
  };
}
