import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance/compliance";

export type RegulatoryOverlayOperationalKind =
  | "operational_block"
  | "documentary_checklist"
  | "notification_signal"
  | "routine_checklist";

export interface RegulatoryOverlayOperationalKindSummary {
  key: RegulatoryOverlayOperationalKind;
  label: string;
  count: number;
}

const DOCUMENTARY_SUBAREAS = new Set([
  "atualizacao_rebanho",
  "comprovacao_brucelose",
]);

const OPERATIONAL_KIND_LABELS: Record<RegulatoryOverlayOperationalKind, string> =
  {
    operational_block: "Bloqueio operacional",
    documentary_checklist: "Checklist documental",
    notification_signal: "Sinal de notificacao",
    routine_checklist: "Checklist operacional",
  };

const OPERATIONAL_KIND_ORDER: RegulatoryOverlayOperationalKind[] = [
  "operational_block",
  "documentary_checklist",
  "notification_signal",
  "routine_checklist",
];

type RegulatoryOverlayOperationalKindInput = Pick<
  RegulatoryOverlayEntry,
  "complianceKind" | "item" | "subarea"
>;

export function resolveRegulatoryOverlayOperationalKind(
  entry: RegulatoryOverlayOperationalKindInput,
): RegulatoryOverlayOperationalKind {
  if (entry.complianceKind === "feed_ban") return "operational_block";

  if (entry.item.area === "notificacao" || entry.subarea === "notificacao") {
    return "notification_signal";
  }

  if (
    entry.item.requires_gta ||
    (entry.subarea && DOCUMENTARY_SUBAREAS.has(entry.subarea))
  ) {
    return "documentary_checklist";
  }

  return "routine_checklist";
}

export function getRegulatoryOverlayOperationalKindLabel(
  kind: RegulatoryOverlayOperationalKind,
) {
  return OPERATIONAL_KIND_LABELS[kind];
}

export function summarizeRegulatoryOverlayOperationalKinds(
  entries: RegulatoryOverlayOperationalKindInput[],
): RegulatoryOverlayOperationalKindSummary[] {
  const counts = new Map<RegulatoryOverlayOperationalKind, number>();
  for (const entry of entries) {
    const kind = resolveRegulatoryOverlayOperationalKind(entry);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return OPERATIONAL_KIND_ORDER.flatMap((key) => {
    const count = counts.get(key) ?? 0;
    if (count === 0) return [];

    return {
      key,
      label: getRegulatoryOverlayOperationalKindLabel(key),
      count,
    };
  });
}
