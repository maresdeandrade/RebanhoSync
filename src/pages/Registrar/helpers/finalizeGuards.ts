import { EventValidationError } from "@/lib/events/validators";
import type { EventDomain } from "@/lib/events/types";

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

export function resolveRegistrarFinancialNatureIssue(input: {
  tipoManejo: EventDomain;
  isFinanceiroSociedade: boolean;
  natureza: FinanceiroNatureza;
}) {
  if (
    input.tipoManejo === "financeiro" &&
    !input.isFinanceiroSociedade &&
    input.natureza !== "compra" &&
    input.natureza !== "venda"
  ) {
    return "Natureza financeira invalida para este fluxo.";
  }

  return null;
}

export function buildRegistrarReproducaoIneligibleIssue(input: {
  animalIdentificacao: string;
  categoriaLabel: string | null;
}) {
  return `Reproducao disponivel apenas para novilhas e vacas. ${input.animalIdentificacao} esta como ${input.categoriaLabel ?? "categoria nao elegivel"}.`;
}

export function resolveRegistrarFinalizeOpsIssue(opsLength: number) {
  if (opsLength === 0) {
    return "Nenhuma operacao valida para envio.";
  }

  return null;
}

export function resolveRegistrarFinalizeCatchIssue(error: unknown) {
  if (error instanceof EventValidationError) {
    return error.issues[0]?.message ?? "Dados invalidos para o evento.";
  }

  return "Erro ao registrar manejo.";
}
