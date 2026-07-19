import type { SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import type { SanitaryExecutedHistoryEventV2 } from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import {
  buildSanitaryProtocolWindowV2,
  type SanitaryProtocolWindowRowV2,
  type SanitaryProtocolWindowSourceV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

export type SanitaryComplianceStatusV2 =
  | "compliant"
  | "planned"
  | "due_soon"
  | "due_now"
  | "overdue"
  | "insufficient_data"
  | "document_pending"
  | "blocked"
  | "not_applicable";

export type SanitaryComplianceEvidenceOriginV2 =
  | "executed_event"
  | "external_documented"
  | "declaration"
  | "future_agenda"
  | "documentary_pendency"
  | "protocol_evaluation"
  | "technical_block"
  | "not_applicable";

export type SanitaryComplianceActiveWithdrawalV2 = {
  animalId: string;
  productId?: string | null;
  productLabel?: string | null;
  meatUntil?: string | null;
  milkUntil?: string | null;
};

export type SanitaryComplianceRowV2 = {
  key: string;
  animalId: string;
  animalLabel: string;
  animalHref: string;
  lotId: string | null;
  lotLabel: string;
  lotHref: string | null;
  protocolId: string;
  protocolLabel: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  status: SanitaryComplianceStatusV2;
  evidenceLabel: string;
  evidenceOrigin: SanitaryComplianceEvidenceOriginV2;
  evidenceOriginLabel: string;
  evidenceDate: string | null;
  agendaId: string | null;
  agendaDate: string | null;
  eventId: string | null;
  documentPendency: string | null;
  productId: string | null;
  productLabel: string | null;
  activeWithdrawal: SanitaryComplianceActiveWithdrawalV2 | null;
};

export type SanitaryComplianceStatusSummaryV2 = Record<
  SanitaryComplianceStatusV2,
  number
>;

export type SanitaryComplianceGroupSummaryV2 = {
  id: string;
  label: string;
  rowCount: number;
  statuses: SanitaryComplianceStatusSummaryV2;
};

export type SanitaryComplianceReadModelV2 = {
  evaluatedAt: string;
  rows: SanitaryComplianceRowV2[];
  statuses: SanitaryComplianceStatusSummaryV2;
  byAnimal: SanitaryComplianceGroupSummaryV2[];
  byLot: SanitaryComplianceGroupSummaryV2[];
  byProtocol: SanitaryComplianceGroupSummaryV2[];
  byItem: SanitaryComplianceGroupSummaryV2[];
  createsAgenda: false;
  createsEvent: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
  allowsOperationalRelease: false;
};

export const SANITARY_COMPLIANCE_STATUS_LABELS_V2: Record<
  SanitaryComplianceStatusV2,
  string
> = {
  compliant: "Conforme",
  planned: "Planejado",
  due_soon: "Próximo da janela",
  due_now: "Devido agora",
  overdue: "Atrasado",
  insufficient_data: "Dados insuficientes",
  document_pending: "Pendência documental",
  blocked: "Bloqueado",
  not_applicable: "Não aplicável",
};

const ALL_STATUSES = Object.keys(
  SANITARY_COMPLIANCE_STATUS_LABELS_V2,
) as SanitaryComplianceStatusV2[];

function emptyStatusSummary(): SanitaryComplianceStatusSummaryV2 {
  return Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as
    SanitaryComplianceStatusSummaryV2;
}

function readString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function agendaItemKey(agenda: SanitarioAgendaLocalV2) {
  return (
    readString(agenda.metadata, "itemKey", "logicalItemKey") ??
    readString(
      agenda.protocol_item_snapshot,
      "itemKey",
      "logicalItemKey",
      "logical_item_key",
    )
  );
}

function isCompatibleHistory(
  event: SanitaryExecutedHistoryEventV2,
  row: SanitaryProtocolWindowRowV2,
  evaluatedAt: string,
) {
  if (event.executedAt.slice(0, 10) > evaluatedAt) return false;
  if (event.itemKey && event.itemKey !== row.itemKey) return false;
  if (event.protocolId && event.protocolId !== row.protocolId) return false;
  return Boolean(event.itemKey || event.protocolId);
}

function isDocumentedHistory(event: SanitaryExecutedHistoryEventV2) {
  const hasLinkedEvidence = Boolean(event.evidenceReference?.trim());
  return (
    (event.source === "external_documented" &&
      event.evidenceClass === "documented" &&
      hasLinkedEvidence) ||
    (event.source === "legacy_import" &&
      event.evidenceClass === "documented" &&
      hasLinkedEvidence)
  );
}

function isDeclaredHistory(event: SanitaryExecutedHistoryEventV2) {
  return (
    event.source === "external_declared" ||
    event.evidenceClass === "declared" ||
    (event.source === "legacy_import" && event.evidenceClass !== "documented")
  );
}

function isLocalExecution(event: SanitaryExecutedHistoryEventV2) {
  return event.source === "event" || event.source === "internal_execution";
}

function buildAgendaIndex(
  source: SanitaryProtocolWindowSourceV2,
  evaluatedAt: string,
) {
  const animalsByAgenda = new Map<string, string[]>();
  for (const entry of source.agendaAnimals) {
    if (entry.planned_status !== "planejado" || entry.execution_evento_id) continue;
    animalsByAgenda.set(entry.agenda_id, [
      ...(animalsByAgenda.get(entry.agenda_id) ?? []),
      entry.animal_id,
    ]);
  }

  const index = new Map<string, SanitarioAgendaLocalV2>();
  for (const agenda of source.agendas) {
    if (
      agenda.deleted_at ||
      agenda.status !== "programada" ||
      agenda.execution_evento_id ||
      agenda.data_programada < evaluatedAt ||
      !agenda.protocolo_id
    ) {
      continue;
    }
    const itemKey = agendaItemKey(agenda);
    if (!itemKey) continue;

    // Lote é contexto de agrupamento; somente vínculos individuais explícitos
    // comprovam quais animais estão planejados.
    for (const animalId of new Set(animalsByAgenda.get(agenda.id) ?? [])) {
      const key = `${animalId}|${agenda.protocolo_id}|${itemKey}`;
      const current = index.get(key);
      if (!current || agenda.data_programada < current.data_programada) {
        index.set(key, agenda);
      }
    }
  }
  return index;
}

function resolveProductFromAgenda(agenda: SanitarioAgendaLocalV2 | undefined) {
  if (!agenda) return { id: null, label: null };
  return {
    id:
      agenda.produto_veterinario_id ??
      readString(agenda.produto_snapshot, "productId", "plannedProductId"),
    label: readString(
      agenda.produto_snapshot,
      "productName",
      "nomeComercial",
      "nome_comercial",
    ),
  };
}

function statusFromPrecheck(row: SanitaryProtocolWindowRowV2) {
  if (row.status === "overdue") return "overdue" as const;
  if (row.status === "in_action_window") return "due_now" as const;
  if (
    row.status === "near_deadline" ||
    row.status === "eligible_soon" ||
    row.status === "not_yet_eligible"
  ) {
    return "due_soon" as const;
  }
  return "insufficient_data" as const;
}

function aggregate(
  rows: SanitaryComplianceRowV2[],
  resolve: (row: SanitaryComplianceRowV2) => { id: string; label: string } | null,
) {
  const groups = new Map<string, SanitaryComplianceGroupSummaryV2>();
  for (const row of rows) {
    const identity = resolve(row);
    if (!identity) continue;
    const group = groups.get(identity.id) ?? {
      ...identity,
      rowCount: 0,
      statuses: emptyStatusSummary(),
    };
    group.rowCount += 1;
    group.statuses[row.status] += 1;
    groups.set(identity.id, group);
  }
  return Array.from(groups.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "pt-BR"),
  );
}

export function buildSanitaryComplianceV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  evaluatedAt: string;
  activeWithdrawals?: SanitaryComplianceActiveWithdrawalV2[];
}): SanitaryComplianceReadModelV2 {
  const histories = new Map(
    input.source.executedHistory.map((entry) => [entry.animalId, entry.events]),
  );
  const agendas = buildAgendaIndex(input.source, input.evaluatedAt);
  const activeWithdrawals = new Map(
    (input.activeWithdrawals ?? []).map((entry) => [entry.animalId, entry]),
  );
  const rows: SanitaryComplianceRowV2[] = [];

  for (const item of input.source.catalog.items) {
    const protocol = input.source.catalog.protocols.find(
      (entry) => entry.id === item.protocolId,
    );
    if (!protocol) continue;
    const window = buildSanitaryProtocolWindowV2({
      source: input.source,
      protocolId: protocol.id,
      itemId: item.id,
      evaluatedAt: input.evaluatedAt,
      filters: { animalStatus: "ativo" },
    });
    if (!window) continue;

    for (const row of window.rows) {
      const history = (histories.get(row.animalId) ?? [])
        .filter((event) => isCompatibleHistory(event, row, input.evaluatedAt))
        .sort((left, right) => right.executedAt.localeCompare(left.executedAt));
      const localEvent = history.find(isLocalExecution);
      const documentedEvent = history.find(isDocumentedHistory);
      const declaredEvent = history.find(isDeclaredHistory);
      const agenda = agendas.get(`${row.animalId}|${row.protocolId}|${row.itemKey}`);
      const blocked =
        row.blockers.length > 0 ||
        protocol.status === "retired" ||
        protocol.legalStatus === "bloqueado" ||
        item.itemStatus === "bloqueado" ||
        item.status === "retired" ||
        item.status === "blocked";

      let status: SanitaryComplianceStatusV2;
      let evidenceLabel: string;
      let evidenceOrigin: SanitaryComplianceEvidenceOriginV2;
      let evidenceOriginLabel: string;
      let evidenceDate: string | null = null;
      let eventId: string | null = null;

      if (blocked) {
        status = "blocked";
        evidenceLabel = row.blockers[0] ?? "Item bloqueado pela regra sanitária.";
        evidenceOrigin = "technical_block";
        evidenceOriginLabel = "Bloqueio técnico do catálogo";
      } else if (row.status === "not_applicable") {
        status = "not_applicable";
        evidenceLabel = row.reason;
        evidenceOrigin = "not_applicable";
        evidenceOriginLabel = "Avaliação de aplicabilidade";
      } else if (localEvent) {
        status = "compliant";
        evidenceLabel = "Execução sanitária compatível registrada.";
        evidenceOrigin = "executed_event";
        evidenceOriginLabel = "Evento sanitário executado";
        evidenceDate = localEvent.executedAt;
        eventId = localEvent.eventId;
      } else if (documentedEvent) {
        status = "compliant";
        evidenceLabel = "Histórico externo documentado compatível.";
        evidenceOrigin = "external_documented";
        evidenceOriginLabel = "Histórico externo documentado";
        evidenceDate = documentedEvent.executedAt;
        eventId = documentedEvent.eventId;
      } else if (row.documentaryPending) {
        status = "document_pending";
        evidenceLabel =
          row.documentaryPendingReasons[0] ??
          "Comprovação documental necessária.";
        evidenceOrigin = declaredEvent ? "declaration" : "documentary_pendency";
        evidenceOriginLabel = declaredEvent
          ? "Declaração sem documento"
          : "Pendência documental";
        evidenceDate = declaredEvent?.executedAt ?? null;
        eventId = declaredEvent?.eventId ?? null;
      } else if (agenda) {
        status = "planned";
        evidenceLabel = `Agenda futura prevista para ${new Date(
          `${agenda.data_programada}T00:00:00`,
        ).toLocaleDateString("pt-BR")}.`;
        evidenceOrigin = "future_agenda";
        evidenceOriginLabel = "Agenda sanitária futura";
        evidenceDate = agenda.data_programada;
      } else {
        status = statusFromPrecheck(row);
        evidenceLabel = row.reason;
        evidenceOrigin = declaredEvent ? "declaration" : "protocol_evaluation";
        evidenceOriginLabel = declaredEvent
          ? "Declaração sem documento"
          : "Avaliação derivada do protocolo";
        evidenceDate = declaredEvent?.executedAt ?? null;
        eventId = declaredEvent?.eventId ?? null;
      }

      const eventForProduct = localEvent ?? documentedEvent ?? declaredEvent;
      const agendaProduct = resolveProductFromAgenda(agenda);
      rows.push({
        key: `${row.animalId}|${row.protocolId}|${row.itemKey}`,
        animalId: row.animalId,
        animalLabel: row.identification,
        animalHref: row.animalHref,
        lotId: row.lotId,
        lotLabel: row.lotLabel,
        lotHref: row.lotHref,
        protocolId: row.protocolId,
        protocolLabel: row.protocolLabel,
        itemId: row.itemId,
        itemKey: row.itemKey,
        itemLabel: row.itemLabel,
        status,
        evidenceLabel,
        evidenceOrigin,
        evidenceOriginLabel,
        evidenceDate,
        agendaId: agenda?.id ?? null,
        agendaDate: agenda?.data_programada ?? null,
        eventId,
        documentPendency: row.documentaryPending
          ? row.documentaryPendingReasons[0] ?? row.reason
          : null,
        productId: eventForProduct?.productId ?? agendaProduct.id,
        productLabel: eventForProduct?.productName ?? agendaProduct.label,
        activeWithdrawal: activeWithdrawals.get(row.animalId) ?? null,
      });
    }
  }

  rows.sort((left, right) =>
    [left.animalLabel, left.protocolLabel, left.itemLabel]
      .join("|")
      .localeCompare(
        [right.animalLabel, right.protocolLabel, right.itemLabel].join("|"),
        "pt-BR",
      ),
  );
  const statuses = emptyStatusSummary();
  for (const row of rows) statuses[row.status] += 1;

  return {
    evaluatedAt: input.evaluatedAt,
    rows,
    statuses,
    byAnimal: aggregate(rows, (row) => ({ id: row.animalId, label: row.animalLabel })),
    byLot: aggregate(rows, (row) =>
      row.lotId ? { id: row.lotId, label: row.lotLabel } : null,
    ),
    byProtocol: aggregate(rows, (row) => ({
      id: row.protocolId,
      label: row.protocolLabel,
    })),
    byItem: aggregate(rows, (row) => ({ id: row.itemId, label: row.itemLabel })),
    createsAgenda: false,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    allowsOperationalRelease: false,
  };
}
