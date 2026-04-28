import type { EventDomain } from "@/lib/events/types";
import { validateSanitaryExecutionPreflight } from "@/lib/sanitario/models/executionPreflight";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";
import {
  isFinanceiroDoacaoNatureza,
  isFinanceiroSaidaNatureza,
  supportsDraftAnimalsInFinanceiroNatureza,
} from "@/pages/Registrar/helpers/financialNature";

export type RegistrarFinanceiroNatureza = FinanceiroNatureza;

export type RegistrarFinanceiroModoPeso = "nenhum" | "lote" | "individual";
export type RegistrarFinanceiroModoPreco = "por_lote" | "por_animal";

export interface RegistrarCompraNovoAnimalDraft {
  identificacao: string;
  dataNascimento: string;
  pesoKg: string;
  raca?: string | null;
}

export interface RegistrarPreflightInput {
  tipoManejo: EventDomain;
  selectedAnimais: string[];
  selectedLoteId: string;
  partoRequiresSingleMatrix: boolean;
  isFinanceiroSociedade: boolean;
  financeiroData: {
    natureza: RegistrarFinanceiroNatureza;
    modoPeso: RegistrarFinanceiroModoPeso;
    modoPreco: RegistrarFinanceiroModoPreco;
    contraparteId: string;
  };
  financeiroValorTotalCalculado: number | null;
  financeiroPesoLote: number | null;
  financeiroValorUnitario: number | null;
  financeiroQuantidadeAnimais: number;
  compraNovosAnimais: RegistrarCompraNovoAnimalDraft[];
  pesagemData: Record<string, string>;
  transitChecklistIssues: string[];
  complianceFlowIssues: string[];
  parseUserWeight: (value: string) => number | null;
}

export function resolveRegistrarPreflightIssue(
  input: RegistrarPreflightInput,
): string | null {
  const hasSelectedAnimals = input.selectedAnimais.length > 0;
  const financeRequiresAnimal =
    input.tipoManejo === "financeiro" &&
    isFinanceiroSaidaNatureza(input.financeiroData.natureza);
  const financeByLoteOnly =
    input.tipoManejo === "financeiro" &&
    !financeRequiresAnimal &&
    !hasSelectedAnimals;
  const entradaGerandoAnimais =
    input.tipoManejo === "financeiro" &&
    supportsDraftAnimalsInFinanceiroNatureza(input.financeiroData.natureza) &&
    !hasSelectedAnimals;
  const isFinanceiroDoacao =
    input.tipoManejo === "financeiro" &&
    isFinanceiroDoacaoNatureza(input.financeiroData.natureza);

  if (
    input.tipoManejo === "financeiro" &&
    input.isFinanceiroSociedade &&
    input.financeiroData.contraparteId === "none"
  ) {
    return "Selecione ou cadastre uma contraparte para evento de sociedade.";
  }

  if (!hasSelectedAnimals && !financeByLoteOnly) {
    return "Selecione ao menos um animal para este tipo de registro.";
  }

  if (financeByLoteOnly && !input.selectedLoteId) {
    return "Selecione um lote para registrar entrada sem animais.";
  }

  if (input.partoRequiresSingleMatrix) {
    return "Parto com geracao de cria deve ser registrado para uma matriz por vez.";
  }

  if (
    input.tipoManejo === "financeiro" &&
    !input.isFinanceiroSociedade &&
    !isFinanceiroDoacao &&
    (!Number.isFinite(input.financeiroValorTotalCalculado) ||
      (input.financeiroValorTotalCalculado ?? 0) <= 0)
  ) {
    return "Informe um valor financeiro valido para a transacao.";
  }

  if (
    input.tipoManejo === "financeiro" &&
    !input.isFinanceiroSociedade &&
    input.financeiroData.modoPeso === "lote" &&
    (!Number.isFinite(input.financeiroPesoLote) ||
      (input.financeiroPesoLote ?? 0) <= 0)
  ) {
    return "Informe um peso de lote valido.";
  }

  if (
    input.tipoManejo === "financeiro" &&
    !input.isFinanceiroSociedade &&
    !isFinanceiroDoacao &&
    input.financeiroData.modoPreco === "por_animal" &&
    (!Number.isFinite(input.financeiroValorUnitario) ||
      (input.financeiroValorUnitario ?? 0) <= 0)
  ) {
    return "Informe um valor unitario valido.";
  }

  if (
    input.tipoManejo === "financeiro" &&
    supportsDraftAnimalsInFinanceiroNatureza(input.financeiroData.natureza) &&
    !hasSelectedAnimals &&
    input.compraNovosAnimais.length !== input.financeiroQuantidadeAnimais
  ) {
    return "A quantidade de animais da entrada ficou inconsistente.";
  }

  if (entradaGerandoAnimais) {
    const hoje = new Date();
    const dataNascimentoInvalida = input.compraNovosAnimais.some((item) => {
      if (!item.dataNascimento) return false;
      const parsed = new Date(item.dataNascimento);
      return Number.isNaN(parsed.getTime()) || parsed > hoje;
    });
    if (dataNascimentoInvalida) {
      return "Data de nascimento invalida ou no futuro.";
    }

    const identificacoes = input.compraNovosAnimais
      .map((item) => item.identificacao.trim().toLowerCase())
      .filter(Boolean);
    if (new Set(identificacoes).size !== identificacoes.length) {
      return "Nao repita identificacoes nos novos animais.";
    }

    if (input.financeiroData.modoPeso === "individual") {
      const pesoInvalido = input.compraNovosAnimais.some((item) => {
        if (!item.pesoKg.trim()) return true;
        const peso = input.parseUserWeight(item.pesoKg);
        return !Number.isFinite(peso) || (peso ?? 0) <= 0;
      });
      if (pesoInvalido) {
        return "Informe um peso individual valido para cada animal da entrada.";
      }
    }
  }

  if (
    input.tipoManejo === "financeiro" &&
    isFinanceiroSaidaNatureza(input.financeiroData.natureza) &&
    input.financeiroData.modoPeso === "individual"
  ) {
    const pesoInvalido = input.compraNovosAnimais.some((item) => {
      if (!item.pesoKg.trim()) return true;
      const peso = input.parseUserWeight(item.pesoKg);
      return !Number.isFinite(peso) || (peso ?? 0) <= 0;
    });
    if (pesoInvalido) {
      return "Informe um peso individual valido para cada animal da saida.";
    }
  }

  if (input.tipoManejo === "pesagem") {
    const invalidWeights = input.selectedAnimais.filter((id) => {
      const weightStr = input.pesagemData[id];
      if (!weightStr || weightStr.trim() === "") return true;
      const weight = input.parseUserWeight(weightStr);
      return weight === null || weight <= 0;
    });

    if (invalidWeights.length > 0) {
      return "Informe um peso maior que zero para todos os animais.";
    }
  }

  const sanitaryPreflight = validateSanitaryExecutionPreflight({
    tipoManejo: input.tipoManejo,
    transitChecklistIssues: input.transitChecklistIssues,
    complianceFlowIssues: input.complianceFlowIssues,
    issueScope: "all_flows",
  });
  if (!sanitaryPreflight.ok) {
    return sanitaryPreflight.message;
  }

  return null;
}
