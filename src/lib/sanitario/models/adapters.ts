/**
 * Adapters: Conversão entre Payload Legado e Domínio Novo
 *
 * Normaliza campos com variações de nome, preenche defaults canônicos,
 * e converte entre formatos legado (livre) e domínio estruturado.
 */

import { readString } from "@/pages/Agenda/helpers/formatting";
import type {
  SanitaryProtocolItemDomain,
  SanitaryIdentity,
  SanitaryApplicability,
  SanitaryEligibility,
  SanitarySchedule,
  SanitaryCompliance,
  SanitaryExecutionPolicy,
  SanitaryCalendarMode,
  SanitaryCalendarAnchor,
  SanitaryScheduleKind,
  ApplicabilityType,
  ComplianceLevel,
  LegacyPayload,
  JurisdictionRule,
  RiskRule,
  EventRule,
  AnimalProfileRule,
} from "@/lib/sanitario/models/domain";

// ============================================================================
// HELPERS: NORMALIZAÇÃO DE CAMPOS
// ============================================================================

/**
 * Normalizar nome de campo, suportando variações de grafia.
 * Tenta os nomes em ordem de preferência.
 */
function getField(obj: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in obj) {
      return obj[name];
    }
  }
  return undefined;
}

/**
 * Tentar converter para número inteiro, retornando null se não conseguir.
 */
function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return !isNaN(n) && Number.isInteger(n) ? n : null;
}

/**
 * Tentar converter para booleano, com default.
 */
function toBooleanOrDefault(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return defaultValue;
}

/**
 * Garantir array string, nullable se vazio.
 */
function toStringArrayOrNull(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const filtered = value.filter(
      (v) => typeof v === "string" || typeof v === "number",
    );
    return filtered.length > 0 ? filtered.map(String) : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  return null;
}

/**
 * Garantir array números, nullable se vazio.
 */
function toNumberArrayOrNull(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const filtered = value
      .map(toIntOrNull)
      .filter((v) => v !== null) as number[];
    return filtered.length > 0 ? filtered : null;
  }
  const n = toIntOrNull(value);
  return n !== null ? [n] : null;
}

function getNestedField(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toSanitaryScheduleKind(value: unknown): SanitaryScheduleKind | null {
  return value === "calendar_base" ||
    value === "after_previous_completion" ||
    value === "rolling_from_last_completion"
    ? value
    : null;
}

// ============================================================================
// PARSE: LEGACY → DOMAIN
// ============================================================================

export function parseLegacyProtocolItemToDomain(
  protocolId: string,
  itemId: string,
  payload: LegacyPayload,
): SanitaryProtocolItemDomain {
  // Extrair campos identidade
  const identity = parseIdentity(protocolId, itemId, payload);

  // Extrair campos schedule (que determinam mode)
  const schedule = parseSchedule(payload);

  // Determinar se deve gerar agenda (padrão: true, exceto legado)
  const generatesAgenda =
    schedule.mode === "nao_estruturado"
      ? false
      : toBooleanOrDefault(
          getField(payload, "generates_agenda", "generatesAgenda"),
          true,
        );

  // Completar schedule com flag
  schedule.generatesAgenda = generatesAgenda;

  // Extrair campos elegibilidade
  const eligibility = parseEligibility(payload);

  // Extrair campos aplicabilidade
  const applicability = parseApplicability(payload);

  // Extrair campos compliance
  const compliance = parseCompliance(payload);

  // Extrair campos execution policy
  const executionPolicy = parseExecutionPolicy(payload);

  return {
    identity,
    schedule,
    eligibility,
    applicability,
    compliance,
    executionPolicy,
  };
}

function parseIdentity(
  protocolId: string,
  itemId: string,
  payload: LegacyPayload,
): SanitaryIdentity {
  const familyCodeRaw = getField(
    payload,
    "family_code",
    "familyCode",
    "familia_code",
    "familiar_code",
    "familia",
  );
  if (!familyCodeRaw || String(familyCodeRaw).trim().length === 0) {
    throw new Error("parseIdentity: family_code é obrigatório");
  }
  const familyCode = String(familyCodeRaw);

  const itemCodeRaw = getField(payload, "item_code", "itemCode", "codigo");
  if (!itemCodeRaw || String(itemCodeRaw).trim().length === 0) {
    throw new Error("parseIdentity: item_code é obrigatório");
  }
  const itemCode = String(itemCodeRaw);

  const regimenVersionRaw = getField(
    payload,
    "regimen_version",
    "regimenVersion",
    "version",
  );
  const regimenVersion = toIntOrNull(regimenVersionRaw) ?? 1;

  const layerRaw = String(
    getField(payload, "origem", "layer", "origin", "camada") || "custom",
  ).toLowerCase();
  const layer = (
    ["official", "standard", "custom"].includes(layerRaw) ? layerRaw : "custom"
  ) as "official" | "standard" | "custom";

  const scopeTypeRaw = String(
    getField(payload, "scope_type", "scopeType", "escopo", "escopo_tipo") ||
      "animal",
  ).toLowerCase();
  const scopeType = (
    ["animal", "lote", "fazenda"].includes(scopeTypeRaw)
      ? scopeTypeRaw
      : "animal"
  ) as "animal" | "lote" | "fazenda";

  return {
    protocolId,
    itemId,
    familyCode,
    itemCode,
    regimenVersion,
    layer,
    scopeType,
  };
}

function parseSchedule(payload: LegacyPayload): SanitarySchedule {
  // Tentar inferir modo automaticamente baseado em campos presentes
  let mode: SanitaryCalendarMode = "nao_estruturado";

  const campaignMonthsRaw = getField(
    payload,
    "campaign_months",
    "campaignMonths",
    "meses_campanha",
    "meses",
  );
  const intervalDaysRaw = getField(
    payload,
    "interval_days",
    "intervalDays",
    "intervalo_dias",
  );
  const ageStartDaysRaw = getField(
    payload,
    "age_start_days",
    "ageStartDays",
    "idade_min_dias",
    "idade_minima_dias",
  );

  const hasCampaignMonths = Boolean(
    campaignMonthsRaw &&
    Array.isArray(campaignMonthsRaw) &&
    campaignMonthsRaw.length > 0,
  );
  const hasIntervalDays =
    toIntOrNull(intervalDaysRaw) !== null && toIntOrNull(intervalDaysRaw)! > 0;
  const hasAgeStartDays = toIntOrNull(ageStartDaysRaw) !== null;

  if (hasCampaignMonths) {
    mode = "campanha";
  } else if (hasIntervalDays) {
    mode = "rotina_recorrente";
  } else if (hasAgeStartDays) {
    mode = "janela_etaria";
  }

  const anchor = String(
    getField(payload, "anchor", "anchoragem", "ancla", "ponto_referencia") ||
      "sem_ancora",
  ).toLowerCase();

  const validAnchors = [
    "nascimento",
    "entrada_fazenda",
    "conclusao_etapa_dependente",
    "ultima_conclusao_mesma_familia",
    "desmama",
    "parto_previsto",
    "movimentacao",
    "diagnostico_evento",
    "sem_ancora",
  ] as const;

  const anchorValue = (validAnchors as readonly string[]).includes(anchor)
    ? (anchor as SanitaryCalendarAnchor)
    : ("sem_ancora" as SanitaryCalendarAnchor);

  return {
    mode,
    anchor: anchorValue,
    scheduleKind: toSanitaryScheduleKind(
      getNestedField(payload, ["regime_sanitario", "schedule_rule", "kind"]) ??
        getField(payload, "schedule_kind", "scheduleKind"),
    ),
    intervalDays:
      mode === "rotina_recorrente" ? toIntOrNull(intervalDaysRaw) : null,
    campaignMonths:
      mode === "campanha" ? toNumberArrayOrNull(campaignMonthsRaw) : null,
    ageStartDays:
      mode === "janela_etaria"
        ? toIntOrNull(ageStartDaysRaw)
        : toIntOrNull(getField(payload, "age_min_days", "ageMinDays")) || null,
    ageEndDays:
      mode === "janela_etaria"
        ? toIntOrNull(
            getField(payload, "age_end_days", "ageMaxDays", "age_max_days"),
          )
        : null,
    dependsOnItemCode: (() => {
      const dep = getField(
        payload,
        "depends_on_item_code",
        "dependsOnItemCode",
        "dependencia",
      );
      return typeof dep === "string" ? dep : null;
    })(),
    generatesAgenda: true, // será sobrescrito em parseLegacyProtocolItemToDomain
    operationalLabel: (() => {
      const label = getField(
        payload,
        "operational_label",
        "operationalLabel",
        "label_operacional",
      );
      return typeof label === "string" ? label : null;
    })(),
    notes: (() => {
      const notes = getField(payload, "notes", "notas", "observacoes");
      return typeof notes === "string" ? notes : null;
    })(),
    instructions: (() => {
      const instr = getField(
        payload,
        "instructions",
        "instrucoes",
        "instructoes",
      );
      return typeof instr === "string" ? instr : null;
    })(),
  };
}

function parseEligibility(payload: LegacyPayload): SanitaryEligibility {
  // First try to get from eligibility-specific fields, then fall back to schedule fields
  const ageMinDays = toIntOrNull(
    getField(
      payload,
      "age_min_days",
      "ageMinDays",
      "idade_min_dias",
      "idade_minima_dias",
      "age_start_days",
      "ageStartDays",
    ),
  );
  const ageMaxDays = toIntOrNull(
    getField(
      payload,
      "age_max_days",
      "ageMaxDays",
      "idade_max_dias",
      "idade_maxima_dias",
      "age_end_days",
      "ageEndDays",
    ),
  );

  return {
    sexTarget: (["macho", "femea", "sem_restricao"].includes(
      String(
        getField(payload, "sex_target", "sexTarget", "sexo_alvo") ||
          "sem_restricao",
      ),
    )
      ? (String(getField(payload, "sex_target", "sexTarget", "sexo_alvo")) as
          | "macho"
          | "femea"
          | "sem_restricao")
      : "sem_restricao") as "macho" | "femea" | "sem_restricao",
    ageMinDays,
    ageMaxDays,
    species: toStringArrayOrNull(
      getField(payload, "species", "especies", "especie"),
    )?.filter((s) => s === "bovino" || s === "bubalino") as Array<
      "bovino" | "bubalino"
    > | null,
    categoryCodes: toStringArrayOrNull(
      getField(payload, "category_codes", "categoryCodes", "codigos_categoria"),
    ),
  };
}

function parseApplicability(payload: LegacyPayload): SanitaryApplicability {
  const type = (
    ["sempre", "jurisdicao", "risco", "evento", "perfil_animal"].includes(
      String(
        getField(
          payload,
          "applicability_type",
          "applicabilityType",
          "tipo_aplicabilidade",
        ) || "sempre",
      ),
    )
      ? String(
          getField(
            payload,
            "applicability_type",
            "applicabilityType",
            "tipo_aplicabilidade",
          ),
        )
      : "sempre"
  ) as ApplicabilityType;

  return {
    type: type as ApplicabilityType,
    jurisdiction: extractJurisdictionRule(payload),
    risk: extractRiskRule(payload),
    event: extractEventRule(payload),
    animalProfile: extractAnimalProfileRule(payload),
  };
}

function extractJurisdictionRule(
  payload: LegacyPayload,
): JurisdictionRule | null {
  const uf = toStringArrayOrNull(getField(payload, "jurisdiction_uf", "uf"));
  const municipio = toStringArrayOrNull(
    getField(payload, "jurisdiction_municipio", "municipio"),
  );
  const regiaoSanitaria = toStringArrayOrNull(
    getField(payload, "jurisdiction_regiao_sanitaria", "regiao_sanitaria"),
  );
  const classificacaoSanitaria = toStringArrayOrNull(
    getField(
      payload,
      "jurisdiction_classificacao_sanitaria",
      "classificacao_sanitaria",
    ),
  );

  if (uf || municipio || regiaoSanitaria || classificacaoSanitaria) {
    return { uf, municipio, regiaoSanitaria, classificacaoSanitaria };
  }
  return null;
}

function extractRiskRule(payload: LegacyPayload): RiskRule | null {
  const riskCodes = toStringArrayOrNull(
    getField(payload, "risk_codes", "riskCodes"),
  );
  const outbreakActive = (() => {
    const val = getField(payload, "outbreak_active", "outbreakActive");
    return val !== null && val !== undefined
      ? toBooleanOrDefault(val, false)
      : null;
  })();
  const zoneIds = toStringArrayOrNull(getField(payload, "zone_ids", "zoneIds"));

  if (riskCodes || outbreakActive !== null || zoneIds) {
    return { riskCodes, outbreakActive, zoneIds };
  }
  return null;
}

function extractEventRule(payload: LegacyPayload): EventRule | null {
  const eventCodes = toStringArrayOrNull(
    getField(payload, "event_codes", "eventCodes", "codigos_evento"),
  );
  const requiresOpenEvent = (() => {
    const val = getField(payload, "requires_open_event", "requiresOpenEvent");
    return val !== null && val !== undefined
      ? toBooleanOrDefault(val, false)
      : null;
  })();

  if (eventCodes || requiresOpenEvent !== null) {
    return { eventCodes, requiresOpenEvent };
  }
  return null;
}

function extractAnimalProfileRule(
  payload: LegacyPayload,
): AnimalProfileRule | null {
  const species = (() => {
    const val = getField(payload, "profile_species", "species");
    if (!val) return null;
    const arr = Array.isArray(val) ? val : [val];
    const valid = arr.filter((s) => ["bovino", "bubalino"].includes(String(s)));
    return valid.length > 0
      ? (valid.map(String) as Array<"bovino" | "bubalino">)
      : null;
  })();

  const categoryCodes = toStringArrayOrNull(
    getField(payload, "profile_category_codes", "categoryCodes"),
  );
  const reproductionStatus = toStringArrayOrNull(
    getField(payload, "profile_reproduction_status", "reproductionStatus"),
  );

  if (species || categoryCodes || reproductionStatus) {
    return { species, categoryCodes, reproductionStatus };
  }
  return null;
}

function parseCompliance(payload: LegacyPayload): SanitaryCompliance {
  const levelValue = String(
    getField(
      payload,
      "compliance_level",
      "complianceLevel",
      "nivel_conformidade",
    ) || "recomendado",
  );
  const level = (
    ["obrigatorio", "condicional", "recomendado"].includes(levelValue)
      ? levelValue
      : "recomendado"
  ) as ComplianceLevel;

  return {
    level,
    mandatory: toBooleanOrDefault(
      getField(payload, "mandatory", "obrigatorio"),
      false,
    ),
    requiresVeterinarian: toBooleanOrDefault(
      getField(
        payload,
        "requires_veterinarian",
        "requiresVeterinarian",
        "requer_veterinario",
      ),
      false,
    ),
    requiresDocument: toBooleanOrDefault(
      getField(
        payload,
        "requires_document",
        "requiresDocument",
        "requer_documento",
      ),
      false,
    ),
    requiredDocumentTypes: toStringArrayOrNull(
      getField(payload, "required_document_types", "requiredDocumentTypes"),
    ),
    blocksExecutionWithoutVeterinarian: toBooleanOrDefault(
      getField(
        payload,
        "blocks_execution_without_veterinarian",
        "blocksExecutionWithoutVeterinarian",
      ),
      false,
    ),
    blocksCompletionWithoutDocument: toBooleanOrDefault(
      getField(
        payload,
        "blocks_completion_without_document",
        "blocksCompletionWithoutDocument",
      ),
      false,
    ),
  };
}

function parseExecutionPolicy(payload: LegacyPayload): SanitaryExecutionPolicy {
  return {
    allowsManualExecution: toBooleanOrDefault(
      getField(payload, "allows_manual_execution", "allowsManualExecution"),
      true,
    ),
    createsInstantTaskOnEvent: toBooleanOrDefault(
      getField(
        payload,
        "creates_instant_task_on_event",
        "createsInstantTaskOnEvent",
      ),
      false,
    ),
    expiresWhenWindowEnds: toBooleanOrDefault(
      getField(payload, "expires_when_window_ends", "expiresWhenWindowEnds"),
      false,
    ),
    supportsBatchExecution: toBooleanOrDefault(
      getField(payload, "supports_batch_execution", "supportsBatchExecution"),
      false,
    ),
  };
}

// ============================================================================
// SERIALIZE: DOMAIN → LEGACY
// ============================================================================

export function serializeDomainToLegacyPayload(
  item: SanitaryProtocolItemDomain,
): LegacyPayload {
  return {
    // identity
    family_code: item.identity.familyCode,
    item_code: item.identity.itemCode,
    regimen_version: item.identity.regimenVersion,
    origem: item.identity.layer,
    scope_type: item.identity.scopeType,

    // schedule
    mode: item.schedule.mode,
    anchor: item.schedule.anchor,
    interval_days: item.schedule.intervalDays,
    campaign_months: item.schedule.campaignMonths,
    age_start_days: item.schedule.ageStartDays,
    age_end_days: item.schedule.ageEndDays,
    depends_on_item_code: item.schedule.dependsOnItemCode,
    generates_agenda: item.schedule.generatesAgenda,
    operational_label: item.schedule.operationalLabel,
    notes: item.schedule.notes,
    instructions: item.schedule.instructions,

    // eligibility
    sex_target: item.eligibility.sexTarget,
    age_min_days: item.eligibility.ageMinDays,
    age_max_days: item.eligibility.ageMaxDays,
    species: item.eligibility.species,
    category_codes: item.eligibility.categoryCodes,

    // applicability
    applicability_type: item.applicability.type,
    jurisdiction_uf: item.applicability.jurisdiction?.uf,
    jurisdiction_municipio: item.applicability.jurisdiction?.municipio,
    jurisdiction_regiao_sanitaria:
      item.applicability.jurisdiction?.regiaoSanitaria,
    jurisdiction_classificacao_sanitaria:
      item.applicability.jurisdiction?.classificacaoSanitaria,
    risk_codes: item.applicability.risk?.riskCodes,
    outbreak_active: item.applicability.risk?.outbreakActive,
    zone_ids: item.applicability.risk?.zoneIds,
    event_codes: item.applicability.event?.eventCodes,
    requires_open_event: item.applicability.event?.requiresOpenEvent,
    profile_species: item.applicability.animalProfile?.species,
    profile_category_codes: item.applicability.animalProfile?.categoryCodes,
    profile_reproduction_status:
      item.applicability.animalProfile?.reproductionStatus,

    // compliance
    compliance_level: item.compliance.level,
    mandatory: item.compliance.mandatory,
    requires_veterinarian: item.compliance.requiresVeterinarian,
    requires_document: item.compliance.requiresDocument,
    required_document_types: item.compliance.requiredDocumentTypes,
    blocks_execution_without_veterinarian:
      item.compliance.blocksExecutionWithoutVeterinarian,
    blocks_completion_without_document:
      item.compliance.blocksCompletionWithoutDocument,

    // executionPolicy
    allows_manual_execution: item.executionPolicy.allowsManualExecution,
    creates_instant_task_on_event:
      item.executionPolicy.createsInstantTaskOnEvent,
    expires_when_window_ends: item.executionPolicy.expiresWhenWindowEnds,
    supports_batch_execution: item.executionPolicy.supportsBatchExecution,
  };
}
