import type {
  AgendaItem,
  Animal,
  FazendaSanidadeConfig,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { getAnimalAgeInDays } from "@/lib/sanitario/engine/protocolRules";

export type SanitaryAgendaReasonCode =
  | "missing_farm_config"
  | "protocol_inactive"
  | "item_not_generating_agenda"
  | "animal_ineligible_species"
  | "animal_ineligible_age"
  | "animal_ineligible_sex"
  | "risk_not_enabled"
  | "explicit_activation_missing"
  | "already_completed"
  | "outside_campaign_window"
  | "dependency_not_completed";

export type SanitaryAgendaDiagnostic = {
  code: SanitaryAgendaReasonCode;
  title: string;
  action: string;
  count: number;
  tone: "neutral" | "info" | "warning" | "danger";
};

export type SanitaryOperationalStatusCode =
  | "official_active"
  | "operational_available"
  | "materialized"
  | "active"
  | "generates_agenda"
  | "blocked_by_configuration"
  | "reference_only";

export type SanitaryOperationalStatus = {
  code: SanitaryOperationalStatusCode;
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

const REASON_META: Record<
  SanitaryAgendaReasonCode,
  Omit<SanitaryAgendaDiagnostic, "code" | "count">
> = {
  missing_farm_config: {
    title: "Configuração sanitária ausente",
    action: "Complete UF, modo de calendário e riscos sanitários da fazenda.",
    tone: "warning",
  },
  protocol_inactive: {
    title: "Protocolo inativo",
    action: "Ative o protocolo operacional antes de esperar agenda automática.",
    tone: "warning",
  },
  item_not_generating_agenda: {
    title: "Etapa não gera agenda",
    action: "Marque uma etapa como gera agenda ou use o fluxo de referência.",
    tone: "neutral",
  },
  animal_ineligible_species: {
    title: "Espécie incompatível",
    action: "Revise espécie-alvo do protocolo ou cadastro dos animais.",
    tone: "warning",
  },
  animal_ineligible_age: {
    title: "Animal fora da idade",
    action: "Revise janela etária da etapa ou aguarde a data elegível.",
    tone: "info",
  },
  animal_ineligible_sex: {
    title: "Sexo incompatível",
    action: "Revise sexo-alvo da etapa e cadastro dos animais.",
    tone: "info",
  },
  risk_not_enabled: {
    title: "Risco/pressão não habilitado",
    action: "Ajuste risco de raiva, helmintos ou carrapato na fazenda.",
    tone: "warning",
  },
  explicit_activation_missing: {
    title: "Ativação explícita ausente",
    action: "Ative operacionalmente a família sanitária para gerar agenda.",
    tone: "warning",
  },
  already_completed: {
    title: "Já concluído no período",
    action: "Confira histórico antes de reabrir nova pendência.",
    tone: "success",
  },
  outside_campaign_window: {
    title: "Fora da janela de campanha",
    action: "Replaneje a campanha ou aguarde mês configurado.",
    tone: "info",
  },
  dependency_not_completed: {
    title: "Dependência anterior pendente",
    action: "Conclua a dose/etapa anterior para liberar a próxima.",
    tone: "warning",
  },
};

const STATUS_META: Record<SanitaryOperationalStatusCode, SanitaryOperationalStatus> = {
  official_active: {
    code: "official_active",
    label: "Oficial ativado",
    description: "Origem regulatória do pack oficial da fazenda.",
    tone: "info",
  },
  operational_available: {
    code: "operational_available",
    label: "Operacional disponível",
    description: "Existe protocolo operacional para uso local.",
    tone: "neutral",
  },
  materialized: {
    code: "materialized",
    label: "Materializado",
    description: "Cabeçalho e etapas existem para a fazenda.",
    tone: "success",
  },
  active: {
    code: "active",
    label: "Ativo",
    description: "Pode ser usado em Agenda/Registrar.",
    tone: "success",
  },
  generates_agenda: {
    code: "generates_agenda",
    label: "Gera agenda",
    description: "Possui etapa ativa que entra no recompute sanitário.",
    tone: "success",
  },
  blocked_by_configuration: {
    code: "blocked_by_configuration",
    label: "Bloqueado por configuração",
    description: "Depende de risco, alvo, janela ou ativação explícita.",
    tone: "warning",
  },
  reference_only: {
    code: "reference_only",
    label: "Somente referência",
    description: "Não materializa agenda automática.",
    tone: "neutral",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readBoolean(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
}

function readNumber(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNestedRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return isRecord(value) ? value : null;
}

function readNestedString(
  record: Record<string, unknown> | null | undefined,
  objectKey: string,
  key: string,
) {
  return readString(readNestedRecord(record, objectKey), key);
}

function readArray(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : null;
}

function normalizeToken(value: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") ?? null;
}

function readFamilyCode(item: ProtocoloSanitarioItem) {
  return normalizeToken(
    readString(item.payload, "family_code") ??
      readNestedString(item.payload, "regime_sanitario", "family_code"),
  );
}

function requiresExplicitActivation(item: ProtocoloSanitarioItem) {
  const activation = readNestedRecord(item.payload, "agenda_activation");
  const trigger = readNestedRecord(item.payload, "gatilho_json");
  return (
    readBoolean(activation, "explicit") ??
    readBoolean(activation, "requires_explicit_activation") ??
    readBoolean(trigger, "requires_explicit_activation") ??
    readBoolean(item.payload, "requires_explicit_activation") ??
    readBoolean(item.payload, "explicit_activation") ??
    readBoolean(item.payload, "ativacao_operacional_explicita") ??
    false
  );
}

function hasCampaignWindow(item: ProtocoloSanitarioItem, today: Date) {
  const calendar = readNestedRecord(item.payload, "calendario_base");
  const mode =
    normalizeToken(readString(calendar, "mode")) ??
    normalizeToken(readString(item.payload, "calendar_mode")) ??
    normalizeToken(readString(item.payload, "calendario_mode"));

  if (mode !== "campaign" && mode !== "campanha") return true;

  const months =
    readArray(calendar, "months") ??
    readArray(item.payload, "months") ??
    readArray(readNestedRecord(item.payload, "gatilho_json"), "months");
  if (!months) return false;

  const currentMonth = today.getMonth() + 1;
  return months.some((value) => Number(value) === currentMonth);
}

function hasDependency(item: ProtocoloSanitarioItem) {
  return Boolean(
    readNestedString(item.payload, "depends_on", "milestone_code") ??
      readNestedString(item.payload, "regime_sanitario", "depends_on_milestone") ??
      readString(item.payload, "depends_on_item_code"),
  );
}

function hasCompletedAgendaForItem(
  item: ProtocoloSanitarioItem,
  agendaItems: AgendaItem[],
) {
  return agendaItems.some(
    (agendaItem) =>
      agendaItem.protocol_item_version_id === item.id &&
      agendaItem.status === "concluido" &&
      !agendaItem.deleted_at,
  );
}

function isRiskEnabled(item: ProtocoloSanitarioItem, config: FazendaSanidadeConfig | null) {
  const familyCode = readFamilyCode(item);
  if (!familyCode) return true;

  if (familyCode === "raiva_herbivoros") {
    return (
      config?.zona_raiva_risco === "medio" ||
      config?.zona_raiva_risco === "alto"
    );
  }

  if (
    familyCode === "controle_parasitario" ||
    familyCode === "controle_estrategico_parasitas"
  ) {
    return Boolean(config?.pressao_helmintos);
  }

  if (familyCode === "controle_carrapato") {
    return Boolean(config?.pressao_carrapato);
  }

  return true;
}

function speciesTargets(item: ProtocoloSanitarioItem) {
  const raw =
    readArray(item.payload, "species") ??
    readArray(item.payload, "especies_alvo") ??
    readArray(readNestedRecord(item.payload, "gatilho_json"), "species");
  return raw
    ? new Set(
        raw
          .map((value) => (typeof value === "string" ? normalizeToken(value) : null))
          .filter((value): value is string => Boolean(value)),
      )
    : null;
}

function hasEligibleSpecies(item: ProtocoloSanitarioItem, animals: Animal[]) {
  const targets = speciesTargets(item);
  if (!targets || targets.size === 0) return true;
  return animals.some(
    (animal) =>
      animal.status === "ativo" &&
      (!animal.especie || targets.has(normalizeToken(animal.especie) ?? "")),
  );
}

function hasEligibleSex(item: ProtocoloSanitarioItem, animals: Animal[]) {
  const sexTarget = readString(item.payload, "sexo_alvo");
  if (sexTarget !== "M" && sexTarget !== "F") return true;
  return animals.some(
    (animal) => animal.status === "ativo" && animal.sexo === sexTarget,
  );
}

function hasEligibleAge(item: ProtocoloSanitarioItem, animals: Animal[], today: Date) {
  const calendar = readNestedRecord(item.payload, "calendario_base");
  const minDays =
    readNumber(item.payload, "idade_min_dias") ??
    readNumber(item.payload, "idade_minima_dias") ??
    readNumber(calendar, "age_start_days");
  const maxDays =
    readNumber(item.payload, "idade_max_dias") ??
    readNumber(item.payload, "idade_maxima_dias") ??
    readNumber(calendar, "age_end_days");

  if (minDays === null && maxDays === null) return true;

  return animals.some((animal) => {
    if (animal.status !== "ativo") return false;
    const age = getAnimalAgeInDays(animal.data_nascimento, today);
    if (age === null) return false;
    if (minDays !== null && age < minDays) return false;
    if (maxDays !== null && age > maxDays) return false;
    return true;
  });
}

function addReason(
  counts: Map<SanitaryAgendaReasonCode, number>,
  code: SanitaryAgendaReasonCode,
) {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}

export function describeSanitaryAgendaReason(code: SanitaryAgendaReasonCode) {
  return {
    code,
    count: 1,
    ...REASON_META[code],
  };
}

export function buildSanitaryAgendaDiagnostics(input: {
  config: FazendaSanidadeConfig | null;
  protocols: ProtocoloSanitario[];
  protocolItems: ProtocoloSanitarioItem[];
  animals: Animal[];
  agendaItems: AgendaItem[];
  today?: Date;
}): SanitaryAgendaDiagnostic[] {
  const counts = new Map<SanitaryAgendaReasonCode, number>();
  const today = input.today ?? new Date();
  const activeAnimals = input.animals.filter(
    (animal) => animal.status === "ativo" && !animal.deleted_at,
  );
  const activeProtocolIds = new Set(
    input.protocols
      .filter((protocol) => protocol.ativo && !protocol.deleted_at)
      .map((protocol) => protocol.id),
  );

  if (!input.config) {
    addReason(counts, "missing_farm_config");
  }

  for (const protocol of input.protocols) {
    if (protocol.deleted_at) continue;
    if (!protocol.ativo) {
      addReason(counts, "protocol_inactive");
    }
  }

  for (const item of input.protocolItems) {
    if (item.deleted_at) continue;
    if (!activeProtocolIds.has(item.protocolo_id)) continue;

    if (!item.gera_agenda) {
      addReason(counts, "item_not_generating_agenda");
      continue;
    }

    if (!hasEligibleSpecies(item, activeAnimals)) {
      addReason(counts, "animal_ineligible_species");
    }
    if (!hasEligibleSex(item, activeAnimals)) {
      addReason(counts, "animal_ineligible_sex");
    }
    if (!hasEligibleAge(item, activeAnimals, today)) {
      addReason(counts, "animal_ineligible_age");
    }
    if (!isRiskEnabled(item, input.config)) {
      addReason(counts, "risk_not_enabled");
    }
    if (requiresExplicitActivation(item)) {
      addReason(counts, "explicit_activation_missing");
    }
    if (!hasCampaignWindow(item, today)) {
      addReason(counts, "outside_campaign_window");
    }
    if (hasDependency(item)) {
      addReason(counts, "dependency_not_completed");
    }
    if (hasCompletedAgendaForItem(item, input.agendaItems)) {
      addReason(counts, "already_completed");
    }
  }

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      count,
      ...REASON_META[code],
    }))
    .sort((left, right) => right.count - left.count);
}

export function buildSanitaryOperationalStatuses(input: {
  protocol: ProtocoloSanitario;
  items: ProtocoloSanitarioItem[];
  diagnostics?: SanitaryAgendaDiagnostic[];
}): SanitaryOperationalStatus[] {
  const statusCodes = new Set<SanitaryOperationalStatusCode>();
  const sourceOrigin =
    normalizeToken(readString(input.protocol.payload, "source_origin")) ??
    normalizeToken(readString(input.protocol.payload, "origem"));

  if (sourceOrigin === "official" || sourceOrigin === "pack_oficial") {
    statusCodes.add("official_active");
  }

  statusCodes.add("operational_available");
  statusCodes.add("materialized");

  if (input.protocol.ativo) {
    statusCodes.add("active");
  }

  if (input.items.some((item) => item.gera_agenda && !item.deleted_at)) {
    statusCodes.add("generates_agenda");
  } else {
    statusCodes.add("reference_only");
  }

  if (
    input.diagnostics?.some(
      (diagnostic) =>
        diagnostic.code === "missing_farm_config" ||
        diagnostic.code === "risk_not_enabled" ||
        diagnostic.code === "explicit_activation_missing" ||
        diagnostic.code === "outside_campaign_window" ||
        diagnostic.code === "animal_ineligible_age" ||
        diagnostic.code === "animal_ineligible_sex" ||
        diagnostic.code === "animal_ineligible_species",
    )
  ) {
    statusCodes.add("blocked_by_configuration");
  }

  return Array.from(statusCodes).map((code) => STATUS_META[code]);
}
