// =========================================================
// ENUMS baseados no schema do banco de dados
// =========================================================

// Sync & Operations
export type GestureStatus =
  | "PENDING"
  | "SYNCING"
  | "DONE"
  | "ERROR"
  | "SYNCED"
  | "REJECTED";
export type OpAction = "INSERT" | "UPDATE" | "DELETE";

// Farm & User Management
export type FarmRoleEnum = "cowboy" | "manager" | "owner";
export type ThemeEnum = "system" | "light" | "dark";
export type FarmInviteStatusEnum =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

// Animal & Lote
export type SexoEnum = "M" | "F";
export type AnimalStatusEnum = "ativo" | "vendido" | "morto";
export type LoteStatusEnum = "ativo" | "inativo";
export type PapelMachoEnum = "reprodutor" | "rufiao";
export type OrigemEnum = "nascimento" | "compra" | "doacao" | "arrendamento" | "sociedade";

// Contrapartes
export type ContraparteTipoEnum = "pessoa" | "empresa";

// Fazenda - Localização e Produção (migration 0016)
export type EstadoUFEnum =
  | "AC"
  | "AL"
  | "AP"
  | "AM"
  | "BA"
  | "CE"
  | "DF"
  | "ES"
  | "GO"
  | "MA"
  | "MT"
  | "MS"
  | "MG"
  | "PA"
  | "PB"
  | "PR"
  | "PE"
  | "PI"
  | "RJ"
  | "RN"
  | "RS"
  | "RO"
  | "RR"
  | "SC"
  | "SP"
  | "SE"
  | "TO";
export type TipoProducaoEnum = "corte" | "leite" | "mista";
export type SistemaManejoEnum =
  | "confinamento"
  | "semi_confinamento"
  | "pastagem";
export type TipoPastoEnum = "nativo" | "cultivado" | "integracao" | "degradado";

// Eventos & Agenda
export type DominioEnum =
  | "sanitario"
  | "pesagem"
  | "nutricao"
  | "movimentacao"
  | "reproducao"
  | "financeiro";
export type AgendaStatusEnum = "agendado" | "concluido" | "cancelado";
export type AgendaSourceKindEnum = "manual" | "automatico";
export type SanitarioTipoEnum = "vacinacao" | "vermifugacao" | "medicamento";
export type ReproTipoEnum = "cobertura" | "IA" | "diagnostico" | "parto";
export type FinanceiroTipoEnum = "compra" | "venda";

// =========================================================
// CORE ENTITIES (State Tables)
// =========================================================

export interface Fazenda {
  id: string;
  nome: string;
  codigo: string | null;
  municipio: string | null;
  timezone: string;
  metadata: Record<string, unknown>;

  // Campos adicionados em migration 0016
  estado: EstadoUFEnum | null;
  cep: string | null;
  area_total_ha: number | null;
  tipo_producao: TipoProducaoEnum | null;
  sistema_manejo: SistemaManejoEnum | null;
  benfeitorias: Record<string, unknown>;

  created_by: string | null;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  // System fields
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Animal {
  id: string;
  fazenda_id: string;
  identificacao: string;
  sexo: SexoEnum;
  status: AnimalStatusEnum;
  lote_id: string | null;

  // Campos de rastreabilidade e genealogia
  data_nascimento: string | null;
  data_entrada: string | null;
  data_saida: string | null;
  pai_id: string | null;
  mae_id: string | null;

  // Campos opcionais de identificação
  nome: string | null;
  rfid: string | null;
  
  // Campos adicionados na Fase 2
  origem: OrigemEnum | null;
  raca: string | null;

  // Campos específicos para machos
  papel_macho: PapelMachoEnum | null;
  habilitado_monta: boolean;

  // Observações e payload
  observacoes: string | null;
  payload: Record<string, unknown>;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  // Campos de sistema
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Lote {
  id: string;
  fazenda_id: string;
  nome: string;
  status: LoteStatusEnum;
  pasto_id: string | null;
  touro_id: string | null;

  observacoes: string | null;
  payload: Record<string, unknown>;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  // Campos de sistema
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Benfeitoria {
  quantidade?: number;
  tipo?: string;
  capacidade?: number;
  unidade_capacidade?: string;
  estado?: 'otimo' | 'bom' | 'regular' | 'ruim';
  observacoes?: string;
  outros_detalhes?: Record<string, unknown>;
}

export interface InfraestruturaPasto {
  cochos?: Benfeitoria;
  bebedouros?: Benfeitoria;
  saleiros?: Benfeitoria;
  cerca?: Benfeitoria & { comprimento_metros?: number };
  curral?: Benfeitoria & { area_metros?: number; possui_balanca?: boolean; possui_brete?: boolean };
  outras?: Record<string, Benfeitoria>;
}

export interface Pasto {
  id: string;
  fazenda_id: string;
  nome: string;
  area_ha: number | null;
  capacidade_ua: number | null;
  tipo_pasto: TipoPastoEnum;
  infraestrutura: InfraestruturaPasto;
  observacoes: string | null;
  payload: Record<string, unknown>;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  // Campos de sistema
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// FASE 2.2: Sociedade de Animais
export interface AnimaisSociedade {
  id: string;
  fazenda_id: string;
  animal_id: string;
  contraparte_id: string;
  percentual: number | null;
  inicio: string; // 'YYYY-MM-DD'
  fim: string | null; // 'YYYY-MM-DD'
  payload: Record<string, unknown>;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at?: string;

  // Campos de sistema
  created_at?: string;
  updated_at?: string;
  deleted_at: string | null;
}

// FASE 2.3: Categorias Zootécnicas
export interface CategoriaZootecnica {
  id: string;
  fazenda_id: string;
  nome: string;
  sexo: SexoEnum | null;
  aplica_ambos: boolean;
  idade_min_dias: number | null;
  idade_max_dias: number | null;
  ativa: boolean;
  payload: Record<string, unknown>;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Operation {
  client_op_id: string;
  client_tx_id: string;
  op_order?: number;
  table: string;
  action: OpAction;
  /**
   * Generic record data. Shape depends on the target table.
   * Cannot be more specific without breaking operation flexibility.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  /**
   * Pre-modification snapshot for rollback.
   * Stored as-is from Dexie for idempotent rollback.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before_snapshot?: any;
  created_at: string;
}

/**
 * OperationInput is used when creating gestures.
 * The fields client_op_id, client_tx_id, and created_at
 * are automatically added by createGesture().
 */
export type OperationInput = Omit<
  Operation,
  "client_op_id" | "client_tx_id" | "created_at"
>;

// =========================================================
// USER & MEMBERSHIP ENTITIES
// =========================================================

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  can_create_farm: boolean;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserSettings {
  user_id: string;
  theme: ThemeEnum;
  date_format: string;
  number_format: string;
  notifications: {
    enabled: boolean;
    agenda_reminders: boolean;
    days_before: number[];
    quiet_hours: { start: string; end: string };
  };
  sync_prefs: {
    wifi_only: boolean;
    background_sync: boolean;
    max_batch_size: number;
  };
  active_fazenda_id: string | null;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserFazenda {
  user_id: string;
  fazenda_id: string;
  role: FarmRoleEnum;
  is_primary: boolean;
  invited_by: string | null;
  accepted_at: string | null;

  // Sync metadata
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FarmInvite {
  id: string;
  fazenda_id: string;
  invited_by: string;
  email: string | null;
  phone: string | null;
  role: FarmRoleEnum;
  status: FarmInviteStatusEnum;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InvitePreview {
  fazenda_id: string;
  fazenda_nome: string;
  role: FarmRoleEnum;
  inviter_display_name: string;
  status: FarmInviteStatusEnum;
  expires_at: string;
}

// =========================================================
// AGENDA & PROTOCOL ENTITIES
// =========================================================

export interface AgendaItem {
  id: string;
  fazenda_id: string;
  dominio: DominioEnum;
  tipo: string;
  status: AgendaStatusEnum;
  data_prevista: string;
  animal_id: string | null;
  lote_id: string | null;

  dedup_key: string | null;
  source_kind: AgendaSourceKindEnum;
  source_ref: Record<string, unknown> | null;
  source_client_op_id: string | null;
  source_tx_id: string | null;
  source_evento_id: string | null;

  protocol_item_version_id: string | null;
  interval_days_applied: number | null;

  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Contraparte {
  id: string;
  fazenda_id: string;
  tipo: ContraparteTipoEnum;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProtocoloSanitario {
  id: string;
  fazenda_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProtocoloSanitarioItem {
  id: string;
  fazenda_id: string;
  protocolo_id: string;
  protocol_item_id: string;
  version: number;

  tipo: SanitarioTipoEnum;
  produto: string;
  intervalo_dias: number;
  dose_num: number | null;
  gera_agenda: boolean;

  dedup_template: string | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Evento {
  id: string;
  fazenda_id: string;
  dominio: DominioEnum;
  occurred_at: string;
  occurred_on?: string;
  animal_id: string | null;
  lote_id: string | null;
  source_task_id: string | null;
  source_tx_id: string | null;
  source_client_op_id: string | null;
  corrige_evento_id: string | null;
  observacoes: string | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventoSanitario {
  evento_id: string;
  fazenda_id: string;
  tipo: SanitarioTipoEnum;
  produto: string;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventoPesagem {
  evento_id: string;
  fazenda_id: string;
  peso_kg: number;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventoNutricao {
  evento_id: string;
  fazenda_id: string;
  alimento_nome: string | null;
  quantidade_kg: number | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventoMovimentacao {
  evento_id: string;
  fazenda_id: string;
  from_lote_id: string | null;
  to_lote_id: string | null;
  from_pasto_id: string | null;
  to_pasto_id: string | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------
// REPRODUÇÃO - PAYLOAD V1 CONTRACT
// ---------------------------------------------------------

export interface ReproductionEventPayloadV1 {
  schema_version: 1;
  
  // Episode Linking
  episode_evento_id?: string; // UUID do evento de serviço (cobertura/IA)
  episode_link_method?: 'manual' | 'auto_last_open_service' | 'unlinked';

  // Common Fields
  observacoes_estruturadas?: Record<string, unknown>;

  // Specific Fields per Type
  // Cobertura
  tecnica_livre?: string;
  reprodutor_tag?: string;

  // IA
  lote_semen?: string;
  dose_semen_ref?: string;

  // Diagnostico
  resultado?: 'positivo' | 'negativo' | 'inconclusivo';
  metodo_livre?: string;
  data_prevista_parto?: string; // YYYY-MM-DD

  // Parto
  data_parto_real?: string; // YYYY-MM-DD
  numero_crias?: number;
}

export interface EventoReproducao {
  evento_id: string;
  fazenda_id: string;
  tipo: ReproTipoEnum;
  macho_id: string | null;
  payload: ReproductionEventPayloadV1 | Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventoFinanceiro {
  evento_id: string;
  fazenda_id: string;
  tipo: FinanceiroTipoEnum;
  valor_total: number;
  contraparte_id: string | null;
  payload: Record<string, unknown>;

  // Campos de sistema
  client_id: string;
  client_op_id: string;
  client_tx_id: string | null;
  client_recorded_at: string;
  server_received_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}



export interface Gesture {
  client_tx_id: string;
  fazenda_id: string;
  client_id: string;
  status: GestureStatus;
  last_error?: string;
  retry_count?: number; // P1.3: For exponential backoff retry strategy
  created_at: string;
}

export interface Rejection {
  id?: number;
  client_tx_id: string;
  client_op_id: string;
  fazenda_id: string;
  table: string;
  action: string;
  reason_code: string;
  reason_message: string;
  created_at: string;
}

// =========================================================
// SYNC API TYPES (sync-batch Edge Function)
// =========================================================

export interface SyncBatchRequest {
  client_id: string;
  fazenda_id: string;
  client_tx_id: string;
  ops: Operation[];
}

export interface SyncBatchResponse {
  server_tx_id: string;
  client_tx_id: string;
  results: SyncOperationResult[];
}

export interface SyncOperationResult {
  op_id: string;
  status: "APPLIED" | "APPLIED_ALTERED" | "REJECTED";
  reason_code?: string;
  reason_message?: string;
  altered?: { dedup?: "collision_noop" };
}

// =========================================================
// UTILITY TYPES (para queries com nested selects)
// =========================================================

/**
 * Fazenda com informação do owner (nested select)
 */
export interface FazendaWithOwner extends Fazenda {
  owner?: UserProfile;
}

/**
 * UserFazenda com dados da fazenda (nested select)
 */
export interface UserFazendaWithFarm extends UserFazenda {
  fazendas?: Fazenda;
}

/**
 * Evento com detalhes específicos por domínio (nested select)
 */
export interface EventoWithDetails extends Evento {
  details_sanitario?: EventoSanitario;
  details_pesagem?: EventoPesagem;
  details_nutricao?: EventoNutricao;
  details_movimentacao?: EventoMovimentacao;
  details_reproducao?: EventoReproducao;
  details_financeiro?: EventoFinanceiro;
}

// =========================================================
// VALIDATION HELPERS (Payload v1)
// =========================================================

export const ensureSchemaVersion = (payload: unknown): 1 => {
  return 1;
};

export const normalizeDateToISO = (dateStr: string | undefined | null): string | undefined => {
  if (!dateStr) return undefined;
  // Simple regex check for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Try to parse if it's a valid date object or other format
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
     return d.toISOString().split('T')[0];
  }
  return undefined;
};

