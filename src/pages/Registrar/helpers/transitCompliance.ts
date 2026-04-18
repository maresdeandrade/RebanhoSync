import type { TransitChecklistDraft } from "@/lib/sanitario/transit";
import { validateTransitChecklist } from "@/lib/sanitario/transit";

type GuardMessage = { message: string };

export function shouldShowTransitChecklist(input: {
  tipoManejo: string | null;
  financeiroNatureza: string;
}) {
  return (
    input.tipoManejo === "movimentacao" ||
    (input.tipoManejo === "financeiro" && input.financeiroNatureza === "venda")
  );
}

export function buildTransitChecklistIssues(input: {
  showsTransitChecklist: boolean;
  transitChecklist: TransitChecklistDraft;
  asOfDate: string;
}) {
  if (!input.showsTransitChecklist) return [];
  return validateTransitChecklist(input.transitChecklist, input.asOfDate);
}

export function buildComplianceFlowIssues(input: {
  tipoManejo: string | null;
  financeiroNatureza: string;
  movementBlockers: GuardMessage[];
  nutritionBlockers: GuardMessage[];
}) {
  if (input.tipoManejo === "nutricao") {
    return input.nutritionBlockers.map((guard) => guard.message);
  }

  if (
    input.tipoManejo === "movimentacao" ||
    (input.tipoManejo === "financeiro" && input.financeiroNatureza === "venda")
  ) {
    return input.movementBlockers.map((guard) => guard.message);
  }

  return [];
}
