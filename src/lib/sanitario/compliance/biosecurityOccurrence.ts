import type { EventInput } from "@/lib/events/types";

export type BiosecurityOccurrenceCategory =
  | "biosseguranca"
  | "suspeita_doenca_notificavel";

export type BiosecurityOccurrenceKind =
  | "acidente_perfurocortante"
  | "contato_sangue_secrecao_aborto_carcaca"
  | "animal_suspeito_sem_isolamento"
  | "falha_epi"
  | "descarte_inadequado"
  | "falha_limpeza_desinfeccao"
  | "visitante_sem_orientacao"
  | "transporte_com_risco_sanitario"
  | "outro";

export type BiosecurityOccurrenceType =
  | BiosecurityOccurrenceCategory
  | BiosecurityOccurrenceKind;

export type BiosecurityOccurrenceScope =
  | "animal"
  | "animais"
  | "lote"
  | "local"
  | "evento"
  | "fazenda";

export type BiosecurityOccurrenceSeverity = "leve" | "moderada" | "alta";

export type BiosecurityOccurrenceStatus = "aberta" | "resolvida" | "cancelada";

export type BiosecurityContextAvailability = {
  hasAnimal: boolean;
  hasMultipleAnimals: boolean;
  hasLote: boolean;
  hasLocal: boolean;
  hasManejo: boolean;
  hasFazenda?: boolean;
};

export type BiosecurityLinkScopeOption = {
  scope: BiosecurityOccurrenceScope;
  label: string;
};

export type BiosecurityLinkScopeInput = {
  selectedOccurrenceTypes: BiosecurityOccurrenceKind[];
  category?: BiosecurityOccurrenceCategory;
  contextAvailability: BiosecurityContextAvailability;
};

export type BiosecurityOccurrenceDraft = {
  tipo_ocorrencia: BiosecurityOccurrenceType;
  tipos_ocorrencia?: BiosecurityOccurrenceKind[] | null;
  categoria_ocorrencia?: BiosecurityOccurrenceCategory;
  escopo_tipo: BiosecurityOccurrenceScope;
  escopos_tipo?: BiosecurityOccurrenceScope[] | null;
  animal_id?: string | null;
  animal_ids?: string[] | null;
  lote_id?: string | null;
  local_id?: string | null;
  evento_id?: string | null;
  agenda_item_id?: string | null;
  gravidade: BiosecurityOccurrenceSeverity;
  descricao?: string | null;
  outro_relato?: string | null;
  acao_imediata: string;
  gera_pendencia: boolean;
  prazo_correcao?: string | null;
  status: BiosecurityOccurrenceStatus;
};

export type BiosecurityOccurrenceBuildInput = {
  fazendaId: string;
  occurredAt: string;
  occurrence: BiosecurityOccurrenceDraft;
};

const BIOSECURITY_LINK_SCOPE_LABELS: Record<
  BiosecurityOccurrenceScope,
  string
> = {
  animal: "Animal",
  animais: "Vários animais",
  lote: "Lote",
  local: "Local",
  evento: "Evento/manejo",
  fazenda: "Fazenda",
};

const ALL_BIOSECURITY_SCOPES: BiosecurityOccurrenceScope[] = [
  "animal",
  "animais",
  "lote",
  "local",
  "evento",
  "fazenda",
];

const CLINICAL_LINK_SCOPES: BiosecurityOccurrenceScope[] = [
  "animal",
  "animais",
  "lote",
];

const LINK_SCOPES_BY_OCCURRENCE_KIND: Record<
  BiosecurityOccurrenceKind,
  BiosecurityOccurrenceScope[]
> = {
  acidente_perfurocortante: ["evento", "animal", "animais", "fazenda"],
  contato_sangue_secrecao_aborto_carcaca: [
    "animal",
    "animais",
    "lote",
    "evento",
    "local",
  ],
  animal_suspeito_sem_isolamento: ["animal", "animais", "lote"],
  falha_epi: ["evento", "fazenda", "local"],
  descarte_inadequado: ["local", "fazenda", "evento"],
  falha_limpeza_desinfeccao: ["local", "fazenda", "evento"],
  visitante_sem_orientacao: ["fazenda", "local", "evento"],
  transporte_com_risco_sanitario: ["lote", "animais", "evento"],
  outro: ALL_BIOSECURITY_SCOPES,
};

export function getAvailableBiosecurityLinkScopes({
  selectedOccurrenceTypes,
  category = "biosseguranca",
  contextAvailability,
}: BiosecurityLinkScopeInput): BiosecurityLinkScopeOption[] {
  const selectedKinds =
    selectedOccurrenceTypes.length > 0 ? selectedOccurrenceTypes : ["outro"];
  const allowedScopes = new Set<BiosecurityOccurrenceScope>();

  for (const kind of selectedKinds) {
    for (const scope of LINK_SCOPES_BY_OCCURRENCE_KIND[kind]) {
      allowedScopes.add(scope);
    }
  }

  if (contextAvailability.hasAnimal) allowedScopes.add("animal");
  if (contextAvailability.hasMultipleAnimals) allowedScopes.add("animais");
  if (contextAvailability.hasLote) allowedScopes.add("lote");

  if (category === "suspeita_doenca_notificavel") {
    for (const scope of CLINICAL_LINK_SCOPES) {
      allowedScopes.add(scope);
    }
  }

  return ALL_BIOSECURITY_SCOPES
    .filter((scope) => allowedScopes.has(scope))
    .filter((scope) => isBiosecurityScopeAvailable(scope, contextAvailability))
    .map((scope) => ({
      scope,
      label: BIOSECURITY_LINK_SCOPE_LABELS[scope],
    }));
}

export function requiresClinicalBiosecurityLink(
  occurrence: Pick<
    BiosecurityOccurrenceDraft,
    "categoria_ocorrencia" | "tipo_ocorrencia"
  >,
) {
  return (
    occurrence.categoria_ocorrencia === "suspeita_doenca_notificavel" ||
    occurrence.tipo_ocorrencia === "suspeita_doenca_notificavel"
  );
}

export function validateBiosecurityOccurrenceDraft(
  occurrence: BiosecurityOccurrenceDraft,
): string | null {
  const kinds = normalizeBiosecurityOccurrenceKinds(occurrence);
  const category = resolveBiosecurityOccurrenceCategory(occurrence);
  const animalIds = normalizeAnimalIds(occurrence);
  const scopes = normalizeBiosecurityOccurrenceScopes(occurrence);

  if (category === "biosseguranca" && kinds.length === 0) {
    return "Informe o que aconteceu.";
  }

  if (kinds.includes("outro") && !readOutroRelato(occurrence)) {
    return "Relate o que aconteceu quando selecionar outro.";
  }

  if (scopes.length === 0) {
    return "Informe o vínculo da ocorrência.";
  }

  if (
    category === "suspeita_doenca_notificavel" &&
    !scopes.some((scope) => CLINICAL_LINK_SCOPES.includes(scope))
  ) {
    return "Suspeita notificável exige vínculo com animal ou lote.";
  }

  if (
    category === "suspeita_doenca_notificavel" &&
    animalIds.length === 0 &&
    !occurrence.lote_id
  ) {
    return "Suspeita notificável exige vínculo com animal ou lote.";
  }

  if (scopes.includes("animal") && !occurrence.animal_id) {
    return "Selecione o animal vinculado.";
  }

  if (scopes.includes("animais") && animalIds.length === 0) {
    return "Selecione ao menos um animal vinculado.";
  }

  if (scopes.includes("lote") && !occurrence.lote_id) {
    return "Selecione o lote vinculado.";
  }

  if (scopes.includes("local") && !occurrence.local_id) {
    return "Selecione o local vinculado.";
  }

  if (scopes.includes("evento") && !occurrence.evento_id && !occurrence.agenda_item_id) {
    return "Informe o evento ou manejo vinculado.";
  }

  if (!occurrence.acao_imediata.trim()) {
    return "Informe a ação imediata.";
  }

  if (occurrence.gera_pendencia && !occurrence.prazo_correcao) {
    return "Informe o prazo quando houver pendência.";
  }

  return null;
}

export function buildBiosecurityOccurrenceEventInput({
  fazendaId,
  occurredAt,
  occurrence,
}: BiosecurityOccurrenceBuildInput): EventInput {
  const validationIssue = validateBiosecurityOccurrenceDraft(occurrence);
  if (validationIssue) {
    throw new Error(validationIssue);
  }

  const kinds = normalizeBiosecurityOccurrenceKinds(occurrence);
  const category = resolveBiosecurityOccurrenceCategory(occurrence);
  const scopes = normalizeBiosecurityOccurrenceScopes(occurrence);
  const animalIds = normalizeAnimalIds(occurrence);
  const primaryAnimalId = occurrence.animal_id ?? animalIds[0] ?? null;
  const payload = {
    biosseguranca_ocorrencia: {
      schema_version: 1,
      ...occurrence,
      categoria_ocorrencia: category,
      tipo_ocorrencia: occurrence.tipo_ocorrencia,
      tipos_ocorrencia: kinds,
      escopo_tipo: scopes[0] ?? occurrence.escopo_tipo,
      escopos_tipo: scopes,
      animal_id: primaryAnimalId,
      animal_ids: animalIds.length > 0 ? animalIds : null,
      descricao: occurrence.descricao?.trim() || null,
      outro_relato: occurrence.outro_relato?.trim() || null,
      acao_imediata: occurrence.acao_imediata.trim(),
      prazo_correcao: occurrence.gera_pendencia
        ? occurrence.prazo_correcao ?? null
        : null,
    },
  };

  if (category === "suspeita_doenca_notificavel") {
    const movementBlocked = occurrence.gravidade === "alta";

    return {
      dominio: "alerta_sanitario",
      fazendaId,
      occurredAt,
      animalId: primaryAnimalId,
      loteId: occurrence.lote_id ?? null,
      sourceTaskId: occurrence.agenda_item_id ?? null,
      alertKind: "suspeita_aberta",
      observacoes:
        occurrence.descricao?.trim() ||
        "Suspeita de doença notificável registrada.",
      payload: {
        ...payload,
        kind: "suspeita_aberta",
        disease_name: "Suspeita de doença notificável",
        notification_type: "imediata",
        movement_blocked: movementBlocked,
      },
      animalPayload: primaryAnimalId
        ? {
            sanidade_alerta: {
              status: "suspeita_aberta",
              movement_blocked: movementBlocked,
              disease_name: "Suspeita de doença notificável",
              notification_type: "imediata",
            },
          }
        : {},
      sanitarioCaso: primaryAnimalId
        ? {
            action: "open",
            tipo: "notificavel",
            status: "aberto",
            diseaseName: "Suspeita de doença notificável",
            notificationType: "imediata",
            requiresImmediateNotification: true,
            movementBlocked,
            observacoes: occurrence.descricao?.trim() || null,
            payload: payload.biosseguranca_ocorrencia,
          }
        : undefined,
    };
  }

  return {
    dominio: "conformidade",
    fazendaId,
    occurredAt,
    animalId: primaryAnimalId,
    loteId: occurrence.lote_id ?? null,
    sourceTaskId: occurrence.agenda_item_id ?? null,
    complianceKind: "checklist",
    observacoes:
      occurrence.descricao?.trim() ||
      "Ocorrência de biossegurança registrada.",
    payload,
  };
}

function resolveBiosecurityOccurrenceCategory(
  occurrence: BiosecurityOccurrenceDraft,
): BiosecurityOccurrenceCategory {
  if (occurrence.categoria_ocorrencia) return occurrence.categoria_ocorrencia;
  return occurrence.tipo_ocorrencia === "suspeita_doenca_notificavel"
    ? "suspeita_doenca_notificavel"
    : "biosseguranca";
}

function normalizeBiosecurityOccurrenceKinds(
  occurrence: BiosecurityOccurrenceDraft,
): BiosecurityOccurrenceKind[] {
  const kinds = occurrence.tipos_ocorrencia ?? [];
  if (kinds.length > 0) return Array.from(new Set(kinds));
  if (
    occurrence.tipo_ocorrencia !== "biosseguranca" &&
    occurrence.tipo_ocorrencia !== "suspeita_doenca_notificavel"
  ) {
    return [occurrence.tipo_ocorrencia];
  }
  return [];
}

function normalizeAnimalIds(occurrence: BiosecurityOccurrenceDraft): string[] {
  return Array.from(
    new Set(
      [occurrence.animal_id, ...(occurrence.animal_ids ?? [])].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

function normalizeBiosecurityOccurrenceScopes(
  occurrence: BiosecurityOccurrenceDraft,
): BiosecurityOccurrenceScope[] {
  const scopes = occurrence.escopos_tipo ?? [];
  if (scopes.length > 0) return Array.from(new Set(scopes));
  return occurrence.escopo_tipo ? [occurrence.escopo_tipo] : [];
}

function readOutroRelato(occurrence: BiosecurityOccurrenceDraft) {
  return (
    occurrence.outro_relato?.trim() || occurrence.descricao?.trim() || null
  );
}

function isBiosecurityScopeAvailable(
  scope: BiosecurityOccurrenceScope,
  context: BiosecurityContextAvailability,
) {
  if (scope === "animal") return context.hasAnimal;
  if (scope === "animais") return context.hasMultipleAnimals;
  if (scope === "lote") return context.hasLote;
  if (scope === "local") return context.hasLocal;
  if (scope === "evento") return context.hasManejo;
  return context.hasFazenda ?? true;
}
