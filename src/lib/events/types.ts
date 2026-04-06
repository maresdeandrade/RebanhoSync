import type {
  AnimalStatusEnum,
  FinanceiroTipoEnum,
  OperationInput,
  SanitarioTipoEnum,
  ReproTipoEnum,
} from "@/lib/offline/types";

export type EventDomain =
  | "sanitario"
  | "pesagem"
  | "movimentacao"
  | "nutricao"
  | "financeiro"
  | "reproducao";

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

export interface ProtocoloAgendaRefInput {
  id: string;
  intervalDays: number;
  doseNum?: number | null;
  geraAgenda: boolean;
}

export interface SanitarioEventInput extends BaseEventInput {
  dominio: "sanitario";
  tipo: SanitarioTipoEnum;
  produto: string;
  protocoloItem?: ProtocoloAgendaRefInput;
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
  applyAnimalStateUpdate?: boolean;
}

export interface NutricaoEventInput extends BaseEventInput {
  dominio: "nutricao";
  alimentoNome: string;
  quantidadeKg: number;
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

export type EventInput =
  | SanitarioEventInput
  | PesagemEventInput
  | MovimentacaoEventInput
  | NutricaoEventInput
  | FinanceiroEventInput
  | ReproductionEventInput;

export interface EventGestureBuildResult {
  eventId: string;
  ops: OperationInput[];
}
