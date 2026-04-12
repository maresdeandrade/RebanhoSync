import { getAgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import type { AgendaItem } from "@/lib/offline/types";

export interface AgendaCriticalNavigationRow {
  item: Pick<AgendaItem, "id" | "status" | "data_prevista">;
}

export interface AgendaCriticalNavigationGroup<T extends AgendaCriticalNavigationRow> {
  key: string;
  title: string;
  rows: T[];
}

export interface AgendaCriticalNavigationTarget<T extends AgendaCriticalNavigationRow> {
  groupKey: string;
  groupTitle: string;
  rows: T[];
  overdueCount: number;
}

export function buildAgendaCriticalNavigationTargets<T extends AgendaCriticalNavigationRow>(
  groups: AgendaCriticalNavigationGroup<T>[],
  today: Date = new Date(),
): AgendaCriticalNavigationTarget<T>[] {
  return groups
    .map((group) => {
      const overdueRows = group.rows.filter(
        (row) => getAgendaScheduleBucket(row.item, today) === "overdue",
      );

      if (overdueRows.length === 0) return null;

      return {
        groupKey: group.key,
        groupTitle: group.title,
        rows: overdueRows,
        overdueCount: overdueRows.length,
      };
    })
    .filter((entry): entry is AgendaCriticalNavigationTarget<T> => entry !== null);
}

export function getAdjacentAgendaCriticalNavigationTarget<T extends AgendaCriticalNavigationRow>(
  targets: AgendaCriticalNavigationTarget<T>[],
  currentGroupKey: string | null,
  direction: "next" | "previous",
): AgendaCriticalNavigationTarget<T> | null {
  if (targets.length === 0) return null;

  const currentIndex = currentGroupKey
    ? targets.findIndex((entry) => entry.groupKey === currentGroupKey)
    : -1;

  if (currentIndex === -1) {
    return direction === "next" ? targets[0] : targets[targets.length - 1];
  }

  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + delta + targets.length) % targets.length;
  return targets[nextIndex];
}
