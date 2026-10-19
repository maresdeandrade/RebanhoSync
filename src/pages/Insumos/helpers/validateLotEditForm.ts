import type { LotEditForm } from "../types";

type LotEditFormValidation =
  | { error: string }
  | { estoqueMinimoBase: number | null; pontoRessuprimentoBase: number | null };

function parseOptionalPositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateLotEditForm(
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
