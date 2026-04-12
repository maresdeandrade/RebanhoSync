import { getAgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import type { AgendaItem } from "@/lib/offline/types";

type AgendaRecommendationTone = "neutral" | "info" | "warning" | "danger";

interface AgendaRecommendationPriority {
  label: string;
  tone: AgendaRecommendationTone;
  mandatory: boolean;
}

export interface AgendaRecommendationRow {
  item: Pick<AgendaItem, "id" | "status" | "data_prevista" | "tipo">;
  animalNome: string;
  loteNome: string;
  priority?: AgendaRecommendationPriority | null;
}

export interface AgendaGroupRecommendation {
  rowId: string;
  urgencyLabel: string;
  actionLabel: string;
  targetLabel: string;
  tone: AgendaRecommendationTone;
}

function formatAgendaTypeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function getTargetLabel(row: AgendaRecommendationRow) {
  if (row.animalNome !== "Sem animal") return row.animalNome;
  if (row.loteNome !== "Sem lote") return row.loteNome;
  return "Sem referencia";
}

function getBucketRank(row: AgendaRecommendationRow, today: Date) {
  const bucket = getAgendaScheduleBucket(row.item, today);
  if (bucket === "overdue") return 0;
  if (bucket === "today") return 1;
  if (bucket === "future") return 2;
  return 3;
}

function getUrgencyMeta(row: AgendaRecommendationRow, today: Date) {
  if (row.priority) {
    return {
      label: row.priority.label,
      tone: row.priority.tone,
      mandatory: row.priority.mandatory,
    };
  }

  const bucket = getAgendaScheduleBucket(row.item, today);
  if (bucket === "overdue") {
    return { label: "Atrasado", tone: "danger" as const, mandatory: false };
  }
  if (bucket === "today") {
    return { label: "Hoje", tone: "warning" as const, mandatory: false };
  }
  if (bucket === "future") {
    return { label: "Proximo", tone: "info" as const, mandatory: false };
  }
  return { label: "Fechado", tone: "neutral" as const, mandatory: false };
}

export function buildAgendaGroupRecommendation(
  rows: AgendaRecommendationRow[],
  today: Date = new Date(),
): AgendaGroupRecommendation | null {
  const candidates = rows
    .filter((row) => row.item.status === "agendado")
    .sort((left, right) => {
      const leftRank = getBucketRank(left, today);
      const rightRank = getBucketRank(right, today);
      if (leftRank !== rightRank) return leftRank - rightRank;

      const leftUrgency = getUrgencyMeta(left, today);
      const rightUrgency = getUrgencyMeta(right, today);
      if (leftUrgency.mandatory !== rightUrgency.mandatory) {
        return leftUrgency.mandatory ? -1 : 1;
      }

      const dateDiff = left.item.data_prevista.localeCompare(right.item.data_prevista);
      if (dateDiff !== 0) return dateDiff;

      return left.item.tipo.localeCompare(right.item.tipo);
    });

  const row = candidates[0];
  if (!row) return null;

  const urgency = getUrgencyMeta(row, today);
  return {
    rowId: row.item.id,
    urgencyLabel: urgency.label,
    actionLabel: formatAgendaTypeLabel(row.item.tipo),
    targetLabel: getTargetLabel(row),
    tone: urgency.tone,
  };
}
