import type {
  AnimalStatusEnum,
  FinanceiroTipoEnum,
  OperationInput,
  SanitarioCasoStatusEnum,
  SanitarioCasoTipoEnum,
  SanitarioTipoEnum,
  ReproTipoEnum,
  CausaObitoEnum,
  Insumo,
  InsumoLote,
} from "@/lib/offline/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";

export type EventDomain =
  | "sanitario"
  | "alerta_sanitario"
  | "conformidade"
  | "comercial"
  | "pesagem"
  | "movimentacao"
  | "pastagem"
  | "nutricao"
  | "financeiro"
  | "reproducao"
  | "obito"
  | "ecc";

export interface BaseEventInput {
  dominio: EventDomain;
  fazendaId: string;
  occurredAt?: string;
  animalId?: string | null;
  loteId?: string | null;
  sourceTaskId?: string | null;
  corrigeEventoId?: string | null;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
}

export interface SanitarioCasoOpenInput {
  action: "open";
  tipo: SanitarioCasoTipoEnum;
  status?: Extract<SanitarioCasoStatusEnum, "aberto" | "em_acompanhamento">;
  diseaseCode?: string | null;
  diseaseName?: string | null;
  notificationType?: string | null;
  requiresImmediateNotification?: boolean;
  movementBlocked?: boolean;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
}

export interface SanitarioCasoCloseInput {
  action: "close";
  id: string;
  status: Extract<
    SanitarioCasoStatusEnum,
    "em_acompanhamento" | "encerrado" | "cancelado"
  >;
  closureReason?: string | null;
  observacoes?: string | null;
  movementBlocked?: boolean;
}

export interface SanitarioCasoLinkInput {
  action: "link";
  id: string;
}

export interface ProtocoloAgendaRefInput {
  id: string;
  logicalItemKey?: string | null;
  version?: number | null;
  itemCode?: string | null;
  snapshot?: Record<string, unknown> | null;
  intervalDays: number;
  doseNum?: number | null;
  geraAgenda: boolean;
}

export interface SanitarioEventInput extends BaseEventInput {
  dominio: "sanitario";
  tipo: SanitarioTipoEnum;
  produto: string;
  protocoloItem?: ProtocoloAgendaRefInput;
  produtoRef?: VeterinaryProductSelection;
  sanitarioCaso?: SanitarioCasoOpenInput | SanitarioCasoLinkInput;
  insumoId?: string | null;
  insumoLoteId?: string | null;
  insumoRef?: Insumo | null;
  loteRef?: InsumoLote | null;
  dose?: number | null;
  doseUnidade?: string | null;
  quantidadeConsumida?: number | null;
  quantidadeUnidade?: string | null;
  viaAplicacao?: string | null;
  custoUnitarioSnapshot?: number | null;
  responsavelNome?: string | null;
  responsavelTipo?: string | null;
  gerarBaixaEstoque?: boolean;
}

export interface AlertaSanitarioEventInput extends BaseEventInput {
  dominio: "alerta_sanitario";
  alertKind: "suspeita_aberta" | "suspeita_encerrada";
  animalPayload: Record<string, unknown>;
  sanitarioCaso?: SanitarioCasoOpenInput | SanitarioCasoCloseInput;
}

export interface ConformidadeEventInput extends BaseEventInput {
  dominio: "conformidade";
  complianceKind: "feed_ban" | "checklist";
}

export interface PesagemEventInput extends BaseEventInput {
  dominio: "pesagem";
  pesoKg: number;
}

export interface MovimentacaoEventInput extends BaseEventInput {
  dominio: "movimentacao";
  fromLoteId?: string | null;
  toLoteId?: string | null;
  fromPastoId?: string | null;
  toPastoId?: string | null;
  allowDestinationNull?: boolean;
  /**
   * "lote_pasto": movimentacao do lote inteiro entre pastos.
   *   - Permite fromLoteId === toLoteId (o lote nao muda, o pasto muda).
   *   - UPDATE em lotes.pasto_id é gerado somente com applyLoteStateUpdate === true.
   * Ausente/undefined: movimentacao de animal entre lotes (comportamento padrao).
   */
  movementKind?: "lote_pasto";
  applyAnimalStateUpdate?: boolean;
  /** Deve ser true explicitamente para emitir UPDATE em lotes.pasto_id. */
  applyLoteStateUpdate?: boolean;
}

export interface NutricaoEventInput extends BaseEventInput {
  dominio: "nutricao";
  alimentoNome: string;
  quantidadeKg: number;
  insumoId?: string | null;
  insumoLoteId?: string | null;
  insumoRef?: Insumo | null;
  loteRef?: InsumoLote | null;
  quantidadeConsumida?: number | null;
  quantidadeUnidade?: string | null;
  custoUnitarioSnapshot?: number | null;
  gerarBaixaEstoque?: boolean;
}

export interface PastoAvaliacaoEventInput extends BaseEventInput {
  dominio: "pastagem";
  pastoId: string;
  loteId?: string | null;
  ocupacaoId?: string | null;
  momento: "entrada" | "saida" | "ronda";
  alturaCm?: number | null;
  coberturaSolo?: "excelente" | "media" | "ruim" | null;
  invasorasNivel?: "nenhuma" | "leve" | "moderada" | "alta" | null;
  eccLoteMedio?: number | null;
  eccEscala?: "1_5";
  fezesScore?: "aneladas" | "ressecadas_empilhadas" | "liquidas" | null;
  aguaStatus?: "limpo" | "sujo" | "nivel_baixo" | "seco" | null;
  suplementoTipo?: string | null;
  suplementoQuantidade?: number | null;
  suplementoUnidade?: "kg" | "sacos" | null;
}

export interface ObitoEventInput extends BaseEventInput {
  dominio: "obito";
  causa?: CausaObitoEnum;
  dataObito?: string; // YYYY-MM-DD, defaults to today if omitted
  cancelAgendaIds?: string[]; // IDs of pending agenda items to cancel
}

export interface FinanceiroEventInput extends BaseEventInput {
  dominio: "financeiro";
  tipo: FinanceiroTipoEnum;
  valorTotal: number;
  contraparteId?: string | null;
  applyAnimalStateUpdate?: boolean;
  clearAnimalLoteOnSale?: boolean;
  animalSaleStatus?: Extract<AnimalStatusEnum, "vendido" | "morto">;
}

export interface ComercialSocietySnapshot {
  sociedadeId: string;
  sociedadeAnimalId?: string | null;
  contraparteId: string;
  contraparteNome?: string | null;
  percentualFazenda: number;
  percentualParceiro: number;
  status: "ativa" | "encerrada" | "suspensa";
}

export interface ComercialEventInput extends BaseEventInput {
  dominio: "comercial";
  operationType: "compra" | "venda";
  scope: "animal" | "lote";
  quantidadeAnimais: number;
  pesoVivoTotal?: number | null;
  pesoMedioDerivado?: number | null;
  valorBruto?: number | null;
  frete?: number | null;
  comissao?: number | null;
  descontos?: number | null;
  taxasImpostos?: number | null;
  valorLiquidoDerivado?: number | null;
  contraparteId?: string | null;
  contraparteNome?: string | null;
  animalIds?: string[] | null;
  financeTransactionId?: string | null;
  snapshot?: Record<string, unknown> | null;
  calculationStatus?: "complete" | "partial" | "blocked";
  issues?: Array<Record<string, unknown>>;
  limitations?: string[];
  animalStatusSnapshot?: "ativo" | "vendido" | "morto" | "retirado" | null;
  sociedadeSnapshot?: ComercialSocietySnapshot[];
  commercialSignals?: string[];
}




export interface ReproductionEventInput extends BaseEventInput {
  dominio: "reproducao";
  tipo: ReproTipoEnum; // from offline/types
  machoId?: string | null;
  // Phase 1 payload fields (optional but typed here for builder)
  payloadData?: {
    distocia?: string;
    escore_condicao_corporal?: number;
    
    // Extended fields used in Registrar.tsx
    schema_version?: number;
    episode_evento_id?: string;
    episode_link_method?: "manual" | "auto_last_open_service" | "unlinked";
    tecnica_livre?: string;
    reprodutor_tag?: string;
    lote_semen?: string;
    dose_semen_ref?: string;
    resultado?: string;
    
    diagnostico_resultado?: string;
    data_prevista_parto?: string; // YYYY-MM-DD
    data_parto_real?: string; // YYYY-MM-DD
    numero_crias?: number;
  };
}

export interface EccEventInput extends BaseEventInput {
  dominio: "ecc";
  animalId: string;
  ecc: number;
  escalaMin?: number;
  escalaMax?: number;
  escalaPasso?: number;
}

export type EventInput =
  | SanitarioEventInput
  | AlertaSanitarioEventInput
  | ConformidadeEventInput
  | ComercialEventInput
  | PesagemEventInput
  | MovimentacaoEventInput
  | NutricaoEventInput
  | PastoAvaliacaoEventInput
  | FinanceiroEventInput
  | ObitoEventInput
  | ReproductionEventInput
  | EccEventInput;

export interface EventGestureBuildResult {
  eventId: string;
  ops: OperationInput[];
}
