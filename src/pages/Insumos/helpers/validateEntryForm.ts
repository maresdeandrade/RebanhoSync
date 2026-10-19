import { convertPresentationQuantityToBase } from "@/lib/inventory/inventoryContracts";
import type { EntryForm } from "../types";

type EntryFormValidation =
  | { error: string }
  | {
      quantidadePorApresentacao: number;
      quantidadeEntrada: number;
      quantidadeBase: number;
    };

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateEntryForm({
  entryForm,
  entryRequiresVeterinaryProduct,
  noneValue,
}: {
  entryForm: Pick<
    EntryForm,
    | "nome"
    | "produtoVeterinarioId"
    | "quantidadePorApresentacao"
    | "quantidadeEntrada"
  >;
  entryRequiresVeterinaryProduct: boolean;
  noneValue: string;
}): EntryFormValidation {
  if (!entryForm.nome.trim()) {
    return { error: "Nome do insumo e obrigatorio." };
  }
  if (
    entryRequiresVeterinaryProduct &&
    entryForm.produtoVeterinarioId === noneValue
  ) {
    return {
      error:
        "Categoria sanitaria clinica exige produto veterinario catalogado.",
    };
  }

  const quantidadePorApresentacao = parsePositiveNumber(
    entryForm.quantidadePorApresentacao,
  );
  const quantidadeEntrada = parsePositiveNumber(entryForm.quantidadeEntrada);

  if (!quantidadePorApresentacao || !quantidadeEntrada) {
    return {
      error: "Quantidade de entrada e apresentacao devem ser maiores que zero.",
    };
  }

  const quantidadeBase = convertPresentationQuantityToBase({
    presentationQuantity: quantidadeEntrada,
    presentationBaseQuantity: quantidadePorApresentacao,
  });

  return { quantidadePorApresentacao, quantidadeEntrada, quantidadeBase };
}
