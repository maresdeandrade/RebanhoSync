import type { SanitarioEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateSanitarioInput = (
  input: SanitarioEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.tipo) {
    issues.push({
      code: "REQUIRED",
      field: "tipo",
      message: "Tipo sanitario obrigatorio.",
    });
  }

  if (!input.produto?.trim()) {
    issues.push({
      code: "REQUIRED",
      field: "produto",
      message: "Produto sanitario obrigatorio.",
    });
  }

  if (input.protocoloItem) {
    if (!input.protocoloItem.id) {
      issues.push({
        code: "REQUIRED",
        field: "protocoloItem.id",
        message: "Item de protocolo invalido.",
      });
    }

    if (input.protocoloItem.intervalDays <= 0) {
      issues.push({
        code: "INVALID_RANGE",
        field: "protocoloItem.intervalDays",
        message: "Intervalo do protocolo deve ser maior que zero.",
      });
    }
  }

  const hasStructuredProduct =
    Boolean(input.produtoRef) ||
    Boolean(input.insumoId) ||
    Boolean(input.insumoRef) ||
    Boolean(input.insumoLoteId);

  if (hasStructuredProduct) {
    if (typeof input.dose !== "number" || !Number.isFinite(input.dose) || input.dose <= 0) {
      issues.push({
        code: "REQUIRED",
        field: "dose",
        message: "Produto sanitario estruturado exige dose maior que zero.",
      });
    }

    if (!input.doseUnidade?.trim()) {
      issues.push({
        code: "REQUIRED",
        field: "doseUnidade",
        message: "Produto sanitario estruturado exige unidade da dose.",
      });
    }

    if (!input.viaAplicacao?.trim()) {
      issues.push({
        code: "REQUIRED",
        field: "viaAplicacao",
        message: "Produto sanitario estruturado exige via de aplicacao.",
      });
    }
  }

  if (input.insumoLoteId) {
    if (!input.insumoId) {
      issues.push({
        code: "REQUIRED",
        field: "insumoId",
        message: "Baixa de estoque sanitario exige insumo associado.",
      });
    }

    if (
      typeof input.quantidadeConsumida !== "number" ||
      !Number.isFinite(input.quantidadeConsumida) ||
      input.quantidadeConsumida <= 0
    ) {
      issues.push({
        code: "REQUIRED",
        field: "quantidadeConsumida",
        message: "Baixa de estoque sanitario exige quantidade maior que zero.",
      });
    }

    if (
      input.loteRef &&
      typeof input.quantidadeConsumida === "number" &&
      input.quantidadeConsumida > input.loteRef.saldo_atual_base
    ) {
      issues.push({
        code: "INVALID_RANGE",
        field: "quantidadeConsumida",
        message: "Baixa de estoque sanitario nao pode deixar saldo negativo.",
      });
    }
  }

  if (input.sanitarioCaso) {
    if (input.sanitarioCaso.action === "link" && !input.sanitarioCaso.id) {
      issues.push({
        code: "REQUIRED",
        field: "sanitarioCaso.id",
        message: "Caso sanitario invalido.",
      });
    }

    if (!input.animalId) {
      issues.push({
        code: "REQUIRED",
        field: "animalId",
        message: "Caso sanitario exige um animal vinculado.",
      });
    }

    if (
      input.sanitarioCaso.action === "open" &&
      input.sanitarioCaso.tipo !== "clinico"
    ) {
      issues.push({
        code: "INVALID_ENUM",
        field: "sanitarioCaso.tipo",
        message: "Registro sanitario operacional so pode abrir caso clinico.",
      });
    }
  }

  return issues;
};
