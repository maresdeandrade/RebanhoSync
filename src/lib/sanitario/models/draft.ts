/**
 * Draft Model — Camada intermediária entre UI e Domínio
 *
 * Permite estados parciais/incompletos na UI, mas converte p/ domínio puro
 * ao salvar. Suporta campos dinâmicos por `mode`.
 */

import type {
  ExecutionPolicyForMode,
  OccurrenceBlockReason,
  SanitaryCalendarAnchor,
  SanitaryCalendarMode,
  SanitaryCompliance,
  SanitaryEligibility,
  SanitaryIdentity,
  SanitaryLayer,
  SanitaryProtocolItemDomain,
  SanitaryScopeType,
} from "@/lib/sanitario/models/domain";
import {
  validateSanitaryItemDomain,
  sanitaryLayerEnum,
  sanitaryScopeEnum,
  sanitaryCalendarModeEnum,
} from "@/lib/sanitario/models/validation";

/**
 * ProtocolItemDraft — Estado intermediário do editor UI
 *
 * Campos podem ser undefined ou "", permitindo edição incremental.
 * Convertido para domínio puro ao salvar.
 */
export interface ProtocolItemDraft {
  // Identity (obrigatório para exibição)
  protocolId: string;
  itemId: string;
  familyCode?: string;
  itemCode?: string;
  regimenVersion?: number;

  // Layer & Scope (obrigatório)
  layer?: SanitaryLayer;
  scopeType?: SanitaryScopeType;

  // Schedule (obrigatório, mas campos dependem do mode)
  mode?: SanitaryCalendarMode;
  anchor?: SanitaryCalendarAnchor;

  // Campos dependentes do mode
  // Campanha
  campaignMonths?: number[] | null;
  campaignLabel?: string;

  // Janela etária
  ageStartDays?: number;
  ageEndDays?: number;

  // Rotina recorrente
  intervalDays?: number;

  // Procedimento imediato
  triggerEvent?: string; // tipo de evento que dispara

  // Campos de elegibilidade
  sexAllowed?: ("M" | "F" | "todos")[];
  speciesAllowed?: string[];
  categoryAllowed?: string[];

  // Compliance
  isComplianceRequired?: boolean;
  complianceDocType?: string;

  // Dependency
  dependsOnItemCode?: string;

  // Identification de produto
  productCode?: string;
  productName?: string;
  doseNumber?: number;

  // UI hints
  generatesAgenda?: boolean;
  description?: string;
  notes?: string;

  // Dedup preview (apenas leitura, calculado)
  dedupKeyPreview?: string | null;
}

/**
 * Converte draft para domínio puro
 *
 * Lança erro se há campos obrigatórios faltando.
 * Preenche defaults para campos opcionais.
 */
export function mapDraftToDomain(draft: ProtocolItemDraft): SanitaryProtocolItemDomain {
  // Validar campos obrigatórios
  if (!draft.layer) {
    throw new Error("Draft: layer é obrigatório");
  }
  if (!draft.scopeType) {
    throw new Error("Draft: scopeType é obrigatório");
  }
  if (!draft.mode) {
    throw new Error("Draft: schedulingMode é obrigatório");
  }

  // Anchor é obrigatório para todos os modos exceto procedimento_imediato
  if (draft.mode !== "procedimento_imediato" && !draft.anchor) {
    throw new Error("Draft: schedulingAnchor é obrigatório");
  }


  // Validar campos dependentes do mode
  if (draft.mode === "campanha" && (!draft.campaignMonths || draft.campaignMonths.length === 0)) {
    throw new Error("Draft: campaignMonths é obrigatório para mode='campanha'");
  }

  if (draft.mode === "janela_etaria") {
    if (typeof draft.ageStartDays !== "number" || draft.ageStartDays < 0) {
      throw new Error("Draft: ageStartDays é obrigatório e deve ser >= 0 para mode='janela_etaria'");
    }
    if (typeof draft.ageEndDays !== "number" || draft.ageEndDays < draft.ageStartDays) {
      throw new Error(
        "Draft: ageEndDays é obrigatório e deve ser >= ageStartDays para mode='janela_etaria'"
      );
    }
  }

  if (draft.mode === "rotina_recorrente") {
    if (typeof draft.intervalDays !== "number" || draft.intervalDays <= 0) {
      throw new Error("Draft: intervalDays é obrigatório e deve ser > 0 para mode='rotina_recorrente'");
    }
  }

  if (draft.mode === "procedimento_imediato") {
    if (!draft.triggerEvent) {
      throw new Error(
        "Draft: triggerEvent é obrigatório para mode='procedimento_imediato'"
      );
    }
  }

  // Construir identidade
  const identity: SanitaryIdentity = {
    protocolId: draft.protocolId,
    itemId: draft.itemId,
    familyCode: draft.familyCode || `family-${draft.itemId}`,
    itemCode: draft.itemCode || `item-${draft.itemId}`,
    regimenVersion: draft.regimenVersion || 1,
  };

  // Construir elegibilidade
  const eligibility: SanitaryEligibility = {
    sexAllowed: draft.sexAllowed || ["M", "F"],
    speciesAllowed: draft.speciesAllowed || ["bovino"],
    categoryAllowed: draft.categoryAllowed || [],
  };

  // Construir compliance
  const compliance: SanitaryCompliance = {
    isComplianceRequired: draft.isComplianceRequired || false,
    complianceDocType: draft.complianceDocType,
  };

  // Construir execução (mode-dependente)
  let execution: ExecutionPolicyForMode;

  switch (draft.mode) {
    case "campanha":
      execution = {
        mode: "campanha",
        anchor: draft.anchor,
        campaignMonths: draft.campaignMonths!,
        campaignLabel: draft.campaignLabel || "",
      };
      break;

    case "janela_etaria":
      execution = {
        mode: "janela_etaria",
        anchor: draft.anchor,
        ageStartDays: draft.ageStartDays!,
        ageEndDays: draft.ageEndDays!,
      };
      break;

    case "rotina_recorrente":
      execution = {
        mode: "rotina_recorrente",
        anchor: draft.anchor,
        intervalDays: draft.intervalDays!,
      };
      break;

    case "procedimento_imediato":
      execution = {
        mode: "procedimento_imediato",
        triggerEvent: draft.triggerEvent!,
      };
      break;

    case "nao_estruturado":
      execution = {
        mode: "nao_estruturado",
      };
      break;

    default:
      throw new Error(`Draft: modo desconhecido "${draft.mode}"`);
  }

  // Construir domínio
  const domain: SanitaryProtocolItemDomain = {
    identity,
    layer: draft.layer,
    scopeType: draft.scopeType,
    eligibility,
    compliance,
    execution,
    dependsOnItemCode: draft.dependsOnItemCode,
    generatesAgenda: draft.generatesAgenda !== false,
    productCode: draft.productCode,
    productName: draft.productName,
    doseNumber: draft.doseNumber || 1,
    description: draft.description,
  };

  return domain;
}

/**
 * Converte domínio puro para draft (para edição)
 *
 * Extrai campos estruturados de volta para o formato draft.
 */
export function mapDomainToDraft(domain: SanitaryProtocolItemDomain): ProtocolItemDraft {
  const draft: ProtocolItemDraft = {
    protocolId: domain.identity.protocolId,
    itemId: domain.identity.itemId,
    familyCode: domain.identity.familyCode,
    itemCode: domain.identity.itemCode,
    regimenVersion: domain.identity.regimenVersion,
    layer: domain.layer,
    scopeType: domain.scopeType,
    generatesAgenda: domain.generatesAgenda,
    description: domain.description,
    sexAllowed: domain.eligibility.sexAllowed,
    speciesAllowed: domain.eligibility.speciesAllowed,
    categoryAllowed: domain.eligibility.categoryAllowed,
    isComplianceRequired: domain.compliance.isComplianceRequired,
    complianceDocType: domain.compliance.complianceDocType,
    dependsOnItemCode: domain.dependsOnItemCode,
    productCode: domain.productCode,
    productName: domain.productName,
    doseNumber: domain.doseNumber,
  };

  // Extrair campos dependentes do mode
  if (domain.execution.mode === "campanha") {
    draft.mode = "campanha";
    draft.anchor = domain.execution.anchor;
    draft.campaignMonths = domain.execution.campaignMonths;
    draft.campaignLabel = domain.execution.campaignLabel;
  } else if (domain.execution.mode === "janela_etaria") {
    draft.mode = "janela_etaria";
    draft.anchor = domain.execution.anchor;
    draft.ageStartDays = domain.execution.ageStartDays;
    draft.ageEndDays = domain.execution.ageEndDays;
  } else if (domain.execution.mode === "rotina_recorrente") {
    draft.mode = "rotina_recorrente";
    draft.anchor = domain.execution.anchor;
    draft.intervalDays = domain.execution.intervalDays;
  } else if (domain.execution.mode === "procedimento_imediato") {
    draft.mode = "procedimento_imediato";
    draft.triggerEvent = domain.execution.triggerEvent;
  } else {
    draft.mode = "nao_estruturado";
  }

  return draft;
}

/**
 * Cria um draft vazio (para novo item)
 */
export function createEmptyProtocolItemDraft(overrides?: Partial<ProtocolItemDraft>): ProtocolItemDraft {
  return {
    protocolId: "",
    itemId: "",
    familyCode: "",
    itemCode: "",
    regimenVersion: 1,
    layer: undefined,
    scopeType: undefined,
    mode: undefined,
    anchor: undefined,
    generatesAgenda: true,
    sexAllowed: ["M", "F"],
    speciesAllowed: ["bovino"],
    isComplianceRequired: false,
    doseNumber: 1,
    ...overrides,
  };
}

/**
 * Valida draft e retorna lista de erros
 *
 * Diferente de validateSanitaryItemDomain que valida domínio puro,
 * esta função valida o draft em contexto de edição (permite nulls parciais).
 */
export function validateProtocolItemDraft(draft: ProtocolItemDraft): string[] {
  const errors: string[] = [];

  // Campos obrigatórios
  if (!draft.layer) {
    errors.push("Layer é obrigatório");
  }
  if (!draft.scopeType) {
    errors.push("Scope type é obrigatório");
  }
  if (!draft.mode) {
    errors.push("Modo de agendamento é obrigatório");
  }
  if (!draft.anchor) {
    errors.push("Âncora de agendamento é obrigatório");
  }

  // Validações dependentes do mode
  if (draft.mode === "campanha") {
    if (!draft.campaignMonths || draft.campaignMonths.length === 0) {
      errors.push("Meses da campanha são obrigatórios");
    }
  }

  if (draft.mode === "janela_etaria") {
    if (typeof draft.ageStartDays !== "number" || draft.ageStartDays < 0) {
      errors.push("Idade inicial deve ser um número >= 0");
    }
    if (typeof draft.ageEndDays !== "number" || draft.ageEndDays < 0) {
      errors.push("Idade final deve ser um número >= 0");
    }
    if (
      typeof draft.ageStartDays === "number" &&
      typeof draft.ageEndDays === "number" &&
      draft.ageEndDays < draft.ageStartDays
    ) {
      errors.push("Idade final deve ser >= idade inicial");
    }
  }

  if (draft.mode === "rotina_recorrente") {
    if (typeof draft.intervalDays !== "number" || draft.intervalDays <= 0) {
      errors.push("Intervalo deve ser um número > 0");
    }
  }

  if (draft.mode === "procedimento_imediato") {
    if (!draft.triggerEvent) {
      errors.push("Tipo de evento disparador é obrigatório");
    }
  }

  return errors;
}

/**
 * Obtém campos visíveis por mode
 * Útil para UI saber quais campos renderizar
 */
export function getVisibleFieldsByMode(mode?: SanitaryCalendarMode): {
  campaignFields: boolean;
  ageWindowFields: boolean;
  intervalFields: boolean;
  triggerEventField: boolean;
} {
  return {
    campaignFields: mode === "campanha",
    ageWindowFields: mode === "janela_etaria",
    intervalFields: mode === "rotina_recorrente",
    triggerEventField: mode === "procedimento_imediato",
  };
}
