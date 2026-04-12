import { describe, expect, it } from "vitest";

import { buildAgendaBadgeOverflowLayout } from "@/lib/agenda/badgeOverflow";

describe("agenda badge overflow", () => {
  it("keeps all badges when the layout budget fits the group", () => {
    const layout = buildAgendaBadgeOverflowLayout(
      [
        { key: "vacinacao", label: "Vacinacao", count: 2, tone: "info" },
        { key: "today", label: "Hoje", count: 1, tone: "warning" },
      ],
      3,
    );

    expect(layout).toEqual({
      visibleBadges: [
        { key: "vacinacao", label: "Vacinacao", count: 2, tone: "info" },
        { key: "today", label: "Hoje", count: 1, tone: "warning" },
      ],
      hiddenCount: 0,
    });
  });

  it("returns an overflow counter when badges exceed the mobile budget", () => {
    const layout = buildAgendaBadgeOverflowLayout(
      [
        { key: "vacinacao", label: "Vacinacao", count: 2, tone: "info" },
        { key: "vermifugacao", label: "Vermifugacao", count: 1, tone: "success" },
        { key: "today", label: "Hoje", count: 1, tone: "warning" },
        { key: "future", label: "Futuro", count: 3, tone: "info" },
      ],
      3,
    );

    expect(layout.visibleBadges).toHaveLength(3);
    expect(layout.hiddenCount).toBe(1);
  });

  it("supports a zero-budget compact layout", () => {
    const layout = buildAgendaBadgeOverflowLayout(
      [{ key: "today", label: "Hoje", count: 1, tone: "warning" }],
      0,
    );

    expect(layout).toEqual({
      visibleBadges: [],
      hiddenCount: 1,
    });
  });
});
