import type { ComercialEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateComercialInput = (input: ComercialEventInput): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.operationType || (input.operationType !== "compra" && input.operationType !== "venda")) {
    issues.push({
      field: "operationType",
      message: "Tipo de operação inválido. Deve ser 'compra' ou 'venda'.",
    });
  }

  if (!input.scope || (input.scope !== "animal" && input.scope !== "lote")) {
    issues.push({
      field: "scope",
      message: "Escopo inválido. Deve ser 'animal' ou 'lote'.",
    });
  }

  if (input.quantidadeAnimais <= 0) {
    issues.push({
      field: "quantidadeAnimais",
      message: "Quantidade de animais deve ser maior que zero.",
    });
  }

  if (!input.occurredAt || input.occurredAt.trim() === "") {
    issues.push({
      field: "occurredAt",
      message: "Data da operação comercial é obrigatória.",
    });
  }

  if (input.operationType === "venda") {
    if (!input.contraparteId) {
      issues.push({
        field: "contraparteId",
        message: "Venda exige contraparte definida.",
      });
    }

    if (input.valorBruto == null || input.valorBruto <= 0) {
      issues.push({
        field: "valorBruto",
        message: "Venda exige valor de venda maior que zero.",
      });
    }

    if (input.animalStatusSnapshot && input.animalStatusSnapshot !== "ativo") {
      issues.push({
        field: "animalStatusSnapshot",
        message: "Animal vendido, morto ou retirado não pode receber nova venda.",
      });
    }
  }

  return issues;
};
