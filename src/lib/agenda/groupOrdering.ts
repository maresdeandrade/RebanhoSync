import type { AgendaItem } from "@/lib/offline/types";

export type AgendaScheduleBucket = "overdue" | "today" | "future" | "closed";

export interface AgendaGroupSortMeta {
  overdueCount: number;
  todayCount: number;
  futureCount: number;
  pendingCount: number;
  urgencyBucket: 0 | 1 | 2 | 3;
  earliestPendingDate: string | null;
}

interface AgendaGroupOrderingRow {
  item: Pick<AgendaItem, "status" | "data_prevista">;
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function summarizeAgendaGroupOrdering(
  rows: AgendaGroupOrderingRow[],
  today: Date = new Date(),
): AgendaGroupSortMeta {
  let overdueCount = 0;
  let todayCount = 0;
  let futureCount = 0;
  let earliestPendingDate: string | null = null;

  for (const row of rows) {
    const bucket = getAgendaScheduleBucket(row.item, today);
    if (bucket === "closed") continue;

    if (
      earliestPendingDate === null ||
      row.item.data_prevista < earliestPendingDate
    ) {
      earliestPendingDate = row.item.data_prevista;
    }

    if (bucket === "overdue") {
      overdueCount += 1;
      continue;
    }

    if (bucket === "today") {
      todayCount += 1;
      continue;
    }

    futureCount += 1;
  }

  const pendingCount = overdueCount + todayCount + futureCount;
  const urgencyBucket =
    overdueCount > 0 ? 0 : todayCount > 0 ? 1 : futureCount > 0 ? 2 : 3;

  return {
    overdueCount,
    todayCount,
    futureCount,
    pendingCount,
    urgencyBucket,
    earliestPendingDate,
  };
}

export function getAgendaScheduleBucket(
  item: Pick<AgendaItem, "status" | "data_prevista">,
  today: Date = new Date(),
): AgendaScheduleBucket {
  if (item.status !== "agendado") return "closed";

  const todayKey = toDateKey(today);
  if (item.data_prevista < todayKey) return "overdue";
  if (item.data_prevista === todayKey) return "today";
  return "future";
}

export function compareAgendaGroupOrdering(
  left: AgendaGroupSortMeta,
  right: AgendaGroupSortMeta,
): number {
  if (left.urgencyBucket !== right.urgencyBucket) {
    return left.urgencyBucket - right.urgencyBucket;
  }

  if (right.overdueCount !== left.overdueCount) {
    return right.overdueCount - left.overdueCount;
  }

  if (right.todayCount !== left.todayCount) {
    return right.todayCount - left.todayCount;
  }

  if (left.earliestPendingDate && right.earliestPendingDate) {
    const dateDiff = left.earliestPendingDate.localeCompare(
      right.earliestPendingDate,
    );
    if (dateDiff !== 0) return dateDiff;
  } else if (left.earliestPendingDate) {
    return -1;
  } else if (right.earliestPendingDate) {
    return 1;
  }

  if (right.pendingCount !== left.pendingCount) {
    return right.pendingCount - left.pendingCount;
  }

  if (right.futureCount !== left.futureCount) {
    return right.futureCount - left.futureCount;
  }

  return 0;
}
