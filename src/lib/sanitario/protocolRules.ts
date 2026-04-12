import type {
  AgendaItem,
  Animal,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";

export interface SanitaryProtocolRestrictions {
  sexoAlvo: "M" | "F" | "todos" | null;
  idadeMinDias: number | null;
  idadeMaxDias: number | null;
  obrigatorio: boolean;
  obrigatorioPorRisco: boolean;
  requiresVet: boolean;
  requiresComplianceDocument: boolean;
}

export interface SanitaryProtocolEligibilitySummary {
  eligibleCount: number;
  ineligibleCount: number;
  compatibleWithAll: boolean;
  reasons: string[];
  restrictions: SanitaryProtocolRestrictions;
}

export interface SanitaryAgendaPriority {
  label: string;
  tone: "neutral" | "info" | "warning" | "danger";
  daysDelta: number;
  mandatory: boolean;
}

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const readNumber = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null => {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readBoolean = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): boolean | null => {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
};

const startOfDay = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

export const getAnimalAgeInDays = (
  dataNascimento: string | null | undefined,
  today: Date = new Date(),
): number | null => {
  if (!dataNascimento) return null;

  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const diffMs = startOfDay(today) - startOfDay(nascimento);
  if (diffMs < 0) return null;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const readSanitaryProtocolRestrictions = (
  item: Pick<ProtocoloSanitarioItem, "payload">,
  protocol?: Pick<ProtocoloSanitario, "payload"> | null,
): SanitaryProtocolRestrictions => {
  const itemPayload = item.payload;
  const protocolPayload = protocol?.payload ?? null;
  const sexoAlvo =
    readString(itemPayload, "sexo_alvo") ??
    readString(protocolPayload, "sexo_alvo");

  return {
    sexoAlvo:
      sexoAlvo === "M" || sexoAlvo === "F" || sexoAlvo === "todos"
        ? sexoAlvo
        : null,
    idadeMinDias:
      readNumber(itemPayload, "idade_min_dias") ??
      readNumber(itemPayload, "idade_minima_dias") ??
      readNumber(protocolPayload, "idade_min_dias") ??
      readNumber(protocolPayload, "idade_minima_dias"),
    idadeMaxDias:
      readNumber(itemPayload, "idade_max_dias") ??
      readNumber(itemPayload, "idade_maxima_dias") ??
      readNumber(protocolPayload, "idade_max_dias") ??
      readNumber(protocolPayload, "idade_maxima_dias"),
    obrigatorio:
      readBoolean(itemPayload, "obrigatorio") ??
      readBoolean(protocolPayload, "obrigatorio") ??
      false,
    obrigatorioPorRisco:
      readBoolean(itemPayload, "obrigatorio_por_risco") ??
      readBoolean(protocolPayload, "obrigatorio_por_risco") ??
      false,
    requiresVet:
      readBoolean(itemPayload, "requires_vet") ??
      readBoolean(itemPayload, "requires_vet_supervision") ??
      readBoolean(protocolPayload, "requires_vet") ??
      readBoolean(protocolPayload, "requires_vet_supervision") ??
      false,
    requiresComplianceDocument:
      readBoolean(itemPayload, "requires_compliance_document") ??
      readBoolean(protocolPayload, "requires_compliance_document") ??
      false,
  };
};

export const evaluateSanitaryProtocolEligibility = (
  item: Pick<ProtocoloSanitarioItem, "payload">,
  animals: Array<Pick<Animal, "identificacao" | "sexo" | "data_nascimento">>,
  protocol?: Pick<ProtocoloSanitario, "payload"> | null,
  today: Date = new Date(),
): SanitaryProtocolEligibilitySummary => {
  const restrictions = readSanitaryProtocolRestrictions(item, protocol);
  const reasons: string[] = [];
  let eligibleCount = 0;
  let ineligibleCount = 0;

  for (const animal of animals) {
    const ageInDays = getAnimalAgeInDays(animal.data_nascimento, today);
    const animalIssues: string[] = [];

    if (
      restrictions.sexoAlvo &&
      restrictions.sexoAlvo !== "todos" &&
      animal.sexo !== restrictions.sexoAlvo
    ) {
      animalIssues.push(
        restrictions.sexoAlvo === "F" ? "exclusivo para femeas" : "exclusivo para machos",
      );
    }

    if (restrictions.idadeMinDias !== null || restrictions.idadeMaxDias !== null) {
      if (ageInDays === null) {
        animalIssues.push("idade indisponivel");
      } else {
        if (
          restrictions.idadeMinDias !== null &&
          ageInDays < restrictions.idadeMinDias
        ) {
          animalIssues.push(`idade abaixo de ${restrictions.idadeMinDias}d`);
        }
        if (
          restrictions.idadeMaxDias !== null &&
          ageInDays > restrictions.idadeMaxDias
        ) {
          animalIssues.push(`idade acima de ${restrictions.idadeMaxDias}d`);
        }
      }
    }

    if (animalIssues.length > 0) {
      ineligibleCount += 1;
      reasons.push(`${animal.identificacao}: ${animalIssues.join(", ")}`);
    } else {
      eligibleCount += 1;
    }
  }

  return {
    eligibleCount,
    ineligibleCount,
    compatibleWithAll: ineligibleCount === 0,
    reasons,
    restrictions,
  };
};

export const formatSanitaryProtocolRestrictions = (
  restrictions: SanitaryProtocolRestrictions,
): string | null => {
  const parts: string[] = [];

  if (restrictions.sexoAlvo === "F") {
    parts.push("Somente femeas");
  } else if (restrictions.sexoAlvo === "M") {
    parts.push("Somente machos");
  }

  if (
    restrictions.idadeMinDias !== null ||
    restrictions.idadeMaxDias !== null
  ) {
    const min = restrictions.idadeMinDias ?? 0;
    const max =
      restrictions.idadeMaxDias !== null
        ? `${restrictions.idadeMaxDias}d`
        : "sem limite";
    parts.push(`${min}d a ${max}`);
  }

  if (restrictions.obrigatorio) {
    parts.push("Obrigatorio");
  } else if (restrictions.obrigatorioPorRisco) {
    parts.push("Obrigatorio por risco");
  }

  if (restrictions.requiresVet) {
    parts.push("Exige veterinario");
  }

  return parts.length > 0 ? parts.join(" | ") : null;
};

export const getSanitaryAgendaPriority = (input: {
  item: Pick<AgendaItem, "data_prevista">;
  protocol?: Pick<ProtocoloSanitario, "payload"> | null;
  protocolItem?: Pick<ProtocoloSanitarioItem, "payload"> | null;
  today?: Date;
}): SanitaryAgendaPriority => {
  const today = input.today ?? new Date();
  const dueDate = new Date(`${input.item.data_prevista}T00:00:00`);
  const daysDelta = Number.isNaN(dueDate.getTime())
    ? 0
    : Math.floor((startOfDay(dueDate) - startOfDay(today)) / (1000 * 60 * 60 * 24));

  const restrictions = input.protocolItem
    ? readSanitaryProtocolRestrictions(input.protocolItem, input.protocol ?? null)
    : {
        sexoAlvo: null,
        idadeMinDias: null,
        idadeMaxDias: null,
        obrigatorio:
          readBoolean(input.protocol?.payload ?? null, "obrigatorio") ?? false,
        obrigatorioPorRisco:
          readBoolean(input.protocol?.payload ?? null, "obrigatorio_por_risco") ?? false,
        requiresVet:
          readBoolean(input.protocol?.payload ?? null, "requires_vet") ?? false,
        requiresComplianceDocument:
          readBoolean(input.protocol?.payload ?? null, "requires_compliance_document") ??
          false,
      };

  const mandatory =
    restrictions.obrigatorio ||
    restrictions.obrigatorioPorRisco ||
    restrictions.requiresComplianceDocument;

  if (daysDelta < 0) {
    const atraso = Math.abs(daysDelta);
    if (mandatory || atraso >= 7) {
      return {
        label: `Critico ${atraso}d`,
        tone: "danger",
        daysDelta,
        mandatory,
      };
    }

    return {
      label: `Atrasado ${atraso}d`,
      tone: "danger",
      daysDelta,
      mandatory,
    };
  }

  if (daysDelta === 0) {
    return {
      label: mandatory ? "Obrigatorio hoje" : "Hoje",
      tone: mandatory ? "danger" : "warning",
      daysDelta,
      mandatory,
    };
  }

  if (daysDelta <= 3) {
    return {
      label: mandatory ? `Obrigatorio em ${daysDelta}d` : `Proximo ${daysDelta}d`,
      tone: mandatory ? "warning" : "info",
      daysDelta,
      mandatory,
    };
  }

  if (mandatory) {
    return {
      label: "Obrigatorio",
      tone: "info",
      daysDelta,
      mandatory,
    };
  }

  return {
    label: "Rotina",
    tone: "neutral",
    daysDelta,
    mandatory,
  };
};
