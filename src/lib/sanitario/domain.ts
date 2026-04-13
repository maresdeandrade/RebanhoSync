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

export interface SanitaryIdentity {
  protocolId: string;
  itemId: string;
  familyCode: string;   // ex: "brucelose"
  itemCode: string;     // ex: "dose_1", "dose_unica", "reforco_anual"
  regimenVersion: number;
  layer: SanitaryLayer;
  scopeType: SanitaryScopeType;
}

export interface JurisdictionRule {
  uf?: string[] | null;
  municipio?: string[] | null;
  regiaoSanitaria?: string[] | null;
  classificacaoSanitaria?: string[] | null;
}

export interface RiskRule {
  riskCodes?: string[] | null;           // ex: ["raiva_endemica"]
  outbreakActive?: boolean | null;
  zoneIds?: string[] | null;
}

export interface EventRule {
  eventCodes?: string[] | null;          // ex: ["entrada_fazenda", "suspeita_doenca"]
  requiresOpenEvent?: boolean | null;
}

export interface AnimalProfileRule {
  species?: Array<"bovino" | "bubalino"> | null;
  categoryCodes?: string[] | null;       // ex: ["bezerra", "novilha", "vaca_lactacao"]
  reproductionStatus?: string[] | null;
}

export interface SanitaryApplicability {
  type: ApplicabilityType;
  jurisdiction?: JurisdictionRule | null;
  risk?: RiskRule | null;
  event?: EventRule | null;
  animalProfile?: AnimalProfileRule | null;
}

export interface SanitaryEligibility {
  sexTarget: SanitarySexTarget;
  ageMinDays: number | null;
  ageMaxDays: number | null;
  species: Array<"bovino" | "bubalino"> | null;
  categoryCodes: string[] | null;
}

export interface SanitarySchedule {
  mode: SanitaryCalendarMode;
  anchor: SanitaryCalendarAnchor;
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

export interface SanitaryCompliance {
  level: ComplianceLevel;
  mandatory: boolean;
  requiresVeterinarian: boolean;
  requiresDocument: boolean;
  requiredDocumentTypes: string[] | null;
  blocksExecutionWithoutVeterinarian: boolean;
  blocksCompletionWithoutDocument: boolean;
}

export interface SanitaryExecutionPolicy {
  allowsManualExecution: boolean;
  createsInstantTaskOnEvent: boolean;
  expiresWhenWindowEnds: boolean;
  supportsBatchExecution: boolean;
}

export interface SanitaryProtocolItemDomain {
  identity: SanitaryIdentity;
  applicability: SanitaryApplicability;
  eligibility: SanitaryEligibility;
  schedule: SanitarySchedule;
  compliance: SanitaryCompliance;
  executionPolicy: SanitaryExecutionPolicy;
}
