// Independent reference from main@86c802a111c7ef3ecdd23ae2618190a0d36c5be4.
// Original parsers and validation order; only showError/return adapted to a result.
import type { LotEditForm } from "../../types";

type LotEditFormValidation =
  | { error: string }
  | { estoqueMinimoBase: number | null; pontoRessuprimentoBase: number | null };

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalPositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? parsePositiveNumber(trimmed) : null;
}

export function validateBaselineLotEditForm(
  editForm: Pick<
    LotEditForm,
    "insumoNome" | "estoqueMinimoBase" | "pontoRessuprimentoBase"
  >,
): LotEditFormValidation {
  if (!editForm.insumoNome.trim()) {
    return { error: "Nome do insumo e obrigatorio." };
  }
  const estoqueMinimoBase = parseOptionalPositiveNumber(
    editForm.estoqueMinimoBase,
  );
  const pontoRessuprimentoBase = parseOptionalPositiveNumber(
    editForm.pontoRessuprimentoBase,
  );
  if (editForm.estoqueMinimoBase.trim() && estoqueMinimoBase == null) {
    return { error: "Estoque minimo deve ser maior que zero." };
  }
  if (
    editForm.pontoRessuprimentoBase.trim() &&
    pontoRessuprimentoBase == null
  ) {
    return { error: "Ponto de ressuprimento deve ser maior que zero." };
  }
  if (
    estoqueMinimoBase != null &&
    pontoRessuprimentoBase != null &&
    pontoRessuprimentoBase < estoqueMinimoBase
  ) {
    return {
      error:
        "Ponto de ressuprimento deve ser maior ou igual ao estoque minimo.",
    };
  }

  return { estoqueMinimoBase, pontoRessuprimentoBase };
}
