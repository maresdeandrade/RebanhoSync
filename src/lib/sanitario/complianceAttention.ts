import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance";
import { getRegulatoryOverlayStatusLabel } from "@/lib/sanitario/compliance";

type ComplianceAttentionTone = "danger" | "warning" | "info";

export interface RegulatoryComplianceAttentionBadge {
  key: string;
  label: string;
  count: number;
  tone: ComplianceAttentionTone;
}

export interface RegulatoryComplianceAttentionItem {
  key: string;
  label: string;
  detail: string;
  statusLabel: string;
  kindLabel: string;
  recommendation: string;
  tone: ComplianceAttentionTone;
  blocking: boolean;
  criticalChecklist: boolean;
  checkedAt: string | null;
}

export interface RegulatoryComplianceAttentionSummary {
  total: number;
  openCount: number;
  pendingCount: number;
  adjustmentCount: number;
  blockingCount: number;
  feedBanOpenCount: number;
  criticalChecklistCount: number;
  badges: RegulatoryComplianceAttentionBadge[];
  topItems: RegulatoryComplianceAttentionItem[];
  groupBadge: {
    label: string;
    tone: ComplianceAttentionTone;
  } | null;
}

const CRITICAL_CHECKLIST_SUBAREAS = new Set([
  "quarentena",
  "agua_limpeza",
]);

const TONE_RANK: Record<ComplianceAttentionTone, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

function isFeedBanOpen(entry: RegulatoryOverlayEntry) {
  return entry.complianceKind === "feed_ban" && entry.status !== "conforme";
}

function isCriticalChecklist(entry: RegulatoryOverlayEntry) {
  if (entry.complianceKind !== "checklist") return false;
  if (entry.status === "conforme") return false;
  if (entry.template.status_legal === "obrigatorio") return true;
  return Boolean(entry.subarea && CRITICAL_CHECKLIST_SUBAREAS.has(entry.subarea));
}

function resolveItemTone(entry: RegulatoryOverlayEntry): ComplianceAttentionTone {
  if (entry.status === "ajuste_necessario") return "danger";
  if (isFeedBanOpen(entry)) return "danger";
  if (isCriticalChecklist(entry)) return "warning";
  return "info";
}

function resolveItemRecommendation(entry: RegulatoryOverlayEntry) {
  if (entry.complianceKind === "feed_ban") {
    return "Revisar formulacao de ruminantes e confirmar ausencia de ingrediente proibido antes do uso.";
  }

  if (entry.subarea === "quarentena") {
    return "Confirmar segregacao de entrada, observacao clinica e documentacao minima.";
  }

  if (entry.subarea === "agua_limpeza") {
    return "Executar o checklist de agua, cochos, bebedouros e equipamentos.";
  }

  if (entry.subarea === "atualizacao_rebanho") {
    return "Concluir a etapa documental no canal oficial da UF.";
  }

  if (entry.subarea === "comprovacao_brucelose") {
    return "Registrar a comprovacao semestral de brucelose no prazo operacional.";
  }

  return "Registrar a verificacao desta frente no overlay regulatorio da fazenda.";
}

function resolveItemDetail(entry: RegulatoryOverlayEntry) {
  const segments = [
    entry.template.nome,
    entry.subarea ? entry.subarea.replaceAll("_", " ") : null,
    entry.template.status_legal.replaceAll("_", " "),
  ].filter((segment): segment is string => Boolean(segment));

  return segments.join(" | ");
}

function compareAttentionItems(
  left: RegulatoryComplianceAttentionItem,
  right: RegulatoryComplianceAttentionItem,
) {
  const toneDiff = TONE_RANK[left.tone] - TONE_RANK[right.tone];
  if (toneDiff !== 0) return toneDiff;

  if (left.checkedAt && right.checkedAt) {
    const checkedAtDiff = left.checkedAt.localeCompare(right.checkedAt);
    if (checkedAtDiff !== 0) return checkedAtDiff;
  } else if (left.checkedAt) {
    return -1;
  } else if (right.checkedAt) {
    return 1;
  }

  return left.label.localeCompare(right.label);
}

export const EMPTY_REGULATORY_COMPLIANCE_ATTENTION: RegulatoryComplianceAttentionSummary = {
  total: 0,
  openCount: 0,
  pendingCount: 0,
  adjustmentCount: 0,
  blockingCount: 0,
  feedBanOpenCount: 0,
  criticalChecklistCount: 0,
  badges: [],
  topItems: [],
  groupBadge: null,
};

export function summarizeRegulatoryComplianceAttention(input: {
  entries: RegulatoryOverlayEntry[];
  limit?: number;
}): RegulatoryComplianceAttentionSummary {
  const limit = Math.max(0, input.limit ?? 3);
  if (input.entries.length === 0) {
    return EMPTY_REGULATORY_COMPLIANCE_ATTENTION;
  }

  const openEntries = input.entries.filter((entry) => entry.status !== "conforme");
  if (openEntries.length === 0) {
    return {
      ...EMPTY_REGULATORY_COMPLIANCE_ATTENTION,
      total: input.entries.length,
    };
  }

  const topItems = openEntries
    .map((entry) => {
      const tone = resolveItemTone(entry);
      return {
        key: entry.item.codigo,
        label: entry.label,
        detail: resolveItemDetail(entry),
        statusLabel: getRegulatoryOverlayStatusLabel(entry.status),
        kindLabel: entry.complianceKind === "feed_ban" ? "Feed-ban" : "Checklist",
        recommendation: resolveItemRecommendation(entry),
        tone,
        blocking: tone === "danger",
        criticalChecklist: isCriticalChecklist(entry),
        checkedAt: entry.runtime?.checkedAt ?? null,
      } satisfies RegulatoryComplianceAttentionItem;
    })
    .sort(compareAttentionItems)
    .slice(0, limit);

  const pendingCount = openEntries.filter((entry) => entry.status === "pendente").length;
  const adjustmentCount = openEntries.filter(
    (entry) => entry.status === "ajuste_necessario",
  ).length;
  const feedBanOpenCount = openEntries.filter(isFeedBanOpen).length;
  const criticalChecklistItems = openEntries.filter(isCriticalChecklist);
  const criticalChecklistCount = criticalChecklistItems.length;
  const blockingCount = topItems.filter((item) => item.blocking).length;
  const badges: RegulatoryComplianceAttentionBadge[] = [];

  if (feedBanOpenCount > 0) {
    badges.push({
      key: "feed-ban",
      label: "Feed-ban",
      count: feedBanOpenCount,
      tone: "danger",
    });
  }

  if (criticalChecklistCount > 0) {
    badges.push({
      key: "critical-checklists",
      label: "Checklist critico",
      count: criticalChecklistCount,
      tone: criticalChecklistItems.some((entry) => entry.status === "ajuste_necessario")
        ? "danger"
        : "warning",
    });
  }

  if (adjustmentCount > 0) {
    badges.push({
      key: "adjustments",
      label: "Ajuste necessario",
      count: adjustmentCount,
      tone: "danger",
    });
  }

  if (badges.length === 0) {
    badges.push({
      key: "pending",
      label: "Conformidade pendente",
      count: openEntries.length,
      tone: "info",
    });
  }

  return {
    total: input.entries.length,
    openCount: openEntries.length,
    pendingCount,
    adjustmentCount,
    blockingCount:
      feedBanOpenCount + openEntries.filter((entry) => entry.status === "ajuste_necessario").length,
    feedBanOpenCount,
    criticalChecklistCount,
    badges,
    topItems,
    groupBadge:
      feedBanOpenCount > 0 || adjustmentCount > 0
        ? {
            label: "Restricao de conformidade",
            tone: "danger",
          }
        : criticalChecklistCount > 0
          ? {
              label: "Checklist critico pendente",
              tone: "warning",
            }
          : {
              label: "Conformidade pendente",
              tone: "info",
            },
  };
}
