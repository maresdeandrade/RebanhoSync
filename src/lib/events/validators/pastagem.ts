import type { PastoAvaliacaoEventInput } from "../types";
import type { EventValidationIssue } from "./common";

const MOMENTOS = ["entrada", "saida", "ronda"] as const;
const COBERTURAS = ["excelente", "media", "ruim"] as const;
const INVASORAS = ["nenhuma", "leve", "moderada", "alta"] as const;
const FEZES = ["aneladas", "ressecadas_empilhadas", "liquidas"] as const;
const AGUA = ["limpo", "sujo", "nivel_baixo", "seco"] as const;
const SUPLEMENTO_UNIDADES = ["kg", "sacos"] as const;

const isOneOf = <T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] =>
  typeof value === "string" && allowed.includes(value as T[number]);

export const validatePastagemInput = (
  input: PastoAvaliacaoEventInput,
): EventValidationIssue[] => {
  const issues: EventValidationIssue[] = [];

  if (!input.pastoId) {
    issues.push({
      code: "REQUIRED",
      field: "pastoId",
      message: "Pasto obrigatorio.",
    });
  }

  if (!input.momento) {
    issues.push({
      code: "REQUIRED",
      field: "momento",
      message: "Momento da avaliacao obrigatorio.",
    });
  } else if (!isOneOf(input.momento, MOMENTOS)) {
    issues.push({
      code: "INVALID_ENUM",
      field: "momento",
      message: "Momento da avaliacao invalido.",
    });
  }

  if (input.alturaCm != null && input.alturaCm <= 0) {
    issues.push({
      code: "INVALID_RANGE",
      field: "alturaCm",
      message: "Altura do capim deve ser maior que zero.",
    });
  }

  if (
    input.eccLoteMedio != null &&
    (input.eccLoteMedio < 1 || input.eccLoteMedio > 5)
  ) {
    issues.push({
      code: "INVALID_RANGE",
      field: "eccLoteMedio",
      message: "ECC medio do lote deve estar entre 1 e 5.",
    });
  }

  if (input.coberturaSolo != null && !isOneOf(input.coberturaSolo, COBERTURAS)) {
    issues.push({
      code: "INVALID_ENUM",
      field: "coberturaSolo",
      message: "Cobertura do solo invalida.",
    });
  }

  if (
    input.invasorasNivel != null &&
    !isOneOf(input.invasorasNivel, INVASORAS)
  ) {
    issues.push({
      code: "INVALID_ENUM",
      field: "invasorasNivel",
      message: "Nivel de invasoras invalido.",
    });
  }

  if (input.fezesScore != null && !isOneOf(input.fezesScore, FEZES)) {
    issues.push({
      code: "INVALID_ENUM",
      field: "fezesScore",
      message: "Escore de fezes invalido.",
    });
  }

  if (input.aguaStatus != null && !isOneOf(input.aguaStatus, AGUA)) {
    issues.push({
      code: "INVALID_ENUM",
      field: "aguaStatus",
      message: "Status da agua invalido.",
    });
  }

  if (input.suplementoQuantidade != null && input.suplementoQuantidade < 0) {
    issues.push({
      code: "INVALID_RANGE",
      field: "suplementoQuantidade",
      message: "Quantidade de suplemento deve ser maior ou igual a zero.",
    });
  }

  if (
    input.suplementoUnidade != null &&
    !isOneOf(input.suplementoUnidade, SUPLEMENTO_UNIDADES)
  ) {
    issues.push({
      code: "INVALID_ENUM",
      field: "suplementoUnidade",
      message: "Unidade do suplemento invalida.",
    });
  }

  return issues;
};
