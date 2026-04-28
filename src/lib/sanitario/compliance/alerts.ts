import type { Animal } from "@/lib/offline/types";

export type SanitaryAlertStatus = "suspeita_aberta" | "encerrada";
export type SanitaryAlertClosureReason =
  | "descartada"
  | "notificada_em_acompanhamento"
  | "encerrada_clinicamente"
  | "outro";

export interface AnimalSanitaryAlertState {
  status: SanitaryAlertStatus;
  diseaseCode: string | null;
  diseaseName: string | null;
  notificationType: string | null;
  requiresImmediateNotification: boolean;
  movementBlocked: boolean;
  openedAt: string | null;
  closedAt: string | null;
  notes: string | null;
  routeLabel: string | null;
  immediateActions: string[];
  alertSignals: string[];
  closureReason: SanitaryAlertClosureReason | null;
  closureNotes: string | null;
}

interface OpenSanitaryAlertInput {
  diseaseCode?: string | null;
  diseaseName?: string | null;
  notificationType?: string | null;
  occurredAt: string;
  notes?: string | null;
  routeLabel?: string | null;
  immediateActions?: string[];
  alertSignals?: string[];
}

interface CloseSanitaryAlertInput {
  occurredAt: string;
  closureReason: SanitaryAlertClosureReason;
  closureNotes?: string | null;
}

const readRecord = (
  value: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null => {
  const entry = value?.[key];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  return entry as Record<string, unknown>;
};

const readString = (
  value: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const entry = value?.[key];
  return typeof entry === "string" && entry.trim().length > 0
    ? entry.trim()
    : null;
};

const readBoolean = (
  value: Record<string, unknown> | null | undefined,
  key: string,
): boolean => value?.[key] === true;

export const readStringArray = (
  value: Record<string, unknown> | null | undefined,
  key: string,
): string[] => {
  const entry = value?.[key];
  if (!Array.isArray(entry)) return [];
  return entry
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const readAnimalSanitaryAlert = (
  payload: Record<string, unknown> | null | undefined,
): AnimalSanitaryAlertState | null => {
  const alert = readRecord(payload, "sanidade_alerta");
  if (!alert) return null;

  const status = readString(alert, "status");
  if (status !== "suspeita_aberta" && status !== "encerrada") {
    return null;
  }

  const closureReason = readString(alert, "closure_reason");

  return {
    status,
    diseaseCode: readString(alert, "disease_code"),
    diseaseName: readString(alert, "disease_name"),
    notificationType: readString(alert, "notification_type"),
    requiresImmediateNotification: readBoolean(
      alert,
      "requires_immediate_notification",
    ),
    movementBlocked: readBoolean(alert, "movement_blocked"),
    openedAt: readString(alert, "opened_at"),
    closedAt: readString(alert, "closed_at"),
    notes: readString(alert, "notes"),
    routeLabel: readString(alert, "route_label"),
    immediateActions: readStringArray(alert, "immediate_actions"),
    alertSignals: readStringArray(alert, "alert_signals"),
    closureReason:
      closureReason === "descartada" ||
      closureReason === "notificada_em_acompanhamento" ||
      closureReason === "encerrada_clinicamente" ||
      closureReason === "outro"
        ? closureReason
        : null,
    closureNotes: readString(alert, "closure_notes"),
  };
};

export const hasOpenSanitaryAlert = (
  payload: Record<string, unknown> | null | undefined,
): boolean => {
  const alert = readAnimalSanitaryAlert(payload);
  return Boolean(
    alert &&
      alert.status === "suspeita_aberta" &&
      alert.movementBlocked,
  );
};

export const getAnimalSanitaryAlertBlockReason = (
  animal: Pick<Animal, "identificacao" | "payload">,
): string | null => {
  const alert = readAnimalSanitaryAlert(animal.payload);
  if (!alert || alert.status !== "suspeita_aberta" || !alert.movementBlocked) {
    return null;
  }

  const diseaseLabel = alert.diseaseName ?? "suspeita sanitaria";
  return `${animal.identificacao} esta com ${diseaseLabel.toLowerCase()} aberta e bloqueio local de movimentacao.`;
};

export const listAnimalsBlockedBySanitaryAlert = <
  TAnimal extends Pick<Animal, "id" | "identificacao" | "payload">,
>(
  animals: TAnimal[],
): Array<{ animal: TAnimal; alert: AnimalSanitaryAlertState }> =>
  animals.flatMap((animal) => {
    const alert = readAnimalSanitaryAlert(animal.payload);
    if (!alert || alert.status !== "suspeita_aberta" || !alert.movementBlocked) {
      return [];
    }
    return [{ animal, alert }];
  });

export const buildOpenSanitaryAlertPayload = (
  currentPayload: Record<string, unknown> | null | undefined,
  input: OpenSanitaryAlertInput,
): Record<string, unknown> => ({
  ...(currentPayload ?? {}),
  sanidade_alerta: {
    status: "suspeita_aberta",
    disease_code: input.diseaseCode ?? null,
    disease_name: input.diseaseName ?? null,
    notification_type: input.notificationType ?? null,
    requires_immediate_notification: true,
    movement_blocked: true,
    opened_at: input.occurredAt,
    closed_at: null,
    notes: input.notes?.trim() || null,
    route_label: input.routeLabel?.trim() || null,
    immediate_actions: input.immediateActions ?? [],
    alert_signals: input.alertSignals ?? [],
    closure_reason: null,
    closure_notes: null,
  },
});

export const buildClosedSanitaryAlertPayload = (
  currentPayload: Record<string, unknown> | null | undefined,
  input: CloseSanitaryAlertInput,
): Record<string, unknown> => {
  const currentAlert = readAnimalSanitaryAlert(currentPayload);

  return {
    ...(currentPayload ?? {}),
    sanidade_alerta: {
      status: "encerrada",
      disease_code: currentAlert?.diseaseCode ?? null,
      disease_name: currentAlert?.diseaseName ?? null,
      notification_type: currentAlert?.notificationType ?? null,
      requires_immediate_notification:
        currentAlert?.requiresImmediateNotification ?? true,
      movement_blocked: false,
      opened_at: currentAlert?.openedAt ?? null,
      closed_at: input.occurredAt,
      notes: currentAlert?.notes ?? null,
      route_label: currentAlert?.routeLabel ?? null,
      immediate_actions: currentAlert?.immediateActions ?? [],
      alert_signals: currentAlert?.alertSignals ?? [],
      closure_reason: input.closureReason,
      closure_notes: input.closureNotes?.trim() || null,
    },
  };
};

export const buildSanitaryAlertEventPayload = ({
  alertKind,
  diseaseCode,
  diseaseName,
  notificationType,
  routeLabel,
  notes,
  immediateActions = [],
  alertSignals = [],
  closureReason,
  closureNotes,
}: {
  alertKind: "suspeita_aberta" | "suspeita_encerrada";
  diseaseCode?: string | null;
  diseaseName?: string | null;
  notificationType?: string | null;
  routeLabel?: string | null;
  notes?: string | null;
  immediateActions?: string[];
  alertSignals?: string[];
  closureReason?: SanitaryAlertClosureReason | null;
  closureNotes?: string | null;
}): Record<string, unknown> => ({
  kind: alertKind,
  disease_code: diseaseCode ?? null,
  disease_name: diseaseName ?? null,
  notification_type: notificationType ?? null,
  route_label: routeLabel?.trim() || null,
  notes: notes?.trim() || null,
  immediate_actions: immediateActions,
  alert_signals: alertSignals,
  movement_blocked: alertKind === "suspeita_aberta",
  requires_immediate_notification: true,
  closure_reason: closureReason ?? null,
  closure_notes: closureNotes?.trim() || null,
});

export const describeSanitaryAlertEvent = (
  payload: Record<string, unknown> | null | undefined,
): string => {
  const kind = readString(payload, "kind");
  const diseaseName = readString(payload, "disease_name");
  const closureReason = readString(payload, "closure_reason");

  if (kind === "suspeita_aberta") {
    return diseaseName
      ? `Suspeita aberta: ${diseaseName}`
      : "Suspeita sanitaria aberta";
  }

  if (kind === "suspeita_encerrada") {
    if (closureReason) {
      return `Suspeita encerrada: ${closureReason.replaceAll("_", " ")}`;
    }
    return "Suspeita sanitaria encerrada";
  }

  return diseaseName
    ? `Alerta sanitario: ${diseaseName}`
    : "Alerta sanitario";
};
