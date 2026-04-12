import type { AgendaSummaryBadge } from "@/lib/agenda/groupSummaries";

export interface AgendaBadgeOverflowLayout {
  visibleBadges: AgendaSummaryBadge[];
  hiddenCount: number;
}

export function buildAgendaBadgeOverflowLayout(
  badges: AgendaSummaryBadge[],
  maxVisible: number,
): AgendaBadgeOverflowLayout {
  if (maxVisible <= 0) {
    return {
      visibleBadges: [],
      hiddenCount: badges.length,
    };
  }

  if (badges.length <= maxVisible) {
    return {
      visibleBadges: badges,
      hiddenCount: 0,
    };
  }

  return {
    visibleBadges: badges.slice(0, maxVisible),
    hiddenCount: badges.length - maxVisible,
  };
}
