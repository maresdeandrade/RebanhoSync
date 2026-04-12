import type { RegulatoryOverlayEntry } from "@/lib/sanitario/compliance";

export type ComplianceGuardTone = "danger" | "warning" | "info";
export type ComplianceGuardSeverity = "block" | "warning";
export type ComplianceGuardContext = "nutrition" | "movement";

export interface ComplianceFlowGuard {
  key: string;
  label: string;
  message: string;
  severity: ComplianceGuardSeverity;
  tone: ComplianceGuardTone;
}

export interface ComplianceFlowGuardResult {
  blockers: ComplianceFlowGuard[];
  warnings: ComplianceFlowGuard[];
}

const EMPTY_RESULT: ComplianceFlowGuardResult = {
  blockers: [],
  warnings: [],
};

function isDocumentarySubarea(entry: RegulatoryOverlayEntry) {
  return (
    entry.subarea === "atualizacao_rebanho" ||
    entry.subarea === "comprovacao_brucelose"
  );
}

function isQuarantine(entry: RegulatoryOverlayEntry) {
  return entry.subarea === "quarentena";
}

function isWaterSanitation(entry: RegulatoryOverlayEntry) {
  return entry.subarea === "agua_limpeza";
}

function hasAdjustment(entry: RegulatoryOverlayEntry) {
  return entry.status === "ajuste_necessario";
}

function isOpen(entry: RegulatoryOverlayEntry) {
  return entry.status !== "conforme";
}

function buildFeedBanGuard(entry: RegulatoryOverlayEntry): ComplianceFlowGuard {
  const adjustment = hasAdjustment(entry);
  return {
    key: "feed-ban",
    label: "Feed-ban de ruminantes",
    severity: "block",
    tone: "danger",
    message: adjustment
      ? "Feed-ban de ruminantes esta com ajuste necessario. Revise a formulacao e o rotulo antes de registrar nutricao."
      : "Feed-ban de ruminantes ainda nao foi verificado. Confirme a conformidade alimentar antes de registrar nutricao.",
  };
}

function buildWaterSanitationGuard(
  entry: RegulatoryOverlayEntry,
): ComplianceFlowGuard {
  return {
    key: "agua-limpeza",
    label: "Agua e higiene operacional",
    severity: hasAdjustment(entry) ? "block" : "warning",
    tone: hasAdjustment(entry) ? "danger" : "warning",
    message: hasAdjustment(entry)
      ? "Checklist de agua, cochos, bebedouros ou equipamentos esta com ajuste necessario. Regularize a rotina antes de registrar nutricao."
      : "Checklist de agua e higiene operacional ainda esta pendente. Revise a rotina antes de seguir com a nutricao.",
  };
}

function buildQuarantineGuard(entry: RegulatoryOverlayEntry): ComplianceFlowGuard {
  return {
    key: "quarentena",
    label: "Quarentena de entrada",
    severity: hasAdjustment(entry) ? "block" : "warning",
    tone: hasAdjustment(entry) ? "danger" : "warning",
    message: hasAdjustment(entry)
      ? "Quarentena/separacao de entrada esta com ajuste necessario. Bloqueie movimentacoes ate regularizar o procedimento."
      : "Quarentena/separacao de entrada ainda esta pendente. Revise a segregacao antes de movimentar animais.",
  };
}

function buildDocumentaryGuard(
  entry: RegulatoryOverlayEntry,
): ComplianceFlowGuard {
  return {
    key: `documental:${entry.item.codigo}`,
    label: entry.label,
    severity: "block",
    tone: hasAdjustment(entry) ? "danger" : "warning",
    message: hasAdjustment(entry)
      ? `${entry.label} esta com ajuste necessario. Regularize a obrigacao documental antes de liberar o transito externo.`
      : `${entry.label} ainda esta pendente. Conclua a obrigacao documental antes de liberar o transito externo.`,
  };
}

function splitGuards(guards: ComplianceFlowGuard[]): ComplianceFlowGuardResult {
  return {
    blockers: guards.filter((guard) => guard.severity === "block"),
    warnings: guards.filter((guard) => guard.severity === "warning"),
  };
}

export function resolveComplianceFlowGuards(input: {
  entries: RegulatoryOverlayEntry[];
  context: ComplianceGuardContext;
  isExternalTransit?: boolean;
}): ComplianceFlowGuardResult {
  if (input.entries.length === 0) return EMPTY_RESULT;

  if (input.context === "nutrition") {
    const guards = input.entries.flatMap((entry) => {
      if (!isOpen(entry)) return [];
      if (entry.complianceKind === "feed_ban") {
        return [buildFeedBanGuard(entry)];
      }
      if (isWaterSanitation(entry)) {
        return [buildWaterSanitationGuard(entry)];
      }
      return [];
    });

    return splitGuards(guards);
  }

  const guards = input.entries.flatMap((entry) => {
    if (!isOpen(entry)) return [];
    if (isQuarantine(entry)) {
      return [buildQuarantineGuard(entry)];
    }

    if (input.isExternalTransit && isDocumentarySubarea(entry)) {
      return [buildDocumentaryGuard(entry)];
    }

    return [];
  });

  return splitGuards(guards);
}
