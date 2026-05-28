export type DataStatus = {
  status: "empty" | "partial" | "complete";
  reason?: string;
};

export interface AnimalOccupancyPeriod {
  animalId: string;
  loteId: string | null;
  pastoId: string | null;
  entradaAt: string;
  saidaAt: string | null;
  dias: number;
  pesoInicial?: number;
  pesoFinal?: number;
  ganho?: number;
  gmd?: number;
  weightStatus: DataStatus;
  eccInicial?: number;
  eccFinal?: number;
  variacaoEcc?: number;
  eccStatus: DataStatus;
}

export interface LoteOccupancyMetrics {
  loteId: string;
  quantidadeAtual: number;
  dataEntradaRecente: string | null;
  tempoMedioPermanencia: number;
  tempoMaximoPermanencia: number;
  pesoMedioInicial: number;
  pesoMedioFinal: number;
  ganhoMedio: number;
  gmdEstimado: number;
  weightStatus: DataStatus;
  eccMedioAtual: number;
  eccCobertura: { avaliados: number; total: number };
  eccStatus: DataStatus;
  animaisSemEcc: string[];
  tempoLotacaoStatus: DataStatus;
  ultimaMovimentacao: string | null;
  categoriaPredominante?: string;
}

export interface PastoOccupancyMetrics {
  pastoId: string;
  lotacaoAtual: number;
  tempoMedioOcupacao: number;
  ganhoMedioPeso: number;
  gmdEstimado: number;
  weightStatus: DataStatus;
  eccMedioAtual: number;
  eccVariacaoMedia: number;
  eccStatus: DataStatus;
  eccCobertura: { avaliados: number; total: number };
  animaisSemEcc: string[];
  tempoLotacaoStatus: DataStatus;
  ultimaMovimentacao: string | null;
  categoriaPredominante?: string;
}
