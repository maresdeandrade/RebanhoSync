import type {
  Evento,
  EventoNutricao,
  EventoPastoAvaliacao,
  EventoSanitario,
  Insumo,
  InsumoApresentacao,
  InsumoLote,
  InsumoMovimentacao,
  ProdutoVeterinarioCatalogEntry,
} from "@/lib/offline/types";
import type { InventoryResupplyEvaluation } from "@/lib/inventory/resupplyPolicy";
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
export type InventorySnapshot = {
  insumos: Insumo[];
  apresentacoes: InsumoApresentacao[];
  lotes: InsumoLote[];
  movimentacoes: InsumoMovimentacao[];
  eventos: Evento[];
  sanitario: EventoSanitario[];
  nutricao: EventoNutricao[];
  pasto: EventoPastoAvaliacao[];
  produtos: ProdutoVeterinarioCatalogEntry[];
  pendingTxIds: Set<string>;
};

export type LotMovementSummary = {
  entradas: number;
  saidas: number;
};

export type LotRow = {
  lot: InsumoLote;
  insumo: Insumo | undefined;
  apresentacao: InsumoApresentacao | undefined;
  category: string;
  movimentoPeriodo: LotMovementSummary;
  saldoOperacional: number;
  saldoInsumo: number;
  resupply: InventoryResupplyEvaluation;
};

export type InventoryProjectionInput = Pick<
  InventorySnapshot,
  "insumos" | "apresentacoes" | "lotes" | "movimentacoes" | "pendingTxIds"
>;
export type InventoryProjectionFilters = {
  search: string;
  periodDays: number | null;
};
export type InventoryRowFilters = {
  selectedCategory: string;
  selectedType: string;
};
export type InventoryProjection = {
  lotRows: LotRow[];
  categoryOptions: string[];
};
export type InventoryViewModel = InventoryProjection & {
  filteredLotRows: LotRow[];
  filteredTotals: { saldo: number; entradas: number; saidas: number };
  filteredResupplyTotals: {
    configured: number;
    warning: number;
    critical: number;
  };
};
