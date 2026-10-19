import type {
  InsumoLoteStatusEnum,
  InsumoTipoEnum,
  InsumoUnidadeBaseEnum,
  InsumoUnidadeCompraEnum,
} from "@/lib/offline/types";
import type { InventoryCostMode } from "@/lib/inventory/inventoryFormPresets";

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

export type EntryForm = {
  tipo: InsumoTipoEnum;
  nome: string;
  categoria: string;
  produtoVeterinarioId: string;
  unidadeBase: InsumoUnidadeBaseEnum;
  unidadeCompra: InsumoUnidadeCompraEnum;
  apresentacaoNome: string;
  quantidadePorApresentacao: string;
  quantidadeEntrada: string;
  identificacaoLote: string;
  validade: string;
  fabricante: string;
  localArmazenamento: string;
  costMode: InventoryCostMode;
  custoTotal: string;
  custoUnitario: string;
  origemCusto: "manual" | "ausente" | "financeiro_vinculado";
  financeTransactionId: string | null;
};
