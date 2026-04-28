import type { EventDomain } from "@/lib/events/types";
import { validateSanitaryExecutionPreflight } from "@/lib/sanitario/models/executionPreflight";

type BuildBaseActionStepIssuesInput = {
  tipoManejo: EventDomain | null;
  sanitatioProductMissing: boolean;
  pesagemAnimaisInvalidosCount: number;
  movimentacaoSemDestino: boolean;
  movimentacaoDestinoIgualOrigem: boolean;
  nutricaoAlimentoMissing: boolean;
  nutricaoQuantidadeInvalida: boolean;
  isFinanceiroSociedade: boolean;
  financeiroContraparteId: string;
  partoRequiresSingleMatrix: boolean;
};

export function buildBaseActionStepIssues(
  input: BuildBaseActionStepIssuesInput,
) {
  if (!input.tipoManejo) return ["Escolha um manejo antes de continuar."];

  const issues: string[] = [];

  const sanitaryProductPreflight = validateSanitaryExecutionPreflight({
    tipoManejo: input.tipoManejo,
    sanitaryProductName: input.sanitatioProductMissing ? "" : "present",
    requireProduct: true,
  });
  if (!sanitaryProductPreflight.ok) {
    issues.push(sanitaryProductPreflight.message);
  }

  if (
    input.tipoManejo === "pesagem" &&
    input.pesagemAnimaisInvalidosCount > 0
  ) {
    issues.push("Informe peso maior que zero para todos os animais selecionados.");
  }

  if (input.tipoManejo === "movimentacao") {
    if (input.movimentacaoSemDestino) {
      issues.push("Selecione o lote de destino antes de continuar.");
    } else if (input.movimentacaoDestinoIgualOrigem) {
      issues.push("Origem e destino devem ser diferentes.");
    }
  }

  if (input.tipoManejo === "nutricao") {
    if (input.nutricaoAlimentoMissing) {
      issues.push("Informe o alimento usado no manejo.");
    }
    if (input.nutricaoQuantidadeInvalida) {
      issues.push("Quantidade de nutricao deve ser maior que zero.");
    }
  }

  if (
    input.tipoManejo === "financeiro" &&
    input.isFinanceiroSociedade &&
    input.financeiroContraparteId === "none"
  ) {
    issues.push("Eventos de sociedade exigem uma contraparte vinculada.");
  }

  if (input.partoRequiresSingleMatrix) {
    issues.push("Parto com geracao de cria deve ser registrado para uma matriz por vez.");
  }

  return issues;
}

type ComposeRegistrarActionStepIssuesInput = {
  baseIssues: string[];
  protocolEligibilityIssues: string[];
  sanitaryMovementBlockIssues: string[];
  complianceFlowIssues: string[];
  transitChecklistIssues: string[];
};

export function composeRegistrarActionStepIssues(
  input: ComposeRegistrarActionStepIssuesInput,
) {
  return [
    ...input.baseIssues,
    ...input.protocolEligibilityIssues,
    ...input.sanitaryMovementBlockIssues,
    ...input.complianceFlowIssues,
    ...input.transitChecklistIssues,
  ];
}

type BlockedAnimalLike = {
  animal: { identificacao: string };
};

export function buildSanitaryMovementBlockIssues(input: {
  showsTransitChecklist: boolean;
  blockedAnimals: BlockedAnimalLike[];
}) {
  if (!input.showsTransitChecklist || input.blockedAnimals.length === 0) {
    return [];
  }

  const firstBlocked = input.blockedAnimals[0];
  if (!firstBlocked) return [];

  return [
    input.blockedAnimals.length === 1
      ? `${firstBlocked.animal.identificacao} esta com suspeita sanitaria aberta e nao pode sair da fazenda.`
      : `${input.blockedAnimals.length} animal(is) do recorte atual estao com suspeita sanitaria aberta e bloqueio de movimentacao.`,
  ];
}

export function buildProtocolEligibilityIssues(input: {
  tipoManejo: EventDomain | null;
  selectedProtocolCompatibleWithAll: boolean | null;
}) {
  if (
    input.tipoManejo !== "sanitario" ||
    input.selectedProtocolCompatibleWithAll === null ||
    input.selectedProtocolCompatibleWithAll
  ) {
    return [];
  }

  const preflight = validateSanitaryExecutionPreflight({
    tipoManejo: input.tipoManejo,
    protocolEligibilityIssues: [
      "O item de protocolo escolhido nao atende todos os animais selecionados.",
    ],
  });

  return preflight.ok ? [] : [preflight.message];
}
