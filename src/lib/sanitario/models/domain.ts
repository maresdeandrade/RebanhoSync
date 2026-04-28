/**
 * Domínio Estruturado do Módulo Sanitário
 *
 * Este arquivo define 6 camadas semânticas que estruturam um item de protocolo sanitário:
 * 1. Identity — o que a etapa é
 * 2. Schedule — quando ela pode/deve nascer
 * 3. Eligibility — para quem ela se aplica
 * 4. Applicability — em que contexto ela passa a valer
 * 5. Compliance — o que é obrigatório para executar/concluir
 * 6. Execution — o que aconteceu de fato na operação
 *
 * Também define o contexto de cálculo do scheduler, o contrato de entrada/saída,
 * e o modelo de registro de execução.
 */

import type { OccurrenceBlockReason as ReasonCode } from "@/lib/sanitario/models/reasonCodes";

// ============================================================================
// ENUMS
// ============================================================================

export type SanitaryLayer = "official" | "standard" | "custom";

export type SanitaryScopeType = "animal" | "lote" | "fazenda";

export type SanitaryCalendarMode =
  | "campanha"
  | "janela_etaria"
  | "rotina_recorrente"
  | "procedimento_imediato"
  | "nao_estruturado";

export type SanitaryCalendarAnchor =
  | "nascimento"
  | "entrada_fazenda"
  | "conclusao_etapa_dependente"
  | "ultima_conclusao_mesma_familia"
  | "desmama"
  | "parto_previsto"
  | "movimentacao"
  | "diagnostico_evento"
  | "sem_ancora";

export type SanitaryScheduleKind =
  | "calendar_base"
  | "after_previous_completion"
  | "rolling_from_last_completion";

export type SanitarySexTarget = "macho" | "femea" | "sem_restricao";

export type ApplicabilityType =
  | "sempre"
  | "jurisdicao"
  | "risco"
  | "evento"
  | "perfil_animal";

export type ComplianceLevel = "obrigatorio" | "condicional" | "recomendado";

export type SanitaryExecutionStatus =
  | "pending"
  | "completed"
  | "blocked"
  | "expired"
  | "cancelled";

export type ProtocolKind =
  | "vacinacao"
  | "antiparasitario"
  | "medicamento"
  | "biosseguranca"
  | "nutricao"
  | "documental"
  | "notificacao"
  | "clinico"
  | "outro";

export type MaterializationMode =
  | "agenda"
  | "compliance_only"
  | "execution_only"
  | "none";

export type ComplianceKind =
  | "checklist"
  | "document_required"
  | "feed_ban"
  | "withholding_period"
  | "quarantine"
  | "none";

// ============================================================================
// CAMADA 1: IDENTITY
// ============================================================================

export interface SanitaryIdentity {
  protocolId: string;
  itemId: string;
  familyCode: string; // ex: "brucelose"
  itemCode: string; // ex: "dose_1", "dose_unica", "reforco_anual"
  regimenVersion: number;
  layer: SanitaryLayer;
  scopeType: SanitaryScopeType;
}

// ============================================================================
// CAMADA 4: APPLICABILITY
// ============================================================================

export interface JurisdictionRule {
  uf?: string[] | null;
  municipio?: string[] | null;
  regiaoSanitaria?: string[] | null;
  classificacaoSanitaria?: string[] | null;
}

export interface RiskRule {
  riskCodes?: string[] | null; // ex: ["raiva_endemica"]
  outbreakActive?: boolean | null;
  zoneIds?: string[] | null;
}

export interface EventRule {
  eventCodes?: string[] | null; // ex: ["entrada_fazenda", "suspeita_doenca"]
  requiresOpenEvent?: boolean | null;
}

export interface AnimalProfileRule {
  species?: Array<"bovino" | "bubalino"> | null;
  categoryCodes?: string[] | null; // ex: ["bezerra", "novilha", "vaca_lactacao"]
  reproductionStatus?: string[] | null;
}

export interface SanitaryApplicability {
  type: ApplicabilityType;
  jurisdiction?: JurisdictionRule | null;
  risk?: RiskRule | null;
  event?: EventRule | null;
  animalProfile?: AnimalProfileRule | null;
}

// ============================================================================
// CAMADA 3: ELIGIBILITY
// ============================================================================

export interface SanitaryEligibility {
  sexTarget: SanitarySexTarget;
  ageMinDays: number | null;
  ageMaxDays: number | null;
  species: Array<"bovino" | "bubalino"> | null;
  categoryCodes: string[] | null;
}

// ============================================================================
// CAMADA 2: SCHEDULE
// ============================================================================

export interface SanitarySchedule {
  mode: SanitaryCalendarMode;
  anchor: SanitaryCalendarAnchor;
  scheduleKind?: SanitaryScheduleKind | null;
  intervalDays: number | null;
  campaignMonths: number[] | null;
  ageStartDays: number | null;
  ageEndDays: number | null;
  dependsOnItemCode: string | null;
  generatesAgenda: boolean;
  operationalLabel: string | null;
  notes: string | null;
  instructions: string | null;
}

// ============================================================================
// CAMADA 5: COMPLIANCE
// ============================================================================

export interface SanitaryCompliance {
  level: ComplianceLevel;
  mandatory: boolean;
  requiresVeterinarian: boolean;
  requiresDocument: boolean;
  requiredDocumentTypes: string[] | null;
  blocksExecutionWithoutVeterinarian: boolean;
  blocksCompletionWithoutDocument: boolean;
}

// ============================================================================
// CAMADA 6: EXECUTION POLICY
// ============================================================================

export interface SanitaryExecutionPolicy {
  allowsManualExecution: boolean;
  createsInstantTaskOnEvent: boolean;
  expiresWhenWindowEnds: boolean;
  supportsBatchExecution: boolean;
}

// ============================================================================
// COMPOSIÇÃO: PROTOCOL ITEM DOMAIN
// ============================================================================

export interface SanitaryProtocolItemDomain {
  identity: SanitaryIdentity;
  applicability: SanitaryApplicability;
  eligibility: SanitaryEligibility;
  schedule: SanitarySchedule;
  compliance: SanitaryCompliance;
  executionPolicy: SanitaryExecutionPolicy;
}

// ============================================================================
// CONTEXTO DO SCHEDULER
// ============================================================================

export interface SanitarySubjectContext {
  scopeType: SanitaryScopeType;
  scopeId: string;

  animal?: {
    id: string;
    birthDate: string | null;
    sex: "macho" | "femea";
    species: "bovino" | "bubalino";
    categoryCode: string | null;
    reproductionStatus?: string | null;
  } | null;

  lote?: {
    id: string;
    categoryCode?: string | null;
  } | null;

  fazenda: {
    id: string;
    uf: string | null;
    municipio: string | null;
    regiaoSanitaria?: string | null;
    classificacaoSanitaria?: string | null;
  };

  activeRisks: string[];
  activeEvents: Array<{
    eventId: string;
    eventCode: string;
    openedAt: string;
    closedAt: string | null;
  }>;
}

// ============================================================================
// REGISTRO DE EXECUÇÃO
// ============================================================================

export interface SanitaryExecutionRecord {
  occurrenceId: string;
  familyCode: string;
  itemCode: string;
  regimenVersion: number;
  scopeType: SanitaryScopeType;
  scopeId: string;
  completedAt: string | null;
  executionDate: string | null;
  sourceEventId: string | null;
  dedupKey: string;
  status: SanitaryExecutionStatus;
}

// ============================================================================
// CONTEXTO TEMPORAL DO SCHEDULER
// ============================================================================

export interface SchedulerNowContext {
  nowIso: string; // ISO 8601 string, ex: "2026-04-12T10:30:00Z"
  timezone: string; // ex: "America/Sao_Paulo"
}

// ============================================================================
// CONTRATO DE ENTRADA DO SCHEDULER
// ============================================================================

export interface ComputeNextSanitaryOccurrenceInput {
  item: SanitaryProtocolItemDomain;
  subject: SanitarySubjectContext;
  history: SanitaryExecutionRecord[];
  now: SchedulerNowContext;
}

// ============================================================================
// REASON CODES (para referência cruzada com reasonCodes.ts)
// ============================================================================

export type OccurrenceBlockReason = ReasonCode;

export type BlockedBy =
  | "eligibility"
  | "applicability"
  | "dependency"
  | "window"
  // Inclui bloqueios de camada/ativacao/modo de calendario.
  | "schedule"
  | "dedup"
  | null;

// ============================================================================
// CONTRATO DE SAÍDA DO SCHEDULER
// ============================================================================

export interface ComputeNextSanitaryOccurrenceResult {
  materialize: boolean;
  dueDate: string | null; // ISO YYYY-MM-DD
  availableAt: string | null; // ISO YYYY-MM-DD
  dedupKey: string | null;
  reasonCode: OccurrenceBlockReason;
  reasonMessage: string;
  actionable: boolean;
  complianceLevel: ComplianceLevel;
  blockedBy: BlockedBy;
}

// ============================================================================
// TIPOS AUXILIARES (para adapters e draft model)
// ============================================================================

export type LegacyPayload = Record<string, unknown>;

export interface ProtocolItemDraft {
  protocolId: string;
  itemId: string;

  // identity
  familyCode: string;
  itemCode: string;
  regimenVersion: number;
  layer: SanitaryLayer;
  scopeType: SanitaryScopeType;

  // schedule
  mode: SanitaryCalendarMode | undefined;
  anchor: SanitaryCalendarAnchor;
  intervalDays: number | undefined;
  campaignMonths: number[] | undefined;
  ageStartDays: number | undefined;
  ageEndDays: number | undefined;
  dependsOnItemCode: string | null;
  generatesAgenda: boolean;
  operationalLabel: string | null;

  // eligibility
  sexTarget: SanitarySexTarget;
  ageMinDays: number | null;
  ageMaxDays: number | null;
  species: Array<"bovino" | "bubalino"> | null;
  categoryCodes: string[] | null;

  // applicability
  applicabilityType: ApplicabilityType;
  jurisdiction: JurisdictionRule | null;
  risk: RiskRule | null;
  event: EventRule | null;
  animalProfile: AnimalProfileRule | null;

  // compliance
  complianceLevel: ComplianceLevel;
  mandatory: boolean;
  requiresVeterinarian: boolean;
  requiresDocument: boolean;
  requiredDocumentTypes: string[] | null;

  // executionPolicy
  allowsManualExecution: boolean;
  createsInstantTaskOnEvent: boolean;
  expiresWhenWindowEnds: boolean;
  supportsBatchExecution: boolean;
}
