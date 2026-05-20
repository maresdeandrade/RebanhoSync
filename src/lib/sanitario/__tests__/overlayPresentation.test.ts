import { describe, expect, it } from "vitest";

import {
  getRegulatoryOverlayOperationalKindLabel,
  resolveRegulatoryOverlayOperationalKind,
  summarizeRegulatoryOverlayOperationalKinds,
} from "@/lib/sanitario/compliance/overlayPresentation";
import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance/compliance";

function buildEntry(
  overrides: Partial<Pick<RegulatoryOverlayEntry, "complianceKind" | "subarea">> & {
    area?: RegulatoryOverlayEntry["item"]["area"];
    requiresGta?: boolean;
  },
) {
  return {
    complianceKind: overrides.complianceKind ?? "checklist",
    subarea: overrides.subarea ?? null,
    item: {
      area: overrides.area ?? "biosseguranca",
      requires_gta: overrides.requiresGta ?? false,
    },
  } as Pick<RegulatoryOverlayEntry, "complianceKind" | "item" | "subarea">;
}

describe("overlayPresentation", () => {
  it("classifica feed-ban como bloqueio operacional", () => {
    const kind = resolveRegulatoryOverlayOperationalKind(
      buildEntry({ complianceKind: "feed_ban", subarea: "feed_ban" }),
    );

    expect(kind).toBe("operational_block");
    expect(getRegulatoryOverlayOperationalKindLabel(kind)).toBe(
      "Bloqueio operacional",
    );
  });

  it("classifica notificacao como sinal de notificacao", () => {
    expect(
      resolveRegulatoryOverlayOperationalKind(
        buildEntry({ area: "notificacao", subarea: "atualizacao_rebanho" }),
      ),
    ).toBe("notification_signal");
    expect(
      resolveRegulatoryOverlayOperationalKind(
        buildEntry({ subarea: "notificacao" }),
      ),
    ).toBe("notification_signal");
  });

  it("classifica checklist documental por subarea ou GTA", () => {
    expect(
      resolveRegulatoryOverlayOperationalKind(
        buildEntry({ subarea: "comprovacao_brucelose" }),
      ),
    ).toBe("documentary_checklist");
    expect(
      resolveRegulatoryOverlayOperationalKind(buildEntry({ requiresGta: true })),
    ).toBe("documentary_checklist");
  });

  it("mantem checklist operacional como fallback", () => {
    expect(
      resolveRegulatoryOverlayOperationalKind(
        buildEntry({ subarea: "quarentena" }),
      ),
    ).toBe("routine_checklist");
  });

  it("resume as classes visuais em ordem operacional", () => {
    const summary = summarizeRegulatoryOverlayOperationalKinds([
      buildEntry({ subarea: "quarentena" }),
      buildEntry({ complianceKind: "feed_ban", subarea: "feed_ban" }),
      buildEntry({ requiresGta: true }),
    ]);

    expect(summary).toEqual([
      {
        key: "operational_block",
        label: "Bloqueio operacional",
        count: 1,
      },
      {
        key: "documentary_checklist",
        label: "Checklist documental",
        count: 1,
      },
      {
        key: "routine_checklist",
        label: "Checklist operacional",
        count: 1,
      },
    ]);
  });
});
