import type { TransitChecklistDraft } from "@/lib/sanitario/compliance/transit";
import { validateTransitChecklist } from "@/lib/sanitario/compliance/transit";
import { isFinanceiroSaidaNatureza } from "@/pages/Registrar/helpers/financialNature";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";

type GuardMessage = { message: string };

export function shouldShowTransitChecklist(input: {
  tipoManejo: string | null;
  financeiroNatureza: FinanceiroNatureza;
}) {
  return (
    input.tipoManejo === "movimentacao" ||
    (input.tipoManejo === "financeiro" &&
      isFinanceiroSaidaNatureza(input.financeiroNatureza))
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
  financeiroNatureza: FinanceiroNatureza;
  movementBlockers: GuardMessage[];
  nutritionBlockers: GuardMessage[];
}) {
  if (input.tipoManejo === "nutricao") {
    return input.nutritionBlockers.map((guard) => guard.message);
  }

  if (
    input.tipoManejo === "movimentacao" ||
    (input.tipoManejo === "financeiro" &&
      isFinanceiroSaidaNatureza(input.financeiroNatureza))
  ) {
    return input.movementBlockers.map((guard) => guard.message);
  }

  return [];
}
