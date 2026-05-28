import type { EccEventInput } from "../types";
import type { EventValidationIssue } from "./common";

export const validateEccInput = (
  input: EccEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  const escalaMin = input.escalaMin ?? 1.00;
  const escalaMax = input.escalaMax ?? 5.00;
  const escalaPasso = input.escalaPasso ?? 0.25;
  const ecc = input.ecc;

  if (escalaMin >= escalaMax) {
    issues.push({
      code: "INVALID_RANGE",
      field: "escalaMin",
      message: "Escala mínima deve ser menor que a escala máxima.",
    });
    return issues;
  }

  if (ecc < escalaMin || ecc > escalaMax) {
    issues.push({
      code: "INVALID_RANGE",
      field: "ecc",
      message: `ECC deve estar entre ${escalaMin.toFixed(2)} e ${escalaMax.toFixed(2)}.`,
    });
  }

  // Validar passo com tolerância numérica para evitar erro de ponto flutuante
  const steps = (ecc - escalaMin) / escalaPasso;
  const diff = Math.abs(steps - Math.round(steps));
  if (diff > 1e-9) {
    issues.push({
      code: "INVALID_STEP",
      field: "ecc",
      message: `ECC deve respeitar o passo da escala (${escalaPasso.toFixed(2)}).`,
    });
  }

  return issues;
};
