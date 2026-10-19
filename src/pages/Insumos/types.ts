import type {
  InsumoLoteStatusEnum,
  InsumoMovimentacaoTipoEnum,
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

export type ConsumptionForm = {
  sourceKey: string;
  insumoLoteId: string;
  quantidadeBase: string;
  observacoes: string;
};

export type ManualMovementForm = {
  insumoLoteId: string;
  tipo: Extract<
    InsumoMovimentacaoTipoEnum,
    "entrada" | "ajuste_positivo" | "ajuste_negativo"
  >;
  quantidadeBase: string;
  observacoes: string;
};

export type SourceOption = {
  key: string;
  eventoId: string;
  dominio: "sanitario" | "nutricao" | "pastagem";
  label: string;
  catalogProductId: string | null;
  quantityBase: number | null;
  unidadeBase: InsumoUnidadeBaseEnum | null;
  animalId: string | null;
  rebanhoLoteId: string | null;
  pastoId: string | null;
};
