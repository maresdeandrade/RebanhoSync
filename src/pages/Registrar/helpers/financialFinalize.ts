import { buildFinancialTransaction } from "@/lib/finance/transactions";
import type { Animal, OperationInput } from "@/lib/offline/types";
import {
  buildRegistrarFinancialPurchaseAnimals,
  buildRegistrarSelectedAnimalRecords,
} from "@/pages/Registrar/helpers/financialPlan";
import { resolveRegistrarFinancialNatureIssue } from "@/pages/Registrar/helpers/finalizeGuards";

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

type FinancialPriceMode = "por_animal" | "por_lote";
type FinancialWeightMode = "nenhum" | "lote" | "individual";

type CompraNovoAnimalDraft = {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
  pesoKg: string;
};

export function resolveRegistrarFinancialFinalizePlan(input: {
  tipoManejo: string;
  isFinanceiroSociedade: boolean;
  natureza: FinanceiroNatureza;
  fazendaId: string;
  occurredAt: string;
  selectedAnimalIds: string[];
  animalsMap: Map<string, Animal>;
  selectedLoteIdNormalized: string | null;
  contraparteId: string;
  sourceTaskId: string | null;
  compraNovosAnimais: CompraNovoAnimalDraft[];
  modoPeso: FinancialWeightMode;
  modoPreco: FinancialPriceMode;
  valorTotalInformado: number;
  valorUnitario: number;
  pesoLote: number;
  transitChecklistPayload: Record<string, unknown>;
  parseUserWeight: (value: string) => number | null;
}):
  | { issue: string; linkedEventId: null; createdAnimalIds: []; ops: [] }
  | {
      issue: null;
      linkedEventId: string;
      createdAnimalIds: string[];
      ops: OperationInput[];
    } {
  const financialNatureIssue = resolveRegistrarFinancialNatureIssue({
    tipoManejo: input.tipoManejo,
    isFinanceiroSociedade: input.isFinanceiroSociedade,
    natureza: input.natureza,
  });
  if (financialNatureIssue) {
    return {
      issue: financialNatureIssue,
      linkedEventId: null,
      createdAnimalIds: [],
      ops: [],
    };
  }

  const selectedAnimalRecords = buildRegistrarSelectedAnimalRecords({
    selectedAnimalIds: input.selectedAnimalIds,
    animalsMap: input.animalsMap,
    fallbackLoteId: input.selectedLoteIdNormalized,
  });

  const purchaseAnimals = buildRegistrarFinancialPurchaseAnimals({
    natureza: input.natureza,
    compraNovosAnimais: input.compraNovosAnimais,
    selectedAnimalRecords,
    modoPeso: input.modoPeso,
    parseUserWeight: input.parseUserWeight,
  });

  const built = buildFinancialTransaction({
    fazendaId: input.fazendaId,
    natureza: input.natureza,
    occurredAt: input.occurredAt,
    loteId: input.selectedLoteIdNormalized,
    contraparteId: input.contraparteId !== "none" ? input.contraparteId : null,
    sourceTaskId: input.sourceTaskId,
    selectedAnimals: selectedAnimalRecords,
    purchaseAnimals,
    priceMode: input.modoPreco,
    totalAmount: input.modoPreco === "por_lote" ? input.valorTotalInformado : null,
    unitAmount: input.modoPreco === "por_animal" ? input.valorUnitario : null,
    weightMode: input.modoPeso,
    lotWeightKg: input.pesoLote,
    payload: input.transitChecklistPayload,
  });

  return {
    issue: null,
    linkedEventId: built.financialEventId,
    createdAnimalIds: built.createdAnimalIds,
    ops: built.ops,
  };
}
