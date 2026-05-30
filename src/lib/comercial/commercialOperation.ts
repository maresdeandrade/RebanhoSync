export type CommercialOperationType = "compra" | "venda";
export type CommercialOperationScope = "animal" | "lote";
export type CommercialOperationCalculationStatus = "complete" | "partial" | "blocked";

export interface CommercialOperationIssue {
  code: string;
  severity: "blocking" | "warning";
  message: string;
}

export interface CommercialOperationInput {
  operationType?: CommercialOperationType;
  scope?: CommercialOperationScope;
  occurredAt?: string;

  quantidadeAnimais?: number;
  pesoVivoTotal?: number;

  valorBruto?: number;
  frete?: number;
  comissao?: number;
  descontos?: number;
  taxasImpostos?: number;

  contraparteId?: string;
  contraparteNome?: string;

  animalIds?: string[];
  loteId?: string;

  financeTransactionId?: string;

  observacoes?: string;
}

export interface CommercialOperationSnapshot {
  operationType?: CommercialOperationType;
  scope?: CommercialOperationScope;
  occurredAt?: string;

  quantidadeAnimais?: number;
  pesoVivoTotal?: number;

  valorBruto?: number;
  frete?: number;
  comissao?: number;
  descontos?: number;
  taxasImpostos?: number;

  contraparteId?: string;
  contraparteNome?: string;

  animalIds?: string[];
  loteId?: string;

  financeTransactionId?: string;

  observacoes?: string;
}

export interface CommercialOperationSummary {
  calculationStatus: CommercialOperationCalculationStatus;

  pesoMedioDerivado?: number;
  valorLiquidoDerivado?: number;

  issues: CommercialOperationIssue[];
  limitations: string[];

  snapshot: CommercialOperationSnapshot;
}

/**
 * Realiza o cálculo e validação estruturada de uma operação comercial pecuária de forma determinística e pura.
 * 
 * @param input Dados de entrada da operação comercial.
 * @returns Um sumário contendo o status do cálculo, os valores derivados, issues de validação e limitações informativas.
 */
export function calculateCommercialOperation(input: CommercialOperationInput): CommercialOperationSummary {
  const issues: CommercialOperationIssue[] = [];
  const limitations: string[] = [];

  // Snapshot da negociação (cópia profunda simples de campos não mutáveis)
  const snapshot: CommercialOperationSnapshot = {
    operationType: input.operationType,
    scope: input.scope,
    occurredAt: input.occurredAt,
    quantidadeAnimais: input.quantidadeAnimais,
    pesoVivoTotal: input.pesoVivoTotal,
    valorBruto: input.valorBruto,
    frete: input.frete,
    comissao: input.comissao,
    descontos: input.descontos,
    taxasImpostos: input.taxasImpostos,
    contraparteId: input.contraparteId,
    contraparteNome: input.contraparteNome,
    animalIds: input.animalIds ? [...input.animalIds] : undefined,
    loteId: input.loteId,
    financeTransactionId: input.financeTransactionId,
    observacoes: input.observacoes,
  };

  // 1. Validação de campos bloqueantes obrigatórios
  if (!input.operationType) {
    issues.push({
      code: "missing_operation_type",
      severity: "blocking",
      message: "Tipo de operação (compra ou venda) é obrigatório.",
    });
  } else if (input.operationType !== "compra" && input.operationType !== "venda") {
    issues.push({
      code: "invalid_operation_type",
      severity: "blocking",
      message: "Tipo de operação inválido. Deve ser 'compra' ou 'venda'.",
    });
  }

  if (!input.scope) {
    issues.push({
      code: "missing_scope",
      severity: "blocking",
      message: "Escopo da operação (animal ou lote) é obrigatório.",
    });
  } else if (input.scope !== "animal" && input.scope !== "lote") {
    issues.push({
      code: "invalid_scope",
      severity: "blocking",
      message: "Escopo da operação inválido. Deve ser 'animal' ou 'lote'.",
    });
  }

  if (!input.occurredAt || input.occurredAt.trim() === "") {
    issues.push({
      code: "missing_occurred_at",
      severity: "blocking",
      message: "Data da operação é obrigatória.",
    });
  }

  if (input.quantidadeAnimais === undefined || input.quantidadeAnimais === null) {
    issues.push({
      code: "missing_quantidade_animais",
      severity: "blocking",
      message: "Quantidade de animais é obrigatória.",
    });
  } else if (input.quantidadeAnimais <= 0) {
    issues.push({
      code: "invalid_quantidade_animais",
      severity: "blocking",
      message: "Quantidade de animais deve ser maior que zero.",
    });
  }

  // 2. Validação de valores numéricos não negativos (bloqueantes)
  if (input.pesoVivoTotal !== undefined && input.pesoVivoTotal !== null && input.pesoVivoTotal < 0) {
    issues.push({
      code: "negative_peso_vivo_total",
      severity: "blocking",
      message: "Peso vivo total não pode ser negativo.",
    });
  }

  if (input.valorBruto !== undefined && input.valorBruto !== null && input.valorBruto < 0) {
    issues.push({
      code: "negative_valor_bruto",
      severity: "blocking",
      message: "Valor bruto não pode ser negativo.",
    });
  }

  if (input.frete !== undefined && input.frete !== null && input.frete < 0) {
    issues.push({
      code: "negative_frete",
      severity: "blocking",
      message: "Frete não pode ser negativo.",
    });
  }

  if (input.comissao !== undefined && input.comissao !== null && input.comissao < 0) {
    issues.push({
      code: "negative_comissao",
      severity: "blocking",
      message: "Comissão não pode ser negativa.",
    });
  }

  if (input.descontos !== undefined && input.descontos !== null && input.descontos < 0) {
    issues.push({
      code: "negative_descontos",
      severity: "blocking",
      message: "Descontos não podem ser negativos.",
    });
  }

  if (input.taxasImpostos !== undefined && input.taxasImpostos !== null && input.taxasImpostos < 0) {
    issues.push({
      code: "negative_taxas_impostos",
      severity: "blocking",
      message: "Taxas/impostos não podem ser negativos.",
    });
  }

  // 3. Cálculos e Limitações
  let pesoMedioDerivado: number | undefined;
  const isQuantidadeValida = input.quantidadeAnimais !== undefined && input.quantidadeAnimais !== null && input.quantidadeAnimais > 0;
  const isPesoValido = input.pesoVivoTotal !== undefined && input.pesoVivoTotal !== null && input.pesoVivoTotal >= 0;

  if (isQuantidadeValida && isPesoValido) {
    // Caso o peso vivo total seja zero, calculamos sem quebrar, mas com limitação
    pesoMedioDerivado = input.pesoVivoTotal! / input.quantidadeAnimais!;
    if (input.pesoVivoTotal === 0) {
      limitations.push("Peso vivo total informado como zero.");
    }
  } else {
    limitations.push("Ausência de peso vivo total impossibilita o cálculo do peso médio derivado.");
  }

  let valorLiquidoDerivado: number | undefined;
  const isValorBrutoValido = input.valorBruto !== undefined && input.valorBruto !== null && input.valorBruto >= 0;

  if (isValorBrutoValido) {
    const frete = input.frete ?? 0;
    const comissao = input.comissao ?? 0;
    const descontos = input.descontos ?? 0;
    const taxasImpostos = input.taxasImpostos ?? 0;

    valorLiquidoDerivado = input.valorBruto! - descontos - taxasImpostos - comissao - frete;

    // Regra: valor líquido derivado negativo é bloqueante
    if (valorLiquidoDerivado < 0) {
      issues.push({
        code: "negative_valor_liquido_derivado",
        severity: "blocking",
        message: "O valor líquido derivado não pode ser negativo.",
      });
    }

    // Registrar tratamentos de valores ausentes considerados zero
    if (input.frete === undefined || input.frete === null) {
      limitations.push("Frete não informado, considerado como zero no cálculo líquido.");
    }
    if (input.comissao === undefined || input.comissao === null) {
      limitations.push("Comissão não informada, considerada como zero no cálculo líquido.");
    }
    if (input.descontos === undefined || input.descontos === null) {
      limitations.push("Descontos não informados, considerados como zero no cálculo líquido.");
    }
    if (input.taxasImpostos === undefined || input.taxasImpostos === null) {
      limitations.push("Taxas/impostos não informados, considerados como zero no cálculo líquido.");
    }
  } else {
    limitations.push("Ausência de valor bruto impossibilita o cálculo do valor líquido derivado.");
  }

  // 4. Limitações de vínculos e metadados opcionais
  if (!input.contraparteId && !input.contraparteNome) {
    limitations.push("Ausência de contraparte (parceiro comercial).");
  }

  if (!input.financeTransactionId) {
    limitations.push("Ausência de vínculo financeiro (financeTransactionId).");
  }

  if (input.scope === "animal") {
    if (!input.animalIds || input.animalIds.length === 0) {
      limitations.push("Ausência de vínculo específico com animal(is).");
    }
  } else if (input.scope === "lote") {
    if (!input.loteId) {
      limitations.push("Ausência de vínculo específico com lote.");
    }
  }

  // 5. Determinação do calculationStatus
  const hasBlockingIssues = issues.some((issue) => issue.severity === "blocking");

  let calculationStatus: CommercialOperationCalculationStatus = "partial";

  if (hasBlockingIssues) {
    calculationStatus = "blocked";
  } else {
    // Para ser considerado completo, todos os dados de cálculo e metadados opcionais importantes devem estar presentes
    const hasAllCalculationData =
      input.occurredAt !== undefined && input.occurredAt !== null && input.occurredAt.trim() !== "" &&
      input.quantidadeAnimais !== undefined && input.quantidadeAnimais !== null && input.quantidadeAnimais > 0 &&
      input.pesoVivoTotal !== undefined && input.pesoVivoTotal !== null &&
      input.valorBruto !== undefined && input.valorBruto !== null;

    const hasAllOptionalMetadata =
      (input.contraparteId !== undefined && input.contraparteId !== null && input.contraparteId.trim() !== "") &&
      (input.financeTransactionId !== undefined && input.financeTransactionId !== null && input.financeTransactionId.trim() !== "") &&
      (input.scope === "animal"
        ? (input.animalIds !== undefined && input.animalIds !== null && input.animalIds.length > 0)
        : (input.loteId !== undefined && input.loteId !== null && input.loteId.trim() !== ""));

    if (hasAllCalculationData && hasAllOptionalMetadata) {
      calculationStatus = "complete";
    } else {
      calculationStatus = "partial";
    }
  }

  return {
    calculationStatus,
    pesoMedioDerivado,
    valorLiquidoDerivado,
    issues,
    limitations,
    snapshot,
  };
}
