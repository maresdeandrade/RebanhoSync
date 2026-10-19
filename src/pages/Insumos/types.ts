import type { InsumoLoteStatusEnum } from "@/lib/offline/types";

export type LotEditForm = {
  lotId: string;
  insumoNome: string;
  categoria: string;
  ativo: boolean;
  estoqueMinimoBase: string;
  pontoRessuprimentoBase: string;
  apresentacaoNome: string;
  apresentacaoFabricante: string;
  identificacaoLote: string;
  validade: string;
  fabricante: string;
  localArmazenamento: string;
  status: InsumoLoteStatusEnum;
  custoTotal: string;
  custoUnitario: string;
  origemCusto: "manual" | "ausente" | "financeiro_vinculado";
};
